/**
 * Gears — ported from boxes.py `boxes/generators/gear.py` (class `Gears`).
 *
 * A meshing pair of involute spur gears, each with a D-shaped shaft hole,
 * then the two shaft holes at the axis distance as a drilling template, and a
 * note of the sizes that matter for mounting them.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { meshWarning } from '../gears';
import { n, type GeneratorDef } from './types';

/** The fields' upper limits, which the warning's suggestions stay within. */
const MAX_SHIFT = 50;
const MAX_ANGLE = 35;

interface GearsOptions {
  teeth1: number;
  shaft1: number;
  dpercentage1: number;
  teeth2: number;
  shaft2: number;
  dpercentage2: number;
  modulus: number;
  pressureAngle: number;
  profileShift: number;
}

class Gears extends Boxes {
  constructor(
    private o: GearsOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const t = this.thickness;
    const { modulus, pressureAngle, profileShift } = this.o;

    const teeth1 = Math.max(2, this.o.teeth1);
    const teeth2 = Math.max(2, this.o.teeth2);
    const shaft1 = this.o.shaft1;
    const dpercentage1 = this.o.dpercentage1;
    const shaft2 = this.o.shaft2 || shaft1;
    const dpercentage2 = this.o.dpercentage2 || dpercentage1;

    const common = { dimension: modulus, angle: pressureAngle, profile_shift: profileShift };

    const tunable = { maxShift: MAX_SHIFT, maxAngle: MAX_ANGLE };
    const warn1 = meshWarning('gear 1', 'gear 2', teeth1, teeth2, common, tunable);
    if (warn1) this.warn(warn1, 'teeth1');
    const warn2 = meshWarning('gear 2', 'gear 1', teeth2, teeth1, common, tunable);
    if (warn2) this.warn(warn2, 'teeth2');

    this.gears.draw({
      teeth: teeth2,
      ...common,
      callback: () => this.dHole(0, 0, { d: shaft2, relW: dpercentage2 / 100 }),
      move: 'up',
      label: 'gear 2',
    });
    const [r2, , d2] = this.gears.sizes({ teeth: teeth2, ...common });

    this.gears.draw({
      teeth: teeth1,
      ...common,
      callback: () => this.dHole(0, 0, { d: shaft1, relW: dpercentage1 / 100 }),
      move: 'up',
      label: 'gear 1',
    });
    const [r1, , d1] = this.gears.sizes({ teeth: teeth1, ...common });

    const r = Math.max(shaft1, shaft2) / 2;
    this.hole(t + r, t + r, shaft1 / 2);
    this.hole(t + r + r1 + r2, t + r, shaft2 / 2);
    this.moveTo(0, 2 * r + t);

    this.text(
      `Pitch radius 1: ${r1.toFixed(1)}mm\n` +
        `Outer diameter 1: ${d1.toFixed(1)}mm\n` +
        `Pitch radius 2: ${r2.toFixed(1)}mm\n` +
        `Outer diameter 2: ${d2.toFixed(1)}mm\n` +
        `Axis distance: ${(r1 + r2).toFixed(1)}mm\n`,
      0,
      0,
      0,
      'bottom left',
    );
    // boxes.py draws the template and note without a move, so they have no
    // name of their own.
    this.ctx.nameCurrentPart('shaft spacing');
  }
}

export const gears: GeneratorDef = {
  meta: {
    id: 'gears',
    name: 'Gears',
    group: 'Misc',
    summary: 'A meshing pair of involute spur gears',
    description:
      'Two spur gears that mesh, each with a shaft hole that can have a flat for a D-shaft. Also cuts the two shaft holes at the right distance apart, to drill a mounting plate from, and notes the pitch radii and axis distance.',
  },
  params: [
    { key: 'teeth1', kind: 'number', label: 'Teeth, gear 1', default: 12, min: 2, max: 300, step: 1, integer: true, group: 'dimensions' },
    { key: 'teeth2', kind: 'number', label: 'Teeth, gear 2', default: 32, min: 2, max: 300, step: 1, integer: true, group: 'dimensions' },
    {
      key: 'modulus',
      kind: 'length',
      label: 'Module',
      unit: 'mm',
      default: 2,
      min: 0.5,
      max: 20,
      step: 0.1,
      group: 'dimensions',
      help: 'Tooth size: pitch diameter divided by the number of teeth. Gears only mesh with the same module.',
    },
    { key: 'shaft1', kind: 'length', label: 'Shaft, gear 1', unit: 'mm', default: 6, min: 0, max: 100, step: 0.1, group: 'dimensions', help: 'Diameter.' },
    {
      key: 'dpercentage1',
      kind: 'number',
      label: 'D-flat, gear 1',
      unit: '%',
      default: 75,
      min: 0,
      max: 100,
      step: 1,
      group: 'dimensions',
      help: 'Width across the flat, as a share of the diameter. 100 for a round shaft.',
    },
    {
      key: 'shaft2',
      kind: 'length',
      label: 'Shaft, gear 2',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 100,
      step: 0.1,
      group: 'dimensions',
      help: '0 for the same as gear 1.',
    },
    {
      key: 'dpercentage2',
      kind: 'number',
      label: 'D-flat, gear 2',
      unit: '%',
      default: 0,
      min: 0,
      max: 100,
      step: 1,
      group: 'dimensions',
      help: '0 for the same as gear 1.',
    },
    {
      key: 'pressure_angle',
      kind: 'number',
      label: 'Pressure angle',
      unit: '°',
      default: 20,
      min: 10,
      max: MAX_ANGLE,
      step: 0.5,
      group: 'advanced',
      help: 'Angle at which the teeth push on each other. 20° is standard; both gears must match.',
    },
    {
      key: 'profile_shift',
      kind: 'number',
      label: 'Profile shift',
      unit: '%',
      default: 20,
      min: -50,
      max: MAX_SHIFT,
      step: 1,
      group: 'advanced',
      help: 'Of the module. Moves the teeth outwards, which strengthens gears with few teeth.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Gears(
      {
        teeth1: n(v, 'teeth1', 12),
        shaft1: n(v, 'shaft1', 6),
        dpercentage1: n(v, 'dpercentage1', 75),
        teeth2: n(v, 'teeth2', 32),
        shaft2: n(v, 'shaft2', 0),
        dpercentage2: n(v, 'dpercentage2', 0),
        modulus: n(v, 'modulus', 2),
        pressureAngle: n(v, 'pressure_angle', 20),
        profileShift: n(v, 'profile_shift', 20),
      },
      config,
    ),
};
