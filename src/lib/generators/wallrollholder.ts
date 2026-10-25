/**
 * Wall roll holder — ported from boxes.py `boxes/generators/wallrollholder.py`
 * (class `WallRollHolder`).
 *
 * Holds a kitchen roll (or any roll) on an axle between two arms. The axle is
 * a dowel or pipe you supply; two rings keep it in the arms.
 */
import type { BoxesConfig } from '../boxes';
import { WALL_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { n, s, type GeneratorDef } from './types';

interface WallRollHolderOptions {
  width: number;
  diameter: number;
  height: number;
  axle: number;
}

class WallRollHolder extends WallMountedBox {
  private height: number;

  constructor(
    private o: WallRollHolderOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
    this.height = o.height;
  }

  private side(move: string): void {
    const d = this.o.diameter;
    let a = this.o.axle;
    const h = this.height;
    const t = this.thickness;
    const B = this.getEdge('B');

    const tw = h;
    const th = (d + a) / 2 + 3 * t + B.spacing();

    if (this.move(tw, th, move, true)) return;

    this.moveTo(0, B.margin());
    B.call(h);
    this.fingerHolesAt(-(a / 2 + 3 * t), this.burn + B.endWidth(), d / 2, 90);
    this.polyline(0, 90, B.endWidth() + d / 2, [90, a / 2 + 3 * t]);

    const r = a / 2 + 3 * t;
    // boxes.py reuses `a` for the angle here; the axle size is not needed again.
    a = Math.atan2(d / 2, h - a - 6 * t);
    const alpha = (a * 180) / Math.PI;

    this.corner(alpha, r);
    this.edge(((h - 2 * r) ** 2 + (d / 2) ** 2) ** 0.5);
    this.corner(90 - alpha, r);
    this.edge(B.startWidth());
    this.corner(90);

    this.move(tw, th, move, false, 'arm');
  }

  private backCB = (): void => {
    const t = this.thickness;
    const a = this.o.axle;
    const h = this.height;
    const w = this.o.width;

    this.wallHolesAt(h / 4 + t / 2 - 3 * t, 0, h, 90);
    this.fingerHolesAt(h / 4 - 3 * t, h - 3 * t - a / 2, h / 4, 180);

    this.wallHolesAt(h / 4 + t / 2 + t - 3 * t + w, 0, h, 90);
    this.fingerHolesAt(h / 4 + 2 * t - 3 * t + w, h - 3 * t - a / 2, h / 4, 0);
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
    this.generateWallEdges();

    const t = this.thickness;
    const w = this.o.width;
    const d = this.o.diameter;
    const a = this.o.axle;

    // boxes.py raises the plate to fit the axle silently; so does the port.
    this.height = Math.max(this.height, a + 10 * t);
    const h = this.height;

    this.side('right');
    this.side('right');

    this.rectangularTriangle(h / 4, d / 2, 'ffe', { num: 2, r: 3 * t, move: 'right', label: 'brace' });

    this.roundedPlate(w + h / 2 + 2 * t, h, 3 * t, {
      edge: 'e',
      extendCorners: false,
      callback: [this.backCB],
      move: 'right',
      label: 'back',
    });
    this.rings();
    // The rings sit in the last part opened; name it so it is not "default".
    this.ctx.nameCurrentPart('rings');
  }
}

export const wallRollHolder: GeneratorDef = {
  meta: {
    id: 'wallrollholder',
    name: 'Wall Roll Holder',
    group: 'Wall mounted',
    summary: 'Holder for a kitchen roll or other roll',
    description:
      'Two arms on a rounded back plate hold an axle for a kitchen roll, a roll of ' +
      'tape or a spool. The axle is a dowel or pipe you supply; two rings keep it in ' +
      'the arms.',
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
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallRollHolder(
      {
        width: n(v, 'width', 275),
        diameter: n(v, 'diameter', 120),
        height: n(v, 'height', 80),
        axle: n(v, 'axle', 25),
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
