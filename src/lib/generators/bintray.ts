/**
 * Bin tray — ported from boxes.py `boxes/generators/bintray.py`
 * (class `BinTray`).
 *
 * A type tray stood on end, with a sloped retainer across the front of each
 * row so the bins can be reached into from the front.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { BaseEdge } from '../edges/base';
import type { FingerJointSettings } from '../edges/fingerjoint';
import { SlottedEdge } from '../edges/slots';
import type { ParamValues } from '../params/schema';
import { parseSections } from '../params/sections';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

/**
 * The sloped front of a row, run up the side walls ('B') or an inner
 * vertical wall ('b'). boxes.py hands the generator itself to this edge as
 * its settings; here it holds the generator directly.
 */
class BinFrontEdge extends BaseEdge {
  override char: string | null = 'B';

  constructor(private tray: BinTray) {
    super(tray, null);
  }

  call(_length: number): void {
    const tray = this.tray;
    const f = tray.front;
    const a1 = Math.atan(f / (1 - f)) / DEG;
    const a2 = 45 + a1;
    this.corner(-a1);
    tray.sh.forEach((l, i) => {
      this.boxes.getEdge('e').call(l * (f ** 2 + (1 - f) ** 2) ** 0.5);
      this.corner(a2);
      this.boxes.getEdge('f').call(l * f * 2 ** 0.5);
      if (i < tray.sh.length - 1) {
        if (this.char === 'B') {
          this.polyline(0, 45, 0.5 * tray.y, -90, this.thickness, -90, 0.5 * tray.y, 90 - a1);
        } else {
          this.polyline(0, -45, this.thickness, -a1);
        }
      } else {
        this.corner(-45);
      }
    });
  }

  override margin(): number {
    return Math.max(...this.tray.sh) * this.tray.front;
  }
}

class BinFrontSideEdge extends BinFrontEdge {
  override char: string | null = 'b';
}

interface BinTrayOptions {
  sx: number[];
  y: number;
  sh: number[];
  outside: boolean;
  holeDD: number[];
  front: number;
}

class BinTray extends Boxes {
  sx: number[];
  y: number;
  sh: number[];
  front: number;

  constructor(
    private o: BinTrayOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.sx = [...o.sx];
    this.y = o.y;
    this.sh = [...o.sh];
    this.front = o.front;
  }

  private xSlots = (): void => {
    let posx = -0.5 * this.thickness;
    for (const x of this.sx.slice(0, -1)) {
      posx += x + this.thickness;
      let posh = 0;
      for (const h of this.sh) {
        this.fingerHolesAt(posx, posh, h);
        posh += h + this.thickness;
      }
    }
  };

  private hSlots = (): void => {
    let posh = -0.5 * this.thickness;
    for (const h of this.sh.slice(0, -1)) {
      posh += h + this.thickness;
      let posx = 0;
      for (const x of [...this.sx].reverse()) {
        this.fingerHolesAt(posh, posx, x);
        posx += x + this.thickness;
      }
    }
  };

  private addMount = (): void => {
    const hd = this.o.holeDD;
    const ds = hd[0] ?? 0;
    let dh: number;
    let h: number;

    if (hd.length < 2) {
      // Only a round hole, assuming a screw head about twice the shaft.
      dh = 0;
      h = Math.max(this.thickness * 1.25, this.thickness * 1.0 + ds);
    } else {
      // Offset the hole to leave room for the head.
      dh = hd[1]!;
      h = Math.max(this.thickness * 1.25, this.thickness * 1.0 + dh / 2);
    }

    const dx = this.sx.reduce((a, c) => a + c, 0) + this.thickness * (this.sx.length - 1);
    const x1 = dx * 0.125;
    const x2 = dx * 0.875;

    this.mountingHole(x1, h, ds, dh, -90);
    this.mountingHole(x2, h, ds, dh, -90);
  };

  private xHoles = (): void => {
    let posx = -0.5 * this.thickness;
    for (const x of this.sx.slice(0, -1)) {
      posx += x + this.thickness;
      this.fingerHolesAt(posx, 0, this.y);
    }
  };

  private frontHoles(i: number) {
    return (): void => {
      let posx = -0.5 * this.thickness;
      for (const x of this.sx.slice(0, -1)) {
        posx += x + this.thickness;
        this.fingerHolesAt(posx, 0, this.sh[i]! * this.front * 2 ** 0.5);
      }
    };
  }

  private hHoles = (): void => {
    let posh = -0.5 * this.thickness;
    for (const h of this.sh.slice(1).reverse()) {
      posh += h + this.thickness;
      this.fingerHolesAt(posh, 0, this.y);
    }
  };

  render(): void {
    const t = this.thickness;
    if (this.o.outside) {
      this.sx = this.adjustSize(this.sx);
      this.sh = this.adjustSize(this.sh);
      this.y = this.adjustSize(this.y, true, false);
    }

    const x = this.sx.reduce((a, c) => a + c, 0) + t * (this.sx.length - 1);
    const h = this.sh.reduce((a, c) => a + c, 0) + t * (this.sh.length - 1);

    const y = this.y;
    this.front = Math.min(this.front, 0.999);

    this.addPart(new BinFrontEdge(this));
    this.addPart(new BinFrontSideEdge(this));

    // The retainers meet the inner walls at 45 degrees.
    const angledsettings = (this.getEdge('f').settings as FingerJointSettings).clone();
    angledsettings.setValues(t, true, { angle: 45 });
    angledsettings.edgeObjects(this, 'gGH');

    const sxRev = [...this.sx].reverse();

    // outer walls
    let e: EdgeSpec[] = ['F', 'f', new SlottedEdge(this, sxRev, 'G'), 'f'];

    this.rectangularWall(x, y, e, { callback: [this.xHoles], move: 'right', label: 'bottom' });
    this.rectangularWall(h, y, 'FFbF', { callback: [this.hHoles], move: 'up', label: 'left' });
    this.rectangularWall(h, y, 'FFbF', { callback: [this.hHoles], label: 'right' });
    this.rectangularWall(x, y, 'Ffef', { callback: [this.xHoles], move: 'left', label: 'top' });
    this.rectangularWall(h, y, 'FFBF', { move: 'up only' });

    // floor
    this.rectangularWall(x, h, 'ffff', {
      callback: [this.xSlots, this.hSlots, this.addMount],
      move: 'right',
      label: 'back',
    });
    // Inner walls
    for (let i = 0; i < this.sx.length - 1; i++) {
      e = [new SlottedEdge(this, this.sh, 'f'), 'f', 'B', 'f'];
      this.rectangularWall(h, y, e, { move: 'up', label: `inner vertical ${i + 1}` });
    }

    for (let i = 0; i < this.sh.length - 1; i++) {
      e = [new SlottedEdge(this, this.sx, 'f', 0.5 * y), 'f', new SlottedEdge(this, sxRev, 'G'), 'f'];
      this.rectangularWall(x, y, e, { move: 'up', label: `inner horizontal ${i + 1}` });
    }

    // Front walls
    for (let i = 0; i < this.sh.length; i++) {
      e = [new SlottedEdge(this, this.sx, 'g'), 'F', 'e', 'F'];
      this.rectangularWall(x, this.sh[i]! * this.front * 2 ** 0.5, e, {
        callback: [this.frontHoles(i)],
        move: 'up',
        label: `retainer ${i + 1}`,
      });
    }
  }
}

export const binTray: GeneratorDef = {
  meta: {
    id: 'bintray',
    name: 'Bin Tray',
    group: 'Shelf',
    summary: 'Upright type tray with a sloped retainer across each row of bins',
    description:
      'A grid of open bins stood on end, to hang on a wall or stand on a ' +
      'bench. A sloped retainer across the front of each row keeps the ' +
      'contents in while leaving them easy to reach.',
  },
  // boxes.py's own default: the short retainers need a smaller finger margin.
  paramDefaults: { fj_surroundingspaces: 0.5 },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Bins left to right',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'bin',
      help: 'Width of each column of bins.',
    },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    {
      key: 'sh',
      kind: 'sections',
      label: 'Rows bottom to top',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'row',
      help: 'Height of each row of bins.',
    },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'front',
      kind: 'number',
      label: 'Retainer height',
      unit: '× row',
      default: 0.4,
      min: 0.05,
      max: 0.95,
      step: 0.05,
      group: 'dimensions',
      help: 'Fraction of each row’s height covered by the sloped front.',
    },
    {
      key: 'hole_dD',
      kind: 'text',
      label: 'Mounting holes',
      default: '3.5:6.5',
      group: 'advanced',
      placeholder: 'shaft:head',
      help: 'Screw shaft and head diameter in mm, as shaft:head. A shaft alone cuts plain round holes.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new BinTray(
      {
        sx: parseSections(s(v, 'sx', '50*3')),
        y: n(v, 'y', 100),
        sh: parseSections(s(v, 'sh', '50*3')),
        outside: b(v, 'outside', true),
        holeDD: parseSections(s(v, 'hole_dD', '3.5:6.5')),
        front: n(v, 'front', 0.4),
      },
      config,
    ),
};
