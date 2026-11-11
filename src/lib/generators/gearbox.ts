/**
 * GearBox — ported from boxes.py `boxes/generators/gearbox.py` (class `GearBox`).
 *
 * A reduction gearbox of identical stages: an open-topped, finger-jointed
 * case whose two long walls carry two shafts, and on each shaft a stack of
 * gears, a small and a large one per stage, so each stage drives the next.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { meshWarning } from '../gears';
import { n, type GeneratorDef } from './types';

interface GearBoxOptions {
  teeth1: number;
  teeth2: number;
  modulus: number;
  shaft: number;
  stages: number;
}

class GearBox extends Boxes {
  constructor(
    private o: GearBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    let { teeth1, teeth2 } = this.o;
    const { modulus, shaft, stages } = this.o;
    if (teeth2 < teeth1) [teeth1, teeth2] = [teeth2, teeth1];

    const [pitch1, size1] = this.gears.sizes({ teeth: teeth1, dimension: modulus });
    const [pitch2, size2] = this.gears.sizes({ teeth: teeth2, dimension: modulus });

    // boxes.py fixes the pressure angle and profile shift here, so only the
    // tooth count is offered as a fix. Swapped above, so teeth1 is the smaller.
    const mesh = { dimension: modulus, angle: 20, profile_shift: 20 };
    const warn = meshWarning('the small gears', 'the large gears', teeth1, teeth2, mesh);
    if (warn) this.warn(warn, this.o.teeth1 <= this.o.teeth2 ? 'teeth1' : 'teeth2');

    const t = this.thickness;
    const x = 1.1 * t * stages;

    let y: number, y1: number, y2: number;
    if (stages === 1) {
      y = size1 + size2;
      y1 = y / 2 - (pitch1 + pitch2) + pitch1;
      y2 = y / 2 + (pitch1 + pitch2) - pitch2;
    } else {
      y = 2 * size2;
      y1 = y / 2 - (pitch1 + pitch2) / 2;
      y2 = y / 2 + (pitch1 + pitch2) / 2;
    }

    const h = Math.max(size1, size2) + t;

    // boxes.py rebinds `t` to the top edge here; kept apart to avoid that.
    const b = 'F';
    const te = 'e';
    const mh = shaft;

    const sideCB = (): void => {
      this.hole(y1, h / 2, mh / 2);
      this.hole(y2, h / 2, mh / 2);
    };

    this.moveTo(this.thickness, this.thickness);
    this.rectangularWall(y, h, [b, 'f', te, 'f'], { callback: [sideCB], move: 'right', label: 'side 1' });
    this.rectangularWall(x, h, [b, 'F', te, 'F'], { move: 'up', label: 'end 1' });
    this.rectangularWall(x, h, [b, 'F', te, 'F'], { label: 'end 2' });
    this.rectangularWall(y, h, [b, 'f', te, 'f'], { callback: [sideCB], move: 'left', label: 'side 2' });
    this.rectangularWall(x, h, [b, 'F', te, 'F'], { move: 'up only' });

    this.rectangularWall(x, y, 'ffff', { move: 'up', label: 'bottom' });

    const gear = { dimension: modulus, angle: 20, mount_hole: mh, profile_shift: 20 };

    for (let i = 0; i < stages - 1; i++) {
      this.gears.draw({ teeth: teeth2, ...gear, move: 'up', label: `large ${i + 1}` });
    }
    this.gears.draw({ teeth: teeth2, ...gear, move: 'right', label: `large ${stages}` });

    for (let i = 0; i < stages; i++) {
      this.gears.draw({ teeth: teeth1, ...gear, move: 'down', label: `small ${i + 1}` });
    }
  }
}

export const gearBox: GeneratorDef = {
  meta: {
    id: 'gearbox',
    name: 'Gearbox',
    group: 'Misc',
    summary: 'Reduction gearbox of identical stages',
    description:
      'An open-topped case holding two shafts, with a small and a large gear per stage. Glue each small gear to a large one so every stage drives the next: the reduction is the tooth ratio raised to the number of stages.',
  },
  params: [
    // boxes.py starts at 8, which binds against 20 teeth (see `meshWarning`);
    // 12 is the fewest that clears.
    { key: 'teeth1', kind: 'number', label: 'Teeth, small gears', default: 12, min: 4, max: 200, step: 1, integer: true, group: 'dimensions', help: 'On the ingoing shaft.' },
    { key: 'teeth2', kind: 'number', label: 'Teeth, large gears', default: 20, min: 4, max: 200, step: 1, integer: true, group: 'dimensions', help: 'On the outgoing shaft.' },
    {
      key: 'modulus',
      kind: 'length',
      label: 'Module',
      unit: 'mm',
      default: 3,
      min: 0.5,
      max: 20,
      step: 0.1,
      group: 'dimensions',
      help: 'Tooth size: pitch diameter divided by the number of teeth.',
    },
    { key: 'shaft', kind: 'length', label: 'Shaft diameter', unit: 'mm', default: 6, min: 1, max: 50, step: 0.1, group: 'dimensions' },
    { key: 'stages', kind: 'number', label: 'Stages', default: 4, min: 1, max: 20, step: 1, integer: true, group: 'dimensions' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new GearBox(
      {
        teeth1: n(v, 'teeth1', 12),
        teeth2: n(v, 'teeth2', 20),
        modulus: n(v, 'modulus', 3),
        shaft: n(v, 'shaft', 6),
        stages: n(v, 'stages', 4),
      },
      config,
    ),
};
