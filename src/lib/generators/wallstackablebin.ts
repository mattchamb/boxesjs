/**
 * Wall stackable bin — ported from boxes.py `boxes/generators/wallstackablebin.py`
 * (class `WallStackableBin`).
 *
 * An open-fronted parts bin with a sloped front and an optional label strip.
 * It hangs on the wall, and bins stack on one another through stackable feet.
 * Bins with plain wall mounts can stack on bins with any other mount.
 */
import type { Boxes, BoxesConfig } from '../boxes';
import { BaseEdge } from '../edges/base';
import type { FingerJointSettings } from '../edges/fingerjoint';
import { STACKABLE_PARAMS, WALL_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface WallStackableBinOptions {
  sx: number[];
  h: number;
  y: number;
  outside: boolean;
  front: number;
  angle: number;
  label: boolean;
  labelHeight: number;
}

/**
 * The front profile of a side wall: sloped bottom, label strip, then back up
 * at an angle to the top. Registered as `j`. boxes.py passes the box as this
 * edge's "settings"; here the bin is passed explicitly.
 */
class StackableBinEdge extends BaseEdge {
  override char: string | null = 'j';

  constructor(
    boxes: Boxes,
    private bin: { o: WallStackableBinOptions; h: number },
  ) {
    super(boxes, null);
  }

  call(): void {
    const a = this.bin.o.angle;
    const f = this.bin.o.front;
    const l = this.bin.o.label ? this.bin.o.labelHeight : 0;
    const h = this.bin.h;

    const w = h * f * Math.tan(a * DEG);
    const hyp1 = (h * f) / Math.cos(a * DEG);
    const hyp2 = Math.sqrt(w ** 2 + ((1 - (l + f)) * h) ** 2);
    const bAngle = Math.atan(w / ((1 - l - f) * h)) / DEG;

    this.corner(-bAngle);
    this.boxes.getEdge('e').call(hyp2);
    this.corner(bAngle);
    this.boxes.getEdge('f').call(l * h);
    this.corner(a);
    this.boxes.getEdge('f').call(hyp1);
    this.corner(-a);
  }

  override margin(): number {
    const t = this.bin.o.label ? this.thickness : 0;
    return this.bin.h * this.bin.o.front * Math.tan(this.bin.o.angle * DEG) + t;
  }
}

class WallStackableBin extends WallMountedBox {
  private sx: number[];
  h: number;
  private y: number;

  constructor(
    public o: WallStackableBinOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
    this.sx = [...o.sx];
    this.h = o.h;
    this.y = o.y;
  }

  private wallCB(sx: number[], l: number, wall = false): () => void {
    return () => {
      const t = this.thickness;
      let posx = -0.5 * t;
      for (const x of sx.slice(0, -1)) {
        posx += x + t;
        if (wall) this.wallHolesAt(posx, 0, l, 90);
        else this.fingerHolesAt(posx, 0, l, 90);
      }
    };
  }

  render(): void {
    this.generateWallEdges();
    this.addPart(new StackableBinEdge(this, this));

    const t = this.thickness;
    const o = this.o;

    // Fingers meeting at the slope's angles. As in WallHopper, each of these
    // also rebinds `h` (PORTING §9, Wall edges).
    const fj = this.getEdge('f').settings as FingerJointSettings;
    const bottomToSlope = fj.clone();
    bottomToSlope.setValues(t, true, { angle: 90 - o.angle });
    bottomToSlope.edgeObjects(this, 'gG');
    const slopeToLabel = fj.clone();
    slopeToLabel.setValues(t, true, { angle: o.angle });
    slopeToLabel.edgeObjects(this, 'kK');

    if (o.outside) {
      this.sx = this.adjustSize(this.sx);
      this.h = this.adjustSize(this.h, 's', 'S');
      this.y = this.adjustSize(this.y, 'h', 'b');
    }

    const sx = this.sx;
    const x = sx.reduce((a, c) => a + c, 0) + t * (sx.length - 1);

    this.savedContext(() => {
      this.rectangularWall(x, this.y, 'ffGf', { callback: [this.wallCB(sx, this.y)], label: 'bottom', move: 'up' });

      const hs = (this.h * o.front) / Math.cos(o.angle * DEG);
      if (o.label) {
        this.rectangularWall(x, hs, 'gFkF', { callback: [this.wallCB(sx, hs)], label: 'slope', move: 'up' });
        this.rectangularWall(x, this.h * o.labelHeight, 'KFeF', {
          callback: [this.wallCB(sx, this.h * o.labelHeight)],
          label: 'label',
          move: 'up',
        });
      } else {
        this.rectangularWall(x, hs, 'gFeF', { callback: [this.wallCB(sx, hs)], label: 'slope', move: 'up' });
      }

      this.rectangularWall(x, this.h, 'hCec', { callback: [this.wallCB(sx, this.h, true)], label: 'back', move: 'up' });
    });

    // Not drawn; moves the side walls to the right of the panels above.
    this.rectangularWall(x, 3, 'DDDD', { label: 'movement', move: 'right only' });

    this.rectangularWall(this.y, this.h, 'sBSj', { label: 'left side', move: 'up' });
    this.rectangularWall(this.y, this.h, 'sBSj', { label: 'right side', move: 'mirror up' });

    for (let i = 0; i < sx.length - 1; i++) {
      this.rectangularWall(this.y, this.h, 'fBSj', { label: 'dividers', move: 'up' });
    }
  }
}

export const wallStackableBin: GeneratorDef = {
  meta: {
    id: 'wallstackablebin',
    name: 'Wall Stackable Bin',
    group: 'Wall mounted',
    summary: 'Sloped-front parts bin that hangs or stacks',
    description:
      'An open-fronted parts bin with a sloped front and an optional label strip. It ' +
      'hangs on the wall, and bins stack on one another through feet. Bins with plain ' +
      'wall mounts can stack on bins with any other mount type. Outside measurements ' +
      'generally do not suit stacking. The bottom, slope and label panels meet at ' +
      'angled finger joints; assemble them in the order they are laid out.',
  },
  // boxes.py starts this generator with stabilisers under the feet.
  paramDefaults: { st_bottom_stabilizers: 2.4 },
  params: [
    { key: 'sx', kind: 'sections', label: 'Compartments left to right', default: '90', group: 'dimensions', itemLabel: 'compartment' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 130, min: 30, max: 500, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 150, min: 30, max: 500, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'front',
      kind: 'number',
      label: 'Sloped share of the front',
      default: 0.3,
      min: 0.05,
      max: 0.7,
      step: 0.05,
      group: 'dimensions',
    },
    { key: 'angle', kind: 'number', label: 'Slope angle', unit: '°', default: 30, min: 0, max: 60, step: 1, group: 'dimensions' },
    { key: 'label', kind: 'bool', label: 'Label strip', default: true, group: 'dimensions' },
    {
      key: 'label_height',
      kind: 'number',
      label: 'Label share of the front',
      default: 0.2,
      min: 0.05,
      max: 0.5,
      step: 0.05,
      group: 'dimensions',
    },
    ...WALL_PARAMS,
    ...STACKABLE_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallStackableBin(
      {
        sx: parseSections(s(v, 'sx', '90')),
        h: n(v, 'h', 130),
        y: n(v, 'y', 150),
        outside: b(v, 'outside', true),
        front: n(v, 'front', 0.3),
        angle: n(v, 'angle', 30),
        label: b(v, 'label', true),
        labelHeight: n(v, 'label_height', 0.2),
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
