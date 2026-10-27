/**
 * Coffin — ported from boxes.py `boxes/generators/coffin.py` (class `Coffin`).
 *
 * A six-sided box in the traditional coffin outline: widest at the
 * shoulders, narrowing to the head and the feet. The floor and lid are the
 * same polygon, the lid with a cross cut into it; the walls are joined at
 * the polygon's angles by `polygonWalls`.
 *
 * Deliberate divergence: with `outside` off, boxes.py raises AttributeError,
 * because the cross reads the foot width and shoulder height that only the
 * `outside` branch stores. They are stored either way here. There is no
 * golden for that configuration, since boxes.py cannot render it.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface CoffinOptions {
  x: number;
  h: number;
  outside: boolean;
  /** These four, and the cross, are fractions of the length. */
  width: number;
  topWidth: number;
  bottomWidth: number;
  shoulderHeight: number;
  cross: number;
}

class Coffin extends Boxes {
  /** Length, width at the feet and length up to the shoulders, for the cross. */
  private x = 0;
  private yb = 0;
  private xb = 0;

  constructor(
    private o: CoffinOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private crossCB = (): void => {
    const c = (this.x + 2 * this.thickness) * this.o.cross;
    if (!c) return;

    this.moveTo(this.yb / 2, this.xb - 1.2 * c);
    const poly = [0.05 * c, 90, 0.9 * c, -90, 0.45 * c, 90, 0.1 * c, 90, 0.45 * c, -90, 0.45 * c, 90, 0.1 * c];
    this.polyline(...poly, ...poly.slice(0, -1).reverse());
  };

  render(): void {
    let x = this.o.x;
    let xb = x * this.o.shoulderHeight;
    const xt = x - xb;
    let [yb, y, yt] = [x * this.o.bottomWidth, x * this.o.width, x * this.o.topWidth];

    if (this.o.outside) {
      x = this.adjustSize(x);
      xb = this.adjustSize(xb, false);
      y = this.adjustSize(y);
      yb = this.adjustSize(yb);
      yt = this.adjustSize(yt);
    }
    this.x = x;
    this.xb = xb;
    this.yb = yb;

    const ab = Math.atan((y - yb) / 2 / xb) / DEG;
    const at = Math.atan((y - yt) / 2 / xt) / DEG;
    const lb = xb / Math.cos(ab * DEG);
    const lt = xt / Math.cos(at * DEG);

    const poly = [yb, 90 - ab, lb, ab + at, lt, 90 - at, yt, 90 - at, lt, at + ab, lb, 90 - ab];

    this.polygonWall(poly, { edge: 'f', move: 'right', label: 'bottom' });
    this.polygonWall(poly, { edge: 'f', callback: [this.crossCB], move: 'right', label: 'lid' });

    this.polygonWalls(poly, this.o.h);
  }
}

export const coffin: GeneratorDef = {
  meta: {
    id: 'coffin',
    name: 'Coffin',
    group: 'Box',
    summary: 'Six-sided box in a coffin outline, with a cross on the lid',
    description:
      'A box widest at the shoulders and narrowing to the head and feet. ' +
      'The proportions are fractions of the total length, so the shape stays ' +
      'the same at any size. Set the cross to 0 for a plain lid.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Length', unit: 'mm', default: 100, min: 30, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 30, min: 10, max: 500, step: 1, group: 'dimensions' },
    {
      key: 'width',
      kind: 'number',
      label: 'Width at the shoulders',
      unit: '× length',
      default: 0.4,
      min: 0.1,
      max: 1,
      step: 0.01,
      group: 'dimensions',
    },
    { key: 'top_width', kind: 'number', label: 'Width at the head', unit: '× length', default: 0.25, min: 0.05, max: 1, step: 0.01, group: 'dimensions' },
    { key: 'bottom_width', kind: 'number', label: 'Width at the feet', unit: '× length', default: 0.25, min: 0.05, max: 1, step: 0.01, group: 'dimensions' },
    {
      key: 'shoulder_height',
      kind: 'number',
      label: 'Shoulder position',
      unit: '× length',
      default: 0.7,
      min: 0.1,
      max: 0.9,
      step: 0.01,
      group: 'dimensions',
      help: 'How far from the feet the widest point is.',
    },
    {
      key: 'cross',
      kind: 'number',
      label: 'Cross size',
      unit: '× length',
      default: 0.2,
      min: 0,
      max: 0.5,
      step: 0.01,
      group: 'top',
      help: 'Size of the cross cut into the lid. 0 leaves the lid plain.',
    },
    {
      key: 'outside',
      kind: 'bool',
      label: 'Outside measurements',
      default: true,
      group: 'dimensions',
      help: 'When on, the length and widths are the exterior. When off, they are the interior.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Coffin(
      {
        x: n(v, 'x', 100),
        h: n(v, 'h', 30),
        outside: b(v, 'outside', true),
        width: n(v, 'width', 0.4),
        topWidth: n(v, 'top_width', 0.25),
        bottomWidth: n(v, 'bottom_width', 0.25),
        shoulderHeight: n(v, 'shoulder_height', 0.7),
        cross: n(v, 'cross', 0.2),
      },
      config,
    ),
};
