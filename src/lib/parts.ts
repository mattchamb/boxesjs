/**
 * Standalone parts, ported from boxes.py `boxes/parts.py`.
 *
 * In boxes.py `Parts` is a thin proxy: it defines a handful of part shapes and
 * forwards everything else to the `Boxes` instance it hangs off as
 * `self.parts`. Keeping that shape means generator code translates line for
 * line, and leaves the other parts (`wavyKnob`, `roundKnob`) somewhere obvious
 * to land if they are ever needed.
 */
import type { Boxes } from './boxes';

const DEG = Math.PI / 180;

export class Parts {
  constructor(private boxes: Boxes) {}

  /**
   * Simple disc.
   *
   * `dwidth` flattens the right-hand side to the given ratio of the diameter,
   * so 1.0 is a full circle. boxes.py calls the callback with no index, so this
   * takes a plain function rather than the usual per-side callback array.
   */
  disc(
    diameter: number,
    opts: {
      hole?: number;
      dwidth?: number;
      callback?: (() => void) | null;
      move?: string | null;
      label?: string;
    } = {},
  ): void {
    const { hole = 0, dwidth = 1.0, callback, move, label = '' } = opts;
    const b = this.boxes;

    const size = diameter;
    const r = diameter / 2.0;

    if (b.move(size * dwidth, size, move, true, label)) return;

    b.moveTo(size / 2, size / 2);

    if (hole) b.hole(0, 0, hole / 2);

    b.cc(callback, 0, 0, 0);
    if (dwidth === 1.0) {
      b.moveTo(r + b.burn, 0, 90);
      b.corner(360, r, 6);
    } else {
      const w = (2.0 * dwidth - 1) * r;
      const a = Math.acos(w / r) / DEG;
      b.moveTo(0, 0, -a);
      b.moveTo(r, 0, -90);
      b.corner(-360 + 2 * a, r);
      b.corner(-a);
      b.edge(2 * r * Math.sin(a * DEG));
    }
    b.move(size * dwidth, size, move, false, label);
  }
}
