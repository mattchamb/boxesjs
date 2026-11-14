/**
 * Rack and Pinion — not a boxes.py generator. boxes.py's gears engine can
 * draw a rack (`draw_rack`), but no generator there uses it.
 *
 * A straight rack with a plain tab at each end for a screw, and a spur gear
 * that meshes with it. The geometry is boxes.py's own: the golden cases
 * render `scripts/golden-fixtures/rackgear.py`, which makes the same calls
 * on boxes.py's engine, so keep the two in step.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { meshWarning, RACK } from '../gears';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

/** The fields' upper limits, which the warning's suggestions stay within. */
const MAX_SHIFT = 50;
const MAX_ANGLE = 35;

/** Material left either side of a screw hole in a tab. */
const HOLE_MARGIN = 1;

interface RackGearOptions {
  rackTeeth: number;
  pinionTeeth: number;
  modulus: number;
  shaft: number;
  dpercentage: number;
  baseHeight: number;
  baseTab: number;
  hole: number;
  pressureAngle: number;
  profileShift: number;
}

class RackGear extends Boxes {
  constructor(
    private o: RackGearOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const { rackTeeth, pinionTeeth, modulus, shaft, dpercentage, baseHeight, baseTab, hole } = this.o;
    const spec = { dimension: modulus, angle: this.o.pressureAngle, profile_shift: this.o.profileShift };

    if (pinionTeeth) {
      const warn = meshWarning('the pinion', 'the rack', pinionTeeth, RACK, spec, {
        maxShift: MAX_SHIFT,
        maxAngle: MAX_ANGLE,
      });
      if (warn) this.warn(warn, 'pinion_teeth');
    }

    // A hole that would break out of the tab is left out rather than cut.
    const holesFit = hole + 2 * HOLE_MARGIN <= Math.min(baseTab, baseHeight);
    if (hole && !holesFit) {
      this.warn(
        `The screw holes need ${HOLE_MARGIN} mm of material round them in the end tabs, so they are left out. Make the tabs and the base at least ${hole + 2 * HOLE_MARGIN} mm, or the holes smaller.`,
        'screw_hole',
      );
    }

    const [width] = this.gears.rackSize({ ...spec, teethLength: rackTeeth, baseHeight, baseTab });
    const holes = (): void => {
      this.hole(baseTab / 2, baseHeight / 2, hole / 2);
      this.hole(width - baseTab / 2, baseHeight / 2, hole / 2);
    };

    this.gears.rack({
      ...spec,
      teethLength: rackTeeth,
      baseHeight,
      baseTab,
      callback: hole && holesFit ? holes : null,
      move: 'up',
      label: 'rack',
    });

    if (pinionTeeth) {
      this.gears.draw({
        teeth: pinionTeeth,
        ...spec,
        callback: () => this.dHole(0, 0, { d: shaft, relW: dpercentage / 100 }),
        move: 'up',
        label: 'pinion',
      });
    }
  }
}

const hasPinion = (v: ParamValues): boolean => v['pinion_teeth'] !== 0;

export const rackGear: GeneratorDef = {
  meta: {
    id: 'rackgear',
    name: 'Rack and Pinion',
    group: 'Misc',
    summary: 'A straight gear rack and the spur gear that drives it',
    description:
      'A straight rack with a plain tab at each end to screw it down, and a pinion that meshes with it. Each turn of the pinion moves the rack its number of teeth times the module times π.',
  },
  params: [
    {
      key: 'rack_teeth',
      kind: 'number',
      label: 'Teeth on the rack',
      default: 20,
      min: 1,
      max: 300,
      step: 1,
      integer: true,
      group: 'dimensions',
      help: 'Each tooth adds the module times π to its length.',
    },
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
      help: 'Tooth size: pitch diameter divided by the number of teeth. The pinion is cut to match.',
    },
    { key: 'base_height', kind: 'length', label: 'Base height', unit: 'mm', default: 8, min: 1, max: 100, step: 0.5, group: 'dimensions', help: 'Below the teeth.' },
    { key: 'base_tab', kind: 'length', label: 'End tabs', unit: 'mm', default: 14, min: 0, max: 100, step: 0.5, group: 'dimensions', help: 'Plain base past the teeth at each end.' },
    { key: 'screw_hole', kind: 'length', label: 'Screw holes', unit: 'mm', default: 3, min: 0, max: 20, step: 0.1, group: 'dimensions', help: 'Diameter, one in each end tab. 0 for none.' },
    {
      key: 'pinion_teeth',
      kind: 'number',
      label: 'Teeth on the pinion',
      default: 16,
      min: 0,
      max: 200,
      step: 1,
      integer: true,
      group: 'dimensions',
      help: '0 leaves the pinion out.',
    },
    { key: 'shaft', kind: 'length', label: 'Pinion shaft', unit: 'mm', default: 6, min: 0, max: 100, step: 0.1, group: 'dimensions', help: 'Diameter.', showIf: hasPinion },
    {
      key: 'dpercentage',
      kind: 'number',
      label: 'D-flat',
      unit: '%',
      default: 75,
      min: 0,
      max: 100,
      step: 1,
      group: 'dimensions',
      help: 'Width across the flat, as a share of the diameter. 100 for a round shaft.',
      showIf: hasPinion,
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
      help: 'Angle at which the teeth push on each other. 20° is standard.',
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
      help: 'Of the module. Shortens the teeth above the pitch line, which helps a pinion with few teeth.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new RackGear(
      {
        rackTeeth: n(v, 'rack_teeth', 20),
        pinionTeeth: n(v, 'pinion_teeth', 16),
        modulus: n(v, 'modulus', 2),
        shaft: n(v, 'shaft', 6),
        dpercentage: n(v, 'dpercentage', 75),
        baseHeight: n(v, 'base_height', 8),
        baseTab: n(v, 'base_tab', 14),
        hole: n(v, 'screw_hole', 3),
        pressureAngle: n(v, 'pressure_angle', 20),
        profileShift: n(v, 'profile_shift', 20),
      },
      config,
    ),
};
