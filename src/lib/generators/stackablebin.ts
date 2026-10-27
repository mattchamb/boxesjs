/**
 * Stackable bin — ported from boxes.py `boxes/generators/stackablebin.py`
 * (class `StackableBin`).
 *
 * One row of the Bin Tray as a bin of its own, with stackable edges so the
 * bins sit on top of each other.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { BaseEdge } from '../edges/base';
import type { FingerJointSettings } from '../edges/fingerjoint';
import { STACKABLE_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { parseSections } from '../params/sections';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

/**
 * The sloped front, run up the sides. boxes.py hands the generator itself to
 * this edge as its settings; here it holds the generator directly.
 */
class StackableBinEdge extends BaseEdge {
  override char: string | null = 'B';

  constructor(private bin: StackableBin) {
    super(bin, null);
  }

  call(_length: number): void {
    const { front: f, h } = this.bin;
    const a1 = Math.atan(f / (1 - f)) / DEG;
    const a2 = 45 + a1;
    this.corner(-a1);

    this.boxes.getEdge('e').call(h * (f ** 2 + (1 - f) ** 2) ** 0.5);
    this.corner(a2);
    this.boxes.getEdge('f').call(h * f * 2 ** 0.5);

    this.corner(-45);
  }

  override margin(): number {
    return this.bin.h * this.bin.front;
  }
}

class StackableBinSideEdge extends StackableBinEdge {
  override char: string | null = 'b';
}

interface StackableBinOptions {
  sx: number[];
  h: number;
  d: number;
  outside: boolean;
  front: number;
}

class StackableBin extends Boxes {
  h: number;
  front: number;
  private sx: number[];
  private d: number;

  constructor(
    private o: StackableBinOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.sx = [...o.sx];
    this.h = o.h;
    this.d = o.d;
    this.front = o.front;
  }

  private wallCB(sx: number[], l: number) {
    return (): void => {
      const t = this.thickness;
      let posx = -0.5 * t;
      for (const x of sx.slice(0, -1)) {
        posx += x + t;
        this.fingerHolesAt(posx, 0, l, 90);
      }
    };
  }

  render(): void {
    this.front = Math.min(this.front, 0.999);

    this.addPart(new StackableBinEdge(this));
    this.addPart(new StackableBinSideEdge(this));

    // The retainer meets the bottom at 45 degrees.
    const angledsettings = (this.getEdge('f').settings as FingerJointSettings).clone();
    angledsettings.setValues(this.thickness, true, { angle: 45 });
    angledsettings.edgeObjects(this, 'gGH');

    if (this.o.outside) {
      this.sx = this.adjustSize(this.sx);
      this.h = this.adjustSize(this.h, 's', 'S');
      this.d = this.adjustSize(this.d, 'h', 'b');
    }

    const { sx, h, d, front } = this;
    const x = sx.reduce((a, c) => a + c, 0) + this.thickness * (sx.length - 1);
    const retainer = h * front * 2 ** 0.5;

    this.savedContext(() => {
      this.rectangularWall(x, d, 'ffGf', { callback: [this.wallCB(sx, d)], label: 'bottom', move: 'up' });
      this.rectangularWall(x, h, 'sfSf', { callback: [this.wallCB(sx, h)], label: 'back', move: 'up ' });
      this.rectangularWall(x, retainer, 'gFeF', { callback: [this.wallCB(sx, retainer)], label: 'retainer', move: 'up' });
      this.rectangularWall(x, 3, 'EEEE', { label: 'for label (optional)' });
    });

    this.rectangularWall(x, 3, 'EEEE', { label: 'movement', move: 'right only' });

    this.rectangularWall(d, h, 'shSb', { label: 'left', move: 'up' });
    this.rectangularWall(d, h, 'shSb', { label: 'right', move: 'mirror up' });
    for (let i = 0; i < sx.length - 1; i++) {
      this.rectangularWall(d, h, 'ffSb', { label: 'divider', move: 'up' });
    }
  }
}

export const stackableBin: GeneratorDef = {
  meta: {
    id: 'stackablebin',
    name: 'Stackable Bin',
    group: 'Shelf',
    summary: 'Open-fronted bin with a sloped retainer, that stacks on others',
    description:
      'A row of the Bin Tray made as a bin of its own: a sloped retainer ' +
      'across the front, optional dividers, and stackable edges so bins sit ' +
      'on top of one another. An optional strip on the front takes a label.',
  },
  // boxes.py's own defaults: a smaller finger margin, and taller feet.
  paramDefaults: { fj_surroundingspaces: 0.5, st_bottom_stabilizers: 2.4 },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartments left to right',
      default: '70',
      group: 'dimensions',
      itemLabel: 'compartment',
      help: 'More than one adds a divider between each.',
    },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 50, min: 20, max: 500, step: 1, group: 'dimensions' },
    { key: 'd', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'front',
      kind: 'number',
      label: 'Retainer height',
      unit: '× height',
      default: 0.4,
      min: 0.05,
      max: 0.95,
      step: 0.05,
      group: 'dimensions',
      help: 'Fraction of the height covered by the sloped front.',
    },
    ...STACKABLE_PARAMS.map((spec) => ({ ...spec, showIf: undefined })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new StackableBin(
      {
        sx: parseSections(s(v, 'sx', '70')),
        h: n(v, 'h', 50),
        d: n(v, 'd', 100),
        outside: b(v, 'outside', true),
        front: n(v, 'front', 0.4),
      },
      config,
    ),
};
