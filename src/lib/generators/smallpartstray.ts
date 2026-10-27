/**
 * Small parts tray — ported from boxes.py
 * `boxes/generators/smallpartstray.py` (class `SmallPartsTray`).
 *
 * A tray whose compartments have a ramp at one or both ends, so game tokens
 * or screws slide out easily. With ramps at both ends the dividers are
 * loose, on little feet, and can be moved.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { LID_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { parseSections } from '../params/sections';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface SmallPartsTrayOptions {
  sx: number[];
  y: number;
  h: number;
  outside: boolean;
  angle: number;
  rampheight: number;
  twoSided: boolean;
  frontPanel: boolean;
}

class SmallPartsTray extends Boxes {
  constructor(
    private o: SmallPartsTrayOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private innerWall(h: number, y: number, rampH: number, rampY: number, twoRamps: boolean, front = true, move?: string, label = ''): void {
    const a = Math.atan(rampH / rampY) / DEG;
    const l = (rampH ** 2 + rampY ** 2) ** 0.5;
    if (twoRamps) {
      this.polygonWall([y - 2 * rampY, a, l, 90 - a, h - rampH, 90, y, 90, h - rampH, 90 - a, l, a], {
        edge: front ? 'fffeff' : 'ffeeef',
        move,
        label,
      });
    } else {
      this.polygonWall([y - rampY, 90, h, 90, y, 90, h - rampH, 90 - a, l, a], {
        edge: front ? 'ffeff' : 'ffeef',
        move,
        label,
      });
    }
  }

  private outerWall(h: number, y: number, rampH: number, rampY: number, twoRamps: boolean, front = true, move?: string, label = ''): void {
    const a = Math.atan(rampH / rampY) / DEG;
    const l = (rampH ** 2 + rampY ** 2) ** 0.5;
    const t = this.thickness;
    const ce = (types: string, lengths: number[]) => this.makeCompoundEdge(Array.from(types), lengths);

    const cb = (): void => {
      this.savedContext(() => {
        this.moveTo(rampY, 0, 180 - a);
        this.fingerHolesAt(0, 0.5 * t, l, 0);
      });
      if (twoRamps) {
        this.moveTo(y - rampY, 0, a);
        this.fingerHolesAt(0, -0.5 * t, l, 0);
      }
    };

    let edges: EdgeSpec[];
    if (twoRamps) {
      edges = [
        ce('EFE', [rampY, y - 2 * rampY, rampY]),
        front ? ce('EF', [rampH, h - rampH]) : 'e',
        'e',
        front ? ce('FE', [h - rampH, rampH]) : 'e',
      ];
    } else {
      edges = [front ? ce('EF', [rampY, y - rampY]) : 'e', 'F', 'e', ce('FE', [h - rampH, rampH])];
    }
    this.rectangularWall(y, h, edges, { callback: [cb], move, label });
  }

  private holeCB(sections: number[], height: number) {
    return (): void => {
      let pos = -0.5 * this.thickness;
      for (const l of sections.slice(0, -1)) {
        pos += l + this.thickness;
        this.fingerHolesAt(pos, 0, height);
      }
    };
  }

  /** Simple movable divider: a wall with small feet for a little more stability. */
  private renderSimpleTrayDivider(width: number, height: number, move: string, label = ''): void {
    if (this.move(width, height, move, true)) return;

    const t = this.thickness;
    this.moveTo(t);
    this.polyline(width - 2 * t, 90, t, -90, t, 90, height - t, 90, width, 90, height - t, 90, t, -90, t, 90);

    this.move(width, height, move, false, label);
  }

  private renderSimpleTrayDividerFeet(move?: string): void {
    const sqr2 = Math.sqrt(2);
    const t = this.thickness;
    const dividerFootWidth = 2 * t;
    const fullWidth = t + 2 * dividerFootWidth;
    const moveLength = fullWidth / sqr2 + 2 * this.burn;
    const moveWidth = fullWidth / sqr2 + 2 * this.burn;

    if (this.move(moveWidth, moveLength, move, true)) return;

    this.moveTo(this.burn);
    this.ctx.save();
    this.polyline(sqr2 * dividerFootWidth, 135, t, -90, t, -90, t, 135, sqr2 * dividerFootWidth, 135, fullWidth, 135);
    this.ctx.restore();

    this.moveTo(-this.burn / sqr2, this.burn * (1 + 1 / sqr2), 45);
    this.moveTo(fullWidth);

    this.polyline(0, 135, sqr2 * dividerFootWidth, 135, t, -90, t, -90, t, 135, sqr2 * dividerFootWidth, 135);

    // Named without a drawn label: boxes.py leaves these unlabelled, and the
    // text is wider than the part, which would change the sheet size.
    this.ctx.nameCurrentPart('feet');
    this.move(moveWidth, moveLength, move, false);
  }

  render(): void {
    let { sx, y, h } = this.o;
    const { twoSided, frontPanel } = this.o;
    const t = this.thickness;
    const a = this.o.angle;

    if (this.o.outside) {
      sx = this.adjustSize(sx);
      h = this.adjustSize(h, false);
      // boxes.py passes the front's width here, t or t/√2, but adjustSize
      // only tests it for truth, so a whole thickness comes off either way.
      y = this.adjustSize(y);
    }

    const x = sx.reduce((acc, v) => acc + v, 0) + (sx.length - 1) * t;

    let rampH = h * this.o.rampheight;
    let rampY = rampH / Math.tan(a * DEG);

    if (twoSided && 2 * rampY + 3 * t > y) {
      rampY = (y - 3 * t) / 2;
      rampH = rampY * Math.tan(a * DEG);
    } else if (rampY > y - t) {
      rampY = y - t;
      rampH = rampY * Math.tan(a * DEG);
    }

    const rampL = (rampH ** 2 + rampY ** 2) ** 0.5;

    this.savedContext(() => {
      this.outerWall(h, y, rampH, rampY, twoSided, frontPanel, 'up', 'left');
      this.outerWall(h, y, rampH, rampY, twoSided, frontPanel, 'mirror up', 'right');
      for (let i = 0; i < sx.length - 1; i++) {
        this.innerWall(h, y, rampH, rampY, twoSided, frontPanel, 'up', `divider ${i + 1}`);
      }
    });
    this.innerWall(h, y, rampH, rampY, twoSided, frontPanel, 'right only');

    const wall = (l: number, edges: string, label: string) =>
      this.rectangularWall(x, l, edges, { callback: [this.holeCB(sx, l)], move: 'up', label });

    if (frontPanel) wall(h - rampH, 'efef', 'front');
    wall(rampL, 'efef', 'front ramp');
    if (twoSided) {
      wall(y - 2 * rampY, 'efef', 'bottom');
      wall(rampL, 'efef', 'back ramp');
      if (frontPanel) wall(h - rampH, 'efef', 'back');
    } else {
      wall(y - rampY, 'efff', 'bottom');
      wall(h, 'Ffef', 'back');
    }

    if (twoSided) {
      this.savedContext(() => {
        sx.forEach((l, i) => this.renderSimpleTrayDivider(l, h, 'right', `loose divider ${i + 1}`));

        this.partsMatrix(sx.length, 0, 'right', (move) => this.renderSimpleTrayDividerFeet(move));
      });
      // boxes.py moves by the last compartment's divider, its loop variable
      // still in scope.
      this.renderSimpleTrayDivider(sx[sx.length - 1]!, h, 'up only');

      this.lid(x, y);
    }
  }
}

export const smallPartsTray: GeneratorDef = {
  meta: {
    id: 'smallpartstray',
    name: 'Small Parts Tray',
    group: 'Tray',
    summary: 'Tray with ramps, so tokens and screws slide out easily',
    description:
      'Each compartment has a ramp at one or both ends, so small parts slide ' +
      'out instead of hiding in the corners. With ramps at both ends the ' +
      'dividers stand loose on little feet and can be moved, and the tray ' +
      'can have a lid.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartments left to right',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'compartment',
    },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 30, min: 10, max: 500, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    { key: 'angle', kind: 'number', label: 'Ramp angle', unit: '°', default: 45, min: 10, max: 80, step: 1, group: 'dimensions' },
    {
      key: 'rampheight',
      kind: 'number',
      label: 'Ramp height',
      unit: '× height',
      default: 0.5,
      min: 0.05,
      max: 1,
      step: 0.05,
      group: 'dimensions',
    },
    {
      key: 'two_sided',
      kind: 'bool',
      label: 'Ramps at both ends',
      default: true,
      group: 'dimensions',
      help: 'Also makes the dividers loose, so they can be moved, and allows a lid.',
    },
    { key: 'front_panel', kind: 'bool', label: 'Upright wall above the ramp', default: true, group: 'dimensions' },
    ...LID_PARAMS.map((spec) => ({
      ...spec,
      showIf: (v: ParamValues) => v['two_sided'] === true && (spec.showIf?.(v) ?? true),
    })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new SmallPartsTray(
      {
        sx: parseSections(s(v, 'sx', '50*3')),
        y: n(v, 'y', 100),
        h: n(v, 'h', 30),
        outside: b(v, 'outside', true),
        angle: n(v, 'angle', 45),
        rampheight: n(v, 'rampheight', 0.5),
        twoSided: b(v, 'two_sided', true),
        frontPanel: b(v, 'front_panel', true),
      },
      config,
    ),
};
