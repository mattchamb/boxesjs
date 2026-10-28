/**
 * Nesting parts by their outlines rather than their boxes.
 *
 * MaxRects packs bounding boxes, which wastes the ground round anything that is
 * not a rectangle: finger joints cannot mesh, and round or L-shaped parts cannot
 * tuck into one another. This packs each piece's footprint (see `footprint.ts`)
 * on a grid of cells instead, placing pieces one at a time as high and then as
 * far left as they go, and searches over the order and the turns they are
 * placed in for the fewest sheets.
 *
 * It is far slower than MaxRects, so it runs only when asked (Optimise), and
 * hands back an `Arrangement` for `realise` to carry out. MaxRects' own
 * arrangement is always in the running, so optimising never does worse.
 */
import { dilate, footprint, materialArea, slackFor, type Footprint, type Spans } from './footprint';
import {
  copiesOf,
  copyCount,
  ORDERS,
  piecesOf,
  planRects,
  turn,
  type Arrangement,
  type PackOptions,
  type Piece,
  type Placement,
} from './pack';
import type { Drawing } from '../render';

export interface NestResult {
  /** What the arrangement was made for: it applies only to a drawing and options with the same key. */
  key: string;
  arrangement: Arrangement;
  sheets: number;
  /** Fraction of the sheets cut that ends up in parts. */
  used: number;
  /** Sheets MaxRects needs for the same drawing, for comparison. */
  baseline: number;
}

export interface NestOptions {
  seed?: number;
  /** Arrangements to try before stopping. Fixed with the seed, the result is too. */
  iterations?: number;
  /** Time to search for, in ms. */
  budgetMs?: number;
  /** Told of each better arrangement found, at most every quarter second. */
  onProgress?: (best: NestResult, elapsedMs: number) => void;
}

/**
 * Cell size for a sheet, in mm. Half a millimetre lets finger joints mesh; a
 * large sheet gets coarser cells so it stays near half a million of them.
 */
export function cellSize(o: PackOptions): number {
  return Math.min(2, Math.max(0.5, Math.sqrt((o.sheetWidth * o.sheetHeight) / 500_000)));
}

/** FNV-1a, twice over with different seeds, for a key that will not collide by accident. */
function hash(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 13);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/**
 * What an arrangement depends on: the design's geometry, and every option that
 * says where its parts may go. A layout made with turns allowed must not
 * survive turning them off.
 */
export function layoutKey(drawing: Drawing, o: PackOptions): string {
  const geometry = drawing.parts.map((p) => p.paths.map((x) => `${x.layer}:${x.d}`).join('|')).join('#');
  const opts = [o.sheetWidth, o.sheetHeight, o.margin, o.gap, o.rotate, o.angleStep ?? 90, copyCount(o)].join(',');
  return hash(`${opts}#${geometry}`);
}

/** Small, fast and seedable, so a search can be repeated exactly. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** A piece turned one way, ready to place. */
interface Shape {
  angle: number;
  fp: Footprint;
  /** Its spans as (row, start, length) triples, longest first: those fail soonest. */
  checks: Int32Array;
  /** Rightmost covered column. */
  right: number;
  /** Cells the gap takes up round it. */
  k: number;
  /** Its spans grown by `k`, stamped onto the sheet once it is placed. */
  stamp: Spans;
}

/**
 * One sheet's cells. For every cell, `run` holds how many free cells start
 * there and run rightwards, or minus how many covered ones do — so a failed
 * fit says how far along the row the next chance is.
 */
class Grid {
  readonly run: Int32Array;
  readonly covered: Uint8Array;
  placed: Placement[] = [];
  /** Lowest edge of anything placed, in mm from the sheet's top. */
  bottom = 0;
  /** Holds one part larger than the sheet, and nothing else. */
  closed = false;

  constructor(
    readonly cols: number,
    readonly rows: number,
    private readonly blank: Int32Array,
  ) {
    this.run = blank.slice();
    this.covered = new Uint8Array(cols * rows);
  }

  reset(): void {
    this.run.set(this.blank);
    this.covered.fill(0);
    this.placed = [];
    this.bottom = 0;
    this.closed = false;
  }

  /** Highest, then leftmost, place the shape fits, no lower than row `last`. */
  find(s: Shape, cx0: number, cx1: number, cy0: number, cy1: number): [number, number] | null {
    const { run, cols } = this;
    const checks = s.checks;
    for (let cy = cy0; cy <= cy1; cy++) {
      let cx = cx0;
      scan: while (cx <= cx1) {
        for (let k = 0; k < checks.length; k += 3) {
          const row = (cy + checks[k]!) * cols;
          const l = checks[k + 1]!;
          const v = run[row + cx + l]!;
          if (v >= checks[k + 2]!) continue;
          // The first covered cell this span would sit on: move the span
          // past the covered stretch that starts there.
          const p = cx + l + Math.max(v, 0);
          if (p >= cols) break scan;
          cx = p - run[row + p]! - l;
          continue scan;
        }
        return [cx, cy];
      }
    }
    return null;
  }

  cover(spans: Spans, cx: number, cy: number): void {
    const { run, covered, cols, rows } = this;
    for (let r = 0; r < spans.length; r++) {
      const y = cy + r;
      if (y < 0 || y >= rows) continue;
      const row = y * cols;
      const s = spans[r]!;
      for (let i = 0; i < s.length; i += 2) {
        const a = Math.max(0, s[i]! + cx);
        const b = Math.min(cols - 1, s[i + 1]! + cx);
        for (let x = a; x <= b; x++) covered[row + x] = 1;
      }
      let v = 0;
      for (let x = cols - 1; x >= 0; x--) {
        v = covered[row + x] ? (v < 0 ? v - 1 : -1) : v > 0 ? v + 1 : 1;
        run[row + x] = v;
      }
    }
  }
}

const sameShape = (a: Footprint, b: Footprint) =>
  a.rows.length === b.rows.length &&
  a.rows.every((r, i) => r.length === b.rows[i]!.length && r.every((v, j) => v === b.rows[i]![j]));

/**
 * Searches for the arrangement that needs fewest sheets, then leaves the last
 * sheet's offcut deepest. Exported for its parts' sake in tests; `nest` is the
 * way in.
 */
export class Nester {
  readonly res: number;
  readonly once: Piece[];
  readonly pieces: Piece[];
  private readonly shapes = new Map<string, Shape>();
  /** Per piece of the design, the turns tried when its turn is left open. */
  private readonly auto: number[][];
  /** Per piece of the design, every turn it may be given. */
  readonly turns: number[][];
  private readonly area: number[];
  private readonly cols: number;
  private readonly rows: number;
  private readonly blank: Int32Array;
  private readonly pool: Grid[] = [];
  /** Most any piece's curves can reach past its cells. */
  private readonly slack: number;

  constructor(
    private readonly drawing: Drawing,
    private readonly o: PackOptions,
  ) {
    this.res = cellSize(o);
    this.once = piecesOf(drawing.parts);
    this.pieces = copiesOf(drawing.parts, copyCount(o), this.once).pieces;
    this.area = this.once.map((p) => materialArea(p.parts.map((i) => drawing.parts[i]!)));
    this.slack = Math.max(0, ...this.once.map((p) => slackFor(p.parts.map((i) => drawing.parts[i]!), this.res)));
    this.cols = Math.floor(o.sheetWidth / this.res) + 1;
    this.rows = Math.floor(o.sheetHeight / this.res) + 1;
    this.blank = new Int32Array(this.cols * this.rows);
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) this.blank[y * this.cols + x] = this.cols - x;
    }

    // A half turn keeps the grain running the same way, so it is allowed even
    // when turning is not.
    const quarter = o.rotate ? [0, 90, 180, 270] : [0, 180];
    const step = o.rotate ? Math.max(1, Math.min(90, o.angleStep ?? 90)) : 180;
    this.auto = this.once.map((_, d) => {
      const out: number[] = [];
      for (const a of quarter) {
        if (!out.some((b) => sameShape(this.shape(d, a).fp, this.shape(d, b).fp))) out.push(a);
      }
      return out;
    });
    this.turns = this.once.map((_, d) => {
      const fp = this.shape(d, 0).fp;
      const box = fp.rows.length * (Math.max(0, ...fp.rows.flatMap((r) => r.filter((_, i) => i % 2))) + 1);
      // Turning a near rectangle by less than a quarter only makes it wider.
      if (step >= 90 || box === 0 || fp.cells / box > 0.85) return quarter;
      const out: number[] = [];
      for (let a = 0; a < 360; a += step) out.push(a);
      return out;
    });
  }

  shape(d: number, angle: number): Shape {
    const key = `${d}:${angle}`;
    let s = this.shapes.get(key);
    if (s) return s;
    const fp = footprint(
      this.once[d]!.parts.map((i) => this.drawing.parts[i]!),
      turn(angle),
      this.res,
    );
    const triples: [number, number, number][] = [];
    let right = 0;
    fp.rows.forEach((r, i) => {
      for (let j = 0; j < r.length; j += 2) {
        triples.push([i, r[j]!, r[j + 1]! - r[j]! + 1]);
        right = Math.max(right, r[j + 1]!);
      }
    });
    triples.sort((a, b) => b[2] - a[2] || a[0] - b[0]);
    // Grown far enough that any other piece's cells, kept off these, keep the
    // gap from this piece's curves and theirs.
    const k = Math.ceil((this.o.gap + fp.slack + this.slack) / this.res - 1e-9);
    s = { angle, fp, checks: Int32Array.from(triples.flat()), right, k, stamp: dilate(fp.rows, k) };
    this.shapes.set(key, s);
    return s;
  }

  /** Whether a shape fits an empty sheet inside the edge offset. */
  private fitsEmpty(s: Shape): boolean {
    const { o } = this;
    const reach = 2 * s.fp.slack;
    return (
      s.fp.width + reach <= o.sheetWidth - 2 * o.margin + 1e-6 &&
      s.fp.height + reach <= o.sheetHeight - 2 * o.margin + 1e-6 &&
      this.bounds(s) !== null
    );
  }

  /** Cells the shape's corner may sit on: inside the edge offset, and on the grid. */
  private bounds(s: Shape): [number, number, number, number] | null {
    const { o, res } = this;
    const edge = o.margin + s.fp.slack;
    const cx0 = Math.ceil(edge / res - 1e-9);
    const cy0 = Math.ceil(edge / res - 1e-9);
    const cx1 = Math.min(Math.floor((o.sheetWidth - edge - s.fp.width) / res + 1e-9), this.cols - 1 - s.right);
    const cy1 = Math.min(Math.floor((o.sheetHeight - edge - s.fp.height) / res + 1e-9), this.rows - s.fp.rows.length);
    return cx1 < cx0 || cy1 < cy0 ? null : [cx0, cx1, cy0, cy1];
  }

  private grid(i: number): Grid {
    let g = this.pool[i];
    if (!g) {
      g = new Grid(this.cols, this.rows, this.blank);
      this.pool[i] = g;
    } else {
      g.reset();
    }
    return g;
  }

  private place(g: Grid, piece: number, s: Shape, cx: number, cy: number): void {
    const { res } = this;
    g.cover(s.stamp, cx - s.k, cy - s.k);
    g.placed.push({ piece, angle: s.angle, x: cx * res - s.fp.x0, y: cy * res - s.fp.y0 });
    g.bottom = Math.max(g.bottom, cy * res + s.fp.height);
  }

  /** Place the piece on the sheet, turned whichever of `shapes` sits highest; false if none fits. */
  private fit(g: Grid, piece: number, shapes: Shape[]): boolean {
    let best: { s: Shape; at: [number, number] } | null = null;
    for (const s of shapes) {
      const b = this.bounds(s)!;
      // Nothing lower than the best so far can win.
      const at = g.find(s, b[0], b[1], b[2], best ? Math.min(b[3], best.at[1]) : b[3]);
      if (at && (!best || at[1] < best.at[1] || (at[1] === best.at[1] && at[0] < best.at[0]))) best = { s, at };
    }
    if (!best) return false;
    this.place(g, piece, best.s, best.at[0], best.at[1]);
    return true;
  }

  /**
   * Move what it can off later sheets into gaps on earlier ones.
   *
   * Placing first fit already does this for the search's own arrangements,
   * but not for MaxRects', which packs boxes and so cannot use the ground
   * round a part that is not one. The cost cannot see the difference while the
   * last sheet's deepest row stays put, and MaxRects' rows sit a little higher
   * than the grid's, so it often wins with small parts left on the last sheet
   * that would fit in an earlier sheet's gaps. Every move empties a little of
   * a later sheet and adds nothing to it, so the result never needs more
   * sheets nor reaches deeper.
   */
  settle(a: Arrangement): Arrangement {
    const n = this.once.length;
    const closed = new Set(a.oversize);
    const sheets = a.sheets.map((s) => s.slice());
    const grids: (Grid | null)[] = [];
    for (let i = 0; i < sheets.length; i++) {
      if (i > 0) {
        sheets[i] = sheets[i]!.filter((pl) => {
          if (closed.has(pl.piece)) return true;
          const d = pl.piece % n;
          const shapes = [...new Set([pl.angle, ...this.auto[d]!])].map((t) => this.shape(d, t)).filter((s) => this.fitsEmpty(s));
          const g = grids.find((g) => g !== null && this.fit(g, pl.piece, shapes));
          if (!g) return true;
          sheets[grids.indexOf(g)]!.push(g.placed.pop()!);
          return false;
        });
      }
      grids.push(sheets[i]!.some((pl) => closed.has(pl.piece)) ? null : this.gridOf(i, sheets[i]!));
    }
    return { sheets: sheets.filter((s) => s.length > 0), oversize: a.oversize };
  }

  /**
   * A grid holding placements made anywhere, not only on its cells. Each is
   * stamped at the cells either side of where it sits, which covers it
   * wherever it falls between them.
   */
  private gridOf(i: number, placed: Placement[]): Grid {
    const g = this.grid(i);
    const n = this.once.length;
    for (const pl of placed) {
      const s = this.shape(pl.piece % n, pl.angle);
      const fx = (pl.x + s.fp.x0) / this.res;
      const fy = (pl.y + s.fp.y0) / this.res;
      for (const cx of new Set([Math.floor(fx + 1e-9), Math.ceil(fx - 1e-9)])) {
        for (const cy of new Set([Math.floor(fy + 1e-9), Math.ceil(fy - 1e-9)])) g.cover(s.stamp, cx - s.k, cy - s.k);
      }
    }
    return g;
  }

  /**
   * Place the pieces in `order`, each turned by its entry in `angles`, or by
   * whichever of its usual turns sits highest where that is -1.
   */
  arrange(order: number[], angles: number[]): Arrangement {
    const n = this.once.length;
    const grids: Grid[] = [];
    const oversize: number[] = [];

    for (const piece of order) {
      const d = piece % n;
      const fixed = angles[piece]!;
      let shapes = (fixed >= 0 ? [fixed] : this.auto[d]!).map((a) => this.shape(d, a)).filter((s) => this.fitsEmpty(s));
      if (shapes.length === 0 && fixed >= 0) {
        shapes = this.auto[d]!.map((a) => this.shape(d, a)).filter((s) => this.fitsEmpty(s));
      }

      if (shapes.length === 0) {
        // Larger than a whole sheet: it gets one to itself, turned whichever
        // way overhangs least, and nothing else is packed round it.
        const { o } = this;
        const over = (s: Shape) =>
          Math.max(0, s.fp.width - o.sheetWidth + 2 * o.margin) + Math.max(0, s.fp.height - o.sheetHeight + 2 * o.margin);
        const s = this.auto[d]!.map((a) => this.shape(d, a)).reduce((a, b) => (over(b) < over(a) ? b : a));
        const g = this.grid(grids.length);
        g.closed = true;
        g.placed.push({ piece, angle: s.angle, x: o.margin - s.fp.x0, y: o.margin - s.fp.y0 });
        g.bottom = o.margin + s.fp.height;
        grids.push(g);
        oversize.push(piece);
        continue;
      }

      // First fit across sheets, so the early sheets fill up and whatever space
      // is left over ends up on the last one.
      if (grids.some((g) => !g.closed && this.fit(g, piece, shapes))) continue;
      const g = this.grid(grids.length);
      grids.push(g);
      this.fit(g, piece, shapes);
    }

    return { sheets: grids.map((g) => g.placed), oversize };
  }

  /**
   * Lower is better: one for every sheet past the first, plus how far down the
   * last sheet the parts reach — less leaves a bigger offcut, and a last sheet
   * that empties is one sheet fewer.
   */
  cost(a: Arrangement): number {
    const last = a.sheets[a.sheets.length - 1] ?? [];
    let bottom = 0;
    for (const pl of last) {
      const fp = this.shape(pl.piece % this.once.length, pl.angle).fp;
      bottom = Math.max(bottom, pl.y + fp.y0 + fp.height);
    }
    return a.sheets.length - 1 + bottom / this.o.sheetHeight;
  }

  used(a: Arrangement): number {
    const n = this.once.length;
    const total = a.sheets.flat().reduce((s, pl) => s + this.area[pl.piece % n]!, 0);
    return total / (a.sheets.length * this.o.sheetWidth * this.o.sheetHeight);
  }
}

/**
 * The arrangement that needs fewest sheets, found by simulated annealing over
 * the order pieces are placed in and the turn each is given. It starts from
 * the best of the orders MaxRects tries, and MaxRects' own arrangement wins
 * whenever the search finds nothing better.
 */
export function nest(drawing: Drawing, o: PackOptions, opts: NestOptions = {}): NestResult {
  const start = Date.now();
  const key = layoutKey(drawing, o);
  const n = new Nester(drawing, o);
  const rects = planRects(drawing, o);
  const baseline = rects.sheets.length;
  const result = (a: Arrangement): NestResult => ({ key, arrangement: a, sheets: a.sheets.length, used: n.used(a), baseline });

  const count = n.pieces.length;
  if (count === 0) return result(rects);
  const random = mulberry32(opts.seed ?? 1);

  // Seeds: MaxRects' orders, and largest true area first.
  const box = (p: number) => n.pieces[p]!.bbox;
  const keys = [...ORDERS.map((k) => (p: number) => k({ w: box(p).width, h: box(p).height })), (p: number) => n.shape(p % n.once.length, 0).fp.cells];
  const auto = Array<number>(count).fill(-1);
  let cur = { order: [] as number[], angles: auto, cost: Infinity, a: rects };
  for (const k of keys) {
    // Stable, so ties keep the generator's own order.
    const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => k(b) - k(a) || a - b);
    const a = n.arrange(order, auto);
    const c = n.cost(a);
    if (c < cur.cost) cur = { order, angles: auto, cost: c, a };
  }
  let best = cur;
  // Both settled before they are compared: MaxRects' gains most from it.
  const settledRects = n.settle(rects);
  const rectsCost = n.cost(settledRects);
  const better = () => {
    const a = n.settle(best.a);
    return n.cost(a) < rectsCost ? a : settledRects;
  };

  const iterations = opts.iterations ?? Infinity;
  const budget = opts.budgetMs ?? (opts.iterations === undefined ? 5000 : Infinity);
  let lastReport = Date.now();
  // Something to show, and to keep if stopped, before the search has improved on anything.
  opts.onProgress?.(result(better()), lastReport - start);
  /** A better arrangement found since the last report. */
  let unreported = false;

  // Hot enough at first to give up most of a sheet's depth; cools a
  // thousandfold by the end.
  const t0 = 0.05;
  for (let it = 0; it < iterations; it++) {
    const now = Date.now();
    const elapsed = now - start;
    if (elapsed >= budget) break;
    // Checked every time round, not only when something improves: stopping
    // keeps the last report, so the best must not sit unreported waiting for
    // a better one that may never come. Timers cannot fire while this runs.
    if (unreported && opts.onProgress && now - lastReport >= 250) {
      lastReport = now;
      unreported = false;
      opts.onProgress(result(better()), elapsed);
    }
    const progress = Math.min(1, Math.max(it / iterations, elapsed / budget));
    const temp = t0 * Math.pow(1e-3, progress);

    const order = cur.order.slice();
    const angles = cur.angles.slice();
    const r = random();
    if (r < 0.45 && count > 1) {
      const i = Math.floor(random() * count);
      const j = Math.floor(random() * count);
      [order[i], order[j]] = [order[j]!, order[i]!];
    } else if (r < 0.75 && count > 1) {
      const [p] = order.splice(Math.floor(random() * count), 1);
      order.splice(Math.floor(random() * count), 0, p!);
    } else {
      const p = Math.floor(random() * count);
      const turns = n.turns[p % n.once.length]!;
      const pick = Math.floor(random() * (turns.length + 1));
      angles[p] = pick === turns.length ? -1 : turns[pick]!;
    }

    const a = n.arrange(order, angles);
    const c = n.cost(a);
    if (c <= cur.cost || random() < Math.exp((cur.cost - c) / temp)) {
      cur = { order, angles, cost: c, a };
      if (c < best.cost - 1e-9) {
        best = cur;
        unreported = true;
      }
    }
  }

  return result(better());
}
