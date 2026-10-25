/**
 * Wall type tray — ported from boxes.py `boxes/generators/walltypetray.py`
 * (class `WallTypeTray`).
 *
 * A compartmented tray that hangs on the wall: TypeTray's grid of dividers,
 * with a taller back wall that carries the wall mounts. Unlike TypeTray, every
 * divider runs the full width or depth.
 */
import type { BoxesConfig, EdgeSpec } from '../boxes';
import { SlottedEdge } from '../edges/slots';
import { STACKABLE_PARAMS, WALL_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { BOTTOM_EDGE_CHOICES } from '../topedge';
import { WallMountedBox, type WallType } from '../walledges';
import { b, n, s, type GeneratorDef } from './types';

interface WallTypeTrayOptions {
  sx: number[];
  sy: number[];
  h: number;
  hi: number;
  outside: boolean;
  bottomEdge: string;
  allMounts: boolean;
  backHeight: number;
  radius: number;
}

class WallTypeTray extends WallMountedBox {
  private sx: number[];
  private sy: number[];
  private h: number;
  private hi: number;

  constructor(
    private o: WallTypeTrayOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
    this.sx = [...o.sx];
    this.sy = [...o.sy];
    this.h = o.h;
    this.hi = o.hi;
  }

  private xSlots = (): void => {
    let posx = -0.5 * this.thickness;
    for (const x of this.sx.slice(0, -1)) {
      posx += x + this.thickness;
      let posy = 0;
      for (const y of this.sy) {
        this.fingerHolesAt(posx, posy, y);
        posy += y + this.thickness;
      }
    }
  };

  private ySlots = (): void => {
    let posy = -0.5 * this.thickness;
    for (const y of this.sy.slice(0, -1)) {
      posy += y + this.thickness;
      let posx = 0;
      for (const x of [...this.sx].reverse()) {
        this.fingerHolesAt(posy, posx, x);
        posx += x + this.thickness;
      }
    }
  };

  /** On the back wall with `all_mounts`, every divider hooks to the wall. */
  private xHoles(wallholes = false): void {
    let posx = -0.5 * this.thickness;
    for (const x of this.sx.slice(0, -1)) {
      posx += x + this.thickness;
      if (wallholes) this.wallHolesAt(posx, 0, this.h + this.o.backHeight, 90);
      else this.fingerHolesAt(posx, 0, this.hi);
    }
  }

  private yHoles = (): void => {
    let posy = -0.5 * this.thickness;
    for (const y of this.sy.slice(0, -1)) {
      posy += y + this.thickness;
      this.fingerHolesAt(posy, 0, this.hi);
    }
  };

  render(): void {
    this.generateWallEdges();
    const be0 = this.o.bottomEdge;

    if (this.o.outside) {
      this.sx = this.adjustSize(this.sx);
      this.sy = this.adjustSize(this.sy);
      this.h = this.adjustSize(this.h, be0, false);
      if (this.hi) this.hi = this.adjustSize(this.hi, be0, false);
    }

    const t = this.thickness;
    const x = this.sx.reduce((a, c) => a + c, 0) + t * (this.sx.length - 1);
    const y = this.sy.reduce((a, c) => a + c, 0) + t * (this.sy.length - 1);
    const h = this.h;
    const bh = this.o.backHeight;
    this.hi = this.hi || h;
    const hi = this.hi;
    const radius = this.o.radius;

    // boxes.py saves here and never restores; reproduced so the transform
    // stack ends up the same depth.
    this.ctx.save();

    // Outer walls along x: front, then the back with the wall mounts.
    this.rectangularWall(x, h, [be0, 'f', 'e', 'f'], { callback: [() => this.xHoles()], move: 'up', label: 'front' });
    this.rectangularWall(x, h + bh, [be0, 'C', 'e', 'c'], {
      callback: [this.mirrorX(() => this.xHoles(this.o.allMounts), x)],
      move: 'up',
      label: 'back',
    });

    if (be0 !== 'e') {
      this.rectangularWall(x, y, 'ffff', { callback: [this.xSlots, this.ySlots], move: 'up', label: 'bottom' });
    }

    const be = be0 !== 'e' ? 'f' : 'e';

    for (let i = 0; i < this.sy.length - 1; i++) {
      const e: EdgeSpec[] = [
        new SlottedEdge(this, this.sx, be),
        'f',
        new SlottedEdge(this, [...this.sx].reverse(), 'e', 0.5 * hi),
        'f',
      ];
      this.rectangularWall(x, hi, e, { move: 'up', label: 'divider x' });
    }

    // Outer walls along y, rising to the back wall.
    this.trapezoidSideWall(y, h, h + bh, [be0, 'B', 'e', 'h'], {
      radius,
      callback: [this.yHoles],
      move: 'up',
      label: 'left',
    });
    this.moveTo(0, 8);
    this.trapezoidSideWall(y, h + bh, h, [be0, 'h', 'e', 'b'], {
      radius,
      callback: [this.mirrorX(this.yHoles, y)],
      move: 'up',
      label: 'right',
    });
    this.moveTo(0, 8);

    for (let i = 0; i < this.sx.length - 1; i++) {
      if (this.o.allMounts) {
        this.trapezoidSideWall(y, h, h + bh, [new SlottedEdge(this, this.sy, be, 0.5 * hi), 'B', 'e', 'f'], {
          radius,
          move: 'up',
          label: 'divider y',
        });
      } else {
        const e: EdgeSpec[] = [new SlottedEdge(this, this.sy, be, 0.5 * hi), 'f', 'e', 'f'];
        this.rectangularWall(y, hi, e, { move: 'up', label: 'divider y' });
      }
    }
  }
}

export const wallTypeTray: GeneratorDef = {
  meta: {
    id: 'walltypetray',
    name: 'Wall Type Tray',
    group: 'Wall mounted',
    summary: 'Compartmented tray that hangs on the wall',
    description:
      'A grid of compartments with a back wall that hangs on the wall system of your ' +
      'choice. Every divider runs the full width or depth. With wall mounts on all ' +
      'walls, the front-to-back dividers hook to the wall too and rise to the back ' +
      'height, for heavier loads.',
  },
  params: [
    { key: 'sx', kind: 'sections', label: 'Columns left to right', default: '50*3', group: 'dimensions', itemLabel: 'column' },
    { key: 'sy', kind: 'sections', label: 'Rows front to back', default: '50*3', group: 'dimensions', itemLabel: 'row' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 500, step: 1, group: 'dimensions' },
    {
      key: 'hi',
      kind: 'length',
      label: 'Divider height',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'Zero makes the dividers as tall as the outer walls.',
    },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: BOTTOM_EDGE_CHOICES,
      default: 'h',
      group: 'dimensions',
    },
    {
      key: 'back_height',
      kind: 'length',
      label: 'Extra back height',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 300,
      step: 1,
      group: 'dimensions',
      help: 'How far the back wall rises above the others.',
    },
    {
      key: 'all_mounts',
      kind: 'bool',
      label: 'Wall mounts on all dividers',
      default: false,
      group: 'dimensions',
      help: 'Front-to-back dividers also hook to the wall, and rise to the back height.',
    },
    {
      key: 'radius',
      kind: 'length',
      label: 'Side corner radius',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 100,
      step: 1,
      group: 'dimensions',
      help: 'Rounds the step from the sides up to the back, strengthening walls that carry hooks.',
    },
    ...WALL_PARAMS,
    ...STACKABLE_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallTypeTray(
      {
        sx: parseSections(s(v, 'sx', '50*3')),
        sy: parseSections(s(v, 'sy', '50*3')),
        h: n(v, 'h', 100),
        hi: n(v, 'hi', 0),
        outside: b(v, 'outside', true),
        bottomEdge: s(v, 'bottom_edge', 'h'),
        allMounts: b(v, 'all_mounts', false),
        backHeight: n(v, 'back_height', 0),
        radius: n(v, 'radius', 0),
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
