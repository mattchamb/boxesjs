/**
 * Heart box — ported from boxes.py `boxes/generators/heart.py`
 * (class `HeartBox`).
 *
 * A box in the shape of a heart: two straight sides meeting at the point and
 * two half-circle lobes. The wall bends round the lobes as a living hinge.
 * The top can be closed, have a heart-shaped hole, or have the hole and a
 * lid to lift off it.
 */
import { Boxes, type BoxesConfig, type PolygonBorder } from '../boxes';
import { FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

type TopStyle = 'closed' | 'hole' | 'lid';

class HeartBox extends Boxes {
  constructor(
    private x: number,
    private h: number,
    private top: TopStyle,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /** The top's hole: one heart for `hole`, a second just inside it for `lid`. */
  private CB = (): void => {
    const t = this.thickness;
    let l = (2 / 3) * this.x - t;
    let r = l / 2 - t;
    let d = 2 * t;

    if (this.top === 'closed') return;

    for (let i = 0; i < 2; i++) {
      this.moveTo(t, t);
      this.polyline([l, 2], [180, r], [d, 1], -90, [d, 1], [180, r], [l, 2], 90);
      l -= t;
      r -= t;
      d += t;
      if (this.top === 'hole') return;
    }
  };

  render(): void {
    const { x, h } = this;
    const t = this.thickness;

    const l = (2 / 3) * x;
    const r = l / 2 - 0.5 * t;

    const borders: PolygonBorder[] = [l, [180, r], t, -90, t, [180, r], l, 90];
    this.polygonWalls(borders, h);
    this.rectangularWall(0, h, 'FFFF', { move: 'up only' });
    this.polygonWall(borders, { callback: [this.CB], move: 'right', label: 'top' });
    this.polygonWall(borders, { move: 'mirror right', label: 'bottom' });
    if (this.top === 'lid') {
      this.polygonWall([l + t, [180, r + t], 0, -90, 0, [180, r + t], l + t, 90], { edge: 'e' });
      // boxes.py draws the lid without a move, so it has no label; it is the
      // part left open after the bottom.
      this.ctx.nameCurrentPart('lid');
    }
  }
}

export const heartBox: GeneratorDef = {
  meta: {
    id: 'heart',
    name: 'Heart Box',
    group: 'Box',
    summary: 'Heart-shaped box with walls bent from a living hinge',
    description:
      'A box in the shape of a heart. The wall bends round the two lobes as ' +
      'a living hinge. Leave the top closed, cut a heart-shaped hole in it, ' +
      'or add a lid that sits in the hole.',
  },
  // Fine fingers suit the short straight runs, as upstream.
  paramDefaults: { fj_finger: 1.0, fj_space: 1.0 },
  params: [
    { key: 'x', kind: 'length', label: 'Size', unit: 'mm', default: 150, min: 30, max: 1000, step: 1, group: 'dimensions', help: 'Across the two lobes.' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 50, min: 10, max: 500, step: 1, group: 'dimensions' },
    {
      key: 'top',
      kind: 'enum',
      label: 'Top',
      default: 'closed',
      choices: [
        { value: 'closed', label: 'Closed' },
        { value: 'hole', label: 'Hole' },
        { value: 'lid', label: 'Hole and lid' },
      ],
      group: 'top',
    },
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new HeartBox(n(v, 'x', 150), n(v, 'h', 50), s(v, 'top', 'closed') as TopStyle, config),
};
