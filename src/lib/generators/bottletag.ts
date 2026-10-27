/**
 * Bottle tag — ported from boxes.py `boxes/generators/bottletag.py`
 * (class `BottleTag`).
 *
 * A neck tag that slips over a bottle: a hole ringed with radial cuts, so it
 * stretches over the neck and grips it.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

interface BottleTagOptions {
  width: number;
  height: number;
  minDiameter: number;
  maxDiameter: number;
  radius: number;
  segmentWidth: number;
}

class BottleTag extends Boxes {
  constructor(
    private o: BottleTagOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const { width, height, radius: r, segmentWidth } = this.o;
    const rMin = this.o.minDiameter / 2;
    const rMax = this.o.maxDiameter / 2;

    // tag outline
    this.moveTo(r);
    this.edge(width - r - r);
    this.corner(90, r);
    this.edge(height - width / 2.0 - r);
    this.corner(180, width / 2);
    this.edge(height - width / 2.0 - r);
    this.corner(90, r);

    // the inner circle, from the centre of the hole
    this.moveTo(width / 2 - r, height - width / 2);
    this.savedContext(() => {
      this.moveTo(0, -rMin);
      this.corner(360, rMin);
    });

    // Radial cuts about segment_width apart round the inner circle, a whole
    // number of them for neatness.
    const segAngle = (segmentWidth / rMin) * (180 / Math.PI);
    const num = Math.floor(360 / segAngle);
    for (let i = 0; i < num; i++) {
      this.savedContext(() => {
        this.moveTo(0, 0, (i * 360.0) / num);
        this.moveTo(rMin);
        this.edge(rMax - rMin);
        // Short cross cuts at the end, so it is less likely to tear.
        this.savedContext(() => {
          this.moveTo(0, 0, 90);
          this.edge(0.5);
        });
        this.savedContext(() => {
          this.moveTo(0, 0, -90);
          this.edge(0.5);
        });
      });
    }
    // boxes.py draws the tag without a move, so it has no name of its own.
    this.ctx.nameCurrentPart('tag');
  }
}

export const bottleTag: GeneratorDef = {
  meta: {
    id: 'bottletag',
    name: 'Bottle Tag',
    group: 'Misc',
    summary: 'Neck tag that slips over a bottle',
    description: 'A tag with a hole ringed by radial cuts, so it stretches over the bottle’s neck and grips it. Cut it from paper or card.',
  },
  params: [
    { key: 'width', kind: 'length', label: 'Width', unit: 'mm', default: 72, min: 20, max: 300, step: 1, group: 'dimensions' },
    { key: 'height', kind: 'length', label: 'Height', unit: 'mm', default: 98, min: 20, max: 500, step: 1, group: 'dimensions' },
    { key: 'min_diameter', kind: 'length', label: 'Hole diameter', unit: 'mm', default: 24, min: 5, max: 200, step: 0.5, group: 'dimensions', help: 'Inside the cuts.' },
    { key: 'max_diameter', kind: 'length', label: 'Cuts diameter', unit: 'mm', default: 50, min: 5, max: 250, step: 0.5, group: 'dimensions', help: 'Where the radial cuts end.' },
    { key: 'radius', kind: 'length', label: 'Corner radius', unit: 'mm', default: 15, min: 0, max: 100, step: 0.5, group: 'dimensions', help: 'At the bottom.' },
    { key: 'segment_width', kind: 'number', label: 'Cut spacing', unit: 'mm', default: 3, min: 1, max: 20, step: 1, integer: true, group: 'dimensions', help: 'Round the hole.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new BottleTag(
      {
        width: n(v, 'width', 72),
        height: n(v, 'height', 98),
        minDiameter: n(v, 'min_diameter', 24),
        maxDiameter: n(v, 'max_diameter', 50),
        radius: n(v, 'radius', 15),
        segmentWidth: n(v, 'segment_width', 3),
      },
      config,
    ),
};
