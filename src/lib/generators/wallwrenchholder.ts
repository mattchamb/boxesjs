/**
 * Wall wrench holder — ported from boxes.py `boxes/generators/wallwrenchholder.py`
 * (class `WallWrenchHolder`).
 *
 * A set of spanners hangs in a rack of angled slots, graded from the smallest
 * to the largest, between two notched side walls.
 */
import type { Boxes, BoxesConfig } from '../boxes';
import { Edge } from '../edges/base';
import { WALL_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { n, s, type GeneratorDef } from './types';

interface WallWrenchHolderOptions {
  x: number;
  depth: number;
  number: number;
  minWidth: number;
  maxWidth: number;
  minStrength: number;
  maxStrength: number;
  extraDistance: number;
}

/**
 * Side edge with one angled slot per wrench, widening from the first to the
 * last. boxes.py calls this `SlottedEdge`; it is generator-local (PORTING §7)
 * and has nothing to do with the library edge of that name.
 */
class WrenchSlotsEdge extends Edge {
  constructor(
    boxes: Boxes,
    private o: WallWrenchHolderOptions,
  ) {
    super(boxes, null);
  }

  override call(length: number): void {
    const n = this.o.number;
    const t = this.thickness;

    this.polyline(t, 45);

    let l = t;
    for (let i = 0; i < n; i++) {
      const w = this.o.minWidth * ((n - i) / n) + this.o.maxWidth * (i / n);
      const s = this.o.minStrength * ((n - i) / n) + this.o.maxStrength * (i / n);
      if (i === n - 1) {
        this.polyline(w - s / 2 + 2 * s, [-180, s / 2], w - 0.5 * s, [180, s / 2]);
        l += s * 2 * 2 ** 0.5;
      } else {
        this.polyline(w - s / 2 + 2 * s, [-180, s / 2], w - 0.5 * s, [135, s / 2], this.o.extraDistance, [45, s / 2]);
        l += s * 2 * 2 ** 0.5 + this.o.extraDistance;
      }
    }
    this.polyline(0, -45);
    this.edge(length - l);
  }
}

class WallWrenchHolder extends WallMountedBox {
  constructor(
    private o: WallWrenchHolderOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
  }

  render(): void {
    this.generateWallEdges();

    const o = this.o;
    const h = (o.minStrength + o.maxStrength) * o.number * 2 ** 0.5 + o.extraDistance * (o.number - 1) + o.maxWidth;
    const t = this.thickness;
    const x = o.x - 2 * t;

    this.rectangularWall(o.depth, h, ['e', 'B', 'e', new WrenchSlotsEdge(this, o)], { move: 'right', label: 'side' });
    this.rectangularWall(o.depth, h, ['e', 'B', 'e', new WrenchSlotsEdge(this, o)], { move: 'right', label: 'side' });
    // boxes.py leaves this unlabelled; each part needs a name here.
    this.rectangularWall(x, h, 'eDed', { move: 'right', label: 'back' });
  }
}

export const wallWrenchHolder: GeneratorDef = {
  meta: {
    id: 'wallwrenchholder',
    name: 'Wall Wrench Holder',
    group: 'Wall mounted',
    summary: 'Rack of graded slots for a set of spanners',
    description:
      'Two notched side walls and a back plate. Each spanner hangs in its own angled ' +
      'slot, the slots growing from the smallest spanner at the top to the largest at ' +
      'the bottom.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 500, step: 1, group: 'dimensions' },
    { key: 'depth', kind: 'length', label: 'Depth of the sides', unit: 'mm', default: 30, min: 10, max: 150, step: 1, group: 'dimensions' },
    { key: 'number', kind: 'number', label: 'Number of wrenches', default: 11, min: 1, max: 30, step: 1, group: 'dimensions' },
    { key: 'min_width', kind: 'length', label: 'Smallest wrench width', unit: 'mm', default: 8, min: 2, max: 60, step: 0.5, group: 'dimensions' },
    { key: 'max_width', kind: 'length', label: 'Largest wrench width', unit: 'mm', default: 25, min: 2, max: 100, step: 0.5, group: 'dimensions' },
    {
      key: 'min_strength',
      kind: 'length',
      label: 'Smallest wrench thickness',
      unit: 'mm',
      default: 3,
      min: 1,
      max: 20,
      step: 0.5,
      group: 'dimensions',
    },
    {
      key: 'max_strength',
      kind: 'length',
      label: 'Largest wrench thickness',
      unit: 'mm',
      default: 5,
      min: 1,
      max: 20,
      step: 0.5,
      group: 'dimensions',
    },
    {
      key: 'extra_distance',
      kind: 'length',
      label: 'Extra space between wrenches',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 30,
      step: 0.5,
      group: 'dimensions',
    },
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallWrenchHolder(
      {
        x: n(v, 'x', 100),
        depth: n(v, 'depth', 30),
        number: n(v, 'number', 11),
        minWidth: n(v, 'min_width', 8),
        maxWidth: n(v, 'max_width', 25),
        minStrength: n(v, 'min_strength', 3),
        maxStrength: n(v, 'max_strength', 5),
        extraDistance: n(v, 'extra_distance', 0),
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
