import { describe, expect, it } from 'vitest';
import { Affine } from '~/lib/geom/affine';
import { insideRing, segmentsCross, type Pt } from '~/lib/geom/crossings';
import { dilate, flatten, footprint, materialArea } from '~/lib/layout/footprint';
import { layoutKey, nest } from '~/lib/layout/nest';
import { packDrawing, piecesOf, realise, type PackOptions } from '~/lib/layout/pack';
import { buildDrawing, optimiseLayout } from '~/lib/preview';
import { defaultsFor, getGenerator, listGenerators } from '~/lib/generators/registry';
import { toBoxesConfig } from '~/lib/params/common';
import { emptyLayerRecord, renderBox, toPathData, type Drawing, type DrawingPart } from '~/lib/render';
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

/** Every subpath of a part that is cut or marked, flattened. */
const linesOf = (p: DrawingPart) =>
  p.paths.filter((x) => x.layer !== 'annotate').flatMap((x) => flatten(x.cmds, Affine.identity(), 0.01));

function toSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Closest approach of two sets of polylines; segments in a grid of buckets so big parts stay quick. */
function clearance(a: Pt[][], b: Pt[][], within: number): number {
  const size = Math.max(within, 5);
  const buckets = new Map<string, [Pt, Pt][]>();
  for (const l of b) {
    for (let i = 1; i < l.length; i++) {
      const s: [Pt, Pt] = [l[i - 1]!, l[i]!];
      const x0 = Math.floor(Math.min(s[0][0], s[1][0]) / size);
      const x1 = Math.floor(Math.max(s[0][0], s[1][0]) / size);
      const y0 = Math.floor(Math.min(s[0][1], s[1][1]) / size);
      const y1 = Math.floor(Math.max(s[0][1], s[1][1]) / size);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const k = `${x},${y}`;
        buckets.set(k, [...(buckets.get(k) ?? []), s]);
      }
    }
  }
  let best = Infinity;
  for (const l of a) {
    for (let i = 1; i < l.length; i++) {
      const p = l[i - 1]!;
      const q = l[i]!;
      const x0 = Math.floor((Math.min(p[0], q[0]) - within) / size);
      const x1 = Math.floor((Math.max(p[0], q[0]) + within) / size);
      const y0 = Math.floor((Math.min(p[1], q[1]) - within) / size);
      const y1 = Math.floor((Math.max(p[1], q[1]) + within) / size);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        for (const [c, d] of buckets.get(`${x},${y}`) ?? []) {
          const dist = segmentsCross(p, q, c, d)
            ? 0
            : Math.min(toSegment(p, c, d), toSegment(q, c, d), toSegment(c, p, q), toSegment(d, p, q));
          best = Math.min(best, dist);
        }
      }
    }
  }
  return best;
}

const closedRings = (lines: Pt[][]) =>
  lines.filter((r) => r.length > 3 && Math.hypot(r[0]![0] - r[r.length - 1]![0], r[0]![1] - r[r.length - 1]![1]) < 1e-3);

/**
 * Pieces on each sheet, as polylines: parts drawn as a move of their own
 * (loose holes) are counted with the part they are cut in.
 */
function piecesBySheet(plain: Drawing, packed: Drawing): Pt[][][][] {
  const n = plain.parts.length;
  const owner = new Map<number, number>();
  piecesOf(plain.parts).forEach((p, k) => p.parts.forEach((i) => owner.set(i, k)));
  return packed.sheets!.map((s) => {
    const byPiece = new Map<string, Pt[][]>();
    for (const i of s.parts) {
      const key = `${Math.floor(i / n)}:${owner.get(i % n)}`;
      byPiece.set(key, [...(byPiece.get(key) ?? []), ...linesOf(packed.parts[i]!)]);
    }
    return [...byPiece.values()].filter((l) => l.length > 0);
  });
}

/** Pairs of pieces closer than `gap`, or one inside the other. */
function clashes(plain: Drawing, packed: Drawing, gap: number): string[] {
  const out: string[] = [];
  piecesBySheet(plain, packed).forEach((pieces, s) => {
    for (let a = 0; a < pieces.length; a++) {
      for (let b = a + 1; b < pieces.length; b++) {
        const pa = pieces[a]!;
        const pb = pieces[b]!;
        const d = clearance(pa, pb, gap);
        if (d < gap - 1e-6) out.push(`sheet ${s + 1}: pieces ${a} and ${b} are ${d.toFixed(3)} mm apart`);
        const inside = (x: Pt[][], y: Pt[][]) => x.some((l) => closedRings(y).some((r) => insideRing(l[0]!, r)));
        if (inside(pa, pb) || inside(pb, pa)) out.push(`sheet ${s + 1}: pieces ${a} and ${b} overlap`);
      }
    }
  });
  return out;
}

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

const SETTINGS = [
  { edge: 5, gap: 2, copies: 1, step: '90' },
  { edge: 12, gap: 7.5, copies: 2, step: '45' },
];

describe.each(
  listGenerators().flatMap((g) => SETTINGS.map((s) => ({ id: g.meta.id, ...s }))),
)('$id × $copies nested onto 300 × 400, $edge mm from the edge, $gap mm apart, turns of $step°', ({ id, edge, gap, copies, step }) => {
  const values: ParamValues = {
    ...defaultsFor(id),
    labels: true,
    reference: 0,
    pack: true,
    sheet_margin: edge,
    pack_gap: gap,
    pack_copies: copies,
    pack_angle_step: step,
  };
  const full = { ...values };
  const plain = renderBox(getGenerator(id).create(full, toBoxesConfig(full)));
  const result = optimiseLayout(id, values, { iterations: 8, seed: 3 })!;
  const packed = buildDrawing(id, values, result);
  const quick = buildDrawing(id, values);
  const n = plain.parts.length;

  it('places every part on exactly one sheet', () => {
    expect(packed.optimised).toBe(true);
    expect(packed.parts).toHaveLength(n * copies);
    const all = packed.sheets!.flatMap((s) => s.parts).sort((a, b) => a - b);
    expect(all).toEqual(packed.parts.map((_, i) => i));
  });

  it('moves parts without changing them', () => {
    packed.parts.forEach((p, i) => {
      const q = plain.parts[i % n]!;
      expect(p.name).toBe(q.name);
      expect(p.paths.map((x) => x.layer)).toEqual(q.paths.map((x) => x.layer));
      expect(p.texts.map((t) => t.text)).toEqual(q.texts.map((t) => t.text));
    });
    // Only the drawing's extent may change: the sheets fill differently.
    expect({ ...packed.stats, widthMm: 0, heightMm: 0 }).toEqual({ ...quick.stats, widthMm: 0, heightMm: 0 });
  });

  it('keeps every cut the gap clear of other parts, and nothing inside another', () => {
    expect(clashes(plain, packed, gap)).toEqual([]);
  });

  it('keeps parts inside their sheet', () => {
    const oversize = new Set(result.arrangement.oversize);
    let k = 0;
    for (const [si, s] of packed.sheets!.entries()) {
      const placed = result.arrangement.sheets[si]!;
      k += placed.length;
      if (placed.some((p) => oversize.has(p.piece))) continue;
      for (const i of s.parts) {
        for (const l of linesOf(packed.parts[i]!)) {
          for (const [x, y] of l) {
            expect(x).toBeGreaterThanOrEqual(s.x + edge - 1e-6);
            expect(y).toBeGreaterThanOrEqual(s.y + edge - 1e-6);
            expect(x).toBeLessThanOrEqual(s.x + s.width - edge + 1e-6);
            expect(y).toBeLessThanOrEqual(s.y + s.height - edge + 1e-6);
          }
        }
      }
    }
    expect(k).toBeGreaterThan(0);
  });

  it('never needs more sheets than packing by box', () => {
    expect(packed.sheets!.length).toBeLessThanOrEqual(quick.sheets!.length);
  });

  it('is deterministic for a seed and a count', () => {
    expect(optimiseLayout(id, values, { iterations: 8, seed: 3 })).toEqual(result);
  });
});
