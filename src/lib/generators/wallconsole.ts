/**
 * Wall console — ported from boxes.py `boxes/generators/wallconsole.py`
 * (class `WallConsole`).
 *
 * A plate that stands out from the wall on trapezoid brackets, deeper at the
 * top than the bottom, so whatever is mounted on it faces slightly upwards.
 */
import type { BoxesConfig } from '../boxes';
import { WALL_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { b, n, s, type GeneratorDef } from './types';

interface WallConsoleOptions {
  sx: number[];
  h: number;
  outside: boolean;
  topDepth: number;
  bottomDepth: number;
}

class WallConsole extends WallMountedBox {
  private sx: number[];
  private h: number;
  /** Length of the slanted front plate. */
  private front = 0;

  constructor(
    private o: WallConsoleOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
    this.sx = [...o.sx];
    this.h = o.h;
  }

  private backHoles = (): void => {
    let posx = -0.5 * this.thickness;
    for (const x of this.sx.slice(0, -1)) {
      posx += x + this.thickness;
      this.wallHolesAt(posx, 0, this.h, 90);
    }
  };

  private frontHoles = (): void => {
    let posx = -0.5 * this.thickness;
    for (const x of this.sx.slice(0, -1)) {
      posx += x + this.thickness;
      this.fingerHolesAt(posx, 0, this.front, 90);
    }
  };

  render(): void {
    this.generateWallEdges();

    if (this.o.outside) {
      this.sx = this.adjustSize(this.sx);
      this.h = this.adjustSize(this.h);
    }

    const t = this.thickness;
    const x = this.sx.reduce((a, c) => a + c, 0) + t * (this.sx.length - 1);
    const h = this.h;
    const td = this.o.topDepth;
    const bd = this.o.bottomDepth;

    this.front = (h ** 2 + (td - bd) ** 2) ** 0.5;

    this.rectangularWall(x, h, 'eCec', { callback: [this.backHoles], move: 'up', label: 'back' });
    this.rectangularWall(x, this.front, 'eFeF', { callback: [this.frontHoles], move: 'up', label: 'front' });

    for (let i = 0; i < this.sx.length + 1; i++) {
      this.trapezoidWall(h, td, bd, 'befe', { move: 'up', label: 'bracket' });
    }
  }
}

export const wallConsole: GeneratorDef = {
  meta: {
    id: 'wallconsole',
    name: 'Wall Console',
    group: 'Wall mounted',
    summary: 'Angled plate standing out from the wall on brackets',
    description:
      'A plate held out from the wall by trapezoid brackets, deeper at the top than ' +
      'at the bottom so it tilts up towards you — for mounting a display, a ' +
      'controller or a power strip.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Sections left to right',
      default: '100',
      group: 'dimensions',
      itemLabel: 'section',
      help: 'A bracket stands at each end and between each pair of sections.',
    },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 600, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'top_depth',
      kind: 'length',
      label: 'Depth at the top',
      unit: 'mm',
      default: 50,
      min: 5,
      max: 300,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'bottom_depth',
      kind: 'length',
      label: 'Depth at the bottom',
      unit: 'mm',
      default: 35,
      min: 5,
      max: 300,
      step: 1,
      group: 'dimensions',
    },
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallConsole(
      {
        sx: parseSections(s(v, 'sx', '100')),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        topDepth: n(v, 'top_depth', 50),
        bottomDepth: n(v, 'bottom_depth', 35),
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
