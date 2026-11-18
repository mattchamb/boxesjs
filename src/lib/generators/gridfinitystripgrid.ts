/**
 * Gridfinity strip grid — not from boxes.py, which has no such generator.
 *
 * A Gridfinity baseplate built as an egg-crate: strips standing on edge,
 * half-lapped together on the 42 mm pitch. A plate with the openings cut out
 * of it throws away about 80 % of its sheet; strips use about a third as much
 * and nest into offcuts. A strip cannot carry the 45° socket chamfer — that
 * runs across the material's thickness — so the bin's own chamfered foot does
 * the locating instead, resting on the strips' top corners.
 *
 * Strips longer than `max_length` are broken, and the breaks are staggered in
 * a bond so the grid holds together as one piece. The bond is defined in
 * global cell coordinates, so a grid cut later at an offset continues it.
 *
 *   X strips run along x, one per grid line y = j·42, notched from the top.
 *   Y strips run along y, one per grid line x = i·42, notched from the bottom.
 *
 * Bond: with M the longest piece in cells, and only along an axis longer
 * than M, an X strip on global line J breaks
 * at global crossing I when I ≡ J (mod M), and a Y strip on line I breaks at J
 * when J ≡ I − q (mod M), q = ⌊M/2⌋. Both together would need q ≡ 0, so no
 * crossing ever has both strips broken (one of the two must carry it), and
 * each grid line has only one strip in M broken on it. A half bond (breaks
 * shifted M/2 between neighbours) was the first idea and is worse on both
 * counts: it piles half the strips' breaks onto the same line, and for some M
 * (4, for one) no offset keeps the X and Y breaks apart.
 *
 * A break sits beside its crossing, not in it: the piece before ends square
 * against the cross strip's face, and the piece after carries the notch, so
 * its end is a half-height tab held under the cross strip. Splitting through
 * the middle of the half-lap would leave two slivers t/2 long instead.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { ETCHING } from '../geom/colors';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

export const PITCH = 42;

/**
 * The bin foot's profile, top down, from the Gridfinity spec: 41.5 mm across
 * at the top, a 2.15 mm 45° chamfer, 1.8 mm straight, then a 0.8 mm chamfer.
 */
const FOOT_TOP = 41.5;
const FOOT_CHAMFER = 2.15;
const FOOT_STRAIGHT = 1.8;
const FOOT_BOTTOM_CHAMFER = 0.8;
export const FOOT_HEIGHT = FOOT_CHAMFER + FOOT_STRAIGHT + FOOT_BOTTOM_CHAMFER;

/** Room left under a seated bin's foot. */
export const FOOT_CLEARANCE = 0.5;

/** Below this the strips are floppy and bins barely seat; above, only the bottom chamfer engages. */
export const THICKNESS_RANGE = [1.5, 4.8] as const;

/**
 * How far down its foot a bin seats on strips of thickness t: the depth at
 * which the foot is as narrow as the cell's clear width, 42 − t.
 */
export function seatDepth(t: number): number {
  const cell = PITCH - t;
  if (cell >= FOOT_TOP) return 0; // the foot drops into the cell without touching
  const z1 = (FOOT_TOP - cell) / 2;
  if (z1 <= FOOT_CHAMFER) return z1;
  const straight = FOOT_TOP - 2 * FOOT_CHAMFER;
  if (cell >= straight) return FOOT_CHAMFER; // a sliding fit down the straight band
  const z3 = FOOT_CHAMFER + FOOT_STRAIGHT + (straight - cell) / 2;
  return Math.min(z3, FOOT_HEIGHT);
}

/** The lowest strip that keeps a seated bin's foot off the floor, rounded up to 0.1 mm. */
export function minStripHeight(t: number): number {
  return Math.ceil((FOOT_HEIGHT - seatDepth(t) + FOOT_CLEARANCE) * 10 - 1e-9) / 10;
}

export interface StripPiece {
  axis: 'x' | 'y';
  /** Local grid line the strip lies on, 0-based. */
  line: number;
  /** Index of this piece along its strip, 0-based. */
  index: number;
  /** First and last local crossings the piece covers. */
  from: number;
  to: number;
  /** Whether each end is a break (true) rather than the grid's outside edge. */
  startBreak: boolean;
  endBreak: boolean;
}

export interface StripGridOptions {
  nx: number;
  ny: number;
  /** Longest piece, in whole cells. */
  maxCells: number;
  /** The grid's position in global cells, so a later grid continues the bond. */
  originX?: number;
  originY?: number;
  /** Border bays: an extra strip at the wall before cell line 0 and after line n. */
  bays?: { x?: [boolean, boolean]; y?: [boolean, boolean] };
}

const mod = (a: number, m: number) => ((a % m) + m) % m;

/**
 * Where every strip breaks, and the pieces that leaves. Pure, so the bond's
 * rules can be tested without drawing anything.
 *
 * Lines are numbered by cell line, so a border bay's strip is line −1 before
 * the cells or n + 1 after them. Breaks only ever fall on cell lines, so a
 * bay's crossings are never broken, and the bond rule still holds for the
 * bay strips' own breaks: numbered −1 or n + 1 they continue the stagger.
 */
export function stripGridLayout(o: StripGridOptions): { pieces: StripPiece[]; q: number } {
  const { nx, ny, maxCells: M } = o;
  const ox = o.originX ?? 0;
  const oy = o.originY ?? 0;
  const [bx0, bx1] = o.bays?.x ?? [false, false];
  const [by0, by1] = o.bays?.y ?? [false, false];
  const q = Math.floor(M / 2);

  // Strips that fit whole stay whole: the bond only breaks the strips along
  // an axis that is longer than a piece can be. Leaving breaks out never makes
  // two meet on one crossing, so the bond's guarantee still holds.
  const breaksX = (j: number): number[] => {
    const out: number[] = [];
    if (nx <= M) return out;
    for (let i = 1; i < nx; i++) if (mod(ox + i - (oy + j), M) === 0) out.push(i);
    return out;
  };
  const breaksY = (i: number): number[] => {
    const out: number[] = [];
    if (ny <= M) return out;
    for (let j = 1; j < ny; j++) if (mod(oy + j - (ox + i) + q, M) === 0) out.push(j);
    return out;
  };

  const pieces: StripPiece[] = [];
  const split = (axis: 'x' | 'y', line: number, length: number, breaks: number[]) => {
    const stops = [0, ...breaks, length];
    for (let k = 0; k + 1 < stops.length; k++) {
      pieces.push({
        axis,
        line,
        index: k,
        from: stops[k]!,
        to: stops[k + 1]!,
        startBreak: k > 0,
        endBreak: k + 2 < stops.length,
      });
    }
  };
  for (let j = by0 ? -1 : 0; j <= ny + (by1 ? 1 : 0); j++) split('x', j, nx, breaksX(j));
  for (let i = bx0 ? -1 : 0; i <= nx + (bx1 ? 1 : 0); i++) split('y', i, ny, breaksY(i));
  return { pieces, q };
}

/** Clear width a border bay needs to be worth a strip of its own. */
export const MIN_BAY = 15;

export type Leftover = 'centre' | 'start' | 'end';

/**
 * How the grid sits along one axis, in mm from its outside start.
 *
 * Cells mode is the bare grid: its outer strips' faces are the outside. Size
 * mode fills `size` exactly: the leftover past the cells goes to either side
 * as `leftover` says, and on each side becomes a border bay with a strip of
 * its own at the wall when that leaves at least MIN_BAY clear, or otherwise
 * just runs the strips' ends on to the wall.
 */
export interface AxisSpec {
  n: number;
  /** Overall length; every strip along this axis runs 0 → size. */
  size: number;
  /** Position of cell line 0. */
  offset: number;
  /** A border bay's strip at each end. */
  bays: [boolean, boolean];
  /** What is left over at each end, past the cells' outer strips. */
  gaps: [number, number];
}

export function axisSpec(n: number, t: number, size?: number, leftover: Leftover = 'centre'): AxisSpec {
  const bare = n * PITCH + t;
  const total = size === undefined ? bare : size;
  const left = Math.max(0, total - bare);
  const gaps: [number, number] =
    leftover === 'start' ? [left, 0] : leftover === 'end' ? [0, left] : [left / 2, left / 2];
  const bays: [boolean, boolean] = [gaps[0] - t >= MIN_BAY, gaps[1] - t >= MIN_BAY];
  return { n, size: Math.max(total, bare), offset: t / 2 + gaps[0], bays, gaps };
}

/** Position of a line, by its number in stripGridLayout: −1 and n + 1 are bay strips at the walls. */
export function linePos(a: AxisSpec, line: number, t: number): number {
  if (line < 0) return t / 2;
  if (line > a.n) return a.size - t / 2;
  return a.offset + line * PITCH;
}

/** A notch across a piece, as an interval along it in mm. */
interface Notch {
  a: number;
  b: number;
}

/**
 * Length of a piece and its notches, in mm from the piece's own start.
 *
 * `run` is the axis the piece runs along. An outside end stops at the edge of
 * the grid: the outer strip's face, or the wall in size mode. A break stops at
 * the face of the cross strip's slot, w/2 before the crossing, so the piece
 * that carries the crossing starts with a full slot-width tab and the piece
 * that butts never has a sliver of slot.
 */
export function pieceGeometry(p: StripPiece, t: number, w: number, run: AxisSpec): { length: number; start: number; notches: Notch[] } {
  const start = p.startBreak ? linePos(run, p.from, t) - w / 2 : 0;
  const end = p.endBreak ? linePos(run, p.to, t) - w / 2 : run.size;
  const crossings: number[] = [];
  if (!p.startBreak && run.bays[0]) crossings.push(-1);
  // The crossing at an end break belongs to the next piece.
  const last = p.endBreak ? p.to - 1 : p.to;
  for (let c = p.from; c <= last; c++) crossings.push(c);
  if (!p.endBreak && run.bays[1]) crossings.push(run.n + 1);
  const length = end - start;
  const notches = crossings.map((c) => {
    const x = linePos(run, c, t);
    return { a: Math.max(x - w / 2, start) - start, b: Math.min(x + w / 2, end) - start };
  });
  // An outside end that would leave a post narrower than the material past
  // its last slot (a short run-on to the wall, or a slot narrower than t)
  // instead lets the slot out through the end, as a corner tab does: a
  // full-height sliver there snaps off.
  const first = notches[0];
  if (first && !p.startBreak && first.a < t) first.a = 0;
  const lastNotch = notches[notches.length - 1];
  if (lastNotch && !p.endBreak && length - lastNotch.b < t) lastNotch.b = length;
  return { length, start, notches };
}

/** Rectilinear outline of a strip, counterclockwise, as nominal vertices. */
export function stripOutline(length: number, h: number, notches: Notch[], fromTop: boolean): [number, number][] {
  const d = h / 2;
  const sorted = [...notches].sort((p, q) => p.a - q.a);
  const pts: [number, number][] = [];
  const eps = 1e-9;

  // Bottom edge, left to right.
  const bottom = fromTop ? [] : sorted;
  const startsNotched = bottom.length > 0 && bottom[0]!.a < eps;
  pts.push([startsNotched ? bottom[0]!.b : 0, 0]);
  for (const nt of bottom) {
    if (nt.a < eps) continue;
    pts.push([nt.a, 0], [nt.a, d]);
    if (nt.b > length - eps) {
      pts.push([length, d]);
    } else {
      pts.push([nt.b, d], [nt.b, 0]);
    }
  }
  if (!(bottom.length > 0 && bottom[bottom.length - 1]!.b > length - eps)) pts.push([length, 0]);

  // Top edge, right to left.
  const top = fromTop ? [...sorted].reverse() : [];
  const endsNotched = top.length > 0 && top[0]!.b > length - eps;
  if (endsNotched) pts.push([length, d], [top[0]!.a, d], [top[0]!.a, h]);
  else pts.push([length, h]);
  for (const nt of top) {
    if (nt.b > length - eps) continue;
    if (nt.a < eps) {
      pts.push([nt.b, h], [nt.b, d], [0, d]);
    } else {
      pts.push([nt.b, h], [nt.b, d], [nt.a, d], [nt.a, h]);
    }
  }
  if (!(top.length > 0 && top[top.length - 1]!.a < eps)) pts.push([0, h]);

  // Left end, top to bottom, back round to the start.
  if (startsNotched) pts.push([0, d], [bottom[0]!.b, d]);

  // Drop collinear and repeated points so every vertex is a real turn.
  const out: [number, number][] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev[0] - p[0]) < eps && Math.abs(prev[1] - p[1]) < eps) continue;
    out.push(p);
  }
  if (out.length > 1) {
    const [f, l] = [out[0]!, out[out.length - 1]!];
    if (Math.abs(f[0] - l[0]) < eps && Math.abs(f[1] - l[1]) < eps) out.pop();
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const p = out[(i + out.length - 1) % out.length]!;
      const c = out[i]!;
      const nn = out[(i + 1) % out.length]!;
      const cross = (c[0] - p[0]) * (nn[1] - c[1]) - (c[1] - p[1]) * (nn[0] - c[0]);
      if (Math.abs(cross) < eps) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return out;
}

/** "X1", "X1b": the line, 1-based from the front or left, and a letter once a strip is in pieces. */
export function pieceName(p: StripPiece, pieces: number, firstLine = 0): string {
  const base = `${p.axis.toUpperCase()}${p.line - firstLine + 1}`;
  return pieces > 1 ? base + String.fromCharCode(97 + p.index) : base;
}

interface GridfinityStripGridOptions {
  sizeBy: 'cells' | 'size';
  x: number;
  y: number;
  sizeX: number;
  sizeY: number;
  leftover: Leftover;
  h: number;
  slotFit: number;
  maxLength: number;
  etchIds: boolean;
  originX: number;
  originY: number;
}

const LEFTOVER_SIDES: Record<Leftover, [string, string]> = {
  centre: ['on each side', 'at front and back'],
  start: ['on the left', 'at the front'],
  end: ['on the right', 'at the back'],
};

class GridfinityStripGrid extends Boxes {
  constructor(
    private o: GridfinityStripGridOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /**
   * One axis: the cells as given, or as many as fit the overall size, with
   * the leftover laid out and reported.
   */
  private axis(count: number, size: number, param: string, across: boolean): AxisSpec | null {
    const t = this.thickness;
    if (this.o.sizeBy === 'cells') return axisSpec(count, t);

    const fit = Math.floor((size - t) / PITCH);
    if (fit < 1) {
      this.warn(`At least ${PITCH + t} mm fits one cell.`, param);
      return null;
    }
    const a = axisSpec(fit, t, size, this.o.leftover);
    const left = a.gaps[0] + a.gaps[1];
    if (left > 0.05) {
      const side = LEFTOVER_SIDES[this.o.leftover][across ? 0 : 1];
      const gap = Math.max(a.gaps[0], a.gaps[1]);
      const how = a.bays[0] || a.bays[1]
        ? `a border bay ${(gap - t).toFixed(1)} mm clear ${side}`
        : `the strips running ${gap.toFixed(1)} mm past them to the edge ${side}`;
      this.note(`${fit} cells fit, with ${how}.`, param);
    }
    return a;
  }

  /** Draw one strip from its nominal outline, the way rectangularWall traces with kerf. */
  private strip(length: number, h: number, outline: [number, number][], label: string, id: string): void {
    if (this.move(length, h, 'up', true)) return;

    // The outline starts at its lowest-left vertex, heading along +x: always a
    // convex corner, as rectangularWall's own start is.
    let s = 0;
    outline.forEach((p, i) => {
      const b = outline[s]!;
      if (p[1] < b[1] - 1e-9 || (Math.abs(p[1] - b[1]) < 1e-9 && p[0] < b[0])) s = i;
    });
    const pts = [...outline.slice(s), ...outline.slice(0, s)];
    const [x0, y0] = pts[0]!;
    this.moveTo(x0, y0);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const bb = pts[(i + 1) % pts.length]!;
      const c = pts[(i + 2) % pts.length]!;
      this.edge(Math.hypot(bb[0] - a[0], bb[1] - a[1]));
      const cross = (bb[0] - a[0]) * (c[1] - bb[1]) - (bb[1] - a[1]) * (c[0] - bb[0]);
      this.corner(cross > 0 ? 90 : -90);
    }

    if (id) {
      // The nominal outline sits a kerf above the path's start, as in
      // rectangularWall, so the etching is placed in that frame.
      this.savedContext(() => {
        this.moveTo(-x0, -y0 + this.burn);
        // Text hangs below its anchor here, as in boxes.py's SVG, so the
        // anchor goes half the text's height above the middle.
        const fs = Math.min(h * 0.5, 3);
        this.text(id, this.idAt, h / 2 + fs / 2, 0, 'center', fs, ETCHING);
      });
      this.ctx.moveTo(0, 0);
    }

    this.move(length, h, 'up', false, label);
  }

  /** Where the current strip's id goes: the middle of its first cell. */
  private idAt = 0;

  render(): void {
    const t = this.thickness;
    const ax = this.axis(this.o.x, this.o.sizeX, this.o.sizeBy === 'cells' ? 'x' : 'size_x', true);
    const ay = this.axis(this.o.y, this.o.sizeY, this.o.sizeBy === 'cells' ? 'y' : 'size_y', false);
    if (ax === null || ay === null) return;
    const nx = ax.n;
    const ny = ay.n;

    const [tMin, tMax] = THICKNESS_RANGE;
    if (t < tMin || t > tMax) {
      this.warn(
        `Bins seat well on strips ${tMin}–${tMax} mm thick. Thinner strips are floppy; thicker ones only catch the foot's bottom edge.`,
        'thickness',
      );
    }

    const hMin = minStripHeight(t);
    const h = this.o.h > 0 ? this.o.h : hMin;
    if (h < hMin) this.warn(`At least ${hMin} mm keeps a seated bin's foot off the floor at this thickness.`, 'h');

    // An outside piece ends at the perimeter strip's face, t/2 out, plus
    // whatever border runs on to the wall; one that starts at a break begins
    // with a whole slot's width. Allow for all of it, on the longer border.
    const border = Math.max(ax.gaps[0] + ax.gaps[1], ay.gaps[0] + ay.gaps[1]);
    const M = Math.floor((this.o.maxLength - t - Math.max(0, this.o.slotFit / 2) - border) / PITCH);
    if (M < 2 && (nx > M || ny > M)) {
      this.warn(`Strips need to span at least two cells (${Math.ceil(2 * PITCH + t + border)} mm here) to stagger their joints.`, 'max_length');
      return;
    }

    const w = t + this.o.slotFit;
    const { pieces } = stripGridLayout({
      nx,
      ny,
      maxCells: Math.max(M, 1),
      originX: this.o.originX,
      originY: this.o.originY,
      bays: { x: ax.bays, y: ay.bays },
    });
    const count = new Map<string, number>();
    for (const p of pieces) count.set(`${p.axis}${p.line}`, (count.get(`${p.axis}${p.line}`) ?? 0) + 1);

    // Longest first, so the rows read like a cut list; X before Y within a length.
    const drawn = pieces
      .map((p) => ({ p, run: p.axis === 'x' ? ax : ay }))
      .map(({ p, run }) => ({ p, run, g: pieceGeometry(p, t, w, run) }))
      .sort((a, b) => b.g.length - a.g.length || (a.p.axis < b.p.axis ? -1 : a.p.axis > b.p.axis ? 1 : 0));

    for (const { p, run, g } of drawn) {
      const across = p.axis === 'x' ? ay : ax;
      const name = pieceName(p, count.get(`${p.axis}${p.line}`)!, across.bays[0] ? -1 : 0);
      this.idAt = linePos(run, p.from, t) + PITCH / 2 - g.start;
      const outline = stripOutline(g.length, h, g.notches, p.axis === 'x');
      this.strip(g.length, h, outline, name, this.o.etchIds ? name : '');
    }
  }
}

const sizeMode = (v: ParamValues) => v['size_by'] === 'size';

export const gridfinityStripGrid: GeneratorDef = {
  meta: {
    id: 'gridfinitystripgrid',
    name: 'Gridfinity Strip Grid',
    group: 'Tray',
    summary: 'Gridfinity baseplate from slotted strips, for a fraction of the sheet',
    description:
      'An egg-crate of strips half-lapped on the Gridfinity pitch, instead of a ' +
      'plate with the openings cut out. Bins seat on the strips’ top corners by ' +
      'their chamfered feet. Size it by cells, or give a drawer’s inside size to ' +
      'fill it exactly. Strips longer than your laser takes are broken in a ' +
      'staggered bond so the grid holds together, and each piece is etched with ' +
      'where it goes.',
  },
  // Strips are long and thin: cut them along the grain, and keep the packer
  // from turning them across it.
  paramDefaults: { pack_rotate: false },
  params: [
    {
      key: 'size_by',
      kind: 'enum',
      label: 'Size by',
      default: 'cells',
      choices: [
        { value: 'cells', label: 'Cells', help: 'A grid of whole cells, as small as it can be.' },
        { value: 'size', label: 'Overall size', help: 'Fill a drawer: as many cells as fit, with the strips reaching its walls.' },
      ],
      group: 'dimensions',
    },
    { key: 'x', kind: 'number', label: 'Cells across', default: 4, min: 1, max: 50, step: 1, integer: true, group: 'dimensions', showIf: (v) => !sizeMode(v) },
    { key: 'y', kind: 'number', label: 'Cells deep', default: 3, min: 1, max: 50, step: 1, integer: true, group: 'dimensions', showIf: (v) => !sizeMode(v) },
    {
      key: 'size_x',
      kind: 'length',
      label: 'Overall width',
      unit: 'mm',
      default: 300,
      min: 50,
      max: 2000,
      step: 1,
      group: 'dimensions',
      help: 'The drawer’s inside width.',
      showIf: sizeMode,
    },
    {
      key: 'size_y',
      kind: 'length',
      label: 'Overall depth',
      unit: 'mm',
      default: 200,
      min: 50,
      max: 2000,
      step: 1,
      group: 'dimensions',
      help: 'The drawer’s inside depth.',
      showIf: sizeMode,
    },
    {
      key: 'leftover',
      kind: 'enum',
      label: 'Leftover goes',
      default: 'centre',
      choices: [
        { value: 'centre', label: 'Both sides equally' },
        { value: 'start', label: 'Left and front' },
        { value: 'end', label: 'Right and back' },
      ],
      group: 'dimensions',
      help: `Room past the last whole cell. Where it leaves ${MIN_BAY} mm or more, a strip at the wall makes a border bay; less, and the strips just run on to the wall.`,
      showIf: sizeMode,
    },
    {
      key: 'h',
      kind: 'length',
      label: 'Strip height',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 20,
      step: 0.1,
      group: 'dimensions',
      help: '0 picks the lowest that keeps a seated bin off the floor, which depends on the thickness.',
    },
    {
      key: 'max_length',
      kind: 'length',
      label: 'Longest strip',
      unit: 'mm',
      default: 300,
      min: 50,
      max: 2000,
      step: 1,
      group: 'joints',
      help: 'What your laser can cut, less its edge margin. Longer strips are broken, with the joints staggered so the grid holds together.',
    },
    {
      key: 'slot_fit',
      kind: 'length',
      label: 'Slot allowance',
      unit: 'mm',
      default: 0,
      min: -0.5,
      max: 1,
      step: 0.05,
      group: 'joints',
      help: 'Added to the material thickness for each slot. Raise it for a looser fit; kerf is already allowed for.',
    },
    { key: 'etch_ids', kind: 'bool', label: 'Etch strip ids', default: true, group: 'dimensions', help: 'X1 runs along the front, Y1 up the left; letters number the pieces of a broken strip from the start.' },
    {
      key: 'origin_x',
      kind: 'number',
      label: 'Grid offset across',
      default: 0,
      min: 0,
      max: 200,
      step: 1,
      integer: true,
      group: 'advanced',
      help: 'Where this grid starts in a larger one, in cells, so its joints continue the same stagger.',
    },
    {
      key: 'origin_y',
      kind: 'number',
      label: 'Grid offset deep',
      default: 0,
      min: 0,
      max: 200,
      step: 1,
      integer: true,
      group: 'advanced',
      help: 'Where this grid starts in a larger one, in cells, so its joints continue the same stagger.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new GridfinityStripGrid(
      {
        sizeBy: s(v, 'size_by', 'cells') === 'size' ? 'size' : 'cells',
        x: n(v, 'x', 4),
        y: n(v, 'y', 3),
        sizeX: n(v, 'size_x', 300),
        sizeY: n(v, 'size_y', 200),
        leftover: s(v, 'leftover', 'centre') as Leftover,
        h: n(v, 'h', 0),
        slotFit: n(v, 'slot_fit', 0),
        maxLength: n(v, 'max_length', 300),
        etchIds: b(v, 'etch_ids', true),
        originX: n(v, 'origin_x', 0),
        originY: n(v, 'origin_y', 0),
      },
      config,
    ),
};
