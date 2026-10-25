/**
 * Wall stairs — ported from boxes.py `boxes/generators/wallstairs.py`
 * (class `WallStairs`).
 *
 * Steps of platforms rising from front to back, for standing screwdrivers and
 * the like. The platform tops are left plain; you add the holes or slots for
 * your own tools in a drawing program.
 */
import type { BoxesConfig } from '../boxes';
import { WALL_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { n, s, type GeneratorDef } from './types';

interface WallStairsOptions {
  sx: number[];
  sy: number[];
  sh: number[];
  braceheight: number;
}

class WallStairs extends WallMountedBox {
  private x = 0;
  private y = 0;

  constructor(
    private o: WallStairsOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
  }

  /** A side wall: the stepped profile, hooked to the wall at the back. */
  private yWall(move: string): void {
    const t = this.thickness;
    const { sy, sh, braceheight } = this.o;
    const y = this.y;

    const tw = sy.reduce((a, c) => a + c, 0);
    const th = Math.max(...sh) + t;

    if (this.move(tw, th, move, true)) return;

    this.polyline(y - t, 90);
    this.getEdge('f').call(braceheight);
    this.step(t);
    this.getEdge('A').call(sh[sh.length - 1]! - braceheight);
    this.corner(90);
    for (let i = sy.length - 1; i > 0; i--) {
      this.getEdge('f').call(sy[i]!);
      this.step(sh[i - 1]! - sh[i]!);
    }
    this.getEdge('f').call(sy[0]!);
    this.polyline(0, 90, sh[0]!, 90);

    this.move(tw, th, move, false, 'side');
  }

  private yCB(width: number): void {
    const t = this.thickness;
    let posx = -0.5 * t;
    for (const dx of this.o.sx.slice(0, -1)) {
      posx += dx + t;
      this.fingerHolesAt(posx, 0, width, 90);
    }
  }

  render(): void {
    this.generateWallEdges();

    const t = this.thickness;
    const { sx, sy, sh, braceheight } = this.o;
    if (sh.length < sy.length) {
      // boxes.py indexes past the end of `sh` here and raises.
      this.warn('Give one height per step.', 'sh');
      return;
    }
    this.x = sx.reduce((a, c) => a + c, 0) + sx.length * t - t;
    this.y = sy.reduce((a, c) => a + c, 0);
    const x = this.x;

    for (const w of sy) {
      this.rectangularWall(x, w, 'eheh', { callback: [() => this.yCB(w)], move: 'up', label: 'step' });
    }
    if (braceheight) {
      this.rectangularWall(x, braceheight, 'eheh', {
        callback: [() => this.yCB(braceheight)],
        move: 'up',
        label: 'brace',
      });
    }

    for (let i = 0; i < sx.length + 1; i++) this.yWall('right');
  }
}

export const wallStairs: GeneratorDef = {
  meta: {
    id: 'wallstairs',
    name: 'Wall Stairs',
    group: 'Wall mounted',
    summary: 'Stepped platforms for standing tools in',
    description:
      'Platforms at rising heights from front to back, so tools stood in them stay ' +
      'visible — screwdrivers, files, pens. The tops are left plain: add the holes ' +
      'or slots for your tools in Inkscape or another drawing program. The overall ' +
      'size is a little larger than the figures given, which exclude the walls.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Columns left to right',
      default: '250/3',
      group: 'dimensions',
      itemLabel: 'column',
    },
    {
      key: 'sy',
      kind: 'sections',
      label: 'Step depths front to back',
      default: '40*3',
      group: 'dimensions',
      itemLabel: 'step',
    },
    {
      key: 'sh',
      kind: 'sections',
      label: 'Step heights front to back',
      default: '30:100:180',
      group: 'dimensions',
      itemLabel: 'step',
      help: 'One height per step depth.',
    },
    {
      key: 'braceheight',
      kind: 'length',
      label: 'Back brace height',
      unit: 'mm',
      default: 30,
      min: 0,
      max: 100,
      step: 1,
      group: 'dimensions',
      help: 'Height of the brace at the bottom back. Zero leaves it out.',
    },
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallStairs(
      {
        sx: parseSections(s(v, 'sx', '250/3')),
        sy: parseSections(s(v, 'sy', '40*3')),
        sh: parseSections(s(v, 'sh', '30:100:180')),
        braceheight: n(v, 'braceheight', 30),
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
