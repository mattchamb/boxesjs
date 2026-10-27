/**
 * Bottle stack — ported from boxes.py `boxes/generators/bottlestack.py`
 * (class `BottleStack`).
 *
 * A rack that holds a row of bottles on their sides in the fridge, so more
 * can be stacked on top. The double version is two halves that slide
 * together to fit wider spaces.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;
type Poly = Array<number | [number, number]>;

class BottleStack extends Boxes {
  constructor(
    private o: { diameter: number; number: number; depth: number; double: boolean },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private front(hSides: number, offset = 0, move?: string, label = ''): void {
    const t = this.thickness;
    const a = 60;
    const nr = this.o.number;
    const r1 = this.o.diameter / 2.0; // bottle
    const r2 = r1 / Math.cos((90 - a) * DEG) - r1; // in between
    const r3 = this.o.double ? 1.5 * t : 0.5 * t; // upper corners
    const h = (r1 + r2) * (1 - Math.cos(a * DEG));
    let hExtra = 1 * t;
    let hS = hSides - t;
    const p = 0.05 * t; // play

    const tw = nr * r1 * 2 + 2 * r3;
    const th = h + 2 * t;

    if (this.move(tw, th, move, true)) return;

    const openSides = r3 <= 0.5 * t;
    const os = openSides ? 1 : 0;

    if (offset === 0) {
      const slot: Poly = [0, 90, hS, -90, t, -90, hS, 90];
      if (openSides) {
        this.moveTo(0, hS);
        this.polyline(r3 - 0.5 * t);
        this.polyline(...slot.slice(4));
      } else {
        this.polyline(r3 - 0.5 * t);
        this.polyline(...slot);
      }
      for (let i = 0; i < nr - os; i++) {
        this.polyline(2 * r1 - t);
        this.polyline(...slot);
      }
      if (openSides) {
        this.polyline(2 * r1 - t);
        this.polyline(...slot.slice(0, -3));
        this.polyline(r3 - 0.5 * t);
      } else {
        this.polyline(r3 - 0.5 * t);
      }
    } else {
      const slot: Poly = [0, 90, hS, -90, t, -90, hS, 90];
      hS += t;
      const slot2: Poly = [0, 90, hS, -90, t + 2 * p, -90, hS, 90];
      if (openSides) {
        this.moveTo(0, hS);
        this.polyline(t + p, -90, hS, 90);
      } else {
        this.polyline(r3 - 0.5 * t - p);
        this.polyline(...slot2);
      }
      this.polyline(t - p);
      this.polyline(...slot);
      this.polyline(2 * r1 - 5 * t);
      this.polyline(...slot);
      this.polyline(t - p);
      this.polyline(...slot2);
      for (let i = 1; i < nr - os; i++) {
        this.polyline(2 * r1 - 3 * t - p);
        this.polyline(...slot);
        this.polyline(t - p);
        this.polyline(...slot2);
      }
      if (openSides) {
        this.polyline(2 * r1 - 3 * t - p);
        this.polyline(...slot);
        this.polyline(t - p);
        this.polyline(0, 90, hS, -90, t + p);
      } else {
        this.polyline(r3 - 0.5 * t - p);
      }
    }

    if (openSides) hExtra -= hS;

    this.polyline(0, 90, hExtra + h - r3, [90, r3]);

    for (let i = 0; i < nr; i++) {
      this.polyline(0, [a, r2], 0, [-2 * a, r1], 0, [a, r2]);
    }
    this.polyline(0, [90, r3], hExtra + h - r3, 90);

    this.move(tw, th, move, false, label);
  }

  private side(l: number, h: number, short: boolean, move?: string, label = ''): void {
    const t = this.thickness;
    const sh = short ? 1 : 0;

    const tw = l + 2 * t - 4 * t * sh;
    const th = h;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(t, 0);

    this.polyline(l - 3 * t * sh);
    const end: Poly = short ? [90, h - t, 90, t, -90, t, 90] : [[90, t], h - 2 * t, [90, t], 0, 90, t, -90, t, -90, t, 90];
    this.polyline(0, ...end);
    this.polyline(l - 2 * t - 3 * t * sh);
    this.polyline(0, ...[...end].reverse());

    this.move(tw, th, move, false, label);
  }

  render(): void {
    const t = this.thickness;
    const d = this.o.depth;
    const nr = this.o.number;
    const hSides = 2 * t;
    const pieces = this.o.double ? 2 : 1;

    for (let offset = 0; offset < pieces; offset++) {
      const label = pieces > 1 ? `front ${offset ? 'B' : 'A'}` : 'front';
      this.front(hSides, offset, 'up', label);
      this.front(hSides, offset, 'up', label);
    }

    for (let short = 0; short < pieces; short++) {
      for (let i = 0; i < nr + 1; i++) {
        this.side(d, hSides, short === 1, 'up', short ? 'short beam' : 'beam');
      }
    }
  }
}

export const bottleStack: GeneratorDef = {
  meta: {
    id: 'bottlestack',
    name: 'Bottle Stack',
    group: 'Misc',
    summary: 'Rack for stacking bottles on their sides in the fridge',
    description:
      'Two shaped fronts joined by beams cradle a row of bottles. The ' +
      'double version is two such stands whose beams slide into each ' +
      'other’s slots, up to twice as wide; without it the stand is a little narrower.',
  },
  params: [
    { key: 'diameter', kind: 'length', label: 'Bottle diameter', unit: 'mm', default: 80, min: 20, max: 300, step: 1, group: 'dimensions' },
    { key: 'number', kind: 'number', label: 'Bottles', default: 3, min: 1, max: 20, step: 1, integer: true, group: 'dimensions', help: 'In the bottom row.' },
    { key: 'depth', kind: 'length', label: 'Depth', unit: 'mm', default: 80, min: 20, max: 500, step: 1, group: 'dimensions', help: 'Along the bottles.' },
    { key: 'double', kind: 'bool', label: 'Double', default: true, group: 'dimensions', help: 'Two pieces that combine to up to twice the width.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new BottleStack({ diameter: n(v, 'diameter', 80), number: n(v, 'number', 3), depth: n(v, 'depth', 80), double: b(v, 'double', true) }, config),
};
