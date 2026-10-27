/**
 * Packing the parts of a finished drawing onto stock sheets.
 *
 * boxes.py lays parts out in one long strip that seldom matches the sheet they
 * are cut from, so the parts end up re-laid by hand in LightBurn. This does
 * that instead: it moves whole parts, rotated by a quarter turn when that is
 * allowed, onto as few sheets as it can, opening another sheet when they do
 * not fit on one.
 *
 * It packs bounding boxes, not outlines. Box parts are mostly walls and plates,
 * close enough to rectangles that true-shape nesting would gain little, and
 * rectangles are cheap enough to pack on every preview.
 *
 * It runs on the finished `Drawing`, after the engine, so the geometry itself
 * — and its match with boxes.py — is untouched; only where each part sits
 * changes.
 */
import { Affine } from '../geom/affine';
import { LAYERS } from '../geom/colors';
import type { PathCmd } from '../geom/context';
import {
  emptyLayerRecord,
  toPathData,
  type BBox,
  type Drawing,
  type DrawingPart,
  type Sheet,
} from '../render';

export interface PackOptions {
  sheetWidth: number;
  sheetHeight: number;
  /** Clear border kept along every edge of a sheet, to the cut line. */
  margin: number;
  /** Clear space between neighbouring parts, cut line to cut line. */
  gap: number;
  /** Allow quarter turns. Off keeps every part in the grain direction it was designed in. */
  rotate: boolean;
  /** How many of the design to cut, packed together so copies share sheets. */
  copies?: number;
}

/** Space between sheets where they sit side by side in one drawing. */
export const SHEET_GAP = 20;

/** Slack for floating-point sizes that fit exactly. */
const FIT_EPS = 1e-6;

/** Parts that have to move together, and the box round all of them. */
interface Piece {
  parts: number[];
  bbox: BBox;
}

const contains = (outer: BBox, inner: BBox) =>
  inner.x >= outer.x - 0.01 &&
  inner.y >= outer.y - 0.01 &&
  inner.x + inner.width <= outer.x + outer.width + 0.01 &&
  inner.y + inner.height <= outer.y + outer.height + 0.01;

function union(a: BBox, b: BBox): BBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * Group parts into pieces that can be moved independently.
 *
 * A part with no outer cut is not a piece of material: it is holes or marking
 * that a generator drew in a `move` of its own, on top of the part they belong
 * to (WallStackableBin's slots are drawn this way). It travels with the
 * smallest cut part that contains it.
 */
function piecesOf(parts: DrawingPart[]): Piece[] {
  const hasCut = parts.map((p) => p.paths.some((x) => x.layer === 'cut'));
  const owner = parts.map((_, i) => i);

  parts.forEach((p, i) => {
    if (hasCut[i] || p.paths.length === 0) return;
    if (p.paths.every((x) => x.layer === 'annotate')) return;
    let best = -1;
    parts.forEach((q, j) => {
      if (!hasCut[j] || !contains(q.bbox, p.bbox)) return;
      if (best < 0 || q.bbox.width * q.bbox.height < parts[best]!.bbox.width * parts[best]!.bbox.height) {
        best = j;
      }
    });
    if (best >= 0) owner[i] = best;
  });

  const byOwner = new Map<number, Piece>();
  parts.forEach((p, i) => {
    const o = owner[i]!;
    const piece = byOwner.get(o);
    if (piece) {
      piece.parts.push(i);
      piece.bbox = union(piece.bbox, p.bbox);
    } else {
      byOwner.set(o, { parts: [i], bbox: { ...p.bbox } });
    }
  });
  return [...byOwner.values()];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Placement {
  piece: number;
  x: number;
  y: number;
  rotated: boolean;
}

/** One sheet's free space, as MaxRects keeps it: every maximal empty rectangle. */
class Bin {
  free: Rect[];
  placed: Placement[] = [];

  constructor(w: number, h: number) {
    this.free = [{ x: 0, y: 0, w, h }];
  }

  /** Best short-side fit, tie-broken by long side, then top-left first. */
  find(w: number, h: number): (Rect & { score: [number, number, number, number] }) | null {
    let best: (Rect & { score: [number, number, number, number] }) | null = null;
    for (const f of this.free) {
      if (w > f.w + FIT_EPS || h > f.h + FIT_EPS) continue;
      const dw = f.w - w;
      const dh = f.h - h;
      const score: [number, number, number, number] = [Math.min(dw, dh), Math.max(dw, dh), f.y, f.x];
      if (!best || lexLess(score, best.score)) best = { x: f.x, y: f.y, w, h, score };
    }
    return best;
  }

  place(r: Rect): void {
    const next: Rect[] = [];
    for (const f of this.free) {
      if (
        r.x >= f.x + f.w - FIT_EPS ||
        r.x + r.w <= f.x + FIT_EPS ||
        r.y >= f.y + f.h - FIT_EPS ||
        r.y + r.h <= f.y + FIT_EPS
      ) {
        next.push(f);
        continue;
      }
      if (r.x > f.x + FIT_EPS) next.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
      if (r.x + r.w < f.x + f.w - FIT_EPS) {
        next.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - (r.x + r.w), h: f.h });
      }
      if (r.y > f.y + FIT_EPS) next.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
      if (r.y + r.h < f.y + f.h - FIT_EPS) {
        next.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - (r.y + r.h) });
      }
    }
    // Drop every rectangle wholly inside another; they add nothing but work.
    this.free = next.filter(
      (a, i) =>
        !next.some(
          (b, j) =>
            j !== i &&
            a.x >= b.x - FIT_EPS &&
            a.y >= b.y - FIT_EPS &&
            a.x + a.w <= b.x + b.w + FIT_EPS &&
            a.y + a.h <= b.y + b.h + FIT_EPS &&
            // Of two identical rectangles, keep the first.
            (j < i || a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h),
        ),
    );
  }
}

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]! - b[i]!) > FIT_EPS) return a[i]! < b[i]!;
  }
  return false;
}

interface Item {
  piece: number;
  w: number;
  h: number;
}

interface Attempt {
  bins: Bin[];
  /** Pieces too large for an empty sheet, each given a sheet of its own. */
  oversize: Set<number>;
}

function attempt(items: Item[], binW: number, binH: number, rotate: boolean): Attempt {
  const bins: Bin[] = [];
  const oversize = new Set<number>();

  const tryBin = (bin: Bin, it: Item): boolean => {
    let best = bin.find(it.w, it.h);
    let rotated = false;
    if (rotate && Math.abs(it.w - it.h) > FIT_EPS) {
      const turned = bin.find(it.h, it.w);
      if (turned && (!best || lexLess(turned.score, best.score))) {
        best = turned;
        rotated = true;
      }
    }
    if (!best) return false;
    bin.place(best);
    bin.placed.push({ piece: it.piece, x: best.x, y: best.y, rotated });
    return true;
  };

  for (const it of items) {
    // First fit across sheets, so the early sheets fill up and whatever space
    // is left over ends up on the last one.
    if (bins.some((b) => b.free.length > 0 && tryBin(b, it))) continue;
    const bin = new Bin(binW, binH);
    bins.push(bin);
    if (tryBin(bin, it)) continue;

    // Larger than a whole sheet: it gets one to itself, turned whichever way
    // overhangs least, and nothing else is packed round it.
    const over = (w: number, h: number) => Math.max(0, w - binW) + Math.max(0, h - binH);
    const rotated = rotate && over(it.h, it.w) < over(it.w, it.h);
    bin.free = [];
    bin.placed.push({ piece: it.piece, x: 0, y: 0, rotated });
    oversize.add(it.piece);
  }
  return { bins, oversize };
}

/** Orders worth trying; none wins on every drawing. All descending. */
const ORDERS: ((i: Item) => number)[] = [
  (i) => i.w * i.h,
  (i) => Math.max(i.w, i.h),
  (i) => i.h,
  (i) => i.w,
  (i) => i.w + i.h,
];

function mapCmd(c: PathCmd, m: Affine): PathCmd {
  const [x, y] = m.apply(c.x, c.y);
  if (c.c === 'C') {
    const [x1, y1] = m.apply(c.x1, c.y1);
    const [x2, y2] = m.apply(c.x2, c.y2);
    return { c: 'C', x, y, x1, y1, x2, y2 };
  }
  if (c.c === 'T') return { ...c, x, y, m: m.mul(c.m) };
  return { c: c.c, x, y };
}

function mapBBox(b: BBox, m: Affine): BBox {
  const pts = [
    m.apply(b.x, b.y),
    m.apply(b.x + b.width, b.y),
    m.apply(b.x, b.y + b.height),
    m.apply(b.x + b.width, b.y + b.height),
  ];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** A part moved by `m`: geometry, labels and box together. */
export function transformPart(part: DrawingPart, m: Affine): DrawingPart {
  return {
    name: part.name,
    bbox: mapBBox(part.bbox, m),
    paths: part.paths.map((p) => {
      const cmds = p.cmds.map((c) => mapCmd(c, m));
      return { ...p, cmds, d: toPathData(cmds).d };
    }),
    texts: part.texts.map((t) => ({ ...t, matrix: m.mul(t.matrix) })),
  };
}

/** A quarter turn, exact rather than through cos(90°). */
const QUARTER_TURN = new Affine(0, -1, 0, 1, 0, 0);

/** Where every piece goes, before anything is moved. */
interface Plan {
  /** The design's pieces, once. */
  once: Piece[];
  /** Every copy's pieces, indexing into `source`. */
  pieces: Piece[];
  /** The design's parts, once per copy. */
  source: DrawingPart[];
  best: Attempt;
}

function plan(drawing: Drawing, o: PackOptions, once = piecesOf(drawing.parts)): Plan {
  const copies = Math.max(1, Math.round(o.copies ?? 1));
  const n = drawing.parts.length;
  // Copies are made piece by piece, from one grouping of the original: every
  // copy starts out in the same place, so grouping the copied parts would hand
  // all of the copies' loose holes to the first copy's part.
  const source = Array.from({ length: copies }, () => drawing.parts).flat();
  const pieces = Array.from({ length: copies }, (_, k) =>
    once.map((p) => ({ parts: p.parts.map((i) => i + k * n), bbox: p.bbox })),
  ).flat();

  // Padding every part and the usable area by one gap lets parts sit flush in
  // the packer while staying a gap apart on the sheet, and lets the last part
  // in a row reach the margin.
  const binW = o.sheetWidth - 2 * o.margin + o.gap;
  const binH = o.sheetHeight - 2 * o.margin + o.gap;
  const items: Item[] = pieces.map((p, i) => ({ piece: i, w: p.bbox.width + o.gap, h: p.bbox.height + o.gap }));

  let best: Attempt | null = null;
  let bestScore: number[] = [];
  for (const rotate of o.rotate ? [true, false] : [false]) {
    for (const key of ORDERS) {
      // Stable sort, so ties keep the generator's own order.
      const sorted = items.map((it, i) => ({ it, i })).sort((a, b) => key(b.it) - key(a.it) || a.i - b.i);
      const a = attempt(sorted.map((s) => s.it), binW, binH, rotate);
      // Fewest sheets; then the fullest early sheets, which leaves the most
      // usable offcut on the last one.
      const fill = a.bins.map((b) => b.placed.reduce((s, p) => s + items[p.piece]!.w * items[p.piece]!.h, 0));
      const score = [a.bins.length, ...fill.map((f) => -f)];
      if (!best || lexLess(score, bestScore)) {
        best = a;
        bestScore = score;
      }
    }
  }

  return { once, pieces, source, best: best! };
}

/** Lay the drawing's parts out on as few sheets as possible. */
export function packDrawing(drawing: Drawing, o: PackOptions): Drawing {
  const copies = Math.max(1, Math.round(o.copies ?? 1));
  const { once, pieces, source, best } = plan(drawing, o);
  const warnings = [...drawing.warnings];
  /** Sheets each oversize piece of the design hangs off, numbered from 1. */
  const overhangs = new Map<number, number[]>();

  const parts = source.slice();
  const sheets: Sheet[] = [];
  let x0 = 0;
  let height = 0;

  for (const bin of best.bins) {
    const ids: number[] = [];
    let right = o.sheetWidth;
    let bottom = o.sheetHeight;
    let area = 0;

    for (const pl of bin.placed) {
      const piece = pieces[pl.piece]!;
      const b = piece.bbox;
      const tx = x0 + o.margin + pl.x;
      const ty = o.margin + pl.y;
      const m = pl.rotated
        ? Affine.translation(tx + b.y + b.height, ty - b.x).mul(QUARTER_TURN)
        : Affine.translation(tx - b.x, ty - b.y);
      for (const i of piece.parts) parts[i] = transformPart(source[i]!, m);
      ids.push(...piece.parts);
      area += b.width * b.height;

      const [w, h] = pl.rotated ? [b.height, b.width] : [b.width, b.height];
      right = Math.max(right, o.margin + pl.x + w);
      bottom = Math.max(bottom, o.margin + pl.y + h);

      if (best.oversize.has(pl.piece)) {
        const key = pl.piece % once.length;
        overhangs.set(key, [...(overhangs.get(key) ?? []), sheets.length + 1]);
      }
    }

    ids.sort((a, b) => a - b);
    sheets.push({
      x: x0,
      y: 0,
      width: o.sheetWidth,
      height: o.sheetHeight,
      parts: ids,
      used: area / (o.sheetWidth * o.sheetHeight),
    });
    // A part hanging off its sheet must not run into the next one.
    x0 += right + SHEET_GAP;
    height = Math.max(height, bottom);
  }

  // One warning per part of the design, however many copies hang off.
  for (const [key, on] of [...overhangs.entries()].sort((a, b) => a[0] - b[0])) {
    const piece = once[key]!;
    const b = piece.bbox;
    const name = piece.parts.map((i) => drawing.parts[i]!.name).find(Boolean) || 'A part';
    on.sort((x, y) => x - y);
    const where = on.length === 1 ? `sheet ${on[0]}` : `sheets ${on.slice(0, -1).join(', ')} and ${on[on.length - 1]}`;
    warnings.push({
      param: 'sheet_width',
      message:
        `${name} (${b.width.toFixed(0)} × ${b.height.toFixed(0)} mm) does not fit on a ` +
        `${o.sheetWidth} × ${o.sheetHeight} mm sheet inside the edge offset, so it hangs off ${where}.`,
    });
  }

  const chunks = emptyLayerRecord<string[]>(() => []);
  for (const p of parts) for (const path of p.paths) chunks[path.layer].push(path.d);
  const layers = emptyLayerRecord<string>(() => '');
  for (const l of LAYERS) layers[l] = chunks[l].join(' ');

  const width = Math.max(0, x0 - SHEET_GAP);
  return {
    parts,
    layers,
    bbox: { x: 0, y: 0, width, height },
    stats: {
      partCount: drawing.stats.partCount * copies,
      widthMm: width,
      heightMm: height,
      cutLengthMm: drawing.stats.cutLengthMm * copies,
      lengthByLayer: Object.fromEntries(
        LAYERS.map((l) => [l, drawing.stats.lengthByLayer[l] * copies]),
      ) as Drawing['stats']['lengthByLayer'],
    },
    warnings,
    sheets,
  };
}

export interface CopiesSuggestion {
  copies: number;
  sheets: number;
  /** Fraction of those sheets covered by the parts' bounding boxes. */
  used: number;
  /** What the copies asked for in the options come to, for comparison. */
  current: { copies: number; sheets: number };
}

/**
 * The number of copies that wastes the least stock, counting a partly used
 * last sheet as waste: the fewest sheets per copy, up to `max` copies.
 *
 * The best rate usually comes round again at multiples (3, 6, 9 …), so of the
 * counts that reach it, this picks the smallest no fewer than were asked for —
 * asking for four is taken as needing four. Returns null when the copies
 * asked for are already as good as any.
 */
export function bestCopies(drawing: Drawing, o: PackOptions, max: number): CopiesSuggestion | null {
  const once = piecesOf(drawing.parts);
  if (once.length === 0) return null;
  const asked = Math.max(1, Math.round(o.copies ?? 1));
  const sheetsFor = (copies: number) => plan(drawing, { ...o, copies }, once).best.bins.length;

  // No packing beats the stock's area, so a count whose lower bound is already
  // worse than the best rate found cannot be the answer and is never packed.
  const area = once.reduce((s, p) => s + p.bbox.width * p.bbox.height, 0) / (o.sheetWidth * o.sheetHeight);

  // Rates compared as fractions, sheets × copies, so equal rates are equal.
  const results: { copies: number; sheets: number }[] = [];
  let best: { copies: number; sheets: number } | null = null;
  for (let copies = 1; copies <= Math.max(max, asked); copies++) {
    const bound = Math.ceil(copies * area - 1e-9);
    if (best && bound * best.copies > best.sheets * copies) continue;
    const sheets = sheetsFor(copies);
    results.push({ copies, sheets });
    if (!best || sheets * best.copies < best.sheets * copies) best = { copies, sheets };
  }

  const current = results.find((r) => r.copies === asked) ?? { copies: asked, sheets: sheetsFor(asked) };
  if (current.sheets * best!.copies <= best!.sheets * current.copies) return null;

  const tied = results.filter((r) => r.sheets * best!.copies === best!.sheets * r.copies);
  const pick = tied.find((r) => r.copies >= asked) ?? tied[0]!;
  return {
    copies: pick.copies,
    sheets: pick.sheets,
    used: (area * pick.copies) / pick.sheets,
    current,
  };
}
