/**
 * Bread box — ported from boxes.py `boxes/generators/breadbox.py`
 * (class `BreadBox`).
 *
 * A box whose front top corner is rounded, with a living-hinge door that
 * slides round the curve between rails, over a shell of narrow slats.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { FingerJointSettings } from '../edges/fingerjoint';
import type { FlexEdge } from '../edges/flex';
import { FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface BreadBoxOptions {
  x: number;
  y: number;
  h: number;
  radius: number;
}

class BreadBox extends Boxes {
  /** Slats round the curve; fixed in boxes.py. */
  private n = 3;

  constructor(
    private o: BreadBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private side(l: number, h: number, r: number, move?: string, label = ''): void {
    const t = this.thickness;

    if (this.move(l + 2 * t, h + 2 * t, move, true)) return;

    this.moveTo(t, t);

    this.ctx.save();

    const n = this.n;
    const a = 90 / n;
    const ls = 2 * Math.sin((a / 2) * DEG) * (r - 2.5 * t);

    this.fingerHolesAt(2 * t, 0, h - r, 90);
    this.moveTo(2.5 * t, h - r, 90 - a / 2);
    for (let i = 0; i < n; i++) {
      this.fingerHolesAt(0, 0.5 * t, ls, 0);
      this.moveTo(ls, 0, -a);
    }
    this.moveTo(0, 0, a / 2);
    this.fingerHolesAt(0, 0.5 * t, l / 2 - r, 0);
    this.ctx.restore();

    this.getEdge('f').call(l);
    this.polyline(t, 90, h - r, [90, r + t], l / 2 - r, 90, t, -90, 0);
    this.getEdge('f').call(l / 2);
    this.polyline(0, 90);
    this.getEdge('f').call(h);

    this.move(l + 2 * t, h + 2 * t, move, false, label);
  }

  /** Quarter-circle formers matching the corner radius. */
  private cornerRadius(r: number, two = false, move?: string): void {
    const s = this.spacing;
    if (this.move(r, r + s, move, true)) return;
    for (let i = 0; i < (two ? 2 : 1); i++) {
      this.polyline(r, 90, r, 180, 0, [-90, r], 0, -180);
      this.moveTo(r, r + s, 180);
    }
    this.move(r, r + s, move, false, 'formers');
  }

  private rails(l: number, h: number, r: number, move?: string): void {
    const t = this.thickness;
    const s = this.spacing;
    const tw = l / 2 + 2.5 * t + 3 * s;
    const th = h + 1.5 * t + 3 * s;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(2.5 * t + s, 0);
    this.polyline(l / 2 - r, [90, r + t], h - r, 90, t, 90, h - r, [-90, r], l / 2 - r, 90, t, 90);
    this.moveTo(-t - s, t + s);
    this.polyline(l / 2 - r, [90, r + t], h - r, 90, t, 90, h - r, [-90, r], l / 2 - r, 90, t, 90);
    this.moveTo(+t - s, t + s);
    this.polyline(l / 2 - r, [90, r - 1.5 * t], h - r, 90, t, 90, h - r, [-90, r - 2.5 * t], l / 2 - r, 90, t, 90);
    this.moveTo(-t - s, t + s);
    this.polyline(l / 2 - r, [90, r - 1.5 * t], h - r, 90, t, 90, h - r, [-90, r - 2.5 * t], l / 2 - r, 90, t, 90);

    this.move(tw, th, move, false, 'rails');
  }

  private door(l: number, h: number, move?: string): void {
    const t = this.thickness;
    if (this.move(l, h, move, true)) return;
    this.fingerHolesAt(t, t, h - 2 * t);
    this.edge(2 * t);
    (this.getEdge('X') as FlexEdge).call(l - 2 * t, { h });
    this.polyline(0, 90, h, 90, l, 90, h, 90);
    this.move(l, h, move, false, 'door');
  }

  render(): void {
    const { x, y, h } = this.o;
    const n = this.n;

    let r = this.o.radius;
    if (!r) r = h / 2;
    r = Math.min(r, h / 2);

    const t = this.thickness;
    this.ctx.save();
    this.side(x, h, r, 'right', 'left');
    this.side(x, h, r, 'right', 'right');
    this.rectangularWall(y, h, 'fFfF', { move: 'right', label: 'back' });

    this.ctx.restore();
    this.side(x, h, r, 'up only');

    this.rectangularWall(x, y, 'FEFF', { move: 'right', label: 'bottom' });
    this.rectangularWall(x / 2, y, 'FeFF', { move: 'right', label: 'top' });

    this.door(x / 2 + h - 2 * r + 0.5 * Math.PI * r + 2 * t, y - 0.2 * t, 'right');

    this.rectangularWall(2 * t, y - 2.2 * t, 'eeef', { move: 'right', label: 'handle' });

    const a = 90 / n;
    const ls = 2 * Math.sin((a / 2) * DEG) * (r - 2.5 * t);

    // Fresh settings, not the user's: the slats meet at the curve's angles
    // with the default finger proportions.
    for (const [angle, chars] of [[a, 'aA'], [a / 2, 'bB']] as const) {
      // `angle` is a class field, so it can only be set once constructed.
      const fs = new FingerJointSettings(t);
      fs.setValues(t, true, { angle });
      fs.edgeObjects(this, chars);
    }

    this.rectangularWall(h - r, y, 'fbfe', { move: 'right', label: 'shell front' });

    this.rectangularWall(ls, y, 'fafB', { move: 'right', label: 'slat 1' });

    for (let i = 0; i < n - 2; i++) {
      this.rectangularWall(ls, y, 'fafA', { move: 'right', label: `slat ${i + 2}` });
    }

    this.rectangularWall(ls, y, 'fbfA', { move: 'right', label: `slat ${n}` });
    this.rectangularWall(x / 2 - r, y, 'fefB', { move: 'right', label: 'shell top' });

    this.rails(x, h, r, 'right mirror');
    this.cornerRadius(r, true, 'right');
  }
}

export const breadBox: GeneratorDef = {
  meta: {
    id: 'breadbox',
    name: 'Bread Box',
    group: 'Box',
    summary: 'Box with a living-hinge door that slides round a rounded corner',
    description:
      'The front half of the top is rounded, and a living-hinge door slides ' +
      'down over it between rails. Beware of the rolling shutter effect: wax ' +
      'the sliding surfaces.',
  },
  // boxes.py's own defaults: a smaller finger margin, and a stiffer hinge.
  paramDefaults: { fj_surroundingspaces: 0.5, flex_distance: 0.75, flex_connection: 2 },
  params: [
    { key: 'x', kind: 'length', label: 'Length', unit: 'mm', default: 150, min: 40, max: 1000, step: 1, group: 'dimensions', help: 'Back to front, along the sides.' },
    { key: 'y', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Between the sides.' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    {
      key: 'radius',
      kind: 'length',
      label: 'Corner radius',
      unit: 'mm',
      default: 40,
      min: 0,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'Of the curve the door slides round. At most half the height; 0 makes it that.',
    },
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new BreadBox({ x: n(v, 'x', 150), y: n(v, 'y', 100), h: n(v, 'h', 100), radius: n(v, 'radius', 40) }, config),
};
