/**
 * Wall hook — ported from boxes.py `boxes/generators/wallhook.py`
 * (class `WallHook`).
 *
 * A single U-shaped hook built up from two hook-shaped sides, a flanged back
 * plate and two spacers.
 */
import type { BoxesConfig } from '../boxes';
import { WALL_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { n, s, type GeneratorDef } from './types';

interface WallHookOptions {
  h: number;
  width: number;
  hookInsideDiameter: number;
  hookThickness: number;
}

class WallHook extends WallMountedBox {
  constructor(
    private o: WallHookOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
  }

  private side(move: string): void {
    const t = this.thickness;
    const h = this.o.h;
    const hid = this.o.hookInsideDiameter;
    const ht = this.o.hookThickness;
    const bEdge = this.getEdge('b');

    const totalLength = hid + ht * 2;
    const radius = hid / 2;
    const outsideRadius = radius + ht;
    const bottomLength = totalLength - outsideRadius - t;

    const tw = bEdge.spacing() + totalLength;

    if (this.move(tw, h, move, true)) return;

    this.moveTo(bEdge.margin());
    this.polyline(
      bEdge.startWidth() + bottomLength,
      [90, outsideRadius],
      0,
      [180, ht / 2], // U-turn the width of the hook
      0,
      [-90, radius],
      0,
      [-90, radius],
      h - radius - ht - ht,
      [90, ht],
      0,
      90,
    );

    bEdge.call(h);

    this.fingerHolesAt(-(ht / 2), 10, totalLength - outsideRadius, 90);
    this.fingerHolesAt(-outsideRadius - ht / 2, totalLength - ht / 2, ht, 0);

    this.move(tw, h, move, false, 'side');
  }

  render(): void {
    this.generateWallEdges();

    const t = this.thickness;
    const h = this.o.h;
    const w = this.o.width;
    const ht = this.o.hookThickness;
    const hid = this.o.hookInsideDiameter;
    const totalLength = hid + ht * 2;
    const outsideRadius = hid / 2 + ht;

    this.side('up');
    this.side('right mirror');

    this.moveTo(this.getEdge('b').spacing(), 0);
    this.flangedWall(w, h, 'eeee', {
      flanges: [10, 2 * t, 0, 2 * t],
      r: 2 * t,
      callback: [() => { this.wallHolesAt(1.5 * t, 0, h, 90); this.wallHolesAt(w + 2.5 * t, 0, h, 90); }],
      move: 'right',
      label: 'back',
    });

    // boxes.py leaves the spacers unlabelled; each part needs a name here.
    this.moveTo(0, -5);
    this.rectangularWall(w, ht, 'efef', { move: 'left down', label: 'spacer' });

    this.moveTo(0, -5);
    this.rectangularWall(w, totalLength - outsideRadius, 'efef', { move: 'down', label: 'spacer' });
  }
}

export const wallHook: GeneratorDef = {
  meta: {
    id: 'wallhook',
    name: 'Wall Hook',
    group: 'Wall mounted',
    summary: 'A single U-shaped hook',
    description:
      'A U-shaped hook built from two hook-shaped sides glued either side of two ' +
      'spacers, on a flanged back plate — for a coat, a bag or a coil of cable.',
  },
  params: [
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 60, max: 400, step: 1, group: 'dimensions' },
    { key: 'width', kind: 'length', label: 'Width', unit: 'mm', default: 10, min: 5, max: 100, step: 1, group: 'dimensions', help: 'Width of the back panel, and so of the hook.' },
    {
      key: 'hook_inside_diameter',
      kind: 'length',
      label: 'Hook inside diameter',
      unit: 'mm',
      default: 40,
      min: 10,
      max: 200,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'hook_thickness',
      kind: 'length',
      label: 'Hook thickness',
      unit: 'mm',
      default: 20,
      min: 5,
      max: 60,
      step: 1,
      group: 'dimensions',
    },
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallHook(
      {
        h: n(v, 'h', 100),
        width: n(v, 'width', 10),
        hookInsideDiameter: n(v, 'hook_inside_diameter', 40),
        hookThickness: n(v, 'hook_thickness', 20),
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
