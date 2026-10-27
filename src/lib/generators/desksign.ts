/**
 * Desk sign — ported from boxes.py `boxes/generators/desksign.py`
 * (class `Desksign`).
 *
 * A plate leaning back on two triangular stands, with a name or message
 * engraved on it.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { ETCHING } from '../geom/colors';
import { STACKABLE_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface DeskSignOptions {
  width: number;
  height: number;
  angle: number;
  label: string;
  fontsize: number;
  feet: boolean;
  mirror: boolean;
  verticaltextoffset: number;
}

class DeskSign extends Boxes {
  constructor(
    private o: DeskSignOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const { width, height, angle, feet, mirror, label, verticaltextoffset, fontsize } = this.o;

    if (!(angle > 0 && angle < 90)) {
      // boxes.py raises ValueError.
      this.warn('The angle has to be between 0 and 90 degrees.', 'angle');
      return;
    }

    const base = Math.cos(angle * DEG) * height;
    const h = Math.sin(angle * DEG) * height;

    if (label && fontsize) {
      this.rectangularWall(width, height, 'eheh', {
        move: 'right',
        callback: [() => this.text(label, width / 2, height / 2 + verticaltextoffset, 0, 'middle center', fontsize, ETCHING)],
        label: 'plate',
      });
    } else {
      this.rectangularWall(width, height, 'eheh', { move: 'right', label: 'plate' });
    }

    // stands at back/side
    const edge = feet ? 'šef' : 'eef';
    if (mirror) {
      this.rectangularTriangle(base, h, edge, { num: 1, move: 'right', label: 'stand' });
      this.rectangularTriangle(base, h, edge, { num: 1, move: 'mirror right', label: 'stand' });
    } else {
      this.rectangularTriangle(base, h, edge, { num: 2, move: 'right', label: 'stands' });
    }
  }
}

export const deskSign: GeneratorDef = {
  meta: {
    id: 'desksign',
    name: 'Desk Sign',
    group: 'Misc',
    summary: 'Angled plate on two stands, engraved with a name or message',
    description:
      'The height is the plate’s, which leans back, not the sign’s height ' +
      'standing. The text is centred on the plate; nudge it with the ' +
      'vertical offset. Empty lines count when centring.',
  },
  // boxes.py's own default: narrower feet.
  paramDefaults: { st_width: 2 },
  params: [
    { key: 'width', kind: 'length', label: 'Width', unit: 'mm', default: 150, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Of the plate, not counting the holes.' },
    { key: 'height', kind: 'length', label: 'Plate height', unit: 'mm', default: 80, min: 10, max: 500, step: 1, group: 'dimensions' },
    { key: 'angle', kind: 'number', label: 'Angle', unit: '°', default: 60, min: 10, max: 89, step: 1, group: 'dimensions', help: '90 would stand it upright.' },
    { key: 'label', kind: 'text', label: 'Text', default: 'DeskSign\nBoxes.py', multiline: true, group: 'dimensions', help: 'Engraved on the plate. Leave blank for none.' },
    { key: 'fontsize', kind: 'length', label: 'Text height', unit: 'mm', default: 20, min: 0, max: 200, step: 1, group: 'dimensions' },
    { key: 'verticaltextoffset', kind: 'length', label: 'Text offset', unit: 'mm', default: 0, min: -200, max: 200, step: 1, group: 'dimensions', help: 'Up from the centre.' },
    { key: 'feet', kind: 'bool', label: 'Raised feet', default: false, group: 'dimensions' },
    {
      key: 'mirror',
      kind: 'bool',
      label: 'Mirror one stand',
      default: true,
      group: 'dimensions',
      help: 'So the same face of the material is outside on both.',
    },
    ...STACKABLE_PARAMS.map((spec) => ({ ...spec, showIf: (v: ParamValues) => v['feet'] === true })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new DeskSign(
      {
        width: n(v, 'width', 150),
        height: n(v, 'height', 80),
        angle: n(v, 'angle', 60),
        label: s(v, 'label', 'DeskSign\nBoxes.py'),
        fontsize: n(v, 'fontsize', 20),
        feet: b(v, 'feet', false),
        mirror: b(v, 'mirror', true),
        verticaltextoffset: n(v, 'verticaltextoffset', 0),
      },
      config,
    ),
};
