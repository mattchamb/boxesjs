/**
 * Folder — ported from boxes.py `boxes/generators/folder.py` (class `Folder`).
 *
 * A book cover in one piece: two rounded boards joined by a living-hinge
 * spine.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { FlexEdge } from '../edges/flex';
import { FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

interface FolderOptions {
  x: number;
  y: number;
  /** Thickness of the contents; the spine bends round half a circle of it. */
  h: number;
  r: number;
}

class Folder extends Boxes {
  constructor(
    private o: FolderOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const { x, y, r, h } = this.o;
    const c2 = Math.PI * h;
    this.moveTo(r + this.thickness, this.thickness);
    this.edge(x - r);
    (this.getEdge('X') as FlexEdge).call(c2, { h: y });
    this.edge(x - r);
    this.corner(90, r);
    this.edge(y - 2 * r);
    this.corner(90, r);
    this.edge(2 * x - 2 * r + c2);
    this.corner(90, r);
    this.edge(y - 2 * r);
    this.corner(90, r);
    // boxes.py draws the cover without a move, so it has no name of its own.
    this.ctx.nameCurrentPart('cover');
  }
}

export const folder: GeneratorDef = {
  meta: {
    id: 'folder',
    name: 'Folder',
    group: 'Misc',
    summary: 'Book cover with a living-hinge spine',
    description: 'Two boards with rounded corners, joined by a spine that bends round the contents.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Of each board.' },
    { key: 'y', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Spine thickness', unit: 'mm', default: 20, min: 1, max: 300, step: 1, group: 'dimensions', help: 'The spine bends round half a circle this wide.' },
    { key: 'r', kind: 'length', label: 'Corner radius', unit: 'mm', default: 10, min: 0, max: 300, step: 1, group: 'dimensions' },
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Folder({ x: n(v, 'x', 100), y: n(v, 'y', 100), h: n(v, 'h', 20), r: n(v, 'r', 10) }, config),
};
