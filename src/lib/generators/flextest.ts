/**
 * Flex test — ported from boxes.py `boxes/generators/flextest.py`
 * (class `FlexTest`).
 *
 * A strip of living hinge, for trying out flex settings on your material.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { FlexEdge } from '../edges/flex';
import { FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

class FlexTest extends Boxes {
  constructor(
    private x: number,
    private y: number,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const { x, y } = this;

    this.moveTo(5, 5);
    this.edge(10);
    (this.getEdge('X') as FlexEdge).call(x, { h: y });
    this.edge(10);
    this.corner(90);
    this.edge(y);
    this.corner(90);
    this.edge(x + 20);
    this.corner(90);
    this.edge(y);
    this.corner(90);
    // boxes.py draws the strip without a move, so it has no name of its own.
    this.ctx.nameCurrentPart('test strip');
  }
}

export const flexTest: GeneratorDef = {
  meta: {
    id: 'flextest',
    name: 'Flex Test',
    group: 'Misc',
    summary: 'Strip of living hinge for testing flex settings',
    description: 'Cut one to see how a living hinge bends in your material before committing to a whole box.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Hinge length', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) => new FlexTest(n(v, 'x', 100), n(v, 'y', 100), config),
};
