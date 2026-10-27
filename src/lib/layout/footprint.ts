/**
 * The ground a piece covers, as the nester sees it: a grid of cells.
 *
 * A cell is set when any of the piece's drawing touches it, or when it is
 * enclosed by drawing — so a piece's holes count as covered, and nothing is
 * ever placed inside another part. Cutting a part out of another's hole is
 * unsafe while every hole on the sheet is cut before every outline: the slug
 * would drop with the part in it still uncut.
 *
 * Every step errs towards covering more, never less. Two pieces whose cells
 * are more than k cells apart are at least k cells' width apart on the sheet,
 * whatever the geometry inside the cells, which is what lets the nester keep
 * the gap between parts by counting cells.
 */
import { Affine } from '../geom/affine';
import type { PathCmd } from '../geom/context';
import { insideRing, type Pt } from '../geom/crossings';
import type { BBox, DrawingPart } from '../render';

/**
 * Each subpath of `cmds`, moved by `m`, as a polyline. Curves are cut into
 * enough chords that none strays more than `tol` from its curve — fixed
 * sampling would let a large arc bulge past the cells it was measured by.
 */
export function flatten(cmds: PathCmd[], m: Affine, tol: number): Pt[][] {
  const rings: Pt[][] = [];
  let ring: Pt[] = [];
  let at: Pt = [0, 0];
  for (const c of cmds) {
    if (c.c === 'T') continue;
    const p = m.apply(c.x, c.y);
    if (c.c === 'M') {
      if (ring.length > 1) rings.push(ring);
      ring = [p];
    } else if (c.c === 'L') {
      ring.push(p);
    } else {
      const p1 = m.apply(c.x1, c.y1);
      const p2 = m.apply(c.x2, c.y2);
      // A cubic's chords stray at most |B''| / 8n² from it, and |B''| is at
      // most six times its control points' largest second difference.
      const dd = Math.max(
        Math.hypot(at[0] - 2 * p1[0] + p2[0], at[1] - 2 * p1[1] + p2[1]),
        Math.hypot(p1[0] - 2 * p2[0] + p[0], p1[1] - 2 * p2[1] + p[1]),
      );
      const n = Math.max(1, Math.ceil(Math.sqrt((6 * dd) / (8 * tol))));
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const u = 1 - t;
        ring.push([
          u * u * u * at[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p[0],
          u * u * u * at[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p[1],
        ]);
      }
      ring.push(p);
    }
    at = p;
  }
  if (ring.length > 1) rings.push(ring);
  return rings;
}

/** Where a cubic's coordinate turns back, between its ends: roots of its derivative in (0, 1). */
function turningPoints(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots =
    Math.abs(a) < 1e-12
      ? Math.abs(b) < 1e-12 ? [] : [-c / b]
      : (() => {
          const disc = b * b - 4 * a * c;
          if (disc < 0) return [];
          const r = Math.sqrt(disc);
          return [(-b + r) / (2 * a), (-b - r) / (2 * a)];
        })();
  return roots.filter((t) => t > 0 && t < 1);
}

const cubicAt = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/**
 * The box round everything a set of parts draws, curves included. A part's
 * own box counts only where its commands end, which is enough to hover it by
 * but not to pack it: a circle drawn as four arcs that meet off its axes
 * bulges past them.
 */
export function drawnBox(parts: DrawingPart[]): BBox | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const part of parts) {
    for (const path of part.paths) {
      const cmds = path.cmds;
      // A trailing move-to draws nothing.
      const n = cmds.length && cmds[cmds.length - 1]!.c === 'M' ? cmds.length - 1 : cmds.length;
      let px = 0;
      let py = 0;
      for (let i = 0; i < n; i++) {
        const c = cmds[i]!;
        if (c.c === 'T') continue;
        add(c.x, c.y);
        if (c.c === 'C') {
          for (const t of turningPoints(px, c.x1, c.x2, c.x)) add(cubicAt(px, c.x1, c.x2, c.x, t), cubicAt(py, c.y1, c.y2, c.y, t));
          for (const t of turningPoints(py, c.y1, c.y2, c.y)) add(cubicAt(px, c.x1, c.x2, c.x, t), cubicAt(py, c.y1, c.y2, c.y, t));
        }
        px = c.x;
        py = c.y;
      }
    }
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/**
 * How far a piece's flattened curves may lie inside the curves themselves, at
 * `res` mm a cell; nothing for a piece drawn in straight lines.
 */
export function slackFor(parts: DrawingPart[], res: number): number {
  return parts.some((p) => p.paths.some((x) => x.cmds.some((c) => c.c === 'C'))) ? res / 16 : 0;
}

/**
 * Covered cells, one list per row of column spans: [start, end, start, end …],
 * ends inclusive, sorted and apart.
 */
export type Spans = number[][];

export interface Footprint {
  /** The turned piece's smallest x and y: the corner at cell (0, 0). */
  x0: number;
  y0: number;
  /** Size of the turned piece, from its geometry rather than its cells. */
  width: number;
  height: number;
  rows: Spans;
  /** Covered cells in all. */
  cells: number;
  /**
   * How far the piece may reach past its cells and its size above: its curves
   * are measured by chords, which cut inside them.
   */
  slack: number;
}

const EMPTY: Footprint = { x0: 0, y0: 0, width: 0, height: 0, rows: [], cells: 0, slack: 0 };

/**
 * The cells a piece covers once turned by `m`, at `res` mm a cell.
 *
 * Every line is drawn into the grid, cell by cell along it, and everything the
 * outside cannot reach without crossing one is covered. The flood moves only
 * edgeways, so a line one diagonal step thick still holds it back.
 */
export function footprint(parts: DrawingPart[], m: Affine, res: number): Footprint {
  const slack = slackFor(parts, res);
  const lines = parts.flatMap((p) => p.paths.flatMap((path) => flatten(path.cmds, m, slack || res)));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const l of lines) {
    for (const [x, y] of l) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (!Number.isFinite(x0)) return EMPTY;

  // One spare cell all round, so the outside surrounds the piece.
  const cols = Math.floor((x1 - x0) / res) + 3;
  const rows = Math.floor((y1 - y0) / res) + 3;
  const grid = new Uint8Array(cols * rows);
  const LINE = 1;
  const OUTSIDE = 2;

  const mark = (row: number, a: number, b: number) => {
    const from = Math.max(0, Math.floor(Math.min(a, b)));
    const to = Math.min(cols - 1, Math.floor(Math.max(a, b)));
    for (let c = from; c <= to; c++) grid[row * cols + c] = LINE;
  };

  for (const l of lines) {
    for (let i = 1; i < l.length; i++) {
      const ax = (l[i - 1]![0] - x0) / res + 1;
      const ay = (l[i - 1]![1] - y0) / res + 1;
      const bx = (l[i]![0] - x0) / res + 1;
      const by = (l[i]![1] - y0) / res + 1;
      const top = Math.min(ay, by);
      const bottom = Math.max(ay, by);
      // Row by row, the stretch of the line inside that row. Rows share their
      // boundary, so a line crossing it marks the cell on both sides.
      for (let r = Math.floor(top); r <= Math.floor(bottom) && r < rows; r++) {
        if (bottom - top < 1e-12) {
          mark(r, ax, bx);
          continue;
        }
        const at = (y: number) => ax + ((bx - ax) * (y - ay)) / (by - ay);
        mark(r, at(Math.max(top, r)), at(Math.min(bottom, r + 1)));
      }
    }
  }

  const stack = [0];
  grid[0] = OUTSIDE;
  while (stack.length) {
    const i = stack.pop()!;
    const r = (i / cols) | 0;
    const c = i - r * cols;
    if (c > 0 && grid[i - 1] === 0) (grid[i - 1] = OUTSIDE), stack.push(i - 1);
    if (c < cols - 1 && grid[i + 1] === 0) (grid[i + 1] = OUTSIDE), stack.push(i + 1);
    if (r > 0 && grid[i - cols] === 0) (grid[i - cols] = OUTSIDE), stack.push(i - cols);
    if (r < rows - 1 && grid[i + cols] === 0) (grid[i + cols] = OUTSIDE), stack.push(i + cols);
  }

  // Back to the piece's own cells: the spare border is all outside.
  const out: Spans = [];
  let cells = 0;
  for (let r = 1; r < rows - 1; r++) {
    const spans: number[] = [];
    let start = -1;
    for (let c = 1; c < cols; c++) {
      const covered = c < cols - 1 && grid[r * cols + c] !== OUTSIDE;
      if (covered && start < 0) start = c;
      if (!covered && start >= 0) {
        spans.push(start - 1, c - 2);
        cells += c - start;
        start = -1;
      }
    }
    out.push(spans);
  }
  return { x0, y0, width: x1 - x0, height: y1 - y0, rows: out, cells, slack };
}

/** Sorted spans, overlapping or touching ones joined. */
function merge(spans: number[]): number[] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < spans.length; i += 2) pairs.push([spans[i]!, spans[i + 1]!]);
  pairs.sort((a, b) => a[0] - b[0]);
  const out: number[] = [];
  for (const [a, b] of pairs) {
    if (out.length && a <= out[out.length - 1]! + 1) out[out.length - 1] = Math.max(out[out.length - 1]!, b);
    else out.push(a, b);
  }
  return out;
}

/**
 * Cells within `k` of a covered one, edgeways or diagonally; the result starts
 * k rows above and k columns left of the original.
 */
export function dilate(rows: Spans, k: number): Spans {
  if (k <= 0) return rows;
  const wide = rows.map((spans) => merge(spans.map((v, i) => (i % 2 === 0 ? v : v + 2 * k))));
  const out: Spans = [];
  for (let r = 0; r < rows.length + 2 * k; r++) {
    const near: number[] = [];
    for (let s = Math.max(0, r - 2 * k); s <= Math.min(rows.length - 1, r); s++) near.push(...wide[s]!);
    out.push(merge(near));
  }
  return out;
}

const shoelace = (r: Pt[]) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j]![0] * r[i]![1] - r[i]![0] * r[j]![1];
  return Math.abs(a) / 2;
};

/**
 * Material a piece is cut from: its outlines' area less its holes'. A ring
 * inside an odd number of others is a hole. With no closed cut at all, the
 * piece's box stands in for it.
 */
export function materialArea(parts: DrawingPart[]): number {
  const rings = parts
    .flatMap((p) => p.paths.filter((x) => x.layer === 'cut' || x.layer === 'inner'))
    .flatMap((x) => flatten(x.cmds, Affine.identity(), 0.05))
    .filter((r) => r.length > 3 && Math.hypot(r[0]![0] - r[r.length - 1]![0], r[0]![1] - r[r.length - 1]![1]) < 1e-3)
    .map((r) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of r) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      return { r, area: shoelace(r), box: [x0, y0, x1, y1] as const };
    });

  if (rings.length === 0) {
    return parts.reduce((s, p) => s + p.bbox.width * p.bbox.height, 0);
  }
  let total = 0;
  for (const a of rings) {
    const p = a.r[0]!;
    let depth = 0;
    for (const b of rings) {
      if (b === a || b.area <= a.area) continue;
      const [x0, y0, x1, y1] = b.box;
      if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) continue;
      if (insideRing(p, b.r)) depth++;
    }
    total += depth % 2 ? -a.area : a.area;
  }
  return Math.max(0, total);
}
