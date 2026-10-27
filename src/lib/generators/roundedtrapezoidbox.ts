/**
 * Rounded trapezoid box — ported from boxes.py
 * `boxes/generators/roundedtrapezoidbox.py` (class `RoundedTrapezoidBox`).
 *
 * A box on a trapezoid floor whose vertical corners are rounded, each to its
 * own radius. The wall bends round the corners as a living hinge, so it is
 * one long piece unless split into two or four, where the pieces meet with
 * dovetails.
 */
import { Boxes, type BoxesConfig, type PolygonBorder } from '../boxes';
import { DOVETAIL_PARAMS, FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

type TopStyle = 'hole' | 'lid' | 'closed';

interface RoundedTrapezoidBoxOptions {
  xFront: number;
  xBack: number;
  y: number;
  h: number;
  outside: boolean;
  radiusFrontLeft: number;
  radiusFrontRight: number;
  radiusBackRight: number;
  radiusBackLeft: number;
  wallPieces: 1 | 2 | 4;
  top: TopStyle;
}

class RoundedTrapezoidBox extends Boxes {
  private holePoly: PolygonBorder[] = [];

  constructor(
    private o: RoundedTrapezoidBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private holeCB = (): void => {
    const t = this.thickness;
    this.moveTo(0, 2 * t);
    this.polygonWall(this.holePoly, { edge: 'e', turtle: true, correctCorners: false });
  };

  render(): void {
    const t = this.thickness;
    let { xFront: xf, xBack: xb, y, h } = this.o;
    const { radiusFrontLeft: rFl, radiusFrontRight: rFr, radiusBackRight: rBr, radiusBackLeft: rBl } = this.o;

    let a = Math.atan((xf - xb) / (2 * y)) / DEG;

    if (this.o.outside) {
      y = this.adjustSize(y);
      a = Math.atan((xf - xb) / (2 * y)) / DEG;
      // boxes.py passes the slanted wall's width as the edges here, but
      // adjustSize reads a number only for its truth, so a full thickness
      // comes off each side either way.
      xf = this.adjustSize(xf, true, true);
      xb = this.adjustSize(xb, true, true);
      h = this.adjustSize(h, true);
    }

    const yL = y / Math.cos(a * DEG);
    const yR = yL;

    // Shorten the sides by what the corner radii take up.
    const dFl = Math.tan(((90 + a) / 2) * DEG) * rFl;
    const dFr = Math.tan(((90 + a) / 2) * DEG) * rFr;
    const dBr = Math.tan(((90 - a) / 2) * DEG) * rBr;
    const dBl = Math.tan(((90 - a) / 2) * DEG) * rBl;

    const poly: PolygonBorder[] = [
      (xf - dFl - dFr) / 2, [90 + a, rFr],
      yR - dFr - dBr, [90 - a, rBr],
      xb - dBr - dBl, [90 - a, rBl],
      yL - dBl - dFl, [90 + a, rFl],
      (xf - dFl - dFr) / 2, 0,
    ];

    let d = 2 * t;

    // The top's hole runs inside the walls, so its radii are smaller; the
    // lid sits on top of them, so its radii are larger.
    this.holePoly = poly.map((v) => (Array.isArray(v) ? [v[0], v[1] - d] : v));
    const lidPoly: PolygonBorder[] = poly.map((v) => (Array.isArray(v) ? [v[0], v[1] + t] : v));
    // A radius below zero becomes a sharp corner, its legs extended to meet.
    this.holePoly.forEach((v, nr) => {
      if (nr % 2 && Array.isArray(v) && v[1] < 0) {
        d = v[1] * Math.tan((v[0] / 2) * DEG);
        (this.holePoly[nr - 1] as number) += d;
        (this.holePoly[nr + 1] as number) += d;
        this.holePoly[nr] = [v[0], 0];
      }
    });

    // Split the wall at the middle of the back, and of the sides for four
    // pieces: a straight 0° corner, which polygonWalls joins with dovetails.
    const halve = (i: number) => {
      const l = poly[i] as number;
      poly.splice(i, 1, l / 2, 0.0, l / 2);
    };
    if (this.o.wallPieces !== 1) halve(4);
    if (this.o.wallPieces === 4) {
      halve(8);
      halve(2);
    }

    this.savedContext(() => {
      this.polygonWall(poly, { move: 'right', label: 'bottom' });
      if (this.o.top === 'closed') this.polygonWall(poly, { move: 'right', label: 'top' });
      else this.polygonWall(poly, { callback: [this.holeCB], move: 'right', label: 'top' });
      if (this.o.top === 'lid') this.polygonWall(lidPoly, { edge: 'e', move: 'right', label: 'lid' });
    });

    this.polygonWall(poly, { move: 'up only' });
    this.moveTo(0, t);
    this.polygonWalls(poly, h);
  }
}

export const roundedTrapezoidBox: GeneratorDef = {
  meta: {
    id: 'roundedtrapezoidbox',
    name: 'Rounded Trapezoid Box',
    group: 'Box',
    summary: 'Trapezoid box with rounded corners bent from a living hinge',
    description:
      'A box on a trapezoid floor with each vertical corner rounded to its ' +
      'own radius. The widths are measured as if the corners were sharp, so ' +
      'the radii make the box narrower unless it is a rectangle. The wall ' +
      'bends round the corners in one piece, or is split into two or four ' +
      'that meet with dovetails. The top can have a hole, a hole and a lid ' +
      'over it, or be closed.',
  },
  params: [
    { key: 'x_front', kind: 'length', label: 'Front width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'As if the corners were sharp.' },
    { key: 'x_back', kind: 'length', label: 'Back width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'As if the corners were sharp.' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    { key: 'radius_front_left', kind: 'length', label: 'Front left radius', unit: 'mm', default: 20, min: 0, max: 300, step: 1, group: 'dimensions' },
    { key: 'radius_front_right', kind: 'length', label: 'Front right radius', unit: 'mm', default: 20, min: 0, max: 300, step: 1, group: 'dimensions' },
    { key: 'radius_back_right', kind: 'length', label: 'Back right radius', unit: 'mm', default: 20, min: 0, max: 300, step: 1, group: 'dimensions' },
    { key: 'radius_back_left', kind: 'length', label: 'Back left radius', unit: 'mm', default: 20, min: 0, max: 300, step: 1, group: 'dimensions' },
    {
      key: 'wall_pieces',
      kind: 'enum',
      label: 'Wall pieces',
      default: '1',
      choices: [
        { value: '1', label: 'One' },
        { value: '2', label: 'Two' },
        { value: '4', label: 'Four' },
      ],
      group: 'joints',
      help: 'Split the wall so it fits a smaller sheet. The pieces meet with dovetails.',
    },
    {
      key: 'top',
      kind: 'enum',
      label: 'Top',
      default: 'hole',
      choices: [
        { value: 'hole', label: 'Hole' },
        { value: 'lid', label: 'Hole and lid' },
        { value: 'closed', label: 'Closed' },
      ],
      group: 'top',
    },
    // Every wall join is a dovetail: the straight 0° corner where the wall's
    // two ends meet, and any split.
    ...DOVETAIL_PARAMS.map((spec) => ({ ...spec, showIf: undefined })),
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new RoundedTrapezoidBox(
      {
        xFront: n(v, 'x_front', 100),
        xBack: n(v, 'x_back', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        radiusFrontLeft: n(v, 'radius_front_left', 20),
        radiusFrontRight: n(v, 'radius_front_right', 20),
        radiusBackRight: n(v, 'radius_back_right', 20),
        radiusBackLeft: n(v, 'radius_back_left', 20),
        wallPieces: n(v, 'wall_pieces', 1) as 1 | 2 | 4,
        top: s(v, 'top', 'hole') as TopStyle,
      },
      config,
    ),
};
