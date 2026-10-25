/**
 * Fully closed box — ported from boxes.py `boxes/generators/closedbox.py`.
 *
 * boxes.py wires captive-nut bolts into every edge here and then switches
 * them off (`d2 = d3 = None`). `assembly: 'bolts'` switches them back on, as
 * wired: two bolts on each edge of the x walls, three on the y edges of the
 * top and bottom (see edges/bolts.ts).
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { checkBolts } from '../edges/bolts';
import { BoltsPolicy, type FingerJointSettings } from '../edges/fingerjoint';
import { BOLT_PARAMS, assemblyParam } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

class ClosedBox extends Boxes {
  constructor(
    private x: number,
    private y: number,
    private h: number,
    private outside: boolean,
    private bolted: boolean,
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

    const d2 = this.bolted ? new BoltsPolicy(2) : null;
    const d3 = this.bolted ? new BoltsPolicy(3) : null;

    this.rectangularWall(x, h, 'FFFF', { bedBolts: [d2, d2, d2, d2], move: 'right', label: 'Wall 1' });
    this.rectangularWall(y, h, 'FfFf', { bedBolts: [d3, d2, d3, d2], move: 'up', label: 'Wall 2' });
    this.rectangularWall(y, h, 'FfFf', { bedBolts: [d3, d2, d3, d2], label: 'Wall 4' });
    this.rectangularWall(x, h, 'FFFF', { bedBolts: [d2, d2, d2, d2], move: 'left up', label: 'Wall 3' });

    this.rectangularWall(x, y, 'ffff', { bedBolts: [d2, d3, d2, d3], move: 'right', label: 'Top' });
    this.rectangularWall(x, y, 'ffff', { bedBolts: [d2, d3, d2, d3], label: 'Bottom' });

    if (this.bolted) {
      // Only the `f` edges are slotted; the `F` edges get plain holes.
      checkBolts(
        this,
        this.getEdge('f').settings as FingerJointSettings,
        [
          { label: 'the width edges', length: x, policy: d2! },
          { label: 'the depth edges', length: y, policy: d3! },
          { label: 'the corners', length: h, policy: d2! },
        ],
      );
    }
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
    assemblyParam(['bolts'], 'Every edge is bolted: two or three bolts each.'),
    ...BOLT_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new ClosedBox(
      n(v, 'x', 100),
      n(v, 'y', 100),
      n(v, 'h', 100),
      b(v, 'outside', true),
      s(v, 'assembly', 'glue') === 'bolts',
      config,
    ),
};
