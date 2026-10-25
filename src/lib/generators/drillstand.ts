/**
 * Drill stand — ported from boxes.py `boxes/generators/drillstand.py`
 * (class `DrillStand`), together with the wall-mounted variant from
 * `walldrillbox.py` (class `WallDrillBox`).
 *
 * Rows of compartments for drill bits, each compartment a little taller than
 * the one to its left, so every bit stands proud of its neighbours and can be
 * read and grabbed. The floor slopes to match.
 *
 * boxes.py builds WallDrillBox by multiple inheritance from DrillStand and
 * `_WallMountedBox`. Here DrillStand's part-drawing methods are a mixin,
 * applied to `Boxes` for the stand and to `WallMountedBox` for the wall box.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import type { BaseEdge } from '../edges/base';
import { FingerHoleEdge, FingerJointEdge } from '../edges/fingerjoint';
import { STACKABLE_PARAMS, WALL_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamSpec, ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface DrillStandOptions {
  sx: number[];
  sy: number[];
  sh: number[];
  extraHeight: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AbstractCtor<T> = abstract new (...args: any[]) => T;

const sum = (a: number[]) => a.reduce((acc, c) => acc + c, 0);

function drillStandParts<TBase extends AbstractCtor<Boxes>>(Base: TBase) {
  abstract class DrillStandParts extends Base {
    protected abstract ds: DrillStandOptions;
    protected x = 0;
    protected y = 0;

    /** Inner wall running front to back, between two columns. */
    protected yWall(nr: number, move: string): void {
      const t = this.thickness;
      const { sx, sy, sh, extraHeight } = this.ds;
      const x = this.x;
      const y = this.y;
      const eh = (extraHeight * (sum(sx.slice(0, nr)) + nr * t - t)) / x;

      const tw = sum(sy) + t * sy.length + t;
      const th = Math.max(...sh) + eh;

      if (this.move(tw, th, move, true)) return;

      this.moveTo(t);
      this.polyline(y, 90);
      this.getEdge('f').call(sh[sh.length - 1]! + eh);
      this.corner(90);
      for (let i = sy.length - 1; i > 0; i--) {
        const s1 = Math.max(sh[i]! - sh[i - 1]!, 0) + 4 * t;
        const s2 = Math.max(sh[i - 1]! - sh[i]!, 0) + 4 * t;
        this.polyline(sy[i]!, 90, s1, -90, t, -90, s2, 90);
      }
      this.polyline(sy[0]!, 90);
      this.getEdge('f').call(sh[0]! + eh);
      this.corner(90);

      this.move(tw, th, move, false, 'inner wall y');
    }

    protected sideWall(extraHeight = 0.0, footHeight = 0.0, edgesIn = 'šFf', move = ''): void {
      const t = this.thickness;
      const { sy, sh } = this.ds;
      const y = this.y;
      const eh = extraHeight;
      const fh = footHeight;

      const edges = Array.from(edgesIn).map((e) => this.getEdge(e));

      const tw = sum(sy) + t * sy.length + edges[1]!.spacing();
      const th = Math.max(...sh) + eh + fh + edges[0]!.spacing();

      if (this.move(tw, th, move, true)) return;

      this.moveTo(edges[0]!.margin());

      edges[0]!.call(y + 2 * t);
      this.edgeCorner(edges[0]!, 'e');
      this.edge(fh);
      this.step(edges[1]!.startWidth() - t);
      edges[1]!.call(sh[sh.length - 1]! + eh);
      this.edgeCorner(edges[1]!, 'e');
      for (let i = sy.length - 1; i > 0; i--) {
        this.edge(sy[i]!);
        if (sh[i]! > sh[i - 1]!) {
          this.fingerHolesAt(0.5 * t, this.burn, sh[i]! + eh, 90);
          this.polyline(t, 90, sh[i]! - sh[i - 1]!, -90);
        } else {
          this.polyline(0, -90, sh[i - 1]! - sh[i]!, 90, t);
          this.fingerHolesAt(-0.5 * t, this.burn, sh[i - 1]! + eh);
        }
      }
      this.polyline(sy[0]!);
      this.edgeCorner('e', edges[2]!);
      edges[2]!.call(sh[0]! + eh);
      this.step(t - edges[2]!.endWidth());
      this.polyline(fh);
      this.edgeCorner('e', edges[0]!);

      this.move(tw, th, move, false, 'side');
    }

    /** Inner wall running left to right, its top rising with the floor. */
    protected xWall(nr: number, move: string): void {
      const t = this.thickness;
      const { sx, sh, extraHeight: eh } = this.ds;
      const x = this.x;

      const tw = x + 2 * t;
      const th = sh[nr]! + eh + t;

      const a = Math.atan(eh / x) / DEG;
      const fa = 1 / Math.cos(a * DEG);

      if (this.move(tw, th, move, true)) return;

      this.moveTo(t, eh + t, -a);

      for (let i = 0; i < sx.length - 1; i++) {
        this.getEdge('f').call(fa * sx[i]!);
        const h = Math.min(sh[nr - 1]!, sh[nr]!);
        const s1 = h - 3.95 * t + (eh * (sum(sx.slice(0, i + 1)) + i * t)) / x;
        const s2 = h - 3.95 * t + (eh * (sum(sx.slice(0, i + 1)) + i * t + t)) / x;
        this.polyline(0, 90 + a, s1, -90, t, -90, s2, 90 - a);
      }
      this.getEdge('f').call(fa * sx[sx.length - 1]!);
      this.polyline(0, 90 + a);
      this.getEdge('f').call(sh[nr]! + eh);
      this.polyline(0, 90, x, 90);
      this.getEdge('f').call(sh[nr]!);
      this.polyline(0, 90 + a);

      this.move(tw, th, move, false, 'inner wall x');
    }

    protected xOutsideWall(h: number, edgesIn = 'fFeF', move = '', label = ''): void {
      const t = this.thickness;
      const { sx, extraHeight: eh } = this.ds;
      const x = this.x;

      const edges: BaseEdge[] = Array.from(edgesIn).map((e) => this.getEdge(e));

      const tw = x + edges[1]!.spacing() + edges[3]!.spacing();
      const th = h + eh + edges[0]!.spacing() + edges[2]!.spacing();

      const a = Math.atan(eh / x) / DEG;
      const fa = 1 / Math.cos(a * DEG);

      if (this.move(tw, th, move, true)) return;

      this.moveTo(edges[3]!.spacing(), eh + edges[0]!.margin(), -a);

      this.edge(t * Math.tan(a * DEG));
      if (edges[0] instanceof FingerHoleEdge) {
        this.savedContext(() => {
          this.moveTo(0, 0, a);
          this.fingerHolesAt(0, 1.5 * t, x * fa - t * Math.tan(a * DEG), -a);
        });
        this.edge(x * fa - t * Math.tan(a * DEG));
      } else if (edges[0] instanceof FingerJointEdge) {
        edges[0].call(x * fa - t * Math.tan(a * DEG));
      } else {
        throw new Error('Only edges h and f supported: ');
      }
      this.corner(a);
      this.edgeCorner(edges[0]!, 'e', 90);
      this.corner(-90);
      this.edgeCorner('e', edges[1]!, 90);
      edges[1]!.call(eh + h);
      this.edgeCorner(edges[1]!, edges[2]!, 90);
      edges[2]!.call(x);
      this.edgeCorner(edges[2]!, edges[3]!, 90);
      edges[3]!.call(h);
      this.edgeCorner(edges[3]!, 'e', 90);
      this.corner(-90);
      this.edgeCorner('e', edges[0]!, 90);

      this.moveTo(0, this.burn + edges[0]!.startWidth(), 0);

      for (let i = 1; i < sx.length; i++) {
        const posx = sum(sx.slice(0, i)) + i * t - 0.5 * t;
        const length = h + (eh * (sum(sx.slice(0, i)) + i * t - t)) / x;
        this.fingerHolesAt(posx, h, length, -90);
      }

      this.move(tw, th, move, false, label);
    }

    protected bottomCB = (): void => {
      const t = this.thickness;
      const { sx, sy, extraHeight: eh } = this.ds;
      const x = this.x;

      const a = Math.atan(eh / x) / DEG;
      const fa = 1 / Math.cos(a * DEG);

      let posy = -0.5 * t;
      for (let i = 0; i < sy.length - 1; i++) {
        posy += sy[i]! + t;
        let posx = -t * Math.tan(a * DEG); // left side is clipped
        for (let j = 0; j < sx.length; j++) {
          this.fingerHolesAt(posx, posy, fa * sx[j]!, 0);
          posx += fa * sx[j]! + fa * t;
        }
      }
    };

    /** Everything up to the side walls, which the two variants draw differently. */
    protected drawStand(backEdges: string): number {
      const t = this.thickness;
      const { sx, sy, sh, extraHeight } = this.ds;
      this.x = sum(sx) + sx.length * t - t;
      this.y = sum(sy) + sy.length * t - t;
      const x = this.x;

      const bottomAngle = Math.atan(extraHeight / x); // radians

      this.xOutsideWall(sh[0]!, 'hFeF', 'up', 'front');
      for (let i = 1; i < sy.length; i++) this.xWall(i, 'up');
      this.xOutsideWall(sh[sh.length - 1]!, backEdges, 'up', 'back');

      this.rectangularWall(x / Math.cos(bottomAngle) - t * Math.tan(bottomAngle), this.y, 'fefe', {
        callback: [this.bottomCB],
        move: 'up',
        label: 'bottom',
      });
      return x;
    }

    /** boxes.py raises an IndexError when there are fewer heights than rows. */
    protected checkHeights(): boolean {
      if (this.ds.sh.length < this.ds.sy.length) {
        this.warn('Give one height per row.', 'sh');
        return false;
      }
      return true;
    }
  }
  return DrillStandParts;
}

class DrillStand extends drillStandParts(Boxes) {
  constructor(
    protected ds: DrillStandOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    if (!this.checkHeights()) return;
    const t = this.thickness;
    this.drawStand('hfef');

    this.sideWall(0, this.ds.extraHeight + 2 * t, 'šFf', 'right');
    for (let i = 1; i < this.ds.sx.length; i++) this.yWall(i, 'right');
    this.sideWall(this.ds.extraHeight, 2 * t, 'šFf', 'right');
  }
}

class WallDrillBox extends drillStandParts(WallMountedBox) {
  constructor(
    protected ds: DrillStandOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
  }

  render(): void {
    this.generateWallEdges();
    if (!this.checkHeights()) return;
    const t = this.thickness;
    // The back wall carries the wall mounts instead of plain fingers.
    this.drawStand('hCec');

    this.sideWall(0, 2 * t, 'eBf', 'right');
    for (let i = 1; i < this.ds.sx.length; i++) this.yWall(i, 'right');
    this.sideWall(this.ds.extraHeight, 2 * t, 'eBf', 'right');
  }
}

const STAND_PARAMS: ParamSpec[] = [
  {
    key: 'sx',
    kind: 'sections',
    label: 'Columns left to right',
    default: '25*6',
    group: 'dimensions',
    itemLabel: 'column',
  },
  {
    key: 'sy',
    kind: 'sections',
    label: 'Rows front to back',
    default: '10:20:30',
    group: 'dimensions',
    itemLabel: 'row',
  },
  {
    key: 'sh',
    kind: 'sections',
    label: 'Row heights front to back',
    default: '25:40:60',
    group: 'dimensions',
    itemLabel: 'row',
    help:
      'Height of each row at its left end; it rises by the extra height across the row. ' +
      'Give one per row, and make each step bigger than the extra height so every ' +
      'compartment is taller than the one in front.',
  },
  {
    key: 'extra_height',
    kind: 'length',
    label: 'Rise left to right',
    unit: 'mm',
    default: 15,
    min: 0,
    max: 100,
    step: 1,
    group: 'dimensions',
  },
];

const readStand = (v: ParamValues): DrillStandOptions => ({
  sx: parseSections(s(v, 'sx', '25*6')),
  sy: parseSections(s(v, 'sy', '10:20:30')),
  sh: parseSections(s(v, 'sh', '25:40:60')),
  extraHeight: n(v, 'extra_height', 15),
});

export const drillStand: GeneratorDef = {
  meta: {
    id: 'drillstand',
    name: 'Drill Stand',
    group: 'Misc',
    summary: 'Stepped stand for drill bits',
    description:
      'Rows of compartments for drill bits, each a little taller than the one to its ' +
      'left so every bit stands proud of its neighbours. Assemble the inner walls ' +
      'first, then the bottom — it is asymmetric, flush on the low side and short on ' +
      'the high side — then the front and back, and the two sides last.',
  },
  // boxes.py starts this generator with lower, wider stacking feet.
  paramDefaults: { st_height: 1.0, st_width: 3 },
  params: [...STAND_PARAMS, ...STACKABLE_PARAMS],
  create: (v: ParamValues, config: BoxesConfig) => new DrillStand(readStand(v), config),
};

export const wallDrillBox: GeneratorDef = {
  meta: {
    id: 'walldrillbox',
    name: 'Wall Drill Box',
    group: 'Wall mounted',
    summary: 'Stepped drill bit holder that hangs on the wall',
    description:
      'The drill stand’s rising rows of compartments, with a back wall that hangs on ' +
      'the wall system of your choice.',
  },
  params: [...STAND_PARAMS, ...WALL_PARAMS],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallDrillBox(readStand(v), s(v, 'walltype', 'plain') as WallType, config),
};
