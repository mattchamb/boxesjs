/**
 * Wall caliper holder — ported from boxes.py `boxes/generators/wallcaliperholder.py`
 * (class `WallCaliper`).
 *
 * Holds a single sliding caliper against the wall: two hooked side pieces
 * that cradle its body, on a flanged back plate.
 */
import type { BoxesConfig } from '../boxes';
import { WALL_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { n, s, type GeneratorDef } from './types';

class WallCaliper extends WallMountedBox {
  constructor(
    private o: { h: number; width: number; height: number },
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
  }

  private side(move: string): void {
    const t = this.thickness;
    const h = this.o.h;
    const hc = this.o.height;
    const bEdge = this.getEdge('b');

    const tw = bEdge.spacing() + hc + 6 * t;

    if (this.move(tw, h, move, true)) return;

    this.moveTo(bEdge.margin());
    this.polyline(
      bEdge.startWidth() + 4 * t + hc, [90, 2 * t], h / 2 - 2 * t, [180, 1.5 * t], 0.25 * h,
      -90, hc, -90, 0.75 * h - 2 * t, [90, 2 * t], 2 * t, 90,
    );
    bEdge.call(h);

    this.move(tw, h, move, false, 'side');
  }

  render(): void {
    this.generateWallEdges();

    const t = this.thickness;
    const h = this.o.h;

    this.side('right');
    this.side('right');
    const w = this.o.width;
    this.flangedWall(w, h, 'eeee', {
      flanges: [0, 2 * t, 0, 2 * t],
      r: 2 * t,
      callback: [() => { this.wallHolesAt(1.5 * t, 0, h, 90); this.wallHolesAt(w + 2.5 * t, 0, h, 90); }],
      // boxes.py leaves this unlabelled; each part needs a name here.
      label: 'back',
    });
  }
}

export const wallCaliper: GeneratorDef = {
  meta: {
    id: 'wallcaliperholder',
    name: 'Wall Caliper Holder',
    group: 'Wall mounted',
    summary: 'Holds a single caliper to the wall',
    description:
      'Two hooked side pieces on a flanged back plate, cradling a sliding caliper by ' +
      'its body with the jaws pointing down.',
  },
  params: [
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 30, max: 300, step: 1, group: 'dimensions' },
    {
      key: 'width',
      kind: 'length',
      label: 'Beam width',
      unit: 'mm',
      default: 18,
      min: 5,
      max: 60,
      step: 0.5,
      group: 'dimensions',
      help: 'Width of the caliper’s long end.',
    },
    {
      key: 'height',
      kind: 'length',
      label: 'Body thickness',
      unit: 'mm',
      default: 6,
      min: 2,
      max: 40,
      step: 0.5,
      group: 'dimensions',
      help: 'Height of the caliper’s body.',
    },
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallCaliper(
      { h: n(v, 'h', 100), width: n(v, 'width', 18), height: n(v, 'height', 6) },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
