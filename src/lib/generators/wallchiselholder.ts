/**
 * Wall chisel holder — ported from boxes.py `boxes/generators/wallchiselholder.py`
 * (class `WallChiselHolder`).
 *
 * A shelf with a row of keyhole slots: a tool drops in through the slot and
 * hangs by its handle, which is too big to pass the round hole.
 */
import type { Boxes, BoxesConfig } from '../boxes';
import { Edge } from '../edges/base';
import { WALL_PARAMS } from '../params/common';
import type { ParamSpec, ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

type Hooks = 'all' | 'odds' | 'everythird';

interface WallChiselHolderOptions {
  h: number;
  tooldiameter: number;
  holediameter: number;
  slotWidth: number;
  radius: number;
  number: number;
  hooks: Hooks;
}

/** Front edge of the shelf: one keyhole per tool. Generator-local (PORTING §7). */
class FrontEdge extends Edge {
  constructor(
    boxes: Boxes,
    private o: WallChiselHolderOptions,
  ) {
    super(boxes, null);
  }

  override call(): void {
    const td = this.o.tooldiameter;
    const rh = this.o.holediameter / 2.0;
    const r = this.o.radius;
    const sw = this.o.slotWidth;

    const a = Math.asin((r + sw / 2) / (r + rh)) / DEG;
    const l = (td - sw - 2 * r) / 2;

    for (let i = 0; i < this.o.number; i++) {
      this.polyline(l, [180 - a, r], 0, [-360 + 2 * a, rh], 0, [180 - a, r], l);
    }
  }
}

/** Whether brace `i` (0 … number) is fitted; the two ends always are. */
export function braceAt(i: number, n: number, hooks: Hooks): boolean {
  if (i === 0 || i === n) return true;
  if (hooks === 'all') return true;
  if (hooks === 'odds') return !(i % 2);
  return !(i % 3);
}

export const HOOKS_PARAM: ParamSpec = {
  key: 'hooks',
  kind: 'enum',
  label: 'Braces',
  default: 'all',
  choices: [
    { value: 'all', label: 'Between every tool' },
    { value: 'odds', label: 'Every second' },
    { value: 'everythird', label: 'Every third' },
  ],
  group: 'dimensions',
  help: 'How many braces, each with a wall hook, hold up the shelf. The two ends always have one.',
};

class WallChiselHolder extends WallMountedBox {
  private depth = 0;

  constructor(
    private o: WallChiselHolderOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
  }

  private braces(): number {
    let count = 0;
    for (let i = 0; i < this.o.number + 1; i++) if (braceAt(i, this.o.number, this.o.hooks)) count++;
    return count;
  }

  private holes(at: (x: number) => void): void {
    const n = this.o.number;
    const rt = this.o.holediameter;
    const wt = this.o.tooldiameter;
    const t = this.thickness;
    const d = Math.min(2 * t, (wt - rt) / 4);
    at(d);
    at(n * wt - d);
    for (let i = 1; i < n; i++) if (braceAt(i, n, this.o.hooks)) at(i * wt);
  }

  private backCB = (): void => this.holes((x) => this.wallHolesAt(x, 0, this.o.h, 90));
  private topCB = (): void => this.holes((x) => this.fingerHolesAt(x, 0, this.depth, 90));

  render(): void {
    this.generateWallEdges();

    const t = this.thickness;
    const wt = this.o.tooldiameter;
    const n = this.o.number;

    this.depth = wt + 4 * t;
    const depth = this.depth;

    // boxes.py leaves these unlabelled; each part needs a name here.
    this.rectangularWall(n * wt, this.o.h, 'eeee', { callback: [this.backCB], move: 'up', label: 'back' });
    this.rectangularWall(n * wt, depth, [new FrontEdge(this, this.o), 'e', 'e', 'e'], {
      callback: [this.topCB],
      move: 'up',
      label: 'shelf',
    });
    this.moveTo(0, t);
    this.rectangularTriangle(depth, this.o.h, 'fbe', { r: 3 * t, num: this.braces(), label: 'brace' });
  }
}

export const wallChiselHolder: GeneratorDef = {
  meta: {
    id: 'wallchiselholder',
    name: 'Wall Chisel Holder',
    group: 'Wall mounted',
    summary: 'Shelf of keyhole slots for chisels and files',
    description:
      'A shelf held out from the wall on triangular braces, with a row of keyhole ' +
      'slots along its front. Each tool slides in through the slot and hangs by its ' +
      'handle, which is too big to pass the round hole.',
  },
  params: [
    { key: 'h', kind: 'length', label: 'Back height', unit: 'mm', default: 120, min: 40, max: 400, step: 1, group: 'dimensions' },
    {
      key: 'tooldiameter',
      kind: 'length',
      label: 'Space per tool',
      unit: 'mm',
      default: 30,
      min: 10,
      max: 100,
      step: 1,
      group: 'dimensions',
      help: 'Diameter of the tool including room to grab it.',
    },
    {
      key: 'holediameter',
      kind: 'length',
      label: 'Hole diameter',
      unit: 'mm',
      default: 30,
      min: 5,
      max: 100,
      step: 1,
      group: 'dimensions',
      help: 'The handle must not fit through.',
    },
    { key: 'slot_width', kind: 'length', label: 'Slot width', unit: 'mm', default: 5, min: 1, max: 30, step: 0.5, group: 'dimensions' },
    { key: 'radius', kind: 'length', label: 'Slot corner radius', unit: 'mm', default: 5, min: 0.5, max: 20, step: 0.5, group: 'dimensions' },
    { key: 'number', kind: 'number', label: 'Number of tools', default: 6, min: 1, max: 30, step: 1, group: 'dimensions' },
    HOOKS_PARAM,
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallChiselHolder(
      {
        h: n(v, 'h', 120),
        tooldiameter: n(v, 'tooldiameter', 30),
        holediameter: n(v, 'holediameter', 30),
        slotWidth: n(v, 'slot_width', 5),
        radius: n(v, 'radius', 5),
        number: n(v, 'number', 6),
        hooks: s(v, 'hooks', 'all') as Hooks,
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
