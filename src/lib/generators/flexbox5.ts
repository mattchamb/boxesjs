/**
 * Flex box 5 — ported from boxes.py `boxes/generators/flexbox5.py`
 * (class `FlexBox5`).
 *
 * A box whose sides are rounded at both ends, top and bottom, each end to
 * its own diameter, joined by straight runs. The wall bends round both ends
 * as a living hinge and carries on as a lid that latches shut.
 */
import { Boxes, type BoxesConfig, type Callback } from '../boxes';
import type { FlexEdge } from '../edges/flex';
import { FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface FlexBox5Options {
  x: number;
  h: number;
  outside: boolean;
  topDiameter: number;
  bottomDiameter: number;
  /** In multiples of the thickness. */
  latchsize: number;
}

class FlexBox5 extends Boxes {
  private x: number;
  private h: number;
  private topDiameter: number;
  private bottomDiameter: number;
  private latchsize: number;
  /** Tilt of the straight runs, and their length; set in render(). */
  private a = 0;
  private l = 0;

  constructor(
    private o: FlexBox5Options,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.x = o.x;
    this.h = o.h;
    this.topDiameter = o.topDiameter;
    this.bottomDiameter = o.bottomDiameter;
    this.latchsize = o.latchsize;
  }

  private flexBoxSide(opts: { callback?: Callback; move?: string; label?: string } = {}): void {
    const t = this.thickness;
    const { callback = null, move } = opts;

    const [r1, r2] = [this.topDiameter / 2, this.bottomDiameter / 2];
    const { a, l } = this;

    const [tw, th] = [l + r1 + r2, 2 * Math.max(r1, r2) + 2 * t];

    if (this.move(tw, th, move, true)) return;

    this.moveTo(r2, t);

    this.cc(callback, 0);
    this.getEdge('f').call(l);
    this.corner(180 + 2 * a, r1);
    this.cc(callback, 1);
    this.latch(this.latchsize);
    this.cc(callback, 2);
    this.getEdge('f').call(l - this.latchsize);
    this.corner(180 - 2 * a, r2);

    this.move(tw, th, move, false, opts.label ?? '');
  }

  /**
   * The bent wall and lid. boxes.py names this `surroundingWall`, shadowing
   * the base class's, which has a different signature.
   */
  private flexWall(move?: string): void {
    const t = this.thickness;

    const [r1, r2] = [this.topDiameter / 2, this.bottomDiameter / 2];
    const { h, a, l } = this;
    const F = this.getEdge('F');
    const X = this.getEdge('X') as FlexEdge;

    const c1 = (180 + 2 * a) * DEG * r1;
    const c2 = (180 - 2 * a) * DEG * r2;

    const tw = 2 * l + c1 + c2;
    const th = h + 2.5 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(0, 0.25 * t);

    F.call(l - this.latchsize);
    X.call(c2, { h: h + 2 * t });
    F.call(l);
    X.call(c1, { h: h + 2 * t });
    this.latch(this.latchsize, false);
    this.edge(h + 2 * t);
    this.latch(this.latchsize, false, true);
    this.edge(c1);
    F.call(l);
    this.edge(c2);
    F.call(l - this.latchsize);
    this.corner(90);
    this.edge(h + 2 * t);
    this.corner(90);

    this.move(tw, th, move, false, 'wall');
  }

  render(): void {
    if (this.o.outside) {
      this.x = this.adjustSize(this.x);
      this.h = this.adjustSize(this.h);
      this.topDiameter = this.adjustSize(this.topDiameter);
      this.bottomDiameter = this.adjustSize(this.bottomDiameter);
    }

    const t = this.thickness;
    this.latchsize *= t;
    const [dT, dB] = [this.topDiameter, this.bottomDiameter];
    // Long enough for the latch between the two rounded ends.
    this.x = Math.max(this.x, this.latchsize + 2 * t + (dT + dB) / 2);

    const dC = this.x - dT / 2 - dB / 2;
    const s = (dT - dB) / 2 / dC;
    if (Math.abs(s) > 1) {
      // boxes.py takes asin of this and fails; no straight run can join ends
      // that far apart in size over so short a length.
      this.warn('The two diameters differ by more than the length allows. Make the box longer or the diameters closer.', 'x');
      return;
    }
    this.a = Math.asin(s) / DEG;
    this.l = dC * Math.cos(this.a * DEG);

    this.flexWall('up');
    this.flexBoxSide({ move: 'right', label: 'left' });
    this.flexBoxSide({ move: 'mirror', label: 'right' });
  }
}

export const flexBox5: GeneratorDef = {
  meta: {
    id: 'flexbox5',
    name: 'Flex Box 5',
    group: 'Box',
    summary: 'Box rounded at both ends, each to its own size, bent from a living hinge',
    description:
      'The sides are rounded at the top and the bottom, each end to its own ' +
      'diameter, with straight runs between. The wall bends round both ends ' +
      'and carries on as a lid that latches shut.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Length', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Top to bottom of the sides. Lengthened if the ends and latch need more.' },
    { key: 'h', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions', help: 'Between the two sides.' },
    { key: 'top_diameter', kind: 'length', label: 'Top diameter', unit: 'mm', default: 60, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'bottom_diameter', kind: 'length', label: 'Bottom diameter', unit: 'mm', default: 60, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    { key: 'latchsize', kind: 'number', label: 'Latch size', unit: '× thickness', default: 8, min: 2, max: 30, step: 0.5, group: 'top' },
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new FlexBox5(
      {
        x: n(v, 'x', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        topDiameter: n(v, 'top_diameter', 60),
        bottomDiameter: n(v, 'bottom_diameter', 60),
        latchsize: n(v, 'latchsize', 8),
      },
      config,
    ),
};
