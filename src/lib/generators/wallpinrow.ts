/**
 * Wall pin row — ported from boxes.py `boxes/generators/wallpinrow.py`
 * (class `WallPinRow`).
 *
 * A row of pins sticking out of the wall, angled up so things hung on them
 * stay on: coats, bags, cables, headphones.
 */
import type { Boxes, BoxesConfig } from '../boxes';
import { BaseEdge } from '../edges/base';
import { WALL_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface WallPinRowOptions {
  pins: number;
  pinlength: number;
  pinwidth: number;
  pinspacing: number;
  pinspacingIncrement: number;
  angle: number;
  hooks: number;
  h: number;
}

/**
 * The pins themselves, cut along the edge of the top plate. boxes.py passes
 * the box as this edge's "settings"; here the options are passed explicitly.
 */
class PinEdge extends BaseEdge {
  constructor(
    boxes: Boxes,
    private o: WallPinRowOptions,
  ) {
    super(boxes, null);
  }

  call(): void {
    const w2 = this.o.pinwidth / 2;
    const l = this.o.pinlength;
    let s = this.o.pinspacing;
    const inc = this.o.pinspacingIncrement;
    const t = this.thickness;

    const pin: Array<number | [number, number]> = [0, -90, l + t - w2, [180, w2], l + t - w2, -90];

    this.edge(s / 2 - w2);
    s += inc / 2;
    for (let i = 0; i < this.o.pins - 1; i++) {
      this.polyline(...pin, s - 2 * w2);
      s += inc;
    }
    this.polyline(...pin, s / 2 - w2 - inc / 4);
  }

  override margin(): number {
    return this.thickness + this.o.pinlength;
  }
}

class WallPinRow extends WallMountedBox {
  private h: number;
  private x = 0;

  constructor(
    private o: WallPinRowOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
    this.h = o.h;
  }

  private frontCB = (): void => {
    let s = this.o.pinspacing;
    const inc = this.o.pinspacingIncrement;
    const t = this.thickness;

    let pos = s / 2;
    s += 0.5 * inc;
    for (let i = 0; i < this.o.pins; i++) {
      this.rectangularHole(pos, 2 * t, this.o.pinwidth, t);
      pos += s;
      s += inc;
    }

    for (let i = 1; i < this.o.hooks - 1; i++) {
      this.fingerHolesAt((i * this.x) / (this.o.hooks - 1), this.h / 2, this.h / 2);
    }
  };

  private backCB = (): void => {
    const t = this.thickness;
    this.fingerHolesAt(0, 2 * t, this.x, 0);
    if (this.o.angle < 0.001) return;
    for (let i = 1; i < this.o.hooks - 1; i++) {
      this.fingerHolesAt((i * this.x) / (this.o.hooks - 1), 3 * t, this.h / 2 - 3 * t);
    }
  };

  private sideWall(move: string): void {
    const a = this.o.angle;
    const ar = a * DEG;
    const h = this.h;
    const t = this.thickness;
    const aEdge = this.getEdge('a');

    const sh = Math.sin(ar) * 6 * t + Math.cos(ar) * h;

    const tw = aEdge.margin() + Math.sin(ar) * h + Math.cos(ar) * 6 * t;
    const th = sh + 6;
    if (this.move(tw, th, move, true)) return;

    this.moveTo(aEdge.margin());

    this.polyline(Math.sin(ar) * h, a, 4 * t);
    this.fingerHolesAt(-3.5 * t, 0, h / 2, 90);
    this.edgeCorner('e', 'h');
    this.getEdge('h').call(h);
    this.polyline(0, 90 - a, Math.cos(ar) * 6 * t, 90);
    aEdge.call(sh);
    this.corner(90);

    this.move(tw, th, move, false, 'side');
  }

  private supportWall(move: string): void {
    const a = this.o.angle;
    const ar = a * DEG;
    const h = this.h;
    const t = this.thickness;
    const aEdge = this.getEdge('a');

    const sh = Math.sin(ar) * 6 * t + Math.cos(ar) * h;

    const tw = aEdge.margin() + Math.max(Math.sin(ar) * h / 2 + Math.cos(ar) * 5 * t, Math.sin(ar) * h);
    const th = sh + 6;
    if (this.move(tw, th, move, true)) return;

    this.moveTo(aEdge.margin());

    if (a > 0.001) {
      this.polyline(Math.sin(ar) * h, a + 90, 3 * t);
      this.getEdge('f').call(h / 2 - 3 * t);
      this.polyline(0, -90);
    }
    this.polyline(4 * t, 90);
    this.getEdge('f').call(h / 2);
    this.polyline(Math.sin(ar) * 2 * t, 90 - a, Math.cos(ar) * 4 * t - Math.sin(ar) ** 2 * 2 * t, 90);
    if (a > 0.001) aEdge.call(sh);
    else aEdge.call(h / 2);
    this.corner(90);

    this.move(tw, th, move, false, 'support');
  }

  render(): void {
    this.generateWallEdges();

    const p = new PinEdge(this, this.o);
    const n = this.o.pins;
    const t = this.thickness;

    // boxes.py raises the front plate to its minimum silently; so does the port.
    if (this.h < 7 * t) this.h = 7 * t;

    this.x = n * this.o.pinspacing + ((n * (n - 1)) / 2) * this.o.pinspacingIncrement;
    const x = this.x;

    this.rectangularWall(x, 3 * t, [p, 'e', 'f', 'e'], { move: 'up', label: 'pins' });
    this.rectangularWall(x, this.h, 'efef', { callback: [this.frontCB], move: 'up', label: 'front' });
    this.rectangularWall(x, this.h / 2, 'efef', { callback: [this.backCB], move: 'up', label: 'back' });
    this.sideWall('right');
    for (let i = 0; i < this.o.hooks - 2; i++) this.supportWall('right');
    this.sideWall('right');
  }
}

export const wallPinRow: GeneratorDef = {
  meta: {
    id: 'wallpinrow',
    name: 'Wall Pin Row',
    group: 'Wall mounted',
    summary: 'Row of upward-angled pins to hang things on',
    description:
      'A row of pins standing out from the wall, angled upwards so whatever hangs on ' +
      'them stays put — coats, bags, cables, headphones. The spacing can widen from ' +
      'left to right.',
  },
  params: [
    { key: 'pins', kind: 'number', label: 'Number of pins', default: 8, min: 1, max: 30, step: 1, group: 'dimensions' },
    { key: 'pinlength', kind: 'length', label: 'Pin length', unit: 'mm', default: 35, min: 5, max: 150, step: 1, group: 'dimensions' },
    { key: 'pinwidth', kind: 'length', label: 'Pin width', unit: 'mm', default: 10, min: 2, max: 40, step: 0.5, group: 'dimensions' },
    {
      key: 'pinspacing',
      kind: 'length',
      label: 'Pin spacing',
      unit: 'mm',
      default: 35,
      min: 15,
      max: 200,
      step: 1,
      group: 'dimensions',
      help: 'Centre to centre.',
    },
    {
      key: 'pinspacing_increment',
      kind: 'length',
      label: 'Spacing increase',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 30,
      step: 0.5,
      group: 'dimensions',
      help: 'Added to each gap from left to right.',
    },
    {
      key: 'angle',
      kind: 'number',
      label: 'Pin angle',
      unit: '°',
      default: 20,
      min: 0,
      max: 60,
      step: 1,
      group: 'dimensions',
      help: 'How far the pins point upwards.',
    },
    {
      key: 'hooks',
      kind: 'number',
      label: 'Wall hooks',
      default: 3,
      min: 2,
      max: 10,
      step: 1,
      group: 'dimensions',
      help: 'Number of brackets hooking into the wall, including the two ends.',
    },
    {
      key: 'h',
      kind: 'length',
      label: 'Front plate height',
      unit: 'mm',
      default: 50,
      min: 10,
      max: 200,
      step: 1,
      group: 'dimensions',
      help: 'At least seven times the material thickness; smaller values are raised to that.',
    },
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallPinRow(
      {
        pins: n(v, 'pins', 8),
        pinlength: n(v, 'pinlength', 35),
        pinwidth: n(v, 'pinwidth', 10),
        pinspacing: n(v, 'pinspacing', 35),
        pinspacingIncrement: n(v, 'pinspacing_increment', 0),
        angle: n(v, 'angle', 20),
        hooks: n(v, 'hooks', 3),
        h: n(v, 'h', 50),
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
