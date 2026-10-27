/**
 * Flex box 4 — ported from boxes.py `boxes/generators/flexbox4.py`
 * (class `FlexBox4`).
 *
 * Like Flex Box 2, but the bent piece runs up the back, over the top and all
 * the way down the front to latch at the bottom, so the front is part of
 * the lid. Only the bottom is a separate flat panel.
 */
import { Boxes, type BoxesConfig, type Callback } from '../boxes';
import type { FlexEdge } from '../edges/flex';
import { FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface FlexBox4Options {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  radius: number;
  /** In multiples of the thickness. */
  latchsize: number;
}

class FlexBox4 extends Boxes {
  private x: number;
  private y: number;
  private h: number;
  private radius: number;
  private latchsize: number;
  /** A quarter circle of the corner radius; set in render(). */
  private c4 = 0;

  constructor(
    private o: FlexBox4Options,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.x = o.x;
    this.y = o.y;
    this.h = o.h;
    this.radius = o.radius;
    this.latchsize = o.latchsize;
  }

  private flexBoxSide(y: number, h: number, r: number, opts: { callback?: Callback; move?: string; label?: string } = {}): void {
    const t = this.thickness;
    const { callback = null, move } = opts;
    if (this.move(y + 2 * t, h + t, move, true)) return;

    this.moveTo(t, t);
    this.cc(callback, 0);
    this.getEdge('f').call(y);
    this.corner(90, 0);
    this.cc(callback, 1);
    this.getEdge('f').call(h - r);
    this.corner(90, r);
    this.cc(callback, 2);
    this.edge(y - 2 * r);
    this.corner(90, r);
    this.cc(callback, 3);
    this.getEdge('e').call(h - r - this.latchsize);
    this.cc(callback, 4);
    this.latch(this.latchsize);
    this.corner(90);

    this.move(y + 2 * t, h + t, move, false, opts.label ?? '');
  }

  /**
   * The bent back, lid and front, down to the latch. boxes.py names this
   * `surroundingWall`, shadowing the base class's, which has a different
   * signature.
   */
  private flexWall(move?: string): void {
    const { y, h, x, radius: r, c4 } = this;
    const t = this.thickness;
    const F = this.getEdge('F');
    const X = this.getEdge('X') as FlexEdge;

    const tw = 2 * c4 + 2 * h + y - 4 * r + 2 * t;
    const th = x + 2.5 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(t, 0.25 * t);
    F.call(h - r);

    if (y - 2 * r < t) {
      X.call(2 * c4 + y - 2 * r, { h: x + 2 * t });
    } else {
      X.call(c4, { h: x + 2 * t });
      this.edge(y - 2 * r);
      X.call(c4, { h: x + 2 * t });
    }

    this.edge(h - r - this.latchsize);
    this.latch(this.latchsize, false, false, t);
    this.edge(x + 2 * t);
    this.latch(this.latchsize, false, true, t);
    this.edge(h - r - this.latchsize);
    this.edge(c4);
    this.edge(y - 2 * r);
    this.edge(c4);
    F.call(h - r);
    this.corner(90);
    this.edge(t);
    this.getEdge('f').call(x);
    this.edge(t);
    this.corner(90);

    this.move(tw, th, move, false, 'wall');
  }

  render(): void {
    if (this.o.outside) {
      this.y = this.adjustSize(this.y);
      this.h = this.adjustSize(this.h);
      this.x = this.adjustSize(this.x);
    }

    this.latchsize *= this.thickness;
    this.radius = this.radius || Math.min(this.y / 2.0, this.h - this.latchsize);
    this.radius = Math.min(this.radius, this.y / 2.0);
    this.radius = Math.min(this.radius, Math.max(0, this.h - this.latchsize));
    this.c4 = Math.PI * this.radius * 0.5;

    this.flexWall('up');
    this.flexBoxSide(this.y, this.h, this.radius, { move: 'right', label: 'left' });
    this.flexBoxSide(this.y, this.h, this.radius, { move: 'mirror right', label: 'right' });
    this.rectangularWall(this.y, this.x, 'FeFF', { label: 'bottom' });
  }
}

export const flexBox4: GeneratorDef = {
  meta: {
    id: 'flexbox4',
    name: 'Flex Box 4',
    group: 'Box',
    summary: 'Box whose lid and front bend from a living hinge, latching at the bottom',
    description:
      'Only the two top corners are rounded. One piece runs up the back, ' +
      'bends over the top and down the front, and latches at the bottom, so ' +
      'the whole front opens with the lid.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
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
      help: 'Kept small enough to fit the depth and height. 0 makes it as large as fits.',
    },
    { key: 'latchsize', kind: 'number', label: 'Latch size', unit: '× thickness', default: 8, min: 2, max: 30, step: 0.5, group: 'top' },
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new FlexBox4(
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
