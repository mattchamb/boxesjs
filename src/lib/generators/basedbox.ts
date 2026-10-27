/**
 * Box on a base — ported from boxes.py `boxes/generators/basedbox.py`
 * (class `BasedBox`).
 *
 * A closed box whose walls stand on a base plate through finger holes rather
 * than meeting a bottom panel at its edge, so the base shows as a brim all
 * round. The brim's width is the finger joints' edge width.
 *
 * boxes.py also restyles a hinged top edge (`i`, `k`) to sit flush; hinges are
 * not ported, so they are not offered and that branch has nothing to do.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { HANDLE_PARAMS, LID_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { TOP_EDGE_CHOICES, drawLid, topEdges } from '../topedge';
import { b, n, s, type GeneratorDef } from './types';

interface BasedBoxOptions {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  topEdge: string;
}

class BasedBox extends Boxes {
  constructor(
    private o: BasedBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    let { x, y, h } = this.o;
    const top = this.o.topEdge;

    const [tl, tb, tr, tf] = topEdges(this, top);

    if (this.o.outside) {
      x = this.adjustSize(x);
      y = this.adjustSize(y);
      h = this.adjustSize(h, top);
    }

    this.rectangularWall(y, h, ['f', 'f', tf, 'f'], { move: 'up', label: 'front' });
    this.rectangularWall(y, h, ['f', 'f', tb, 'f'], { move: 'up', label: 'back' });

    this.rectangularWall(x, y, 'hhhh', { move: 'up', label: 'base' });

    drawLid(this, x, y, top);
    this.lid(x, y, top);

    this.rectangularWall(x, h, ['f', 'F', tl, 'F'], { move: 'up', label: 'left' });
    this.rectangularWall(x, h, ['f', 'F', tr, 'F'], { move: 'up', label: 'right' });
  }
}

export const basedBox: GeneratorDef = {
  meta: {
    id: 'basedbox',
    name: 'Box on a Base',
    group: 'Box',
    summary: 'Closed box standing on a base plate with a brim',
    description:
      'A building block more than a finished item: the walls stand in finger ' +
      'holes on a base plate that overhangs them as a brim. The brim’s width ' +
      'is the finger joints’ edge width. Add your own holes to the parts, or ' +
      'see the Closed Box for a version without a base.',
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
      help: 'When on, the sizes above are the walls’ exterior, not counting the brim. When off, they are the usable interior.',
    },
    {
      key: 'top_edge',
      kind: 'edge',
      label: 'Top edge',
      choices: TOP_EDGE_CHOICES,
      default: 'F',
      group: 'top',
      help: 'Finger joints close the box with a top panel. Straight leaves it open.',
    },
    ...HANDLE_PARAMS,
    ...LID_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new BasedBox(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        topEdge: s(v, 'top_edge', 'F'),
      },
      config,
    ),
};
