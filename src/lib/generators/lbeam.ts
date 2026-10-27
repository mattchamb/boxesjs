/**
 * L-beam — ported from boxes.py `boxes/generators/lbeam.py` (class `LBeam`).
 *
 * Two strips joined at a right angle.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

class LBeam extends Boxes {
  constructor(
    private o: { x: number; y: number; h: number; outside: boolean },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    let { x, y } = this.o;
    const { h } = this.o;

    if (this.o.outside) {
      x = this.adjustSize(x, false);
      y = this.adjustSize(y, false);
    }

    this.rectangularWall(x, h, 'eFee', { move: 'right', label: 'x side' });
    this.rectangularWall(y, h, 'eeef', { label: 'y side' });
  }
}

export const lBeam: GeneratorDef = {
  meta: {
    id: 'lbeam',
    name: 'L-Beam',
    group: 'Misc',
    summary: 'Two strips joined at a right angle',
    description: 'A simple L-shaped beam: two pieces finger-jointed along their length.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width of one side', unit: 'mm', default: 100, min: 5, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Width of the other', unit: 'mm', default: 100, min: 5, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Length', unit: 'mm', default: 100, min: 10, max: 2000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new LBeam({ x: n(v, 'x', 100), y: n(v, 'y', 100), h: n(v, 'h', 100), outside: b(v, 'outside', true) }, config),
};
