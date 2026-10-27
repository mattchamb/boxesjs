/**
 * Flex box — ported from boxes.py `boxes/generators/flexbox.py`
 * (class `FlexBox`).
 *
 * A box whose walls are one long piece bent round four rounded corners as a
 * living hinge. The same piece carries on over the top as a lid, which
 * latches shut at the front. The sides are flat panels; with several
 * compartments, the middle ones become dividers.
 */
import { Boxes, type BoxesConfig, type Callback } from '../boxes';
import type { FlexEdge } from '../edges/flex';
import { FLEX_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

interface FlexBoxOptions {
  sx: number[];
  y: number;
  h: number;
  outside: boolean;
  radius: number;
  /** In multiples of the thickness. */
  latchsize: number;
}

class FlexBox extends Boxes {
  private sx: number[];
  private x = 0;
  private y: number;
  private h: number;
  private radius: number;
  private latchsize: number;

  constructor(
    private o: FlexBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.sx = [...o.sx];
    this.y = o.y;
    this.h = o.h;
    this.radius = o.radius;
    this.latchsize = o.latchsize;
  }

  /** A side, or a divider when `middle`, which has no latch to catch. */
  private flexBoxSide(y: number, h: number, r: number, opts: { middle?: boolean; callback?: Callback; move?: string; label?: string } = {}): void {
    const t = this.thickness;
    const { callback = null, move } = opts;

    if (this.move(y + 2 * t, h + t, move, true)) return;

    this.moveTo(t + r, t);

    for (const [i, l] of [y, h].entries()) {
      this.cc(callback, i);
      this.getEdge('f').call(l - 2 * r);
      this.corner(90, r);
    }

    this.cc(callback, 2);
    this.edge(y - 2 * r);
    this.corner(90, r);
    this.cc(callback, 3);
    if (opts.middle) this.edge(this.latchsize);
    else this.latch(this.latchsize);
    this.cc(callback, 4);
    this.getEdge('f').call(h - 2 * r - this.latchsize);
    this.corner(90, r);

    this.move(y + 2 * t, h + t, move, false, opts.label ?? '');
  }

  /** Slots for the dividers, across a run of the wall. */
  private fingerHoles(l: number): void {
    const t = this.thickness;
    let pos = -0.5 * t;
    for (const x of this.sx.slice(0, -1)) {
      pos += x + t;
      this.fingerHolesAt(0, pos, l, 0);
    }
  }

  /**
   * The bent wall and lid in one piece. boxes.py names this `surroundingWall`,
   * shadowing the base class's, which has a different signature.
   */
  private flexWall(move?: string): void {
    const { x, y, h, radius: r } = this;
    const t = this.thickness;
    const c4 = Math.PI * r * 0.5;
    const F = this.getEdge('F');
    const X = this.getEdge('X') as FlexEdge;

    const tw = 2 * y + 2 * h - 8 * r + 4 * c4;
    const th = x + 2.5 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(0, 0.25 * t);

    this.fingerHoles(h - 2 * r - this.latchsize);
    F.call(h - 2 * r - this.latchsize);
    if (y - 2 * r < t) {
      X.call(2 * c4 + y - 2 * r, { h: x + 2 * t });
    } else {
      X.call(c4, { h: x + 2 * t });
      this.fingerHoles(y - 2 * r);
      F.call(y - 2 * r);
      X.call(c4, { h: x + 2 * t });
    }
    this.fingerHoles(h - 2 * r);
    F.call(h - 2 * r);
    if (y - 2 * r < t) {
      X.call(2 * c4 + y - 2 * r, { h: x + 2 * t });
    } else {
      X.call(c4, { h: x + 2 * t });
      this.edge(y - 2 * r);
      X.call(c4, { h: x + 2 * t });
    }
    this.latch(this.latchsize, false);
    this.edge(x + 2 * t);
    this.latch(this.latchsize, false, true);
    this.edge(c4);
    this.edge(y - 2 * r);
    this.edge(c4);
    F.call(h - 2 * r);
    this.edge(c4);
    F.call(y - 2 * r);
    this.edge(c4);
    F.call(h - 2 * r - this.latchsize);
    this.corner(90);
    this.edge(x + 2 * t);
    this.corner(90);

    this.move(tw, th, move, false, 'wall');
  }

  render(): void {
    if (this.o.outside) {
      this.sx = this.adjustSize(this.sx);
      this.y = this.adjustSize(this.y);
      this.h = this.adjustSize(this.h);
    }

    const { sx, y, h } = this;
    this.x = sx.reduce((a, c) => a + c, 0) + (sx.length - 1) * this.thickness;

    this.latchsize *= this.thickness;
    let r = this.radius || Math.min(y, h - this.latchsize) / 2.0;
    r = Math.min(r, y / 2.0);
    this.radius = Math.min(r, Math.max(0, (h - this.latchsize) / 2.0));

    this.flexWall('up');
    for (let i = 0; i < sx.length; i++) {
      this.flexBoxSide(this.y, this.h, this.radius, { middle: i > 0, move: 'right', label: i > 0 ? `divider ${i}` : 'left' });
    }
    this.flexBoxSide(this.y, this.h, this.radius, { move: 'mirror', label: 'right' });
  }
}

export const flexBox: GeneratorDef = {
  meta: {
    id: 'flexbox',
    name: 'Flex Box',
    group: 'Box',
    summary: 'Box with rounded corners and a lid, bent from one living-hinge piece',
    description:
      'The walls and the lid are one piece, bent round four rounded corners ' +
      'as a living hinge, and the lid latches shut at the front. Split it ' +
      'into compartments to add dividers.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartment widths, left to right',
      default: '100',
      group: 'dimensions',
      itemLabel: 'compartment',
    },
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
    {
      key: 'latchsize',
      kind: 'number',
      label: 'Latch size',
      unit: '× thickness',
      default: 8,
      min: 2,
      max: 30,
      step: 0.5,
      group: 'top',
    },
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new FlexBox(
      {
        sx: parseSections(s(v, 'sx', '100')),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        radius: n(v, 'radius', 15),
        latchsize: n(v, 'latchsize', 8),
      },
      config,
    ),
};
