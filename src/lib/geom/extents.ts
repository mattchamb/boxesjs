/** Axis-aligned bounding box that grows as points are added. */
export class Extents {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;

  constructor(
    xmin = Number.POSITIVE_INFINITY,
    ymin = Number.POSITIVE_INFINITY,
    xmax = Number.NEGATIVE_INFINITY,
    ymax = Number.NEGATIVE_INFINITY,
  ) {
    this.xmin = xmin;
    this.ymin = ymin;
    this.xmax = xmax;
    this.ymax = ymax;
  }

  add(x: number, y: number): void {
    if (x < this.xmin) this.xmin = x;
    if (x > this.xmax) this.xmax = x;
    if (y < this.ymin) this.ymin = y;
    if (y > this.ymax) this.ymax = y;
  }

  extend(points: Iterable<readonly [number, number]>): void {
    for (const [x, y] of points) this.add(x, y);
  }

  /** Union with another box, returning a new box. */
  union(o: Extents): Extents {
    return new Extents(
      Math.min(this.xmin, o.xmin),
      Math.min(this.ymin, o.ymin),
      Math.max(this.xmax, o.xmax),
      Math.max(this.ymax, o.ymax),
    );
  }

  get width(): number {
    return this.xmax - this.xmin;
  }

  get height(): number {
    return this.ymax - this.ymin;
  }

  get isEmpty(): boolean {
    return !Number.isFinite(this.xmin) || !Number.isFinite(this.ymin);
  }

  static union(list: Iterable<Extents>): Extents {
    const out = new Extents();
    for (const e of list) {
      if (e.isEmpty) continue;
      out.add(e.xmin, e.ymin);
      out.add(e.xmax, e.ymax);
    }
    return out;
  }
}
