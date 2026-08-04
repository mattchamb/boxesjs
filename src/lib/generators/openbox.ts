/** Box with the top and front open — ported from boxes.py `openbox.py`. */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

class OpenBox extends Boxes {
  constructor(
    private x: number,
    private y: number,
    private h: number,
    private outside: boolean,
    private edgetype: string,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    let { x, y, h } = this;

    if (this.outside) {
      x = this.adjustSize(x);
      // Only the bottom consumes material on these axes; the top is open.
      y = this.adjustSize(y, false);
      h = this.adjustSize(h, false);
    }

    const e = this.edgetype;
    this.rectangularWall(x, h, [e, e, 'e', e], { move: 'right', label: 'Back' });
    this.rectangularWall(y, h, [e, 'e', 'e', 'f'], { move: 'up', label: 'Side 1' });
    this.rectangularWall(y, h, [e, 'e', 'e', 'f'], { label: 'Side 2' });
    this.rectangularWall(x, y, 'efff', { move: 'left', label: 'Bottom' });
  }
}

export const openBox: GeneratorDef = {
  meta: {
    id: 'openbox',
    name: 'Open Box',
    group: 'Box',
    summary: 'Box with the top and front left open',
    description:
      'A tray-like box open at the top and the front, useful for shelf bins ' +
      'and anything you need to reach into from the side.',
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
      help: 'When on, the sizes above are the finished exterior.',
    },
    {
      key: 'edgetype',
      kind: 'edge',
      label: 'Wall joint',
      choices: 'Fh',
      default: 'F',
      group: 'joints',
      help: 'Finger joints at the corner, or slots through the panel face.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new OpenBox(
      n(v, 'x', 100),
      n(v, 'y', 100),
      n(v, 'h', 100),
      b(v, 'outside', true),
      s(v, 'edgetype', 'F'),
      config,
    ),
};
