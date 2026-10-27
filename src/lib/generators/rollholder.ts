/**
 * Roll holder — ported from boxes.py `boxes/generators/rollholder.py`
 * (class `RollHolder`).
 *
 * Holds a kitchen roll (or any roll) on an axle between two arms, screwed to
 * the wall through a back plate: one long plate, or one small plate per arm.
 * The axle is a dowel or pipe you supply; two rings keep it in the arms.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface RollHolderOptions {
  width: number;
  diameter: number;
  height: number;
  axle: number;
  screwHoles: number;
  onePiece: boolean;
}

class RollHolder extends Boxes {
  private height: number;

  constructor(
    private o: RollHolderOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.height = o.height;
  }

  private side(move: string, label: string): void {
    const d = this.o.diameter;
    let a = this.o.axle;
    const h = this.height;
    const t = this.thickness;

    const tw = h;
    const th = (d + a) / 2 + 4 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(0, t);
    this.getEdge('f').call(h);
    this.fingerHolesAt(-(a / 2 + 3 * t), this.burn, d / 2, 90);
    this.polyline(0, 90, d / 2, [90, a / 2 + 3 * t]);

    const r = a / 2 + 3 * t;
    // boxes.py reuses `a` for the angle here; the axle size is not needed again.
    a = Math.atan2(d / 2, h - a - 6 * t);
    const alpha = (a * 180) / Math.PI;

    this.corner(alpha, r);
    this.edge(((h - 2 * r) ** 2 + (d / 2) ** 2) ** 0.5);
    this.corner(90 - alpha, r);
    this.corner(90);

    this.move(tw, th, move, false, label);
  }

  private backCB = (): void => {
    const t = this.thickness;
    const a = this.o.axle;
    const h = this.height;
    const w = this.o.width;

    const plate = this.o.onePiece ? w + 2 * t + h / 2 : h / 2 + t;

    this.fingerHolesAt(h / 4 + t / 2 - 3 * t, 0, h, 90);
    this.fingerHolesAt(h / 4 - 3 * t, h - 3 * t - a / 2, h / 4, 180);

    if (this.o.onePiece) {
      this.fingerHolesAt(h / 4 + t / 2 + t - 3 * t + w, 0, h, 90);
      this.fingerHolesAt(h / 4 + 2 * t - 3 * t + w, h - 3 * t - a / 2, h / 4, 0);
    }

    for (const x of [0, plate - 6 * t]) {
      for (const y of [3 * t, h - 3 * t]) {
        this.hole(x, y, 0, this.o.screwHoles);
      }
    }
  };

  /** Two retaining rings for the axle, drawn freehand rather than as parts. */
  private rings(): void {
    const a = this.o.axle;
    const r = a / 2;
    const t = this.thickness;

    this.moveTo(0, a + 1.5 * t, -90);
    for (let i = 0; i < 2; i++) {
      this.polyline(r - 1.5 * t, [180, r + 3 * t], 0, [180, 1.5 * t], 0, [-180, r], r - 1.5 * t, [180, 1.5 * t]);
      this.moveTo(a - t, a + 12 * t, 180);
    }
  }

  render(): void {
    const t = this.thickness;
    const w = this.o.width;
    const d = this.o.diameter;
    const a = this.o.axle;

    // boxes.py raises the plate to fit the axle silently; so does the port.
    this.height = Math.max(this.height, a + 10 * t);
    const h = this.height;

    this.side('right', 'arm');
    this.side('right', 'arm');

    this.rectangularTriangle(h / 4, d / 2, 'ffe', { num: 2, r: 3 * t, move: 'right', label: 'brace' });

    const plate = (width: number, move: string) =>
      this.roundedPlate(width, h, 3 * t, { edge: 'e', extendCorners: false, callback: [this.backCB], move, label: 'back' });
    if (this.o.onePiece) {
      plate(w + h / 2 + 2 * t, 'right');
    } else {
      plate(h / 2 + t, 'right');
      plate(h / 2 + t, 'right mirror');
    }

    this.rings();
    // The rings sit in the last part opened; name it so it is not "default".
    this.ctx.nameCurrentPart('rings');
  }
}

export const rollHolder: GeneratorDef = {
  meta: {
    id: 'rollholder',
    name: 'Roll Holder',
    group: 'Wall mounted',
    summary: 'Screw-on holder for a kitchen roll or other roll',
    description:
      'Two arms hold an axle for a kitchen roll, a roll of tape or a spool, ' +
      'screwed to the wall through one long back plate or a small plate per ' +
      'arm. The axle is a dowel or pipe you supply; two rings keep it in the arms.',
  },
  params: [
    { key: 'width', kind: 'length', label: 'Axle length', unit: 'mm', default: 275, min: 50, max: 1000, step: 1, group: 'dimensions' },
    {
      key: 'diameter',
      kind: 'length',
      label: 'Roll diameter',
      unit: 'mm',
      default: 120,
      min: 20,
      max: 400,
      step: 1,
      group: 'dimensions',
      help: 'The largest the roll will be. Be generous.',
    },
    {
      key: 'height',
      kind: 'length',
      label: 'Back plate height',
      unit: 'mm',
      default: 80,
      min: 30,
      max: 300,
      step: 1,
      group: 'dimensions',
      help: 'Raised automatically if too small for the axle.',
    },
    {
      key: 'axle',
      kind: 'length',
      label: 'Axle diameter',
      unit: 'mm',
      default: 25,
      min: 5,
      max: 80,
      step: 0.5,
      group: 'dimensions',
      help: 'Including some play.',
    },
    { key: 'screw_holes', kind: 'length', label: 'Screw hole diameter', unit: 'mm', default: 4, min: 1, max: 20, step: 0.5, group: 'dimensions' },
    {
      key: 'one_piece',
      kind: 'bool',
      label: 'One back plate',
      default: true,
      group: 'dimensions',
      help: 'One continuous back plate, rather than a small one for each arm.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new RollHolder(
      {
        width: n(v, 'width', 275),
        diameter: n(v, 'diameter', 120),
        height: n(v, 'height', 80),
        axle: n(v, 'axle', 25),
        screwHoles: n(v, 'screw_holes', 4),
        onePiece: b(v, 'one_piece', true),
      },
      config,
    ),
};
