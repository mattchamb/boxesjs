/**
 * Makita power supply — ported from boxes.py
 * `boxes/generators/makitapowersupply.py` (class `MakitaPowerSupply`).
 *
 * A bench power supply box that sits on a Makita 18 V battery, for a
 * DSP5005-style regulator module, with banana sockets and an optional
 * second power input. Its size is fixed by those parts.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

type SecondaryPower = 'ibm-barrel' | 'usb-c' | 'none';

class MakitaPowerSupply extends Boxes {
  private x = 85;
  private y = 75;
  private h = 35;
  private l = 64;

  constructor(
    private o: { bananaSocketDiameter: number; flipswitchDiameter: number; secondaryPower: SecondaryPower },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /** Rails that slide onto the battery. */
  private side(l: number, h = 14, move?: string, label = ''): void {
    const t = this.thickness;
    const tw = h + t;
    const th = l;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(t, 0);
    this.polyline(h, 90, l - h / 3 ** 0.5, 60, (h * 2) / 3 ** 0.5, 120);
    this.getEdge('f').call(l);

    this.move(tw, th, move, false, label);
  }

  private side2(l: number, h = 14, move?: string, label = ''): void {
    const tw = h;
    const th = l - 10;

    if (this.move(tw, th, move, true)) return;

    if (h > 14) {
      this.polyline(h, 90, l - 12, 90, h - 14, 90, 50 - 12, -90, 8, -90);
    } else {
      this.polyline(h, 90, l - 50, 90, h - 6, -90);
    }
    this.polyline(11, 90, 1, -90, 27, [90, 1], 3, [90, 1], l - 12, 90);

    this.move(tw, th, move, false, label);
  }

  private bottom = (): void => {
    const t = this.thickness;
    const m = this.x / 2;

    this.fingerHolesAt(m - 30.5 - 0.5 * t, 10, this.l);
    this.fingerHolesAt(m + 30.5 + 0.5 * t, 10, this.l);

    // Slots for the battery's terminals
    this.rectangularHole(m - 19, 10 + 34, 0.8, 6.25);
    this.rectangularHole(m + 19, 10 + 34, 0.8, 6.25);

    this.rectangularHole(m, 7.5, 35, 5);
  };

  private front = (): void => {
    const dB = this.o.bananaSocketDiameter;
    const dF = this.o.flipswitchDiameter;
    const style = this.o.secondaryPower;

    this.hole(10, this.h / 2, 0, dB);
    this.hole(30, this.h / 2, 0, dB);

    if (style === 'ibm-barrel') {
      this.hole(50, this.h / 2, 0, dF);
      this.rectangularHole(76, 6.4, 12.4, 12.4);
    }
    if (style === 'usb-c') {
      this.hole(50, this.h / 2, 0, dF);
      this.rectangularHole(75, 2.6, 9.2, 3.2, 1);
    }
  };

  /** Ventilation slots. */
  private back = (): void => {
    const n = Math.trunc(Math.floor((this.h - 2 * this.thickness) / 8));
    const offs = (this.h - n * 8.0) / 2 + 4;
    for (let i = 0; i < n; i++) {
      this.rectangularHole(this.x / 2, i * 8 + offs, this.x - 20, 5, 2.5);
    }
  };

  render(): void {
    const { x, y, h, l } = this;
    const hm = 15.5;

    this.rectangularWall(x, h, 'FFFF', { callback: [this.front], move: 'right', label: 'front' });
    this.rectangularWall(y, h, 'FfFf', { move: 'up', label: 'left' });
    this.rectangularWall(y, h, 'FfFf', { label: 'right' });
    this.rectangularWall(x, h, 'FFFF', { callback: [this.back], move: 'left up', label: 'back' });

    this.rectangularWall(x, y, 'ffff', { callback: [this.bottom], move: 'right', label: 'bottom' });
    this.rectangularWall(x, y, 'ffff', { callback: [() => this.rectangularHole(x / 2, y - 20 - 5, 76, 40)], move: '', label: 'top' });
    this.rectangularWall(x, y, 'ffff', { move: 'left up only' });

    this.side(l, hm, 'right', 'rail');
    this.side(l, hm, 'right mirror', 'rail');
    this.side2(l, hm, 'right', 'rail spacer');
    this.side2(l, hm, 'right mirror', 'rail spacer');
  }
}

export const makitaPowerSupply: GeneratorDef = {
  meta: {
    id: 'makitapowersupply',
    name: 'Makita Power Supply',
    group: 'Misc',
    summary: 'Bench power supply box that runs on a Makita 18 V battery',
    description:
      'Slides onto a Makita 18 V battery and houses a DSP5005 (or similar) ' +
      'regulator. You also need two banana sockets and two 4.8 mm flat ' +
      'terminals with flat soldering tags; to run it from a laptop power ' +
      'supply instead, a flip switch and the matching socket.',
  },
  params: [
    { key: 'banana_socket_diameter', kind: 'length', label: 'Banana socket holes', unit: 'mm', default: 8, min: 2, max: 20, step: 0.1, group: 'dimensions', help: 'Diameter.' },
    {
      key: 'secondary_power',
      kind: 'enum',
      label: 'Second power input',
      default: 'ibm-barrel',
      choices: [
        { value: 'ibm-barrel', label: 'Lenovo round socket' },
        { value: 'usb-c', label: 'USB-C' },
        { value: 'none', label: 'None' },
      ],
      group: 'dimensions',
    },
    {
      key: 'flipswitch_diameter',
      kind: 'length',
      label: 'Flip switch hole',
      unit: 'mm',
      default: 6.3,
      min: 2,
      max: 20,
      step: 0.1,
      group: 'dimensions',
      help: 'Diameter, for choosing the power input.',
      showIf: (v) => v['secondary_power'] !== 'none',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new MakitaPowerSupply(
      {
        bananaSocketDiameter: n(v, 'banana_socket_diameter', 8),
        flipswitchDiameter: n(v, 'flipswitch_diameter', 6.3),
        secondaryPower: s(v, 'secondary_power', 'ibm-barrel') as SecondaryPower,
      },
      config,
    ),
};
