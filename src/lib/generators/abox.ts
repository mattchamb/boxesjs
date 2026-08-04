/** A simple box with a selectable bottom and optional lid — boxes.py `abox.py`. */
import { Boxes, type BoxesConfig } from '../boxes';
import { LID_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

class ABox extends Boxes {
  constructor(
    private x: number,
    private y: number,
    private h: number,
    private outside: boolean,
    private bottomEdge: string,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    let { x, y, h } = this;
    const bottom = this.edges[this.bottomEdge] ? this.bottomEdge : 'F';
    const side = 'F';

    if (this.outside) {
      x = this.adjustSize(x, side, side);
      y = this.adjustSize(y);
      h = this.adjustSize(h, bottom, 'e');
    }

    // ignoreWidths [1, 6] extends the side edges down over the bottom edge, so
    // the walls still meet cleanly when the bottom uses stackable feet.
    this.savedContext(() => {
      this.rectangularWall(x, h, [bottom, side, 'e', side], {
        ignoreWidths: [1, 6],
        move: 'up',
        label: 'Front',
      });
      this.rectangularWall(x, h, [bottom, side, 'e', side], {
        ignoreWidths: [1, 6],
        move: 'up',
        label: 'Back',
      });
      if (this.bottomEdge !== 'e') {
        this.rectangularWall(x, y, 'ffff', { move: 'up', label: 'Bottom' });
      }
      this.lid(x, y);
    });

    this.rectangularWall(x, h, [bottom, side, 'e', side], {
      ignoreWidths: [1, 6],
      move: 'right only',
    });
    this.rectangularWall(y, h, [bottom, 'f', 'e', 'f'], {
      ignoreWidths: [1, 6],
      move: 'up',
      label: 'Side 1',
    });
    this.rectangularWall(y, h, [bottom, 'f', 'e', 'f'], {
      ignoreWidths: [1, 6],
      move: 'up',
      label: 'Side 2',
    });
  }
}

export const aBox: GeneratorDef = {
  meta: {
    id: 'abox',
    name: 'Simple Box',
    group: 'Box',
    summary: 'Open-topped box with a choice of bottom edge',
    description:
      'Deliberately minimal. Pick how the bottom attaches, optionally add a lid, ' +
      'and you have a usable box. For more options see the Universal Box.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: 'Fhse',
      default: 'h',
      group: 'dimensions',
      help: 'How the bottom panel attaches. "Stackable feet" lets boxes nest on top of each other.',
    },
    ...LID_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new ABox(
      n(v, 'x', 100),
      n(v, 'y', 100),
      n(v, 'h', 100),
      b(v, 'outside', true),
      s(v, 'bottom_edge', 'h'),
      config,
    ),
};
