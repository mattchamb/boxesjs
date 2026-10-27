import { describe, expect, it } from 'vitest';
import { packDrawing, SHEET_GAP, type PackOptions } from '~/lib/layout/pack';
import { buildDrawing, suggestCopies } from '~/lib/preview';
import { decodeParams } from '~/lib/permalink';
import { defaultsFor, listGenerators } from '~/lib/generators/registry';
import { emptyLayerRecord, toPathData, type BBox, type Drawing, type DrawingPart } from '~/lib/render';
import type { Layer } from '~/lib/geom/colors';
import type { PathCmd } from '~/lib/geom/context';
import type { ParamValues } from '~/lib/params/schema';

function rectPart(name: string, x: number, y: number, w: number, h: number, layer: Layer = 'cut'): DrawingPart {
  const cmds: PathCmd[] = [
    { c: 'M', x, y },
    { c: 'L', x: x + w, y },
    { c: 'L', x: x + w, y: y + h },
    { c: 'L', x, y: y + h },
    { c: 'L', x, y },
  ];
  return {
    name,
    bbox: { x, y, width: w, height: h },
    paths: [{ layer, cmds, d: toPathData(cmds).d, closed: true }],
    texts: [],
  };
}

/** A drawing of parts laid in a row, the way boxes.py would leave them. */
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

function row(sizes: [number, number][]): DrawingPart[] {
  let x = 0;
  return sizes.map(([w, h], i) => {
    const p = rectPart(`p${i}`, x, 0, w, h);
    x += w + 10;
    return p;
  });
}

const opts = (o: Partial<PackOptions> = {}): PackOptions => ({
  sheetWidth: 300,
  sheetHeight: 400,
  margin: 5,
  gap: 2,
  rotate: true,
  ...o,
});

/** Sum of segment lengths, which no rigid move changes. */
function length(p: DrawingPart): number {
  let total = 0;
  for (const path of p.paths) {
    let x = 0;
    let y = 0;
    for (const c of path.cmds) {
      if (c.c !== 'M') total += Math.hypot(c.x - x, c.y - y);
      x = c.x;
      y = c.y;
    }
  }
  return total;
}

const apart = (a: BBox, b: BBox, gap: number) =>
  a.x + a.width + gap <= b.x + 1e-6 ||
  b.x + b.width + gap <= a.x + 1e-6 ||
  a.y + a.height + gap <= b.y + 1e-6 ||
  b.y + b.height + gap <= a.y + 1e-6;

describe('copies', () => {
  it('share sheets rather than each taking their own', () => {
    // One default wall uses under a tenth of a 300 × 400 sheet.
    const base = { ...defaultsFor('rectangularwall'), pack: true };
    expect(buildDrawing('rectangularwall', base).sheets).toHaveLength(1);
    const five = buildDrawing('rectangularwall', { ...base, pack_copies: 5 });
    expect(five.parts).toHaveLength(5);
    expect(five.sheets).toHaveLength(1);
  });

  it('never need more sheets than packing each copy alone', () => {
    for (const id of ['storagerack', 'typetray', 'closedbox']) {
      const base = { ...defaultsFor(id), pack: true };
      const one = buildDrawing(id, base).sheets!.length;
      expect(buildDrawing(id, { ...base, pack_copies: 3 }).sheets!.length, id).toBeLessThanOrEqual(3 * one);
    }
  });

  it('keep loose holes with their own copy of the part', () => {
    // WallStackableBin draws a side's slots in a move of their own, on top of it.
    const v = { ...defaultsFor('wallstackablebin'), pack: true, pack_copies: 3 };
    const plain = buildDrawing('wallstackablebin', { ...v, pack: false });
    const packed = buildDrawing('wallstackablebin', v);
    const n = plain.parts.length;
    const loose = plain.parts.flatMap((p, i) => (p.paths.some((x) => x.layer === 'cut') ? [] : [i]));
    expect(loose.length).toBeGreaterThan(0);
    for (const i of loose) {
      const host = plain.parts.findIndex(
        (q, j) => j !== i && q.paths.some((x) => x.layer === 'cut') && within(p(plain, i), p(plain, j)),
      );
      for (let k = 0; k < 3; k++) {
        expect(within(p(packed, i + k * n), p(packed, host + k * n)), `copy ${k + 1}`).toBe(true);
      }
    }
  });

  it('warn once about a part too large for the sheet, naming every sheet it hangs off', () => {
    const v = { ...defaultsFor('displayshelf'), pack: true };
    const one = buildDrawing('displayshelf', v).warnings.filter((w) => w.param === 'sheet_width');
    const two = buildDrawing('displayshelf', { ...v, pack_copies: 2 }).warnings.filter((w) => w.param === 'sheet_width');
    expect(one.length).toBeGreaterThan(0);
    expect(two).toHaveLength(one.length);
    expect(two[0]!.message).toMatch(/hangs off sheets \d+ and \d+\./);
  });
});

describe('suggested copies', () => {
  // Settings from trays and racks cut on 300 × 400 stock.
  const tray = decodeParams('typetray', 'sx=78*3&sy=280&h=102&outside=0&bottom_edge=F&fingerholes=front&thickness=3.3&burn=0.08&pack=1');
  const rack = decodeParams('storagerack', 'x=249&depth=289&sh=107*2&rail=45&outside=0&bottom_edge=s&top_edge=S&thickness=3.3&burn=0.08&pack=1');

  it('finds the count that wastes least', () => {
    const hint = suggestCopies('typetray', tray)!;
    expect(hint).toMatchObject({ copies: 3, sheets: 8, current: { copies: 1, sheets: 3 } });
    expect(hint.used).toBeGreaterThan(0.7);
    // And that is what packing that many actually gives.
    expect(buildDrawing('typetray', { ...tray, pack_copies: 3 }).sheets).toHaveLength(8);
  });

  it('takes the count asked for as a minimum', () => {
    expect(suggestCopies('typetray', { ...tray, pack_copies: 4 })).toMatchObject({ copies: 6, sheets: 16 });
  });

  it('says nothing when the count asked for is already as good as any', () => {
    expect(suggestCopies('typetray', { ...tray, pack_copies: 3 })).toBeNull();
    expect(suggestCopies('storagerack', rack)).toBeNull();
    expect(suggestCopies('typetray', { ...tray, pack: false })).toBeNull();
  });

  it('agrees with packing every count, despite skipping the hopeless ones', () => {
    for (const id of ['typetray', 'rectangularwall', 'cardbox', 'trayinsert']) {
      const base: ParamValues = { ...defaultsFor(id), pack: true };
      const all = Array.from({ length: 20 }, (_, i) => ({
        copies: i + 1,
        sheets: buildDrawing(id, { ...base, pack_copies: i + 1 }).sheets!.length,
      }));
      const rate = Math.min(...all.map((r) => r.sheets / r.copies));
      const hint = suggestCopies(id, base);
      if (all[0]!.sheets <= rate + 1e-9) {
        expect(hint, id).toBeNull();
      } else {
        expect(hint, id).not.toBeNull();
        expect(hint!.sheets / hint!.copies, id).toBeCloseTo(rate, 9);
        expect(hint!.copies, id).toBe(all.find((r) => Math.abs(r.sheets / r.copies - rate) < 1e-9)!.copies);
      }
    }
  });
});

const p = (d: Drawing, i: number) => d.parts[i]!.bbox;
const within = (inner: BBox, outer: BBox) =>
  inner.x >= outer.x - 0.01 &&
  inner.y >= outer.y - 0.01 &&
  inner.x + inner.width <= outer.x + outer.width + 0.01 &&
  inner.y + inner.height <= outer.y + outer.height + 0.01;

describe('packDrawing', () => {
  it('fits parts that fill a sheet exactly', () => {
    // Four quarters of the usable area, a gap apart.
    const w = (290 - 2) / 2;
    const h = (390 - 2) / 2;
    const packed = packDrawing(drawingOf(row([[w, h], [w, h], [w, h], [w, h]])), opts());
    expect(packed.sheets).toHaveLength(1);
    expect(packed.sheets![0]!.parts).toEqual([0, 1, 2, 3]);
  });

  it('turns a part that only fits turned', () => {
    const packed = packDrawing(drawingOf(row([[380, 100]])), opts());
    expect(packed.sheets).toHaveLength(1);
    expect(packed.parts[0]!.bbox.width).toBeCloseTo(100);
    expect(packed.parts[0]!.bbox.height).toBeCloseTo(380);
    expect(packed.warnings).toEqual([]);
  });

  it('keeps the designed orientation when rotation is off', () => {
    const sizes: [number, number][] = [[200, 50], [120, 30], [60, 250], [140, 140]];
    const packed = packDrawing(drawingOf(row(sizes)), opts({ rotate: false }));
    packed.parts.forEach((p, i) => {
      expect(p.bbox.width).toBeCloseTo(sizes[i]![0]);
      expect(p.bbox.height).toBeCloseTo(sizes[i]![1]);
    });
  });

  it('gives a part larger than the sheet a sheet of its own, and says so', () => {
    const packed = packDrawing(drawingOf(row([[500, 100], [50, 50]])), opts());
    expect(packed.sheets).toHaveLength(2);
    const big = packed.sheets!.find((s) => s.parts.includes(0))!;
    expect(big.parts).toEqual([0]);
    expect(packed.warnings).toHaveLength(1);
    expect(packed.warnings[0]!.message).toContain('p0');
    // The overhang must not run into the next sheet.
    const next = packed.sheets!.find((s) => s !== big)!;
    expect(packed.parts[0]!.bbox.x + packed.parts[0]!.bbox.width).toBeLessThan(next.x);
  });

  it('opens another sheet when one is full', () => {
    const packed = packDrawing(drawingOf(row(Array.from({ length: 7 }, () => [140, 120] as [number, number]))), opts());
    expect(packed.sheets).toHaveLength(2);
    expect(packed.sheets![0]!.parts).toHaveLength(6);
    expect(packed.sheets![1]!.x).toBeCloseTo(300 + SHEET_GAP);
    expect(packed.sheets![0]!.used).toBeGreaterThan(packed.sheets![1]!.used);
  });

  it('moves holes drawn as a part of their own with the part they are cut in', () => {
    const outer = rectPart('side', 0, 0, 100, 60);
    const slots = rectPart('slots', 10, 20, 80, 3, 'inner');
    const other = rectPart('other', 120, 0, 200, 200);
    const packed = packDrawing(drawingOf([outer, slots, other]), opts());
    const dx = packed.parts[1]!.bbox.x - packed.parts[0]!.bbox.x;
    const dy = packed.parts[1]!.bbox.y - packed.parts[0]!.bbox.y;
    // A quarter turn takes the slot's top-left (10, 20) in a 60 mm tall part to (60 - 23, 10).
    const rotated = packed.parts[0]!.bbox.width < packed.parts[0]!.bbox.height;
    const [ex, ey] = rotated ? [37, 10] : [10, 20];
    expect(dx).toBeCloseTo(ex);
    expect(dy).toBeCloseTo(ey);
  });
});

/** The defaults, and settings far enough from them to show they are used. */
const OFFSETS = [
  { edge: 5, gap: 2, copies: 1 },
  { edge: 12, gap: 7.5, copies: 3 },
];

describe.each(
  listGenerators().flatMap((g) => OFFSETS.map((o) => ({ id: g.meta.id, ...o }))),
)('$id × $copies packed onto 300 × 400, $edge mm from the edge, $gap mm apart', ({ id, edge, gap, copies }) => {
  const values: ParamValues = { ...defaultsFor(id), labels: true, reference: 0 };
  const plain = buildDrawing(id, values);
  const settings = { ...values, pack: true, sheet_margin: edge, pack_gap: gap, pack_copies: copies };
  const packed = buildDrawing(id, settings);
  const sheets = packed.sheets!;
  const n = plain.parts.length;

  it('places every part on exactly one sheet', () => {
    expect(packed.parts).toHaveLength(n * copies);
    const all = sheets.flatMap((s) => s.parts).sort((a, b) => a - b);
    expect(all).toEqual(packed.parts.map((_, i) => i));
  });

  it('moves parts without changing them', () => {
    packed.parts.forEach((p, i) => {
      const q = plain.parts[i % n]!;
      expect(p.name).toBe(q.name);
      expect(p.paths.map((x) => x.layer)).toEqual(q.paths.map((x) => x.layer));
      expect(length(p)).toBeCloseTo(length(q), 6);
      expect(p.texts.map((t) => t.text)).toEqual(q.texts.map((t) => t.text));
    });
    for (const [layer, mm] of Object.entries(plain.stats.lengthByLayer)) {
      expect(packed.stats.lengthByLayer[layer as Layer]).toBeCloseTo(mm * copies, 6);
    }
    expect(packed.stats.partCount).toBe(plain.stats.partCount * copies);
  });

  it('keeps parts apart and inside their sheet', () => {
    const oversize = packed.warnings.length - plain.warnings.length;
    for (const s of sheets) {
      const cut = s.parts.filter((i) => packed.parts[i]!.paths.some((x) => x.layer === 'cut'));
      for (let a = 0; a < cut.length; a++) {
        for (let b = a + 1; b < cut.length; b++) {
          const pa = packed.parts[cut[a]!]!;
          const pb = packed.parts[cut[b]!]!;
          expect(apart(pa.bbox, pb.bbox, gap - 1e-6), `${pa.name} / ${pb.name}`).toBe(true);
        }
      }
      if (oversize > 0 && s.parts.length === 1) continue;
      for (const i of s.parts) {
        const b = packed.parts[i]!.bbox;
        expect(b.x).toBeGreaterThanOrEqual(s.x + edge - 1e-6);
        expect(b.y).toBeGreaterThanOrEqual(s.y + edge - 1e-6);
        expect(b.x + b.width).toBeLessThanOrEqual(s.x + s.width - edge + 1e-6);
        expect(b.y + b.height).toBeLessThanOrEqual(s.y + s.height - edge + 1e-6);
      }
    }
  });

  it('is deterministic', () => {
    expect(buildDrawing(id, settings)).toEqual(packed);
  });
});
