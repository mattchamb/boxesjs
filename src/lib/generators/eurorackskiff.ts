/**
 * Eurorack skiff — ported from boxes.py `boxes/generators/eurorackskiff.py`
 * (class `EuroRackSkiff`).
 *
 * A shallow 3U case for Eurorack synthesizer modules, its width in HP, with
 * the two rails the modules screw to.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

class EuroRackSkiff extends Boxes {
  constructor(
    private h: number,
    private hp: number,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private wallyCB(y: number): void {
    const t = this.thickness;
    this.fingerHolesAt(0, this.h - 1.5 * t, y, 0);
  }

  private railHoles = (): void => {
    for (let i = 0; i < this.hp; i++) {
      this.hole(i * 5.08 + 2.54, 3, 0, 3.0);
    }
  };

  render(): void {
    const h = this.h;
    // One HP is 5.08 mm; 128.5 mm is the 3U module height.
    const y = this.hp * 5.08;
    const x = 128.5;

    this.rectangularWall(y, 6, 'feee', { callback: [this.railHoles], move: 'up', label: 'rail' });
    this.rectangularWall(y, 6, 'feee', { callback: [this.railHoles], move: 'up', label: 'rail' });
    this.rectangularWall(x, h, 'fFeF', { move: 'right', label: 'left' });
    this.rectangularWall(y, h, 'ffef', { callback: [() => this.wallyCB(y)], move: 'up', label: 'front' });
    this.rectangularWall(y, h, 'ffef', { callback: [() => this.wallyCB(y)], label: 'back' });
    this.rectangularWall(x, h, 'fFeF', { move: 'left up', label: 'right' });
    this.rectangularWall(x, y, 'FFFF', { move: 'right', label: 'bottom' });
  }
}

export const euroRackSkiff: GeneratorDef = {
  meta: {
    id: 'eurorackskiff',
    name: 'Eurorack Skiff',
    group: 'Box',
    summary: 'Shallow 3U case for Eurorack modules, with rails',
    description: 'A 3U case for Eurorack synthesizer modules, as wide as you choose in HP, with two rails drilled for the module screws.',
  },
  params: [
    { key: 'hp', kind: 'number', label: 'Width', unit: 'HP', default: 84, min: 4, max: 300, step: 1, integer: true, group: 'dimensions', help: 'One HP is 5.08 mm.' },
    { key: 'h', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 500, step: 1, group: 'dimensions' },
  ],
  create: (v: ParamValues, config: BoxesConfig) => new EuroRackSkiff(n(v, 'h', 100), n(v, 'hp', 84), config),
};
