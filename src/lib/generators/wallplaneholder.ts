/**
 * Wall plane holder — ported from boxes.py `boxes/generators/wallplaneholder.py`
 * (class `WallPlaneHolder`).
 *
 * Holds a woodworking plane against the wall, sole outwards, on two side
 * cheeks with a lip that hooks over the front of the plane.
 */
import type { BoxesConfig } from '../boxes';
import { WALL_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { n, s, type GeneratorDef } from './types';

interface WallPlaneHolderOptions {
  width: number;
  length: number;
  holdLength: number;
  height: number;
}

class WallPlaneHolder extends WallMountedBox {
  constructor(
    private o: WallPlaneHolderOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
  }

  private side = (): void => {
    const { length: l, height: h, holdLength: hl } = this.o;
    const t = this.thickness;
    this.fingerHolesAt(1.5 * t, 2 * t, 0.25 * l, 90);
    this.fingerHolesAt(1.5 * t, 2 * t + 0.75 * l, 0.25 * l, 90);
    this.fingerHolesAt(2.5 * t + h, 2 * t + l - hl, hl, 90);
    this.fingerHolesAt(2 * t, 1.5 * t, h + 2 * t, 0);
  };

  render(): void {
    this.generateWallEdges();

    const { width: w, length: l, height: h } = this.o;
    const t = this.thickness;
    this.rectangularWall(h + 4 * t, l + 2 * t, 'eeea', { callback: [this.side], move: 'right', label: 'side' });
    this.rectangularWall(h + 4 * t, l + 2 * t, 'eeea', { callback: [this.side], move: 'right', label: 'side' });
    this.rectangularWall(w, h + 2 * t, 'efFf', { move: 'up', label: 'bottom' });
    this.rectangularWall(w, 0.25 * l, 'ffef', { move: 'up', label: 'back' });
    this.rectangularWall(w, 0.25 * l, 'efef', { move: 'up', label: 'back' });
    this.rectangularWall(w, this.o.holdLength, 'efef', { move: 'up', label: 'hold' });
  }
}

export const wallPlaneHolder: GeneratorDef = {
  meta: {
    id: 'wallplaneholder',
    name: 'Wall Plane Holder',
    group: 'Wall mounted',
    summary: 'Holds a hand plane against the wall',
    description:
      'Two side cheeks and a set of cross pieces that hold a woodworking plane to ' +
      'the wall, with a lip over the front of the plane to keep it in.',
  },
  params: [
    { key: 'width', kind: 'length', label: 'Plane width', unit: 'mm', default: 80, min: 20, max: 300, step: 1, group: 'dimensions' },
    { key: 'length', kind: 'length', label: 'Plane length', unit: 'mm', default: 250, min: 50, max: 800, step: 1, group: 'dimensions' },
    {
      key: 'hold_length',
      kind: 'length',
      label: 'Lip length',
      unit: 'mm',
      default: 30,
      min: 5,
      max: 200,
      step: 1,
      group: 'dimensions',
      help: 'Length of the part holding the plane over its front.',
    },
    {
      key: 'height',
      kind: 'length',
      label: 'Plane height',
      unit: 'mm',
      default: 80,
      min: 10,
      max: 300,
      step: 1,
      group: 'dimensions',
      help: 'Height of the front of the plane.',
    },
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallPlaneHolder(
      {
        width: n(v, 'width', 80),
        length: n(v, 'length', 250),
        holdLength: n(v, 'hold_length', 30),
        height: n(v, 'height', 80),
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
