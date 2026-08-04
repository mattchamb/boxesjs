/**
 * A single panel with a chosen edge on each side — boxes.py `rectangularWall.py`.
 * Handy for replacing a broken part or making a one-off panel that fits an
 * existing box.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

/** Edge characters this build supports on an arbitrary panel. */
const PANEL_EDGES = 'eEfFhgsSšŠtTG';

class RectangularWall extends Boxes {
  constructor(
    private x: number,
    private h: number,
    private edgetypes: string[],
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const t = this.thickness;

    // Finger-jointed sides get matching slots so a wall can meet this panel.
    const cb = (nr: number) => {
      if (this.edgetypes[nr] === 'f') {
        this.fingerHolesAt(0, -2.5 * t, nr % 2 ? this.h : this.x, 0);
      }
    };

    this.moveTo(3 * t, 3 * t);
    this.rectangularWall(this.x, this.h, this.edgetypes, { callback: cb, label: 'Panel' });
  }
}

const edgeParam = (key: string, label: string) =>
  ({
    key,
    kind: 'edge' as const,
    label,
    choices: PANEL_EDGES,
    default: 'e',
    group: 'dimensions' as const,
  });

export const rectangularWall: GeneratorDef = {
  meta: {
    id: 'rectangularwall',
    name: 'Rectangular Panel',
    group: 'Part',
    summary: 'One panel, with any edge type on each of its four sides',
    description:
      'A single part rather than a whole box. Use it to cut a replacement panel, ' +
      'or a divider that has to mate with something you have already built.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    edgeParam('bottom_edge', 'Bottom edge'),
    edgeParam('right_edge', 'Right edge'),
    edgeParam('top_edge', 'Top edge'),
    edgeParam('left_edge', 'Left edge'),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new RectangularWall(
      n(v, 'x', 100),
      n(v, 'h', 100),
      [
        s(v, 'bottom_edge', 'e'),
        s(v, 'right_edge', 'e'),
        s(v, 'top_edge', 'e'),
        s(v, 'left_edge', 'e'),
      ],
      config,
    ),
};
