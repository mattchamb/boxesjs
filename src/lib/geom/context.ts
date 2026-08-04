/**
 * Path recording, ported from boxes.py `boxes/drawing.py`.
 *
 * `Context` is a small cairo-like drawing API with an affine transform stack.
 * The turtle graphics in `Boxes` never touch coordinates directly: they walk the
 * transform forward and draw at the origin, which is what makes kerf
 * compensation composable.
 *
 * Everything is kept as command objects rather than SVG strings so the same
 * geometry can be serialised to SVG, LightBurn, or measured for statistics.
 */
import { Affine } from './affine';
import { Extents } from './extents';
import type { RGB } from './colors';

export const EPS = 1e-4;
export const PADDING = 10;

/** Hard ceiling mirroring boxes.py, to stop a bad parameter melting the tab. */
const MAX_SEGMENTS = 100_000;

export function pointsEqual(x1: number, y1: number, x2: number, y2: number): boolean {
  return Math.abs(x1 - x2) < EPS && Math.abs(y1 - y2) < EPS;
}

export type FontStyle = 'serif' | 'sans-serif' | 'monospaced';
export type TextAlign = 'left' | 'middle' | 'end';

export interface TextParams {
  /** [style, bold, italic] */
  ff: [FontStyle, boolean, boolean];
  /** font size */
  fs: number;
  lw: number;
  rgb: RGB;
  align?: TextAlign;
  font?: string;
}

export interface PathParams {
  rgb: RGB;
  lw: number;
}

export type PathCmd =
  | { c: 'M'; x: number; y: number }
  | { c: 'L'; x: number; y: number }
  /** Cubic bézier. `x`/`y` is the *destination*; `x1..y2` are the control points. */
  | { c: 'C'; x: number; y: number; x1: number; y1: number; x2: number; y2: number }
  | { c: 'T'; x: number; y: number; m: Affine; text: string; params: TextParams };

export type InnerCorners = 'loop' | 'corner' | 'backarc';

function paramsEqual(a: PathParams, b: PathParams): boolean {
  return (
    a.lw === b.lw &&
    a.rgb[0] === b.rgb[0] &&
    a.rgb[1] === b.rgb[1] &&
    a.rgb[2] === b.rgb[2]
  );
}

/** Intersection of two infinite lines, plus whether it lands on both segments. */
export function lineIntersection(
  l1: [[number, number], [number, number]],
  l2: [[number, number], [number, number]],
): { intersect: boolean; x: number; y: number } {
  const xdiff: [number, number] = [l1[0][0] - l1[1][0], l2[0][0] - l2[1][0]];
  const ydiff: [number, number] = [l1[0][1] - l1[1][1], l2[0][1] - l2[1][1]];

  const det = (a: [number, number], b: [number, number]) => a[0] * b[1] - a[1] * b[0];

  const div = det(xdiff, ydiff);
  if (div === 0) return { intersect: false, x: 0, y: 0 };

  const d: [number, number] = [
    det([l1[0][0], l1[0][1]], [l1[1][0], l1[1][1]]),
    det([l2[0][0], l2[0][1]], [l2[1][0], l2[1][1]]),
  ];
  const x = det(d, xdiff) / div;
  const y = det(d, ydiff) / div;

  const onSegments =
    x + EPS >= Math.min(l1[0][0], l1[1][0]) &&
    x + EPS >= Math.min(l2[0][0], l2[1][0]) &&
    x - EPS <= Math.max(l1[0][0], l1[1][0]) &&
    x - EPS <= Math.max(l2[0][0], l2[1][0]) &&
    y + EPS >= Math.min(l1[0][1], l1[1][1]) &&
    y + EPS >= Math.min(l2[0][1], l2[1][1]) &&
    y - EPS <= Math.max(l1[0][1], l1[1][1]) &&
    y - EPS <= Math.max(l2[0][1], l2[1][1]);

  return { intersect: onSegments, x, y };
}

export class Path {
  path: PathCmd[];
  params: PathParams;

  constructor(path: PathCmd[], params: PathParams) {
    this.path = path;
    this.params = params;
  }

  extents(): Extents {
    const e = new Extents();
    for (const p of this.path) {
      e.add(p.x, p.y);
      if (p.c === 'T') {
        const h = p.params.fs;
        const l = p.text.length * h * 0.7;
        const align = p.params.align ?? 'left';
        const [start, end] =
          align === 'middle' ? [-0.5, 0.5] : align === 'end' ? [-1, 0] : [0, 1];
        for (const x of [start * l, end * l]) {
          for (const y of [0, h]) {
            const [tx, ty] = p.m.apply(x, y);
            e.add(tx, ty);
          }
        }
      }
    }
    return e;
  }

  transform(f: number, m: Affine, invertY = false): void {
    this.params.lw *= f;
    for (const c of this.path) {
      [c.x, c.y] = m.apply(c.x, c.y);
      if (c.c === 'C') {
        [c.x1, c.y1] = m.apply(c.x1, c.y1);
        [c.x2, c.y2] = m.apply(c.x2, c.y2);
      } else if (c.c === 'T') {
        c.m = m.mul(c.m);
        if (invertY) c.m = c.m.mul(Affine.scale(1, -1));
      }
    }
  }

  /**
   * Kerf compensation leaves a small self-intersecting loop at every inner
   * corner. Trim it back to the true intersection point so the laser does not
   * trace a redundant curl. `backarc` keeps the loop, which some people prefer
   * because it clears the corner radius for a press fit.
   */
  fasterEdges(innerCorners: InnerCorners): void {
    if (innerCorners !== 'backarc') {
      for (let i = 0; i < this.path.length; i++) {
        const p = this.path[i]!;
        if (p.c !== 'C' || i <= 1 || i >= this.path.length - 1) continue;
        const prev = this.path[i - 1]!;
        const next = this.path[i + 1]!;
        if (prev.c !== 'L' || next.c !== 'L') continue;

        const before = this.path[i - 2]!;
        const p11: [number, number] = [before.x, before.y];
        const p12: [number, number] = [prev.x, prev.y];
        const p21: [number, number] = [p.x, p.y];
        const p22: [number, number] = [next.x, next.y];

        // Only collapse loops smaller than the line width; anything bigger is
        // a real feature of the part.
        const dx = p12[0] - p21[0];
        const dy = p12[1] - p21[1];
        if (dx * dx + dy * dy > this.params.lw * this.params.lw) continue;

        const { intersect, x, y } = lineIntersection([p11, p12], [p21, p22]);
        if (!intersect) continue;

        this.path[i - 1] = { c: 'L', x, y };
        this.path[i] =
          innerCorners === 'loop'
            ? { c: 'C', x, y, x1: p12[0], y1: p12[1], x2: p21[0], y2: p21[1] }
            : { c: 'L', x, y };
      }
    }

    // Drop consecutive duplicates.
    if (this.path.length > 1) {
      const out: PathCmd[] = [];
      for (let i = 0; i < this.path.length; i++) {
        const cur = this.path[i]!;
        const prev = this.path[i === 0 ? this.path.length - 1 : i - 1]!;
        if (!sameCmd(cur, prev)) out.push(cur);
      }
      this.path = out;
    }
  }
}

function sameCmd(a: PathCmd, b: PathCmd): boolean {
  if (a.c !== b.c) return false;
  if (a.x !== b.x || a.y !== b.y) return false;
  if (a.c === 'C' && b.c === 'C') {
    return a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;
  }
  if (a.c === 'T') return false; // never dedupe text
  return true;
}

export class Part {
  name: string;
  /** Finished sub-paths. */
  pathes: Path[] = [];
  /** Path currently being accumulated, flushed by `stroke()`. */
  path: PathCmd[] = [];

  constructor(name: string) {
    this.name = name;
  }

  extents(): Extents {
    return Extents.union(this.pathes.map((p) => p.extents()));
  }

  transform(f: number, m: Affine, invertY = false): void {
    for (const p of this.pathes) p.transform(f, m, invertY);
  }

  append(cmd: PathCmd): void {
    this.path.push(cmd);
  }

  /**
   * Flush the working path. If it starts exactly where an earlier path of the
   * same colour ended, the two are joined — this is what keeps a part outline a
   * single continuous contour instead of dozens of fragments, which matters a
   * lot for cut quality and for LightBurn's path planner.
   */
  stroke(params: PathParams): Path | undefined {
    if (this.path.length === 0) return undefined;

    const first = this.path[0]!;
    const last = this.path[this.path.length - 1]!;
    if (!pointsEqual(first.x, first.y, last.x, last.y) && first.c !== 'T') {
      for (let i = this.pathes.length - 1; i >= 0; i--) {
        const p = this.pathes[i]!;
        const end = p.path[p.path.length - 1]!;
        if (pointsEqual(first.x, first.y, end.x, end.y) && paramsEqual(p.params, params)) {
          p.path.push(...this.path.slice(1));
          this.path = [];
          return p;
        }
      }
    }

    const p = new Path(this.path, params);
    this.pathes.push(p);
    this.path = [];
    return p;
  }

  moveTo(x: number, y: number): void {
    if (this.path.length === 0) {
      this.path.push({ c: 'M', x, y });
      return;
    }
    const last = this.path[this.path.length - 1]!;
    if (last.c === 'M') {
      this.path[this.path.length - 1] = { c: 'M', x, y };
    } else if (!pointsEqual(last.x, last.y, x, y)) {
      this.path.push({ c: 'M', x, y });
    }
  }
}

export class Surface {
  scale = 1.0;
  invertY = false;
  parts: Part[] = [];
  private _p: Part;
  private count = 0;

  constructor() {
    this._p = new Part('default');
    this.parts.push(this._p);
  }

  newPart(name = 'part'): Part {
    const last = this.parts[this.parts.length - 1];
    if (last && last.pathes.length === 0) {
      // Reuse the empty part rather than accumulating blanks.
      this._p.name = name;
      return this._p;
    }
    const p = new Part(name);
    this.parts.push(p);
    this._p = p;
    return p;
  }

  /** Name the part currently being drawn, for preview hover and export ids. */
  nameCurrentPart(name: string): void {
    this._p.name = name;
  }

  get currentPart(): Part {
    return this._p;
  }

  append(cmd: PathCmd): void {
    this.count++;
    if (this.count > MAX_SEGMENTS) {
      throw new Error(
        'Too many line segments - the parameters probably describe something far larger than intended',
      );
    }
    this._p.append(cmd);
  }

  stroke(params: PathParams): Path | undefined {
    return this._p.stroke(params);
  }

  moveTo(x: number, y: number): void {
    this._p.moveTo(x, y);
  }

  extents(): Extents {
    return Extents.union(this.parts.map((p) => p.extents()));
  }

  transform(f: number, m: Affine, invertY = false): void {
    for (const p of this.parts) p.transform(f, m, invertY);
  }

  /**
   * Translate everything so the drawing starts at the origin with a padding
   * margin, applying the y-flip if the target format wants y pointing down.
   * Returns the final page size.
   */
  adjustCoordinates(): Extents {
    const e = this.extents();
    e.xmin -= PADDING;
    e.ymin -= PADDING;
    e.xmax += PADDING;
    e.ymax += PADDING;

    let m = Affine.translation(-e.xmin, -e.ymin);
    if (this.invertY) {
      m = Affine.scale(this.scale, -this.scale).mul(m);
      m = Affine.translation(0, this.scale * e.height).mul(m);
    } else {
      m = Affine.scale(this.scale, this.scale).mul(m);
    }
    this.transform(this.scale, m, this.invertY);

    return new Extents(0, 0, e.width * this.scale, e.height * this.scale);
  }
}

interface ContextState {
  m: Affine;
  xy: [number, number];
  lw: number;
  rgb: RGB;
  mxy: [number, number];
}

/** cairo-like drawing context over a `Surface`. */
export class Context {
  private dwg: Surface;
  private stack: ContextState[] = [];
  private _m = Affine.identity();
  private _xy: [number, number] = [0, 0];
  private _mxy: [number, number] = [0, 0];
  private _lw = 0;
  private _rgb: RGB = [0, 0, 0];
  private _ff: [FontStyle, boolean, boolean] = ['sans-serif', false, false];
  private _fs = 10;

  constructor(surface: Surface) {
    this.dwg = surface;
  }

  save(): void {
    this.stack.push({
      m: this._m,
      xy: this._xy,
      lw: this._lw,
      rgb: this._rgb,
      mxy: this._mxy,
    });
    this._xy = [0, 0];
  }

  restore(): void {
    const s = this.stack.pop();
    if (!s) throw new Error('Context.restore() with empty stack');
    this._m = s.m;
    this._xy = s.xy;
    this._lw = s.lw;
    this._rgb = s.rgb;
    this._mxy = s.mxy;
  }

  // -- transforms -----------------------------------------------------------

  translate(x: number, y: number): void {
    this._m = this._m.mul(Affine.translation(x, y));
    this._xy = [0, 0];
  }

  scale(sx: number, sy: number): void {
    this._m = this._m.mul(Affine.scale(sx, sy));
  }

  /** Rotate by `r` radians. */
  rotate(r: number): void {
    this._m = this._m.mul(Affine.rotation((180 * r) / Math.PI));
  }

  setLineWidth(lw: number): void {
    this._lw = lw;
  }

  setSourceRGB(rgb: RGB): void {
    this._rgb = rgb;
  }

  get lineWidth(): number {
    return this._lw;
  }

  get matrix(): Affine {
    return this._m;
  }

  // -- path ------------------------------------------------------------------

  private addMove(): void {
    this.dwg.moveTo(this._mxy[0], this._mxy[1]);
  }

  moveTo(x: number, y: number): void {
    this._xy = [x, y];
    this._mxy = this._m.apply(x, y);
  }

  lineTo(x: number, y: number): void {
    this.addMove();
    const [x1, y1] = this._mxy;
    this._xy = [x, y];
    this._mxy = this._m.apply(x, y);
    const [x2, y2] = this._mxy;
    if (!pointsEqual(x1, y1, x2, y2)) {
      this.dwg.append({ c: 'L', x: x2, y: y2 });
    }
  }

  /**
   * Arc as a single cubic bézier. The control-point formula is the same one
   * boxes.py uses, kept verbatim so exported geometry matches to the micron.
   */
  private _arc(
    xc: number,
    yc: number,
    radius: number,
    angle1: number,
    angle2: number,
  ): void {
    if (Math.abs(angle1 - angle2) < EPS || radius < EPS) return;

    const x1 = radius * Math.cos(angle1) + xc;
    const y1 = radius * Math.sin(angle1) + yc;
    const x4 = radius * Math.cos(angle2) + xc;
    const y4 = radius * Math.sin(angle2) + yc;

    const ax = x1 - xc;
    const ay = y1 - yc;
    const bx = x4 - xc;
    const by = y4 - yc;
    const q1 = ax * ax + ay * ay;
    const q2 = q1 + ax * bx + ay * by;
    const k2 = ((4 / 3) * (Math.sqrt(2 * q1 * q2) - q2)) / (ax * by - ay * bx);

    const x2 = xc + ax - k2 * ay;
    const y2 = yc + ay + k2 * ax;
    const x3 = xc + bx + k2 * by;
    const y3 = yc + by - k2 * bx;

    const [mx2, my2] = this._m.apply(x2, y2);
    const [mx3, my3] = this._m.apply(x3, y3);
    const [mx4, my4] = this._m.apply(x4, y4);

    this.addMove();
    this.dwg.append({ c: 'C', x: mx4, y: my4, x1: mx2, y1: my2, x2: mx3, y2: my3 });
    this._xy = [x4, y4];
    this._mxy = [mx4, my4];
  }

  arc(xc: number, yc: number, radius: number, angle1: number, angle2: number): void {
    this._arc(xc, yc, radius, angle1, angle2);
  }

  arcNegative(xc: number, yc: number, radius: number, angle1: number, angle2: number): void {
    this._arc(xc, yc, radius, angle1, angle2);
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    const [mx1, my1] = this._m.apply(x1, y1);
    const [mx2, my2] = this._m.apply(x2, y2);
    const [mx3, my3] = this._m.apply(x3, y3);
    this.addMove();
    this.dwg.append({ c: 'C', x: mx3, y: my3, x1: mx1, y1: my1, x2: mx2, y2: my2 });
    this._xy = [x3, y3];
    this._mxy = [mx3, my3];
  }

  stroke(): void {
    this.dwg.stroke({ rgb: this._rgb, lw: this._lw });
    this._xy = [0, 0];
  }

  rectangle(x: number, y: number, width: number, height: number): void {
    this.stroke();
    this.moveTo(x, y);
    this.lineTo(x + width, y);
    this.lineTo(x + width, y + height);
    this.lineTo(x, y + height);
    this.lineTo(x, y);
    this.stroke();
  }

  // -- text ------------------------------------------------------------------

  setFont(style: FontStyle, bold = false, italic = false): void {
    this._ff = [style, bold, italic];
  }

  setFontSize(fs: number): void {
    this._fs = fs;
  }

  get fontSize(): number {
    return this._fs;
  }

  showText(text: string, extra: Partial<TextParams> = {}): void {
    const params: TextParams = {
      ff: this._ff,
      fs: this._fs,
      lw: this._lw,
      rgb: this._rgb,
      ...extra,
    };
    const [mx0, my0] = this._m.apply(this._xy[0], this._xy[1]);
    this.dwg.append({ c: 'T', x: mx0, y: my0, m: this._m, text, params });
  }

  /** Rough metrics; boxes.py uses the same approximation for label placement. */
  textExtents(text: string): { width: number; height: number } {
    return { width: 0.6 * this._fs * text.length, height: 0.65 * this._fs };
  }

  getCurrentPoint(): [number, number] {
    return this._xy;
  }

  newPart(name?: string): void {
    this.dwg.newPart(name);
  }

  nameCurrentPart(name: string): void {
    this.dwg.nameCurrentPart(name);
  }
}
