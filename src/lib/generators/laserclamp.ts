/**
 * Laser clamp — ported from boxes.py `boxes/generators/laserclamp.py`
 * (class `LaserClamp`).
 *
 * A spring clamp that holds material down on a knife table: a sliding top
 * jaw over a fixed bottom part, pulled down by a tension spring you supply.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

class LaserClamp extends Boxes {
  constructor(
    private o: { minheight: number; maxheight: number; extraheight: number },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private topPart(l: number, move?: string): void {
    const t = this.thickness;

    const tw = 12 * t;
    const th = l + 4 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(8 * t, 0);
    this.rectangularHole(t, 2 * t + l / 2, 1.05 * t, l);
    this.polyline(
      2 * t, [90, t], l + 1.5 * t, [-90, 0.5 * t],
      2 * t, -90, 0, [180, 0.5 * t], 0,
      [90, 1.5 * t], 9 * t,
      [180, 4 * t], 2 * t, [-90, t],
    );
    this.hole(-5 * t, -3 * t, 2.5 * t);
    this.polyline(l - 5.5 * t, [90, t]);
    this.move(tw, th, move, false, 'top jaw');
  }

  private bottomPart(hMin: number, hExtra: number, move?: string): void {
    const t = this.thickness;

    const tw = 14 * t;
    const th = hMin + 4 * t;

    if (this.move(tw, th, move, true)) return;

    const ls = (t / 2) * 2 ** 0.5;
    this.moveTo(2 * t, 0);
    this.fingerHolesAt(3 * t, 2 * t, hMin + hExtra, 90);
    if (hExtra) {
      this.polyline(4 * t, [90, t], hExtra - 2 * t, [-90, t]);
    } else {
      this.polyline(6 * t);
    }
    this.polyline(4 * t, [90, 2 * t], 3 * t, 135, 2 * ls, 45, 1 * t, -90, 6 * t, -90);

    this.polyline(
      hMin, [90, t], 2 * t, [90, t],
      hMin + hExtra - 0 * t, [-90, t], t, [180, t],
      0, 90, 0, [-180, 0.5 * t], 0, 90,
    );

    this.move(tw, th, move, false, 'bottom jaw');
  }

  render(): void {
    const t = this.thickness;
    const { maxheight: hMax, minheight: hMin } = this.o;
    let hExtra = this.o.extraheight;

    if (hExtra && hExtra < 2 * t) hExtra = 2 * t;

    this.topPart(hMax + hExtra, 'right');
    this.bottomPart(hMin, hExtra, 'right');
    this.roundedPlate(4 * t, hMin + hExtra + 4 * t, t, {
      edge: 'e',
      extendCorners: false,
      move: 'right',
      callback: [() => this.fingerHolesAt(1 * t, 2 * t, hMin + hExtra)],
      label: 'guide',
    });
    // Named without a drawn label: boxes.py leaves it unlabelled, and the
    // text is wider than the strip, which would change the sheet size.
    this.rectangularWall(1.1 * t, hMin + hExtra, 'efef', { callback: [() => this.ctx.nameCurrentPart('spacer')] });
  }
}

export const laserClamp: GeneratorDef = {
  meta: {
    id: 'laserclamp',
    name: 'Laser Clamp',
    group: 'Misc',
    summary: 'Spring clamp to hold material down on a knife table',
    description:
      'Needs a tension spring of the right length. More extra height leaves ' +
      'more room for the spring and makes the slide less likely to bind; ' +
      'wax on the sliding parts helps too.',
  },
  // boxes.py's own default: fingers right up to the ends of the short joints.
  paramDefaults: { fj_surroundingspaces: 0 },
  params: [
    { key: 'minheight', kind: 'length', label: 'Lowest clamping height', unit: 'mm', default: 25, min: 5, max: 200, step: 1, group: 'dimensions' },
    { key: 'maxheight', kind: 'length', label: 'Highest clamping height', unit: 'mm', default: 50, min: 10, max: 300, step: 1, group: 'dimensions' },
    { key: 'extraheight', kind: 'length', label: 'Extra height', unit: 'mm', default: 0, min: 0, max: 100, step: 1, group: 'dimensions', help: 'Room for the spring, and a smoother slide.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new LaserClamp({ minheight: n(v, 'minheight', 25), maxheight: n(v, 'maxheight', 50), extraheight: n(v, 'extraheight', 0) }, config),
};
