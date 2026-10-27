/**
 * Spool — ported from boxes.py `boxes/generators/spool.py` (class `Spool`).
 *
 * A spool: two round flanges joined by a polygonal core, with optional ribs
 * to stiffen the flanges.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

interface SpoolOptions {
  h: number;
  outerDiameter: number;
  innerDiameter: number;
  axleDiameter: number;
  sides: number;
  reinforcements: number;
  reinforcementHeight: number;
}

class Spool extends Boxes {
  constructor(
    private o: SpoolOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private sideCB = (): void => {
    const { axleDiameter, innerDiameter, outerDiameter, sides, reinforcements } = this.o;
    this.hole(0, 0, 0, axleDiameter);
    const [r, h, side] = this.regularPolygon(sides, innerDiameter / 2);
    const t = this.thickness;
    for (let i = 0; i < sides; i++) {
      this.fingerHolesAt(-side / 2, h + 0.5 * this.thickness, side, 0);
      this.moveTo(0, 0, 360 / sides);
    }

    if (this.o.reinforcementHeight) {
      for (let i = 0; i < reinforcements; i++) {
        this.fingerHolesAt(axleDiameter / 2, 0, h - axleDiameter / 2, 0);
        this.fingerHolesAt(r + t, 0, outerDiameter / 2 - r - t, 0);
        this.moveTo(0, 0, 360 / reinforcements);
      }
    }
  };

  private reinforcementCB = (): void => {
    const { axleDiameter, innerDiameter, reinforcements } = this.o;
    for (let i = 0; i < reinforcements; i++) {
      this.fingerHolesAt(axleDiameter / 2, 0, (innerDiameter - axleDiameter) / 2 + this.thickness, 0);
      this.moveTo(0, 0, 360 / reinforcements);
    }
  };

  render(): void {
    const t = this.thickness;
    const { outerDiameter, innerDiameter, axleDiameter, sides, reinforcements, reinforcementHeight } = this.o;
    const [r, h, side] = this.regularPolygon(sides, innerDiameter / 2);
    for (let i = 0; i < 2; i++) {
      this.parts.disc(outerDiameter, { callback: this.sideCB, move: 'right', label: 'flange' });
    }
    for (let i = 0; i < sides; i++) {
      this.rectangularWall(side, this.o.h, 'fefe', { move: 'right', label: `core ${i + 1}` });
    }
    if (reinforcementHeight) {
      for (let i = 0; i < reinforcements * 2; i++) {
        const edge = this.makeCompoundEdge(Array.from('fef'), [outerDiameter / 2 - r - t, r - h + t, h - axleDiameter / 2]);
        this.trapezoidWall(reinforcementHeight - t, (outerDiameter - axleDiameter) / 2, (innerDiameter - axleDiameter) / 2 + t, ['e', 'f', 'e', edge], {
          move: 'right',
          label: `rib ${i + 1}`,
        });
      }
      for (let i = 0; i < 2; i++) {
        this.parts.disc(innerDiameter + 2 * t, { hole: axleDiameter, callback: this.reinforcementCB, move: 'right', label: 'rib hub' });
      }
    }
  }
}

export const spool: GeneratorDef = {
  meta: {
    id: 'spool',
    name: 'Spool',
    group: 'Misc',
    summary: 'Spool with round flanges on a polygonal core',
    description: 'Two round flanges joined by a core of flat pieces, with a hole for an axle you supply. Ribs on the flanges stiffen them.',
  },
  params: [
    { key: 'h', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions', help: 'Between the flanges.' },
    { key: 'outer_diameter', kind: 'length', label: 'Flange diameter', unit: 'mm', default: 200, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'inner_diameter', kind: 'length', label: 'Core diameter', unit: 'mm', default: 80, min: 10, max: 900, step: 1, group: 'dimensions' },
    { key: 'axle_diameter', kind: 'length', label: 'Axle hole diameter', unit: 'mm', default: 40, min: 1, max: 800, step: 0.5, group: 'dimensions' },
    { key: 'sides', kind: 'number', label: 'Core pieces', default: 8, min: 3, max: 50, step: 1, integer: true, group: 'dimensions' },
    { key: 'reinforcement_height', kind: 'length', label: 'Rib height', unit: 'mm', default: 0, min: 0, max: 200, step: 1, group: 'dimensions', help: 'Ribs on the flanges. 0 leaves them out.' },
    {
      key: 'reinforcements',
      kind: 'number',
      label: 'Ribs per flange',
      default: 8,
      min: 1,
      max: 50,
      step: 1,
      integer: true,
      group: 'dimensions',
      showIf: (v) => v['reinforcement_height'] !== 0,
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Spool(
      {
        h: n(v, 'h', 100),
        outerDiameter: n(v, 'outer_diameter', 200),
        innerDiameter: n(v, 'inner_diameter', 80),
        axleDiameter: n(v, 'axle_diameter', 40),
        sides: n(v, 'sides', 8),
        reinforcements: n(v, 'reinforcements', 8),
        reinforcementHeight: n(v, 'reinforcement_height', 0),
      },
      config,
    ),
};
