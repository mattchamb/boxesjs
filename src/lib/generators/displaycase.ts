/**
 * Display case — ported from boxes.py `boxes/generators/displaycase.py`
 * (class `DisplayCase`).
 *
 * A fully closed box meant to be cut from clear acrylic, with the top and
 * bottom overhanging the walls.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

class DisplayCase extends Boxes {
  constructor(
    private o: { x: number; y: number; h: number; outside: boolean; overhang: number },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    let { x, y, h } = this.o;

    if (this.o.outside) {
      x = this.adjustSize(x);
      y = this.adjustSize(y);
      h = this.adjustSize(h);
    }

    // boxes.py builds bolt policies here and then sets both to None, so the
    // walls are drawn without bolts.
    this.rectangularWall(x, h, 'ffff', { move: 'right', label: 'Wall 1' });
    this.rectangularWall(y, h, 'fFfF', { move: 'up', label: 'Wall 2' });
    this.rectangularWall(y, h, 'fFfF', { label: 'Wall 4' });
    this.rectangularWall(x, h, 'ffff', { move: 'left up', label: 'Wall 3' });

    const flanges = Array<number>(4).fill(this.o.overhang);
    this.flangedWall(x, y, 'FFFF', { flanges, move: 'right', label: 'Top' });
    this.flangedWall(x, y, 'FFFF', { flanges, label: 'Bottom' });
  }
}

export const displayCase: GeneratorDef = {
  meta: {
    id: 'displaycase',
    name: 'Display Case',
    group: 'Box',
    summary: 'Closed box for clear acrylic, with an overhanging top and bottom',
    description: 'A fully closed box intended to be cut from transparent acrylic, to display something in. The top and bottom overhang the walls.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    { key: 'overhang', kind: 'length', label: 'Overhang', unit: 'mm', default: 2, min: 0, max: 50, step: 0.5, group: 'dimensions', help: 'Of the top and bottom past the walls.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new DisplayCase(
      { x: n(v, 'x', 100), y: n(v, 'y', 100), h: n(v, 'h', 100), outside: b(v, 'outside', true), overhang: n(v, 'overhang', 2) },
      config,
    ),
};
