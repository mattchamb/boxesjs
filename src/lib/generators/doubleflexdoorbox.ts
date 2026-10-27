/**
 * Double flex door box — ported from boxes.py
 * `boxes/generators/doubleflexdoorbox.py` (class `DoubleFlexDoorBox`).
 *
 * A box with four rounded corners whose wall is one living-hinge piece that
 * carries on round the top as two doors, meeting in the middle and latching
 * to each other.
 */
import { Boxes, type BoxesConfig, type Callback } from '../boxes';
import type { FlexEdge } from '../edges/flex';
import { FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface DoubleFlexDoorBoxOptions {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  radius: number;
  /** In multiples of the thickness. */
  latchsize: number;
}

class DoubleFlexDoorBox extends Boxes {
  private latchsize: number;

  constructor(
    private o: DoubleFlexDoorBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.latchsize = o.latchsize;
  }

  private flexBoxSide(x: number, y: number, r: number, opts: { callback?: Callback; move?: string; label?: string } = {}): void {
    const t = this.thickness;
    const { callback = null, move } = opts;
    const ll = (x - 2 * r) / 2 - this.latchsize;

    if (this.move(x + 2 * t, y + 2 * t, move, true)) return;

    this.moveTo(t + r, t);

    for (const [i, l] of [x, y].entries()) {
      this.cc(callback, i);
      this.getEdge('f').call(l - 2 * r);
      this.corner(90, r);
    }

    // The two doors' latches meet in the middle of the top.
    this.cc(callback, 2);
    this.edge(ll);
    this.latch(this.latchsize);
    this.latch(this.latchsize, true, true);
    this.edge(ll);

    this.corner(90, r);
    this.cc(callback, 3);
    this.getEdge('f').call(y - 2 * r);
    this.corner(90, r);

    this.move(x + 2 * t, y + 2 * t, move, false, opts.label ?? '');
  }

  /**
   * The bent wall and both doors. boxes.py names this `surroundingWall`,
   * shadowing the base class's, which has a different signature.
   */
  private flexWall(x: number, y: number, h: number, r: number, move?: string): void {
    const t = this.thickness;
    const c4 = Math.PI * r * 0.5;
    const F = this.getEdge('F');
    const X = this.getEdge('X') as FlexEdge;
    const ls = this.latchsize;

    const tw = 2 * x + 2 * y - 8 * r + 4 * c4;
    const th = h + 2.5 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(0, 0.25 * t, -90);

    this.latch(ls, false, true);
    this.edge((x - 2 * r) / 2 - ls);
    if (y - 2 * r < t) {
      X.call(2 * c4 + y - 2 * r, { h: h + 2 * t });
    } else {
      X.call(c4, { h: h + 2 * t });
      F.call(y - 2 * r);
      X.call(c4, { h: h + 2 * t });
    }
    F.call(x - 2 * r);
    if (y - 2 * r < t) {
      X.call(2 * c4 + y - 2 * r, { h: h + 2 * t });
    } else {
      X.call(c4, { h: h + 2 * t });
      F.call(y - 2 * r);
      X.call(c4, { h: h + 2 * t });
    }
    this.edge((x - 2 * r) / 2 - ls);
    this.latch(ls, false);
    this.edge(h + 2 * t);
    this.latch(ls, false, true);
    this.edge((x - 2 * r) / 2 - ls);
    this.edge(c4);
    F.call(y - 2 * r);
    this.edge(c4);
    F.call(x - 2 * r);
    this.edge(c4);
    F.call(y - 2 * r);
    this.edge(c4);
    this.edge((x - 2 * r) / 2 - ls);
    this.latch(ls, false, false);
    this.edge(h + 2 * t);

    this.move(tw, th, move, false, 'wall');
  }

  render(): void {
    let { x, y, h } = this.o;
    if (this.o.outside) {
      x = this.adjustSize(x);
      y = this.adjustSize(y);
      h = this.adjustSize(h);
    }

    const t = this.thickness;
    this.latchsize *= t;
    let r = this.o.radius || Math.min(x - 2 * this.latchsize, y) / 2.0;
    r = Math.min(r, y / 2.0);
    r = Math.min(r, Math.max(0, (x - 2 * this.latchsize) / 2.0));

    // boxes.py swaps y and h here for more consistent axis names.
    this.flexWall(x, h, y, r, 'up');
    this.flexBoxSide(x, h, r, { move: 'right', label: 'left' });
    this.flexBoxSide(x, h, r, { move: 'mirror', label: 'right' });
  }
}

export const doubleFlexDoorBox: GeneratorDef = {
  meta: {
    id: 'doubleflexdoorbox',
    name: 'Double Flex Door Box',
    group: 'Box',
    summary: 'Rounded box whose two lid halves bend open from a living hinge',
    description:
      'All four corners are rounded, and the wall carries on round the top ' +
      'as two doors that bend open either way and latch to each other in ' +
      'the middle.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Across the doors.' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Between the two sides.' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'radius',
      kind: 'length',
      label: 'Corner radius',
      unit: 'mm',
      default: 15,
      min: 0,
      max: 300,
      step: 1,
      group: 'dimensions',
      help: 'Kept small enough to leave room for the latches. 0 makes it as large as fits.',
    },
    { key: 'latchsize', kind: 'number', label: 'Latch size', unit: '× thickness', default: 8, min: 2, max: 30, step: 0.5, group: 'top' },
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new DoubleFlexDoorBox(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        radius: n(v, 'radius', 15),
        latchsize: n(v, 'latchsize', 8),
      },
      config,
    ),
};
