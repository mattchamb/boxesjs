/**
 * Stachel — ported from boxes.py `boxes/generators/stachel.py`
 * (class `Stachel`).
 *
 * An endpin for a bass recorder: three layers that clamp round the foot of
 * the instrument and hold a pole to stand it on.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

class Stachel extends Boxes {
  constructor(
    private o: { flutediameter: number; polediameter: number; wall: number },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private layer(ri: number, ro: number, rp: number, holes = false, move = '', label = ''): void {
    const r = 2.5; // radius
    const l = 25; // depth of clamp
    const w = 20; // width of clamp

    const wp = rp + 8; // width pole

    const tw = 2 * ro + 2 * rp;
    const th = 2 * ro + l;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(ro, r, 90);

    const a1 = Math.asin(w / ro) / DEG;
    const a2 = Math.asin(wp / ro) / DEG;
    const l1 = ro * (1 - Math.cos(a1 * DEG));
    const a3 = Math.asin(1 / rp) / DEG;
    this.polyline(ro - ri + l - r, 90, 0, [-355, ri], 0, 90, ro - ri + l - r, [90, r], w - 2 * r, [90, r]); // inside
    const poly1: Array<number | [number, number]> = [(l + l1 - 2) / 2 - r, 90, w - 2, -90, 2, -90, w - 2, 90, (l + l1 - 2) / 2];
    if (holes) {
      // right side main clamp
      this.polyline(...poly1);
    } else {
      this.polyline(l + l1 - r);
    }
    this.polyline(0, -90 + a1, 0, [90 - a1 - a2, ro], 0, -90 + a2);
    const poly2: Array<number | [number, number]> = [2 * rp + 15, 90, wp - 2, -90, 2, -90, wp - 2, 90, 10 - 2 - r];
    if (holes) {
      this.polyline(...poly2);
    } else {
      this.polyline(25 + 2 * rp - r);
    }
    this.polyline(0, [90, r], wp - 1 - r, 90, 20, 90 - a3, 0, [-360 + 2 * a3, rp], 0, 90 - a3, 20, 90, wp - 1 - r, [90, r]);
    if (holes) {
      this.polyline(...[...poly2].reverse());
    } else {
      this.polyline(25 + 2 * rp - r);
    }
    this.polyline(0, -90 + a2, 0, [270 - a2 - a1 - 5, ro], 0, -90 + a1);
    if (holes) {
      // left side main clamp
      this.polyline(...[...poly1].reverse());
    } else {
      this.polyline(l + l1 - r);
    }
    this.polyline(0, [90, r], w - 2 * r, [90, r]);

    this.move(tw, th, move, false, label);
  }

  render(): void {
    const ri = this.o.flutediameter / 2.0;
    const ro = ri + this.o.wall;
    const rp = this.o.polediameter / 2.0;
    this.layer(ri - 20, ro, rp, false, 'up', 'bottom layer');
    this.layer(ri, ro, rp, true, 'up', 'middle layer');
    this.layer(ri, ro, rp, false, 'up', 'top layer');
  }
}

export const stachel: GeneratorDef = {
  meta: {
    id: 'stachel',
    name: 'Stachel',
    group: 'Misc',
    summary: 'Endpin for a bass recorder',
    description: 'Three layers that clamp round the foot of a bass recorder and hold a pole, so the instrument can stand on the floor while you play.',
  },
  params: [
    { key: 'flutediameter', kind: 'length', label: 'Recorder diameter', unit: 'mm', default: 115, min: 50, max: 300, step: 0.5, group: 'dimensions', help: 'At its foot.' },
    { key: 'polediameter', kind: 'length', label: 'Pole diameter', unit: 'mm', default: 25, min: 5, max: 60, step: 0.5, group: 'dimensions' },
    { key: 'wall', kind: 'length', label: 'Wall', unit: 'mm', default: 7, min: 3, max: 50, step: 0.5, group: 'dimensions', help: 'Width of the ring round the recorder.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Stachel({ flutediameter: n(v, 'flutediameter', 115), polediameter: n(v, 'polediameter', 25), wall: n(v, 'wall', 7) }, config),
};
