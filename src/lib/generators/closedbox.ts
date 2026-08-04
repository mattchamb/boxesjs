/** Fully closed box — ported from boxes.py `boxes/generators/closedbox.py`. */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

class ClosedBox extends Boxes {
  constructor(
    private x: number,
    private y: number,
    private h: number,
    private outside: boolean,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    let { x, y, h } = this;

    if (this.outside) {
      x = this.adjustSize(x);
      y = this.adjustSize(y);
      h = this.adjustSize(h);
    }

    this.rectangularWall(x, h, 'FFFF', { move: 'right', label: 'Wall 1' });
    this.rectangularWall(y, h, 'FfFf', { move: 'up', label: 'Wall 2' });
    this.rectangularWall(y, h, 'FfFf', { label: 'Wall 4' });
    this.rectangularWall(x, h, 'FFFF', { move: 'left up', label: 'Wall 3' });

    this.rectangularWall(x, y, 'ffff', { move: 'right', label: 'Top' });
    this.rectangularWall(x, y, 'ffff', { label: 'Bottom' });
  }
}

export const closedBox: GeneratorDef = {
  meta: {
    id: 'closedbox',
    name: 'Closed Box',
    group: 'Box',
    summary: 'Fully enclosed six-sided box with finger joints',
    description:
      'The simplest building block: six panels, every edge finger jointed. ' +
      'Useful on its own, and a good starting point to add your own holes to.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    {
      key: 'outside',
      kind: 'bool',
      label: 'Outside measurements',
      default: true,
      group: 'dimensions',
      help: 'When on, the sizes above are the finished exterior. When off, they are the usable interior.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new ClosedBox(n(v, 'x', 100), n(v, 'y', 100), n(v, 'h', 100), b(v, 'outside', true), config),
};
