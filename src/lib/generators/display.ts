/**
 * Display — ported from boxes.py `boxes/generators/display.py`
 * (class `Display`).
 *
 * A stand for flyers or leaflets: a rounded panel with a slot near the
 * bottom for a foot plate.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

class Display extends Boxes {
  constructor(
    private o: { x: number; h: number; radius: number; angle: number },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const { x, h, radius: r, angle: a } = this.o;
    const t = this.thickness;

    this.roundedPlate(0.7 * x, x, r, { edge: 'e', extendCorners: false, move: 'up', label: 'foot' });

    const oh = 1.2 * h - 2 * r;
    if (a > 0) this.moveTo(Math.sin(a * DEG) * oh);
    this.rectangularHole(x / 2, h * 0.2, 0.7 * x + 0.1 * t, 1.3 * t);
    this.moveTo(r);
    this.polyline(x - 2 * r, [90 - a, r], oh, [90 + a, r], x - 2 * r + 2 * Math.sin(a * DEG) * oh, [90 + a, r], oh, [90 - a, r]);
    // boxes.py draws the panel without a move, so it has no name of its own.
    this.ctx.nameCurrentPart('panel');
  }
}

export const display: GeneratorDef = {
  meta: {
    id: 'display',
    name: 'Display',
    group: 'Misc',
    summary: 'Stand for flyers or leaflets',
    description: 'A rounded panel that stands in a foot plate. Tilt the sides to make it wider at the top than at the bottom.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 150, min: 30, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 200, min: 30, max: 1000, step: 1, group: 'dimensions' },
    { key: 'radius', kind: 'length', label: 'Corner radius', unit: 'mm', default: 5, min: 0, max: 100, step: 0.5, group: 'dimensions' },
    { key: 'angle', kind: 'number', label: 'Side tilt', unit: '°', default: 0, min: 0, max: 30, step: 1, group: 'dimensions', help: 'Above zero makes the top wider than the bottom.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Display({ x: n(v, 'x', 150), h: n(v, 'h', 200), radius: n(v, 'radius', 5), angle: n(v, 'angle', 0) }, config),
};
