/**
 * Wall slotted holder — ported from boxes.py `boxes/generators/wallslottedholder.py`
 * (class `WallSlottedHolder`).
 *
 * A shelf with a row of open slots along its front, for tools that hang by a
 * flat blade or a neck: scissors, spatulas, chisels with a collar.
 */
import type { Boxes, BoxesConfig } from '../boxes';
import { Edge } from '../edges/base';
import { WALL_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { HOOKS_PARAM, braceAt } from './wallchiselholder';
import { n, s, type GeneratorDef } from './types';

type Hooks = 'all' | 'odds' | 'everythird';

interface WallSlottedHolderOptions {
  h: number;
  slotDepth: number;
  additionalDepth: number;
  slotWidth: number;
  toolWidth: number;
  radius: number;
  number: number;
  hooks: Hooks;
}

/** Front edge of the shelf: one open slot per tool. Generator-local (PORTING §7). */
class FrontEdge extends Edge {
  constructor(
    boxes: Boxes,
    private o: WallSlottedHolderOptions,
  ) {
    super(boxes, null);
  }

  override call(): void {
    const ws = this.o.slotWidth;
    const wt = this.o.toolWidth;
    const ds = this.o.slotDepth;
    const r1 = Math.min(this.o.radius, ds / 2, (wt - ws) / 2);
    const r2 = Math.min(this.o.radius, ws / 2);
    const w = (wt - ws) / 2 - r1;
    const t = this.thickness;
    const d = Math.min(2 * t, (wt - ws) / 4);
    this.edge(d);
    for (let i = 0; i < this.o.number; i++) {
      this.polyline(w, [90, r1], ds - r1 - r2, [-90, r2], ws - 2 * r2, [-90, r2], ds - r1 - r2, [90, r1], w);
    }
    this.edge(d);
  }
}

class WallSlottedHolder extends WallMountedBox {
  constructor(
    private o: WallSlottedHolderOptions,
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

  /** Unlike the chisel holder, every position is offset by the margin `d`. */
  private holes(at: (x: number) => void): void {
    const n = this.o.number;
    const ws = this.o.slotWidth;
    const wt = this.o.toolWidth;
    const t = this.thickness;
    const d = Math.min(2 * t, (wt - ws) / 4);
    at(d);
    at(n * wt + d);
    for (let i = 1; i < n; i++) if (braceAt(i, n, this.o.hooks)) at(i * wt + d);
  }

  private backCB = (): void => this.holes((x) => this.wallHolesAt(x, 0, this.o.h, 90));
  private topCB = (): void =>
    this.holes((x) => this.fingerHolesAt(x, 0, this.o.additionalDepth + this.o.slotDepth, 90));

  render(): void {
    this.generateWallEdges();

    const t = this.thickness;
    const l1 = this.o.additionalDepth;
    const l2 = this.o.slotDepth;
    const ws = this.o.slotWidth;
    const wt = this.o.toolWidth;
    const n = this.o.number;

    const d = Math.min(2 * t, (wt - ws) / 4);

    // boxes.py leaves these unlabelled; each part needs a name here.
    this.rectangularWall(n * wt + 2 * d, this.o.h, 'eeee', { callback: [this.backCB], move: 'up', label: 'back' });
    this.rectangularWall(n * wt + 2 * d, l1 + l2, [new FrontEdge(this, this.o), 'e', 'e', 'e'], {
      callback: [this.topCB],
      move: 'up',
      label: 'shelf',
    });
    this.moveTo(0, t);
    this.rectangularTriangle(l1 + l2, this.o.h, 'fbe', { r: 3 * t, num: this.braces(), label: 'brace' });
  }
}

export const wallSlottedHolder: GeneratorDef = {
  meta: {
    id: 'wallslottedholder',
    name: 'Wall Slotted Holder',
    group: 'Wall mounted',
    summary: 'Shelf of open slots for hanging tools',
    description:
      'A shelf held out from the wall on triangular braces, with a row of open slots ' +
      'along its front. Tools hang in the slots by a blade or a neck.',
  },
  params: [
    { key: 'h', kind: 'length', label: 'Back height', unit: 'mm', default: 120, min: 40, max: 400, step: 1, group: 'dimensions' },
    { key: 'slot_depth', kind: 'length', label: 'Slot depth', unit: 'mm', default: 50, min: 5, max: 200, step: 1, group: 'dimensions', help: 'From the front edge.' },
    {
      key: 'additional_depth',
      kind: 'length',
      label: 'Depth behind the slots',
      unit: 'mm',
      default: 50,
      min: 5,
      max: 200,
      step: 1,
      group: 'dimensions',
    },
    { key: 'slot_width', kind: 'length', label: 'Slot width', unit: 'mm', default: 5, min: 1, max: 30, step: 0.5, group: 'dimensions' },
    {
      key: 'tool_width',
      kind: 'length',
      label: 'Space per tool',
      unit: 'mm',
      default: 35,
      min: 10,
      max: 150,
      step: 1,
      group: 'dimensions',
    },
    { key: 'radius', kind: 'length', label: 'Slot corner radius', unit: 'mm', default: 5, min: 0.5, max: 20, step: 0.5, group: 'dimensions' },
    { key: 'number', kind: 'number', label: 'Number of tools', default: 6, min: 1, max: 30, step: 1, group: 'dimensions' },
    HOOKS_PARAM,
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallSlottedHolder(
      {
        h: n(v, 'h', 120),
        slotDepth: n(v, 'slot_depth', 50),
        additionalDepth: n(v, 'additional_depth', 50),
        slotWidth: n(v, 'slot_width', 5),
        toolWidth: n(v, 'tool_width', 35),
        radius: n(v, 'radius', 5),
        number: n(v, 'number', 6),
        hooks: s(v, 'hooks', 'all') as Hooks,
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
