/**
 * Rounded regular box — ported from boxes.py
 * `boxes/generators/roundedregularbox.py` (class `RoundedRegularBox`).
 *
 * A box on a regular polygon with every vertical corner rounded. The wall
 * bends round the corners as a living hinge, split into pieces that meet in
 * the middle of a side with dovetails.
 */
import { Boxes, type BoxesConfig, type PolygonBorder } from '../boxes';
import { DOVETAIL_PARAMS, FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

type TopStyle = 'hole' | 'lid' | 'closed';

interface RoundedRegularBoxOptions {
  h: number;
  sides: number;
  innerSize: number;
  radius: number;
  /** 0 for one per side. */
  wallpieces: number;
  top: TopStyle;
}

class RoundedRegularBox extends Boxes {
  /** Length of each straight run between the rounded corners. */
  private side = 0;

  constructor(
    private o: RoundedRegularBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private holeCB = (): void => {
    const n = this.o.sides;
    const t = this.thickness;

    const poly: PolygonBorder[] = [];
    for (let i = 0; i < n; i++) poly.push(this.side, [360 / n, this.o.radius - 2 * t]);

    this.moveTo(-this.side / 2, 2 * t);
    this.polygonWall(poly, { edge: 'e', turtle: true });
  };

  render(): void {
    const n = this.o.sides;
    const t = this.thickness;
    const r = this.o.radius;
    const wallpieces = this.o.wallpieces === 0 ? n : this.o.wallpieces;

    const [, , full] = this.regularPolygon(n, undefined, this.o.innerSize / 2);

    const side = (this.side = full - 2 * r * Math.tan((360 / 2 / n) * DEG));

    // Start mid-side, and split the wall there too wherever a piece ends: a
    // straight 0° corner, which polygonWalls joins with dovetails.
    const poly: PolygonBorder[] = [side / 2, [360 / n, r]];
    let parts = 1;
    for (let i = 0; i < n - 1; i++) {
      if ((wallpieces * (i + 1)) / n >= parts) {
        poly.push(side / 2, 0, side / 2, [360 / n, r]);
        parts += 1;
      } else {
        poly.push(side, [360 / n, r]);
      }
    }
    poly.push(side / 2, 0);

    this.savedContext(() => {
      this.polygonWall(poly, { move: 'right', label: 'bottom' });
      if (this.o.top === 'closed') this.polygonWall(poly, { move: 'right', label: 'top' });
      else this.polygonWall(poly, { callback: [this.holeCB], move: 'right', label: 'top' });
      if (this.o.top === 'lid') {
        const lid: PolygonBorder[] = [];
        for (let i = 0; i < n; i++) lid.push(this.side, [360 / n, r + t]);
        this.polygonWall(lid, { edge: 'e', move: 'right', label: 'lid' });
      }
    });

    this.polygonWall(poly, { move: 'up only' });
    this.moveTo(0, t);
    this.polygonWalls(poly, this.o.h);
  }
}

export const roundedRegularBox: GeneratorDef = {
  meta: {
    id: 'roundedregularbox',
    name: 'Rounded Regular Box',
    group: 'Box',
    summary: 'Regular polygon box with rounded corners bent from a living hinge',
    description:
      'A box on a regular polygon with every vertical corner rounded. The ' +
      'wall bends round the corners and is split into pieces that meet with ' +
      'dovetails, by default one per side. The top can have a hole, a hole ' +
      'and a lid over it, or be closed.',
  },
  params: [
    { key: 'sides', kind: 'number', label: 'Sides', default: 5, min: 3, max: 20, step: 1, group: 'dimensions' },
    {
      key: 'inner_size',
      kind: 'length',
      label: 'Inner size',
      unit: 'mm',
      default: 150,
      min: 30,
      max: 1000,
      step: 1,
      group: 'dimensions',
      help: 'Diameter of the circle that touches the middle of every side, inside.',
    },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'radius', kind: 'length', label: 'Corner radius', unit: 'mm', default: 15, min: 0, max: 200, step: 1, group: 'dimensions' },
    {
      key: 'wallpieces',
      kind: 'number',
      label: 'Wall pieces',
      default: 0,
      min: 0,
      max: 20,
      step: 1,
      group: 'joints',
      help: 'How many pieces the wall is cut in, meeting with dovetails. 0 makes one per side.',
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
    ...DOVETAIL_PARAMS.map((spec) => ({ ...spec, showIf: undefined })),
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new RoundedRegularBox(
      {
        h: n(v, 'h', 100),
        sides: Math.floor(n(v, 'sides', 5)),
        innerSize: n(v, 'inner_size', 150),
        radius: n(v, 'radius', 15),
        wallpieces: Math.floor(n(v, 'wallpieces', 0)),
        top: s(v, 'top', 'hole') as TopStyle,
      },
      config,
    ),
};
