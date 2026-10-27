/**
 * Shutter box — ported from boxes.py `boxes/generators/shutterbox.py`
 * (class `ShutterBox`).
 *
 * A box with one or two rounded top corners and a living-hinge shutter that
 * rolls round them between rails, over a shell of narrow slats.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { FingerJointSettings } from '../edges/fingerjoint';
import type { FlexEdge } from '../edges/flex';
import { FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

type Style = 'single' | 'double';

interface ShutterBoxOptions {
  x: number;
  y: number;
  h: number;
  radius: number;
  style: Style;
}

class ShutterBox extends Boxes {
  /** Slats round each curve; fixed in boxes.py. */
  private n = 3;

  constructor(
    private o: ShutterBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private side(l: number, h: number, r: number, style: Style, move?: string, label = ''): void {
    const t = this.thickness;

    if (this.move(l + 2 * t, h + 2 * t, move, true)) return;

    this.moveTo(t, t);

    this.ctx.save();

    const n = this.n;
    const a = 90 / n;
    const ls = 2 * Math.sin((a / 2) * DEG) * (r - 2.5 * t);

    if (style === 'double') {
      this.ctx.save();
      this.fingerHolesAt(r, 2 * t, l - 2 * r, 0);
      this.moveTo(r, 2.5 * t, 180 - a / 2);
      for (let i = 0; i < n; i++) {
        this.fingerHolesAt(0, 0.5 * t, ls, 0);
        this.moveTo(ls, 0, -a);
      }
      if (h - 2 * r > 2 * t) {
        this.moveTo(0, 0, a / 2);
        this.fingerHolesAt(0, 0.5 * t, h - 2 * r, 0);
      }
      this.ctx.restore();
    } else {
      this.fingerHolesAt(0, 2 * t, l - r, 0);
    }
    this.moveTo(l - r, 2.5 * t, a / 2);
    for (let i = 0; i < n; i++) {
      this.fingerHolesAt(0, -0.5 * t, ls, 0);
      this.moveTo(ls, 0, a);
    }
    if (h - 2 * r > 2 * t) {
      this.moveTo(0, 0, -a / 2);
      this.fingerHolesAt(0, -0.5 * t, h - 2 * r, 0);
    }
    this.ctx.restore();

    this.getEdge('f').call(l);
    this.corner(90);
    this.getEdge('f').call(h - r);
    this.polyline(0, -90, t, 90, 0, [90, r + t]);
    if (style === 'single') {
      this.polyline(l - r, 90, t);
      this.getEdge('f').call(h);
    } else {
      this.polyline(l - 2 * r, [90, r + t], 0, 90, t, -90);
      this.getEdge('f').call(h - r);
    }

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

  private rails(l: number, r: number, move?: string): void {
    const t = this.thickness;
    const s = this.spacing;
    const tw = l + 2.5 * t + 3 * s;
    const th = r + 1.5 * t + 3 * s;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(2.5 * t + s, 0);
    this.polyline(l - r, [90, r + t], 0, 90, t, 90, 0, [-90, r], l - r, 90, t, 90);
    this.moveTo(-t - s, t + s);
    this.polyline(l - r, [90, r + t], 0, 90, t, 90, 0, [-90, r], l - r, 90, t, 90);
    this.moveTo(0.5 * t, t + s);
    this.polyline(l - r, [90, r - 1.5 * t], 0, 90, t, 90, 0, [-90, r - 2.5 * t], l - r, 90, t, 90);
    this.moveTo(-t - s, t + s);
    this.polyline(l - r, [90, r - 1.5 * t], 0, 90, t, 90, 0, [-90, r - 2.5 * t], l - r, 90, t, 90);

    this.move(tw, th, move, false, 'rails');
  }

  /** Rails for the double style, curving down at both ends. */
  private rails2(l: number, r: number, move?: string): void {
    const t = this.thickness;
    const s = this.spacing;
    const tw = l + 2.5 * t + 3 * s;
    const th = 2 * r + t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(r + t, 0);
    for (let i = 0; i < 2; i++) {
      this.polyline(l - 2 * r, [90, r + t], 0, 90, t, 90, 0, [-90, r], l - 2 * r, [-90, r], 0, 90, t, 90, 0, [90, r + t]);
      this.moveTo(0, 1.5 * t);
      this.polyline(
        l - 2 * r, [90, r - 1.5 * t], 0, 90, t, 90, 0, [-90, r - 2.5 * t], l - 2 * r,
        [-90, r - 2.5 * t], 0, 90, t, 90, 0, [90, r - 1.5 * t],
      );
      this.moveTo(0, r);
    }

    this.move(tw, th, move, false, 'rails');
  }

  private door(l: number, h: number, move?: string): void {
    const t = this.thickness;
    if (this.move(l, h, move, true)) return;
    this.fingerHolesAt(t, t, h - 2 * t);
    this.edge(2 * t);
    (this.getEdge('X') as FlexEdge).call(l - 2 * t, { h });
    this.polyline(0, 90, h, 90, l, 90, h, 90);
    this.move(l, h, move, false, 'shutter');
  }

  render(): void {
    const { x, y, h, style } = this.o;
    const n = this.n;

    let r = this.o.radius;
    if (!r) r = h / 2;
    r = Math.min(r, h / 2);

    const t = this.thickness;
    this.ctx.save();
    this.side(y, h, r, style, 'right', 'left');
    this.side(y, h, r, style, 'right', 'right');
    if (style === 'single') {
      this.rectangularWall(x, h, 'fFEF', { move: 'right', label: 'back' });
    } else {
      this.rectangularWall(x, h - r, 'fFeF', { move: 'right', label: 'back' });
    }
    this.rectangularWall(x, h - r, 'fFeF', { move: 'right', label: 'front' });

    if (style === 'double') this.cornerRadius(r, true, 'right');

    this.cornerRadius(r, true, 'right');
    if (style === 'single') {
      this.rails(y, r, 'right');
    } else {
      this.rails2(y, r, 'right');
    }

    this.ctx.restore();
    this.side(y, h, r, style, 'up only');

    this.rectangularWall(y, x, 'FFFF', { move: 'right', label: 'bottom' });

    if (style === 'single') {
      this.door(y - r + 0.5 * Math.PI * r + 3 * t, x - 0.2 * t, 'right');
    } else {
      this.door(y - 2 * r + Math.PI * r + 3 * t, x - 0.2 * t, 'right');
    }

    this.rectangularWall(2 * t, x - 2.2 * t, 'eeef', { move: 'right', label: 'handle' });

    const a = 90 / n;
    const ls = 2 * Math.sin((a / 2) * DEG) * (r - 2.5 * t);

    for (const [angle, chars] of [[a, 'aA'], [a / 2, 'bB']] as const) {
      // Fresh settings, not the user's: the slats meet at the curve's
      // angles with the default finger proportions. `angle` is a class
      // field, so it can only be set once constructed.
      const fs = new FingerJointSettings(t);
      fs.setValues(t, true, { angle });
      fs.edgeObjects(this, chars);
    }

    // The shell, back to front over the top.
    let piece = 0;
    const shell = (l: number, edges: string) =>
      this.rectangularWall(l, x, edges, { move: 'right', label: `shell ${++piece}` });

    if (style === 'double') {
      if (h - 2 * r > 2 * t) {
        shell(h - 2 * r, 'fBfe');
        shell(ls, 'fAfb');
      } else {
        shell(ls, 'fAfe');
      }

      for (let i = 0; i < n - 2; i++) shell(ls, 'fAfa');

      shell(ls, 'fBfa');

      shell(y - 2 * r, 'fbfb');
    } else {
      shell(y - r, 'fbfe');
    }

    shell(ls, 'fafB');

    for (let i = 0; i < n - 2; i++) shell(ls, 'fafA');

    if (h - 2 * r > 2 * t) {
      shell(ls, 'fbfA');
      shell(h - 2 * r, 'fefB');
    } else {
      shell(ls, 'fefA');
    }
  }
}

export const shutterBox: GeneratorDef = {
  meta: {
    id: 'shutterbox',
    name: 'Shutter Box',
    group: 'Box',
    summary: 'Box with a living-hinge shutter that rolls round its rounded top',
    description:
      'One or both top corners are rounded, and a living-hinge shutter rolls ' +
      'round them between rails. Beware of the rolling shutter effect: wax ' +
      'the sliding surfaces.',
  },
  // boxes.py's own defaults: a smaller finger margin, and a stiffer hinge.
  paramDefaults: { fj_surroundingspaces: 0.5, flex_distance: 0.75, flex_connection: 2 },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Between the sides.' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 150, min: 40, max: 1000, step: 1, group: 'dimensions', help: 'Back to front, along the sides.' },
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
      help: 'Of the curves the shutter rolls round. At most half the height; 0 makes it that.',
    },
    {
      key: 'style',
      kind: 'enum',
      label: 'Rounded corners',
      default: 'single',
      choices: [
        { value: 'single', label: 'One, at the front' },
        { value: 'double', label: 'Two, front and back' },
      ],
      group: 'top',
    },
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new ShutterBox(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 150),
        h: n(v, 'h', 100),
        radius: n(v, 'radius', 40),
        style: s(v, 'style', 'single') as Style,
      },
      config,
    ),
};
