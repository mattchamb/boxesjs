/**
 * Sliding drawer — ported from boxes.py `boxes/generators/slidingdrawer.py`.
 *
 * An open-fronted sleeve and a drawer that slides into it. The drawer's front
 * is grooved to give a finger something to pull on.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { CompoundEdge } from '../edges/base';
import { groovedParams } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface SlidingDrawerOptions {
  x: number;
  y: number;
  h: number;
  hi: number;
  outside: boolean;
  play: number;
}

class SlidingDrawer extends Boxes {
  constructor(private o: SlidingDrawerOptions, config: Partial<BoxesConfig>) {
    super(config);
  }

  render(): void {
    let x = this.adjustSize(this.o.x);
    let y = this.adjustSize(this.o.y);
    let h = this.adjustSize(this.o.h);
    let hi = !this.o.hi ? h : this.adjustSize(this.o.hi);

    const t = this.thickness;
    const p = this.o.play * t;

    // boxes.py shrinks by the walls before testing `outside`, then adds them
    // back (and more) for inside measurements. The order matters to the result.
    y = y + t;
    if (!this.o.outside) {
      x = x + 4 * t + 2 * p;
      y = y + 3 * t + 2 * p;
      h = h + 3 * t + 2 * p;
      hi = hi + 3 * t + 2 * p;
    }

    const x2 = x - (2 * t + 2 * p);
    const y2 = y - (2 * t + 2 * p);
    const h2 = h - (t + 2 * p);
    hi = hi - (t + 2 * p);
    const e1: EdgeSpec = hi !== h2 ? new CompoundEdge(this, [this.getEdge('F'), this.getEdge('E')], [hi, h2 - hi]) : 'F';
    const e2: EdgeSpec = hi !== h2 ? new CompoundEdge(this, [this.getEdge('E'), this.getEdge('F')], [h2 - hi, hi]) : 'F';

    this.rectangularWall(x2, hi, 'FFeF', { label: 'in box wall', move: 'right' });
    this.rectangularWall(y2, hi, 'ffef', { label: 'in box wall', move: 'up' });
    this.rectangularWall(y2, hi, 'ffef', { label: 'in box wall' });
    this.rectangularWall(x2, h2, ['F', e1, 'z', e2], { label: 'in box wall', move: 'left up' });
    this.rectangularWall(y2, x2, 'FfFf', { label: 'in box bottom', move: 'up' });

    this.rectangularWall(y, x, 'FFFe', { label: 'out box bottom', move: 'right' });
    this.rectangularWall(y, x, 'FFFe', { label: 'out box top', move: 'up' });
    this.rectangularWall(y, h, 'fffe', { label: 'out box wall' });
    this.rectangularWall(y, h, 'fffe', { label: 'out box wall', move: 'up left' });

    this.rectangularWall(x, h, 'fFfF', { label: 'out box wall' });
  }
}

export const slidingDrawer: GeneratorDef = {
  meta: {
    id: 'slidingdrawer',
    name: 'Sliding Drawer',
    group: 'Box',
    summary: 'Open-fronted sleeve with a drawer that slides into it',
    description:
      'The sizes are those of the sleeve. The drawer is made to fit inside it with ' +
      'the play you set, and its front is grooved to pull on. Set the inner height ' +
      'to make the drawer lower than the sleeve.',
  },
  // boxes.py uses finer fingers here, and a wider groove for a finger to pull on.
  paramDefaults: { fj_finger: 2.0, fj_space: 2.0, gr_width: 0.4 },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 60, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 30, min: 10, max: 1000, step: 1, group: 'dimensions' },
    {
      key: 'hi',
      kind: 'length',
      label: 'Drawer height',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 1000,
      step: 1,
      group: 'dimensions',
      help: 'Height of the drawer walls. Zero makes them as high as the sleeve allows.',
    },
    {
      key: 'outside',
      kind: 'bool',
      label: 'Outside measurements',
      default: true,
      group: 'dimensions',
      help: 'When on, the sizes above are the finished exterior. When off, they are the usable interior.',
    },
    {
      key: 'play',
      kind: 'number',
      label: 'Play',
      unit: '× thickness',
      default: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'joints',
      help: 'Clearance between the drawer and the sleeve on each side.',
    },
    ...groovedParams(),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new SlidingDrawer(
      {
        x: n(v, 'x', 60),
        y: n(v, 'y', 100),
        h: n(v, 'h', 30),
        hi: n(v, 'hi', 0),
        outside: b(v, 'outside', true),
        play: n(v, 'play', 0.15),
      },
      config,
    ),
};
