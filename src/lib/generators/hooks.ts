/**
 * Hook — ported from boxes.py `boxes/generators/hooks.py` (class `Hook`).
 *
 * A wall hook with a square mouth: a back plate, two braced sides, and a
 * three-sided channel between them.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface HookOptions {
  width: number;
  height: number;
  depth: number;
  strength: number;
  angle: number;
}

class Hook extends Boxes {
  private angle: number;

  constructor(
    private o: HookOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.angle = o.angle;
  }

  private get hA(): number {
    return this.o.depth * Math.tan(this.angle * DEG);
  }

  private get heightBack(): number {
    return this.o.strength + this.o.height + this.hA;
  }

  render(): void {
    this.angle = Math.min(this.angle, 80);
    const t = this.thickness;
    const w = this.o.width - 2 * t; // inner width
    const { depth: d, height: h, strength: s } = this.o;

    this.rectangularWall(w + 4 * t, this.heightBack, 'Eeee', { callback: this.backCallback, move: 'right', label: 'back' });
    this.sidewall(d, h, s, this.angle, 'right', 'side');
    this.sidewall(d, h, s, this.angle, 'right', 'side');
    this.rectangularWall(d, w, 'FFFf', { move: 'right', label: 'bottom' });
    this.rectangularWall(h - t, w, 'FFFf', { move: 'right', label: 'front', callback: [() => this.hole((h - t) / 2, w / 2, 0, 17)] });
    this.rectangularWall(s - t, w, 'FeFf', { move: 'right', label: 'top' });
  }

  private backCallback = (num: number): void => {
    if (num !== 0) return;

    const t = this.thickness;
    const { width, height, strength } = this.o;
    const h = this.hA + strength;

    this.fingerHolesAt(1.5 * t, 0, h);
    this.fingerHolesAt(width + 0.5 * t, 0, h);
    this.fingerHolesAt(2 * t, h + t / 2, width - 2 * t, 0);

    const xH = width / 2 + t;

    const y1 = h + height / 2;
    const y2 = strength / 2;
    const y3 = (y1 + y2) / 2;

    this.hole(xH, y1, 0, 3);
    this.hole(xH, y2, 0, 3);
    this.hole(xH, y3, 0, 3);
  };

  private sidewall(depth: number, height: number, strength: number, angle = 60, move?: string, label = ''): void {
    const t = this.thickness;

    const hA = depth * Math.tan(angle * DEG);
    const lA = depth / Math.cos(angle * DEG);

    const fEdge = this.getEdge('f');

    const xTotal = depth + strength + fEdge.margin();
    const yTotal = strength + height + hA;

    if (this.move(xTotal, yTotal, move, true)) return;

    this.moveTo(fEdge.margin());
    this.polyline(strength, angle, lA, 90 - angle, height + strength, 90);

    fEdge.call(strength - t);
    this.corner(90);
    fEdge.call(height - t);

    this.polyline(t, -90, t);

    fEdge.call(depth);
    this.corner(90);
    fEdge.call(hA + strength);
    this.corner(90);

    this.move(xTotal, yTotal, move, false, label);
  }
}

export const hook: GeneratorDef = {
  meta: {
    id: 'hooks',
    name: 'Hook',
    group: 'Misc',
    summary: 'Wall hook with a square mouth, braced underneath',
    description: 'A back plate to screw to the wall, two braced sides, and a three-sided channel to hang things in.',
  },
  // boxes.py's own default: a smaller edge margin.
  paramDefaults: { fj_surroundingspaces: 0.5 },
  params: [
    { key: 'width', kind: 'length', label: 'Width', unit: 'mm', default: 40, min: 10, max: 300, step: 1, group: 'dimensions', help: 'The back plate is a little wider.' },
    { key: 'height', kind: 'length', label: 'Mouth height', unit: 'mm', default: 40, min: 5, max: 300, step: 1, group: 'dimensions', help: 'Inside.' },
    { key: 'depth', kind: 'length', label: 'Mouth depth', unit: 'mm', default: 40, min: 5, max: 300, step: 1, group: 'dimensions', help: 'Inside.' },
    { key: 'strength', kind: 'length', label: 'Strength', unit: 'mm', default: 20, min: 5, max: 100, step: 1, group: 'dimensions', help: 'Width of the hook’s sides.' },
    { key: 'angle', kind: 'number', label: 'Brace angle', unit: '°', default: 45, min: 10, max: 80, step: 1, group: 'dimensions', help: 'Of the support underneath.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Hook(
      { width: n(v, 'width', 40), height: n(v, 'height', 40), depth: n(v, 'depth', 40), strength: n(v, 'strength', 20), angle: n(v, 'angle', 45) },
      config,
    ),
};
