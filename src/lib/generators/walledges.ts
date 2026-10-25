/**
 * Wall edges sampler — ported from boxes.py `boxes/generators/walledges.py`
 * (class `WallEdges`).
 *
 * Not a thing to build: four strips showing each wall-mounting edge pair
 * (`a/A` … `d/D`) for the chosen wall system, plus `wallHolesAt`, so you can
 * see what the other wall-mounted generators will cut.
 */
import type { BoxesConfig } from '../boxes';
import { WALL_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { n, s, type GeneratorDef } from './types';

class WallEdgesSampler extends WallMountedBox {
  constructor(
    private h: number,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
  }

  render(): void {
    this.generateWallEdges();
    const h = this.h;

    this.moveTo(0, 25);
    // boxes.py leaves these unlabelled; each part needs a name here.
    this.rectangularWall(40, h, 'eAea', {
      move: 'right',
      label: 'a A',
      callback: [() => { this.text('a', 0, -20); this.text('A', 30, -20); }],
    });
    this.rectangularWall(40, h, 'eBeb', {
      move: 'right',
      label: 'b B',
      callback: [() => { this.text('b', 0, -20); this.text('B', 30, -20); }],
    });
    this.rectangularWall(40, h, 'eCec', {
      callback: [
        () => {
          this.text('c', 0, -20);
          this.text('C', 30, -20);
          this.text('wallHolesAt', -5, -30);
          this.wallHolesAt(20, 0, h, 90);
        },
      ],
      move: 'right',
      label: 'c C',
    });
    this.moveTo(10);
    this.rectangularWall(40, h, 'eDed', {
      move: 'right',
      label: 'd D',
      callback: [() => { this.text('d', 0, -20); this.text('D', 30, -20); }],
    });
  }
}

export const wallEdges: GeneratorDef = {
  meta: {
    id: 'walledges',
    name: 'Wall Edges',
    group: 'Wall mounted',
    summary: 'Sampler of the wall-mounting edges for each wall system',
    description:
      'Four test strips showing every wall-mounting edge for the chosen wall system, ' +
      'and the matching holes. Cut one to check the fit on your wall before building ' +
      'a larger wall-mounted piece.',
  },
  params: [
    {
      key: 'h',
      kind: 'length',
      label: 'Strip height',
      unit: 'mm',
      default: 120,
      min: 30,
      max: 500,
      step: 1,
      group: 'dimensions',
    },
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallEdgesSampler(n(v, 'h', 120), s(v, 'walltype', 'plain') as WallType, config),
};
