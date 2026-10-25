/**
 * Wall pliers holder — ported from boxes.py `boxes/generators/wallpliersholder.py`
 * (class `WallPliersHolder`).
 *
 * A bar held out from the wall on curved braces; pliers hang over it by their
 * handles, one per compartment.
 */
import type { BoxesConfig } from '../boxes';
import { WALL_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface WallPliersHolderOptions {
  sx: number[];
  y: number;
  h: number;
  outside: boolean;
  angle: number;
}

class WallPliersHolder extends WallMountedBox {
  private sx: number[];
  /** Height of the back plate: the front bar plus the brace below it. */
  private hT = 0;

  constructor(
    private o: WallPliersHolderOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
    this.sx = [...o.sx];
  }

  /** `outside` braces are the end ones, which get slots instead of fingers. */
  private brace(h: number, d: number, a: number, outside: boolean, move: string): void {
    const t = this.thickness;
    const bEdge = this.getEdge('b');

    const tw = d + bEdge.spacing() + this.getEdge('f').spacing();
    const th = this.hT;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(bEdge.spacing());

    const r = d / 4;
    const l = (d + t - r) / Math.sin(a * DEG);

    if (outside) {
      this.polyline(t, [90 - a, r], l, [a, r]);
      this.getEdge('h').call(h);
      this.polyline(0, 90, d + 2 * t, 90);
    } else {
      this.polyline(0, [90 - a, r], l, [a, r], 0, 90, t, -90);
      this.getEdge('f').call(h);
      this.polyline(0, 90, d, 90);
    }
    bEdge.call(h + (d + t - r) * Math.tan((90 - a) * DEG) + r);
    this.polyline(0, 90);

    this.move(tw, th, move, false, 'brace');
  }

  private frontCB = (): void => {
    const t = this.thickness;
    let posx = -t;
    for (const dx of this.sx.slice(0, -1)) {
      posx += dx + t;
      this.fingerHolesAt(posx, 0, this.o.h, 90);
    }
  };

  private backCB = (): void => {
    const t = this.thickness;
    let posx = -t;
    for (const dx of this.sx.slice(0, -1)) {
      posx += dx + t;
      this.wallHolesAt(posx, 0, this.hT, 90);
    }
  };

  render(): void {
    this.generateWallEdges();

    if (this.o.outside) this.sx = this.adjustSize(this.sx);

    const sx = this.sx;
    const { y, h, angle } = this.o;
    const t = this.thickness;

    const r = y / 4;
    this.hT = h + (y + t - r) * Math.tan((90 - angle) * DEG) + r;

    const x = sx.reduce((a, c) => a + c, 0) + (sx.length - 1) * t;
    this.rectangularWall(x, h, 'efef', { callback: [this.frontCB], move: 'up', label: 'front' });
    this.rectangularWall(x, this.hT, 'eCec', { callback: [this.backCB], move: 'up', label: 'back' });
    for (let i = 0; i < sx.length + 1; i++) {
      this.brace(h, y, angle, i < 2, 'right');
    }
  }
}

export const wallPliersHolder: GeneratorDef = {
  meta: {
    id: 'wallpliersholder',
    name: 'Wall Pliers Holder',
    group: 'Wall mounted',
    summary: 'Bar on braces to hang pliers over',
    description:
      'A bar held out from the wall by curved braces. Pliers hang over it by their ' +
      'handles, one per compartment; the braces between compartments keep them apart.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartments left to right',
      default: '100*3',
      group: 'dimensions',
      itemLabel: 'compartment',
    },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 50, min: 10, max: 200, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Bar height', unit: 'mm', default: 50, min: 10, max: 200, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'angle',
      kind: 'number',
      label: 'Brace angle',
      unit: '°',
      default: 45,
      min: 20,
      max: 80,
      step: 1,
      group: 'dimensions',
      help: 'Smaller angles give a longer, stronger brace.',
    },
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallPliersHolder(
      {
        sx: parseSections(s(v, 'sx', '100*3')),
        y: n(v, 'y', 50),
        h: n(v, 'h', 50),
        outside: b(v, 'outside', true),
        angle: n(v, 'angle', 45),
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
