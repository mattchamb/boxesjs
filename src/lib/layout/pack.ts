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
import { drawnBox, materialArea } from './footprint';
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
  /**
   * Finest turn the nester tries, in degrees, where rotating is allowed. Only
   * Optimise uses it; MaxRects turns by quarter turns at most.
   */
  angleStep?: number;
  /** How many of the design to cut, packed together so copies share sheets. */
  copies?: number;
}

/** Space between sheets where they sit side by side in one drawing. */
export const SHEET_GAP = 20;

/** Slack for floating-point sizes that fit exactly. */
const FIT_EPS = 1e-6;

/** Parts that have to move together, and the box round all of them. */
export interface Piece {
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
export function piecesOf(parts: DrawingPart[]): Piece[] {
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
    // Packed by what is drawn, curves and all, not by the part's own box.
    const box = drawnBox([p]) ?? p.bbox;
    if (piece) {
      piece.parts.push(i);
      piece.bbox = union(piece.bbox, box);
    } else {
      byOwner.set(o, { parts: [i], bbox: { ...box } });
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

interface BinPlacement {
  piece: number;
  x: number;
  y: number;
  rotated: boolean;
}

/** One sheet's free space, as MaxRects keeps it: every maximal empty rectangle. */
class Bin {
  free: Rect[];
  placed: BinPlacement[] = [];

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
export const ORDERS: ((i: { w: number; h: number }) => number)[] = [
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

/**
 * The box round a part's drawn points, the way `renderBox` measures it. Turned
 * by anything but a quarter turn, the old box's corners would overstate it.
 */
function drawnBBox(paths: DrawingPart['paths']): BBox | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of paths) {
    // A trailing move-to draws nothing.
    const n = p.cmds.length && p.cmds[p.cmds.length - 1]!.c === 'M' ? p.cmds.length - 1 : p.cmds.length;
    for (let i = 0; i < n; i++) {
      const c = p.cmds[i]!;
      x0 = Math.min(x0, c.x);
      y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x);
      y1 = Math.max(y1, c.y);
    }
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** A part moved by `m`: geometry, labels and box together. */
export function transformPart(part: DrawingPart, m: Affine): DrawingPart {
  const paths = part.paths.map((p) => {
    const cmds = p.cmds.map((c) => mapCmd(c, m));
    return { ...p, cmds, d: toPathData(cmds).d };
  });
  const square = (m.b === 0 && m.d === 0) || (m.a === 0 && m.e === 0);
  return {
    name: part.name,
    bbox: (!square && drawnBBox(paths)) || mapBBox(part.bbox, m),
    paths,
    texts: part.texts.map((t) => ({ ...t, matrix: m.mul(t.matrix) })),
  };
}

/** A quarter turn, exact rather than through cos(90°). */
const QUARTER_TURN = new Affine(0, -1, 0, 1, 0, 0);

/** A turn by `angle` degrees; exact for quarter turns, so they move parts without rounding. */
export function turn(angle: number): Affine {
  switch (((angle % 360) + 360) % 360) {
    case 0:
      return Affine.identity();
    case 90:
      return QUARTER_TURN;
    case 180:
      return new Affine(-1, 0, 0, 0, -1, 0);
    case 270:
      return new Affine(0, 1, 0, -1, 0, 0);
    default:
      return Affine.rotation(angle);
  }
}

/** Where one piece goes: turned by `angle` degrees about the origin, then moved by (x, y) from its sheet's corner. */
export interface Placement {
  piece: number;
  angle: number;
  x: number;
  y: number;
}

/**
 * Where every piece goes, before anything is moved: what a packer decides and
 * `realise` carries out. Plain data, so it can cross a worker boundary.
 */
export interface Arrangement {
  /** Each sheet's placements. Pieces index the design's pieces, copy after copy. */
  sheets: Placement[][];
  /** Pieces too large for an empty sheet, each on a sheet of its own. */
  oversize: number[];
}

/**
 * The design's pieces once per copy, and its parts once per copy.
 *
 * Copies are made piece by piece, from one grouping of the original: every
 * copy starts out in the same place, so grouping the copied parts would hand
 * all of the copies' loose holes to the first copy's part.
 */
export function copiesOf(parts: DrawingPart[], copies: number, once: Piece[]): { pieces: Piece[]; source: DrawingPart[] } {
  const n = parts.length;
  return {
    source: Array.from({ length: copies }, () => parts).flat(),
    pieces: Array.from({ length: copies }, (_, k) =>
      once.map((p) => ({ parts: p.parts.map((i) => i + k * n), bbox: p.bbox })),
    ).flat(),
  };
}

export const copyCount = (o: PackOptions) => Math.max(1, Math.round(o.copies ?? 1));

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
  const { pieces, source } = copiesOf(drawing.parts, copyCount(o), once);

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

/** Where MaxRects puts every piece: quick enough to run on every preview. */
export function planRects(drawing: Drawing, o: PackOptions): Arrangement {
  const { pieces, best } = plan(drawing, o);
  return {
    sheets: best.bins.map((bin) =>
      bin.placed.map((pl) => {
        const b = pieces[pl.piece]!.bbox;
        return pl.rotated
          ? { piece: pl.piece, angle: 90, x: o.margin + pl.x + b.y + b.height, y: o.margin + pl.y - b.x }
          : { piece: pl.piece, angle: 0, x: o.margin + pl.x - b.x, y: o.margin + pl.y - b.y };
      }),
    ),
    oversize: [...best.oversize],
  };
}

/** Lay the drawing's parts out on as few sheets as possible. */
export function packDrawing(drawing: Drawing, o: PackOptions): Drawing {
  return realise(drawing, o, planRects(drawing, o));
}

/**
 * Move every part where an arrangement says, and lay the sheets side by side.
 * The arrangement must have been made for this drawing and these options.
 */
export function realise(drawing: Drawing, o: PackOptions, arrangement: Arrangement): Drawing {
  const copies = copyCount(o);
  const once = piecesOf(drawing.parts);
  const { pieces, source } = copiesOf(drawing.parts, copies, once);
  const area = once.map((p) => materialArea(p.parts.map((i) => drawing.parts[i]!)));
  const oversize = new Set(arrangement.oversize);
  const warnings = [...drawing.warnings];
  /** Sheets each oversize piece of the design hangs off, numbered from 1. */
  const overhangs = new Map<number, number[]>();

  const parts = source.slice();
  const sheets: Sheet[] = [];
  let x0 = 0;
  let height = 0;

  for (const placed of arrangement.sheets) {
    const ids: number[] = [];
    let right = o.sheetWidth;
    let bottom = o.sheetHeight;
    let covered = 0;

    for (const pl of placed) {
      const piece = pieces[pl.piece]!;
      const m = Affine.translation(x0 + pl.x, pl.y).mul(turn(pl.angle));
      for (const i of piece.parts) {
        const p = transformPart(source[i]!, m);
        parts[i] = p;
        right = Math.max(right, p.bbox.x + p.bbox.width - x0);
        bottom = Math.max(bottom, p.bbox.y + p.bbox.height);
      }
      ids.push(...piece.parts);
      covered += area[pl.piece % once.length]!;

      if (oversize.has(pl.piece)) {
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
      used: covered / (o.sheetWidth * o.sheetHeight),
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

/** Stock as bought: a panel that is cut down into laser-sized sheets. */
export interface Panel {
  width: number;
  height: number;
}

/**
 * How many sheets one panel cuts into, in a grid, whichever way round fits
 * more. Saw kerf is not allowed for: the sheet's edge offset absorbs it, and
 * bought panels are seldom exactly to size anyway.
 */
export function sheetsPerPanel(sheetW: number, sheetH: number, panel: Panel): number {
  const across = (len: number, side: number) => Math.floor(len / side + 1e-9);
  return Math.max(
    across(panel.width, sheetW) * across(panel.height, sheetH),
    across(panel.width, sheetH) * across(panel.height, sheetW),
  );
}

/**
 * Sheet sizes that cut a panel evenly and fit the laser bed: everything else
 * leaves an offcut on every panel. Each is turned to fit the bed, the way the
 * sheet will be loaded. Below `minSide` a sheet is more sawing and loading
 * than it is worth, and too narrow to hold down.
 */
export function panelDivisions(panel: Panel, bed: Panel, minSide = 150): { width: number; height: number }[] {
  const out: { width: number; height: number }[] = [];
  for (let a = 1; panel.width / a >= minSide; a++) {
    for (let b = 1; panel.height / b >= minSide; b++) {
      const w = panel.width / a;
      const h = panel.height / b;
      const sized =
        w <= bed.width + 1e-9 && h <= bed.height + 1e-9 ? { width: w, height: h }
        : h <= bed.width + 1e-9 && w <= bed.height + 1e-9 ? { width: h, height: w }
        : null;
      if (sized && !out.some((x) => Math.abs(x.width - sized.width) < 1e-6 && Math.abs(x.height - sized.height) < 1e-6)) {
        out.push(sized);
      }
    }
  }
  return out;
}

export interface LayoutSuggestion {
  sheetWidth: number;
  sheetHeight: number;
  /** Sheets cut from each panel at that size. */
  perPanel: number;
  copies: number;
  sheets: number;
  panels: number;
  /** Fraction of the sheets cut covered by the parts' bounding boxes, unused sheets included. */
  used: number;
  /** What the options asked for come to, for comparison. */
  current: { copies: number; sheets: number; panels: number };
}

interface Rate {
  copies: number;
  sheets: number;
  panels: number;
}

/** a is a better rate than b: fewer panels per copy, compared as fractions. */
const cheaper = (a: Rate, b: Rate) => a.panels * b.copies < b.panels * a.copies;
const same = (a: Rate, b: Rate) => a.panels * b.copies === b.panels * a.copies;

/**
 * The sheet size and copy count that waste the least stock: the fewest panels
 * per copy, counting a partly used panel as waste. With no panel given, every
 * sheet is its own panel and only the copy count is searched.
 *
 * Sizes tried are the sheet asked for and every even division of the panel
 * that fits the bed and holds every part; counts run up to `max`. The best
 * rate usually comes round again at multiples (3, 6, 9 …), so of the counts
 * that reach it this picks the smallest no fewer than were asked for —
 * asking for four is taken as needing four — and between sizes that tie it
 * keeps the one asked for, then the larger sheet. Returns null when what was asked for is already as
 * good as any.
 */
export function bestLayout(
  drawing: Drawing,
  o: PackOptions,
  stock: { panel?: Panel; bed?: Panel; max: number },
): LayoutSuggestion | null {
  const once = piecesOf(drawing.parts);
  if (once.length === 0) return null;
  const asked = Math.max(1, Math.round(o.copies ?? 1));
  const area = once.reduce((s, p) => s + p.bbox.width * p.bbox.height, 0);

  const fitsEveryPiece = (w: number, h: number) => {
    const bw = w - 2 * o.margin;
    const bh = h - 2 * o.margin;
    return once.every(
      ({ bbox: b }) =>
        (b.width <= bw + FIT_EPS && b.height <= bh + FIT_EPS) ||
        (o.rotate && b.height <= bw + FIT_EPS && b.width <= bh + FIT_EPS),
    );
  };

  // Without stock panels each sheet is bought as it is: the size stays, and
  // the search is over copies alone, in sheets per copy.
  const sizes = [{ width: o.sheetWidth, height: o.sheetHeight }];
  const divisions = stock.panel && stock.bed ? panelDivisions(stock.panel, stock.bed) : [];
  for (const d of divisions) {
    if (!sizes.some((x) => Math.abs(x.width - d.width) < 1e-6 && Math.abs(x.height - d.height) < 1e-6)) sizes.push(d);
  }

  const rateAt = (w: number, h: number, per: number, copies: number): Rate => {
    const sheets = plan(drawing, { ...o, sheetWidth: w, sheetHeight: h, copies }, once).best.bins.length;
    return { copies, sheets, panels: Math.ceil(sheets / per) };
  };

  let current: Rate | null = null;
  let best: (Rate & { size: number; per: number; tied: Rate[] }) | null = null;

  sizes.forEach((size, si) => {
    const per = stock.panel ? sheetsPerPanel(size.width, size.height, stock.panel) : 1;
    // A sheet larger than the panel is bought some other way: count it whole.
    const perSheet = Math.max(1, per);
    if (si > 0 && !fitsEveryPiece(size.width, size.height)) return;

    const results: Rate[] = [];
    for (let copies = 1; copies <= Math.max(stock.max, asked); copies++) {
      // No packing beats the parts' own area, so a count whose bound is
      // already worse than the best rate found anywhere is never packed —
      // except the count asked for, which is what the answer is measured against.
      const bound = Math.ceil(Math.ceil((copies * area) / (size.width * size.height) - 1e-9) / perSheet);
      const hopeless = best && bound * best.copies > best.panels * copies;
      if (hopeless && !(si === 0 && copies === asked)) continue;
      const r = rateAt(size.width, size.height, perSheet, copies);
      results.push(r);
      if (si === 0 && copies === asked) current = r;
    }

    // Between sizes that waste the same, keep the one asked for, then the
    // larger sheet: fewer of them to saw and load.
    const larger = () => best!.size !== 0 && size.width * size.height > sizes[best!.size]!.width * sizes[best!.size]!.height;
    for (const r of results) {
      if (!best || cheaper(r, best) || (same(r, best) && best.size !== si && larger())) {
        best = { ...r, size: si, per: perSheet, tied: [] };
      }
    }
    if (best && best.size === si) best.tied = results.filter((r) => same(r, best!));
  });

  if (!best || !current || !cheaper(best, current)) return null;
  const b = best as Rate & { size: number; per: number; tied: Rate[] };
  const pick = b.tied.find((r) => r.copies >= asked) ?? b.tied[0]!;
  const size = sizes[b.size]!;
  return {
    sheetWidth: size.width,
    sheetHeight: size.height,
    perPanel: b.per,
    copies: pick.copies,
    sheets: pick.sheets,
    panels: pick.panels,
    used: (area * pick.copies) / (pick.panels * b.per * size.width * size.height),
    current,
  };
}
