/**
 * Wall hopper — ported from boxes.py `boxes/generators/wallhopper.py`
 * (class `WallHopper`).
 *
 * A bin that hangs on the wall and feeds its contents down a sloped front
 * into a dispensing tray at the bottom, like a cereal or screw dispenser. The
 * front of the tray can carry a label strip. Compartments side by side are
 * separated by dividers shaped like the sides.
 */
import { type BoxesConfig } from '../boxes';
import type { FingerJointSettings } from '../edges/fingerjoint';
import { WALL_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { WallMountedBox, type WallType } from '../walledges';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface WallHopperOptions {
  sx: number[];
  h: number;
  hopperDepth: number;
  dispenserDepth: number;
  dispenserHeight: number;
  slopeRatio: number;
  slopeAngle: number;
  label: boolean;
  labelRatio: number;
}

class WallHopper extends WallMountedBox {
  constructor(
    private o: WallHopperOptions,
    walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(walltype, config);
  }

  /** Slots for the dividers, one between each pair of compartments. */
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

    const o = this.o;
    const hd = o.hopperDepth;
    const dd = o.dispenserDepth;
    const dh = o.dispenserHeight;
    let sr = o.slopeRatio < 1 ? o.slopeRatio : 0.999;
    let a = o.slopeAngle;
    let lr = o.labelRatio < 1 ? o.labelRatio : 0.999;
    const t = this.thickness;
    const sx = o.sx;

    const x = sx.reduce((acc, c) => acc + c, 0) + t * (sx.length - 1);
    const h = o.h;

    // Clamp the slope between a flat front (0°) and one steep enough to leave
    // no flat floor in the tray. boxes.py clamps silently, so the port does too.
    const maxsa = Math.atan(dd / (dh * sr)) / DEG;
    if (a < 0) a = 0;
    else if (a > maxsa) a = maxsa;

    const wh = this.getEdge('h').startWidth();

    if (!o.label) lr = 0;
    if (sr + lr >= 1) {
      // Scale both down proportionally so they leave 5% for the top slope.
      const total = sr + lr;
      sr = (sr / total) * 0.95;
      lr = (lr / total) * 0.95;
    }

    // Angle from the label back up to the hopper front.
    const bAngle = Math.atan(dd / ((1 - (lr + sr)) * dh)) / DEG;
    // The tray's flat floor: its depth less what the slope takes.
    const df = dd - dh * sr * Math.tan(a * DEG);
    const sl = (dh * sr) / Math.cos(a * DEG);
    const tl = (dd ** 2 + ((1 - (lr + sr)) * dh) ** 2) ** 0.5;

    // Fingers that meet at the slope's angles. Registering `gG` replaces the
    // grip edge, and each `edgeObjects` call here also rebinds `h` to an angled
    // finger-hole edge, since it gets three edges for two characters. boxes.py
    // does the same, and the side walls below draw with that last `h`.
    const fj = this.getEdge('f').settings as FingerJointSettings;
    const bottomToSlope = fj.clone();
    bottomToSlope.setValues(t, true, { angle: 90 - a });
    bottomToSlope.edgeObjects(this, 'gG');
    const slopeToLabel = fj.clone();
    slopeToLabel.setValues(t, true, { angle: a });
    slopeToLabel.edgeObjects(this, 'kK');

    this.savedContext(() => {
      this.rectangularWall(x, hd + df, 'ffGf', {
        callback: [this.wallCB(sx, hd + df)],
        label: 'bottom',
        move: 'up',
      });

      if (o.label) {
        this.rectangularWall(x, sl, 'gfkf', { callback: [this.wallCB(sx, sl)], label: 'slope', move: 'up' });
        this.rectangularWall(x, dh * lr, 'Kfef', {
          callback: [this.wallCB(sx, dh * lr)],
          label: 'label',
          move: 'up',
        });
      } else {
        this.rectangularWall(x, sl, 'gfef', { callback: [this.wallCB(sx, sl)], label: 'slope', move: 'up' });
      }
      this.rectangularWall(x, h, 'hCec', { callback: [this.wallCB(sx, h, true)], label: 'back', move: 'up' });
      this.rectangularWall(x, h - dh, 'efef', { callback: [this.wallCB(sx, h - dh)], label: 'front', move: 'up' });
    });

    // Not drawn; moves the side walls to the right of the panels above.
    this.rectangularWall(x, 3, 'DDDD', { label: 'movement', move: 'right only' });

    const sideEdges: Array<number | [number, number]> = [
      t, 0,
      hd + df, [90 - a, wh],
      sl, [a, wh],
      dh * lr, bAngle,
      tl, -bAngle,
      h - dh, 90,
      hd + wh + t, 90,
      h, 0,
      wh, 90,
    ];

    // As the sides, but jointed to the panels rather than slotted for them.
    const middleEdges: Array<number | [number, number]> = [
      t, 0,
      hd + df, 90 - a,
      sl, a,
      dh * lr, bAngle,
      tl, -bAngle,
      h - dh, 90,
      hd + t, 90,
      h, 0,
      0, 90,
    ];

    this.polygonWall(sideEdges, { edge: 'ehhhehebe', correctCorners: false, label: 'left', move: 'up' });
    this.polygonWall(sideEdges, { edge: 'ehhhehebe', correctCorners: false, label: 'right', move: 'up mirror' });
    for (let i = 0; i < sx.length - 1; i++) {
      this.polygonWall(middleEdges, { edge: 'efffefebe', correctCorners: false, label: 'divider', move: 'up' });
    }
  }
}

export const wallHopper: GeneratorDef = {
  meta: {
    id: 'wallhopper',
    name: 'Wall Hopper',
    group: 'Wall mounted',
    summary: 'Wall-hung storage hopper with a dispensing tray',
    description:
      'A bin that hangs on the wall and feeds its contents down a sloped front ' +
      'into a tray at the bottom, with an optional label strip on the front. Hangs ' +
      'on a plain wall, slatwall, DIN rail, French cleat or IKEA Skådis board. The ' +
      'bottom, slope and label panels meet at angled finger joints, so assemble ' +
      'them in the order they are laid out.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartments left to right',
      default: '80',
      group: 'dimensions',
      itemLabel: 'compartment',
    },
    {
      key: 'h',
      kind: 'length',
      label: 'Height',
      unit: 'mm',
      default: 150,
      // Must stay above the dispenser height, or the hopper front goes negative.
      min: 80,
      max: 600,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'hopper_depth',
      kind: 'length',
      label: 'Hopper depth',
      unit: 'mm',
      default: 50,
      min: 10,
      max: 300,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'dispenser_depth',
      kind: 'length',
      label: 'Tray depth',
      unit: 'mm',
      default: 45,
      min: 10,
      max: 200,
      step: 1,
      group: 'dimensions',
      help: 'How far the dispensing tray sticks out in front of the hopper.',
    },
    {
      key: 'dispenser_height',
      kind: 'length',
      label: 'Tray height',
      unit: 'mm',
      default: 50,
      min: 15,
      max: 75,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'slope_ratio',
      kind: 'number',
      label: 'Sloped share of the tray front',
      default: 0.4,
      min: 0.05,
      max: 0.95,
      step: 0.05,
      group: 'dimensions',
    },
    {
      key: 'slope_angle',
      kind: 'number',
      label: 'Slope angle',
      unit: '°',
      default: 30,
      min: 0,
      max: 80,
      step: 1,
      group: 'dimensions',
      help: 'Zero is a vertical front. Values too steep for the tray are reduced to fit.',
    },
    { key: 'label', kind: 'bool', label: 'Label strip', default: true, group: 'dimensions' },
    {
      key: 'label_ratio',
      kind: 'number',
      label: 'Label share of the tray front',
      default: 0.2,
      min: 0.05,
      max: 0.9,
      step: 0.05,
      group: 'dimensions',
      help: 'If the slope and label together take the whole front, both are scaled back.',
    },
    ...WALL_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallHopper(
      {
        sx: parseSections(s(v, 'sx', '80')),
        h: n(v, 'h', 150),
        hopperDepth: n(v, 'hopper_depth', 50),
        dispenserDepth: n(v, 'dispenser_depth', 45),
        dispenserHeight: n(v, 'dispenser_height', 50),
        slopeRatio: n(v, 'slope_ratio', 0.4),
        slopeAngle: n(v, 'slope_angle', 30),
        label: b(v, 'label', true),
        labelRatio: n(v, 'label_ratio', 0.2),
      },
      s(v, 'walltype', 'plain') as WallType,
      config,
    ),
};
