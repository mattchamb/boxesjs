import { describe, expect, it } from 'vitest';
import { Affine } from '~/lib/geom/affine';
import { dilate, flatten, footprint, materialArea } from '~/lib/layout/footprint';
import { layoutKey, nest, Nester } from '~/lib/layout/nest';
import { packDrawing, planRects, realise, type PackOptions } from '~/lib/layout/pack';
import { buildDrawing, optimiseLayout } from '~/lib/preview';
import { defaultsFor, getGenerator } from '~/lib/generators/registry';
import { toBoxesConfig } from '~/lib/params/common';
import { emptyLayerRecord, renderBox, toPathData, type Drawing, type DrawingPart } from '~/lib/render';
import { clashes } from './helpers/nest';
import type { PathCmd } from '~/lib/geom/context';
import type { ParamValues } from '~/lib/params/schema';

/** A closed outline through `pts`, drawn as one cut path per ring. */
function partOf(name: string, ...rings: [number, number][][]): DrawingPart {
  const paths = rings.map((pts) => {
    const cmds: PathCmd[] = [
      { c: 'M', x: pts[0]![0], y: pts[0]![1] },
      ...pts.slice(1).map(([x, y]) => ({ c: 'L' as const, x, y })),
      { c: 'L', x: pts[0]![0], y: pts[0]![1] },
    ];
    return { layer: 'cut' as const, cmds, d: toPathData(cmds).d, closed: true };
  });
  const xs = rings.flat().map((p) => p[0]);
  const ys = rings.flat().map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { name, bbox: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }, paths, texts: [] };
}

const rect = (x: number, y: number, w: number, h: number): [number, number][] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

function drawingOf(parts: DrawingPart[]): Drawing {
  return {
    parts,
    layers: emptyLayerRecord(() => ''),
    bbox: { x: 0, y: 0, width: 1000, height: 1000 },
    stats: {
      partCount: parts.length,
      widthMm: 1000,
      heightMm: 1000,
      cutLengthMm: 0,
      lengthByLayer: emptyLayerRecord(() => 0),
    },
    warnings: [],
  };
}

/**
 * A comb: a spine `w` wide and 10 deep along the top, with 10 mm teeth hanging
 * 40 mm below it every 30 mm. Two of them, one turned a half turn and slid
 * along by 15, mesh.
 */
function comb(x0: number): [number, number][] {
  const pts: [number, number][] = [
    [0, 0], [100, 0], [100, 50], [90, 50], [90, 10], [70, 10], [70, 50], [60, 50],
    [60, 10], [40, 10], [40, 50], [30, 50], [30, 10], [10, 10], [10, 50], [0, 50],
  ];
  return pts.map(([x, y]) => [x + x0, y]);
}

const opts = (o: Partial<PackOptions> = {}): PackOptions => ({
  sheetWidth: 300,
  sheetHeight: 400,
  margin: 5,
  gap: 2,
  rotate: true,
  ...o,
});

describe('footprint', () => {
  it('covers every cell a square touches, edges included', () => {
    const fp = footprint([partOf('sq', rect(0, 0, 10, 10))], Affine.identity(), 1);
    expect(fp.width).toBe(10);
    expect(fp.rows).toHaveLength(11);
    expect(fp.rows.every((r) => r.length === 2 && r[0] === 0 && r[1] === 10)).toBe(true);
    expect(fp.cells).toBe(121);
  });

  it('counts a hole as covered, so nothing is placed in it', () => {
    const fp = footprint([partOf('frame', rect(0, 0, 40, 40), rect(10, 10, 20, 20))], Affine.identity(), 1);
    expect(fp.cells).toBe(41 * 41);
  });

  it('leaves the bay of a U uncovered', () => {
    const u: [number, number][] = [[0, 0], [10, 0], [10, 30], [30, 30], [30, 0], [40, 0], [40, 40], [0, 40]];
    const fp = footprint([partOf('u', u)], Affine.identity(), 1);
    // Rows inside the bay have two spans, either side of it.
    expect(fp.rows[10]).toEqual([0, 10, 30, 40]);
  });

  it('turns before it measures', () => {
    const fp = footprint([partOf('r', rect(0, 0, 30, 10))], new Affine(0, -1, 0, 1, 0, 0), 1);
    expect(fp.width).toBeCloseTo(10, 9);
    expect(fp.height).toBeCloseTo(30, 9);
  });

  it('grows by k cells every way when dilated', () => {
    // The result starts k cells up and left, so [2, 4] becomes [2 - k, 4 + k] + k.
    const d = dilate([[2, 4]], 2);
    expect(d).toEqual([[2, 8], [2, 8], [2, 8], [2, 8], [2, 8]]);
  });

  it('flattens a curve to within its tolerance', () => {
    // A quarter circle of radius 100, as a cubic.
    const k = 0.5523 * 100;
    const cmds: PathCmd[] = [{ c: 'M', x: 100, y: 0 }, { c: 'C', x1: 100, y1: k, x2: k, y2: 100, x: 0, y: 100 }];
    const [line] = flatten(cmds, Affine.identity(), 0.01);
    for (let i = 1; i < line!.length; i++) {
      const [ax, ay] = line![i - 1]!;
      const [bx, by] = line![i]!;
      const mid = Math.hypot((ax + bx) / 2, (ay + by) / 2);
      expect(100 - mid).toBeLessThan(0.03);
    }
  });

  it('measures material as outline less holes', () => {
    expect(materialArea([partOf('frame', rect(0, 0, 40, 40), rect(10, 10, 20, 20))])).toBeCloseTo(1600 - 400, 6);
  });
});

describe('nest', () => {
  it('meshes two combs that cannot share a sheet as boxes', () => {
    const d = drawingOf([partOf('a', comb(0)), partOf('b', comb(120))]);
    const o = opts({ sheetWidth: 130, sheetHeight: 80 });
    expect(packDrawing(d, o).sheets).toHaveLength(2);
    const r = nest(d, o, { iterations: 0 });
    expect(r.sheets).toBe(1);
    expect(r.baseline).toBe(2);
    expect(clashes(d, realise(d, o, r.arrangement), o.gap)).toEqual([]);
  });

  it('never places a part inside another part’s hole', () => {
    // The frame fills the sheet inside the edge offset; its hole would hold the square.
    const d = drawingOf([partOf('frame', rect(0, 0, 100, 100), rect(10, 10, 80, 80)), partOf('sq', rect(200, 0, 20, 20))]);
    const o = opts({ sheetWidth: 110, sheetHeight: 110 });
    const r = nest(d, o, { iterations: 20 });
    expect(r.sheets).toBe(2);
    expect(clashes(d, realise(d, o, r.arrangement), o.gap)).toEqual([]);
  });

  it('keeps the grain: only half turns when rotating is off', () => {
    const d = drawingOf([partOf('a', comb(0)), partOf('b', comb(120)), partOf('c', rect(300, 0, 30, 80))]);
    const r = nest(d, opts({ rotate: false }), { iterations: 50 });
    expect(r.arrangement.sheets.flat().every((p) => p.angle === 0 || p.angle === 180)).toBe(true);
  });

  it('turns finely only parts that are not near rectangles', () => {
    const l: [number, number][] = [[0, 0], [20, 0], [20, 80], [80, 80], [80, 100], [0, 100]];
    const d = drawingOf([partOf('l', l), partOf('r', rect(200, 0, 50, 30))]);
    const r = nest(d, opts({ angleStep: 15, copies: 3 }), { iterations: 200, seed: 7 });
    const turns = r.arrangement.sheets.flat();
    expect(turns.filter((p) => p.piece % 2 === 1).every((p) => p.angle % 90 === 0)).toBe(true);
    expect(clashes(d, realise(d, opts({ angleStep: 15, copies: 3 }), r.arrangement), 2)).toEqual([]);
  });

  it('settles parts MaxRects left on a later sheet into an earlier sheet’s gaps', () => {
    // The L's box fills the sheet, so MaxRects puts the square on a sheet of
    // its own; it fits in the L's bay.
    const l: [number, number][] = [[0, 0], [100, 0], [100, 30], [30, 30], [30, 100], [0, 100]];
    const d = drawingOf([partOf('l', l), partOf('sq', rect(200, 0, 20, 20))]);
    const o = opts({ sheetWidth: 110, sheetHeight: 110 });
    const rects = planRects(d, o);
    expect(rects.sheets).toHaveLength(2);
    const settled = new Nester(d, o).settle(rects);
    expect(settled.sheets).toHaveLength(1);
    expect(clashes(d, realise(d, o, settled), o.gap)).toEqual([]);
  });

  it('gives a part larger than the sheet a sheet of its own', () => {
    const d = drawingOf([partOf('big', rect(0, 0, 500, 50)), partOf('sq', rect(600, 0, 20, 20))]);
    const r = nest(d, opts(), { iterations: 10 });
    expect(r.arrangement.oversize).toEqual([0]);
    expect(r.sheets).toBe(2);
  });
});

describe('optimised layouts in the drawing', () => {
  const values: ParamValues = { ...defaultsFor('closedbox'), pack: true, pack_copies: 2 };

  it('are used while they fit the settings', () => {
    const r = optimiseLayout('closedbox', values, { iterations: 5 })!;
    const d = buildDrawing('closedbox', values, r);
    expect(d.optimised).toBe(true);
    expect(d.sheets).toHaveLength(r.sheets);
  });

  it('are dropped for MaxRects once the settings move on', () => {
    const r = optimiseLayout('closedbox', values, { iterations: 5 })!;
    const changes: ParamValues[] = [{ pack_gap: 3 }, { x: 120 }, { pack_rotate: false }, { pack_copies: 3 }];
    for (const change of changes) {
      const v = { ...values, ...change };
      const d = buildDrawing('closedbox', v, r);
      expect(d.optimised, JSON.stringify(change)).toBeUndefined();
      expect(d).toEqual(buildDrawing('closedbox', v));
    }
  });

  it('key on geometry and every sheet option', () => {
    const full = { ...defaultsFor('closedbox'), ...values };
    const plain = renderBox(getGenerator('closedbox').create(full, toBoxesConfig(full)));
    const base = layoutKey(plain, opts());
    for (const o of [{ sheetWidth: 301 }, { margin: 4 }, { gap: 1 }, { rotate: false }, { angleStep: 45 }, { copies: 2 }]) {
      expect(layoutKey(plain, opts(o)), JSON.stringify(o)).not.toBe(base);
    }
  });
});
