/**
 * 2D affine transform, matching the surface of the Python `affine` package that
 * boxes.py relies on.
 *
 *   | a  b  c |
 *   | d  e  f |
 *   | 0  0  1 |
 *
 * Element order is the same as `affine.Affine`, so index 0..5 maps to a..f. The
 * SVG/LightBurn writers depend on that ordering when they emit a matrix.
 */
export class Affine {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;

  constructor(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }

  static identity(): Affine {
    return new Affine(1, 0, 0, 0, 1, 0);
  }

  static translation(x: number, y: number): Affine {
    return new Affine(1, 0, x, 0, 1, y);
  }

  static scale(sx: number, sy: number = sx): Affine {
    return new Affine(sx, 0, 0, 0, sy, 0);
  }

  /** Rotation by `degrees` counter-clockwise. */
  static rotation(degrees: number): Affine {
    const rad = (degrees * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Affine(c, -s, 0, s, c, 0);
  }

  /** Matrix product `this * other` (apply `other` first, then `this`). */
  mul(o: Affine): Affine {
    return new Affine(
      this.a * o.a + this.b * o.d,
      this.a * o.b + this.b * o.e,
      this.a * o.c + this.b * o.f + this.c,
      this.d * o.a + this.e * o.d,
      this.d * o.b + this.e * o.e,
      this.d * o.c + this.e * o.f + this.f,
    );
  }

  /** Transform a point. */
  apply(x: number, y: number): [number, number] {
    return [this.a * x + this.b * y + this.c, this.d * x + this.e * y + this.f];
  }

  /** Element access by `affine` package index, 0..5 => a..f. */
  at(i: number): number {
    switch (i) {
      case 0: return this.a;
      case 1: return this.b;
      case 2: return this.c;
      case 3: return this.d;
      case 4: return this.e;
      case 5: return this.f;
      default: throw new RangeError(`Affine index out of range: ${i}`);
    }
  }

  /** Six numbers in SVG `matrix(a b c d e f)` order. */
  toSVGMatrix(): [number, number, number, number, number, number] {
    return [this.a, this.d, this.b, this.e, this.c, this.f];
  }
}
