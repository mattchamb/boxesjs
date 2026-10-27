/**
 * Burn test — ported from boxes.py `boxes/generators/burntest.py`
 * (class `BurnTest`).
 *
 * Pairs of finger-jointed strips, each side cut with a slightly larger burn
 * value, so you can see which fits best in your material.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { ETCHING } from '../geom/colors';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

interface BurnTestOptions {
  x: number;
  step: number;
  pairs: number;
  date: boolean;
  id: string;
}

/** Today as YYYY-MM-DD, in local time as boxes.py's `date.today()` is. */
function today(): string {
  const d = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

class BurnTest extends Boxes {
  constructor(
    private o: BurnTestOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const { x, step: s } = this.o;
    const fontsize = x < 81 ? (12.5 * x) / 100 : 10;
    const metaSize = fontsize * 0.75;
    const t = this.thickness;
    const date = today();

    const etch = (i: number) => {
      this.text(`${this.burn.toFixed(3)}mm`, x / 2, t, 0, 'center', fontsize, ETCHING);
      if (this.o.date && i === 3) this.text(date, x / 2, 20, 0, 'center', metaSize, ETCHING);
      if (this.o.id && i === 1) this.text(this.o.id, x / 2, 20, 0, 'center', metaSize, ETCHING);
    };

    this.moveTo(t, t);

    for (let cnt = 0; cnt < this.o.pairs; cnt++) {
      for (let i = 0; i < 4; i++) {
        etch(i);
        this.getEdge('f').call(x);
        this.corner(90);
        this.burn += s;
      }
      this.burn -= 4 * s;
      this.moveTo(x + 2 * t + this.spacing, -t);

      for (let i = 0; i < 4; i++) {
        etch(i);
        this.getEdge('F').call(x);
        this.polyline(t, 90, t);
        this.burn += s;
      }
      this.moveTo(x + 2 * t + this.spacing, t);
    }
    // boxes.py draws every piece without a move, as one path, so they are
    // one part.
    this.ctx.nameCurrentPart('test pieces');
  }
}

export const burnTest: GeneratorDef = {
  meta: {
    id: 'burntest',
    name: 'Burn Test',
    group: 'Misc',
    summary: 'Finger-jointed squares for finding the right burn value',
    description:
      'Set the burn to the lowest value you want to try. Each side of each ' +
      'square is cut with a slightly larger one, etched on it; fit the ' +
      'pieces together and use the value of the best-fitting side. The ' +
      'L-Beam makes a more compact test.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Side length', unit: 'mm', default: 100, min: 20, max: 300, step: 1, group: 'dimensions' },
    { key: 'step', kind: 'number', label: 'Burn step', unit: 'mm', default: 0.01, min: 0.001, max: 0.1, step: 0.001, group: 'dimensions', help: 'Added to the burn for each side.' },
    { key: 'pairs', kind: 'number', label: 'Pairs', default: 2, min: 1, max: 10, step: 1, integer: true, group: 'dimensions', help: 'Each pair tests four burn values.' },
    { key: 'date', kind: 'bool', label: 'Etch the date', default: false, group: 'dimensions' },
    { key: 'id', kind: 'text', label: 'Etched identifier', default: '', group: 'dimensions', placeholder: 'e.g. material', help: 'Left blank, nothing is etched.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new BurnTest(
      { x: n(v, 'x', 100), step: n(v, 'step', 0.01), pairs: n(v, 'pairs', 2), date: b(v, 'date', false), id: s(v, 'id', '') },
      config,
    ),
};
