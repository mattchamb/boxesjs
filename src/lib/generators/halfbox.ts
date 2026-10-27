/**
 * Half box — ported from boxes.py `boxes/generators/halfbox.py`
 * (class `HalfBox`).
 *
 * Two walls at right angles held by triangular supports: a bookend, a
 * hanging shelf, an angle clamping jig and more.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { ANNOTATIONS } from '../geom/colors';
import { MOUNTING_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { parseSections } from '../params/sections';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface HalfBoxOptions {
  x: number;
  sy: number[];
  h: number;
  clamping: boolean;
  clampingSize: number;
  mounting: boolean;
  sturdy: boolean;
}

class HalfBox extends Boxes {
  private sy: number[];

  constructor(
    private o: HalfBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.sy = [...o.sy];
  }

  /**
   * polygonWall with each leg's corner radius and edge given: groups of
   * length, turn angle, turn radius (without radius correction) and edge.
   */
  private polygonWallExt(borders: Array<number | string>): void {
    for (let i = 0; i < borders.length; i += 4) {
      const length = borders[i] as number;
      const nextAngle = borders[i + 1] as number;
      const nextRadius = borders[i + 2] as number;
      const e = this.getEdge(borders[i + 3] as EdgeSpec);
      if (i === 0) this.moveTo(0, e.margin(), 0);
      e.call(length);
      if (this.debug) this.hole(0, 0, 1, 0, 0, ANNOTATIONS);
      this.corner(nextAngle, nextRadius, 0);
    }
  }

  private xHoles = (): void => {
    let posy = -0.5 * this.thickness;
    for (const y of this.sy.slice(0, -1)) {
      posy += y + this.thickness;
      this.fingerHolesAt(posy, 0, this.o.x);
    }
  };

  private hHoles = (): void => {
    let posy = -0.5 * this.thickness;
    for (const y of this.sy.slice(1).reverse()) {
      posy += y + this.thickness;
      this.fingerHolesAt(posy, 0, this.o.h);
    }
  };

  render(): void {
    const { x, h } = this.o;
    const d = this.o.clampingSize;
    const t = this.thickness;
    const fm = this.getEdge('f').margin();

    // triangle with sides: x (horizontal), h (upwards) and l
    // angles: 90° between x & h
    //           b between h & l
    //           c between l & x
    const l = Math.sqrt(x * x + h * h);
    let b = Math.asin(x / l) / DEG;
    let c = Math.asin(h / l) / DEG;
    if (x > h) {
      if (90 + b + c < 179) b = 180 - b;
    } else if (90 + b + c < 179) {
      c = 180 - c;
    }

    // small triangle top: 2*t, h1, l1
    const h1 = ((2 * t) / x) * h;
    const l1 = ((2 * t) / x) * l;

    // small triangle left: x2, 2*t, l2
    const x2 = ((2 * t) / h) * x;
    const l2 = ((2 * t) / h) * l;

    const support = (i: number, clampHoles: () => void) => {
      const label = `support ${i}`;
      this.move(x + fm, h + fm, 'right', true, label);
      this.polygonWallExt([x, 90, 0, 'f', h, 180 - b, 0, 'f', l, 180 - c, 0, 'e']);
      if (this.o.clamping) clampHoles();
      this.move(x + fm, h + fm, 'right', false, label);
    };

    if (this.o.sturdy) {
      const width = this.sy.reduce((a, v) => a + v, 0) + (this.sy.length - 1) * t;
      this.rectangularWall(x, width, 'fffe', { callback: [null, this.xHoles, null, null], move: 'right', label: 'bottom' });
      this.rectangularWall(h, width, this.o.mounting ? 'fGfF' : 'fefF', {
        callback: [null, null, null, this.hHoles],
        move: 'up',
        label: 'back',
      });
      this.rectangularWall(x, width, 'fffe', { callback: [null, this.xHoles, null, null], move: 'left only', label: 'invisible' });

      for (let i = 0; i < 2; i++) {
        const label = `side ${i}`;
        this.move(x + x2 + 2 * t + fm, h + h1 + 2 * t + fm, 'right', true, label);
        this.polygonWallExt([
          x2, 0, 0, 'e', x, 0, 0, 'h', 2 * t, 90, 0, 'e', 2 * t, 0, 0, 'e', h, 0, 0, 'h',
          h1, 180 - b, 0, 'e', l + l1 + l2, 180 - c, 0, 'e',
        ]);
        if (this.o.clamping) {
          this.hole(0, 0, 1, 0, 0, ANNOTATIONS);
          this.rectangularHole(x / 2 + x2, 2 * t + d / 2, d, d, d / 8);
          this.rectangularHole(x + x2 + 2 * t - 2 * t - d / 2, h / 2 + 2 * t, d, d, d / 8);
        }
        this.move(x + x2 + 2 * t + fm, h + h1 + 2 * t + fm, 'right', false, label);
      }

      for (let i = 0; i < this.sy.length - 1; i++) {
        support(i, () => {
          this.rectangularHole(x / 2, d / 2 - t / 2, d, d + t, d / 8);
          this.rectangularHole(x - d / 2 + t / 2, h / 2, d + t, d, d / 8);
        });
      }
    } else {
      // Without sides, the outermost supports stand at the very edges.
      this.sy = [0, ...this.sy, 0];
      const width = this.sy.reduce((a, v) => a + v, 0) + (this.sy.length - 1) * t;
      this.rectangularWall(x, width, 'efee', { callback: [null, this.xHoles, null, null], move: 'right', label: 'bottom' });
      this.rectangularWall(h, width, this.o.mounting ? 'eGeF' : 'eeeF', {
        callback: [null, null, null, this.hHoles],
        move: 'up',
        label: 'side',
      });
      this.rectangularWall(x, width, 'efee', { callback: [null, this.xHoles, null, null], move: 'left only', label: 'invisible' });

      for (let i = 0; i < this.sy.length - 1; i++) {
        support(i, () => {
          this.rectangularHole(x / 2, d / 2, d, d, d / 8);
          this.rectangularHole(x - d / 2, h / 2, d, d, d / 8);
        });
      }
    }
  }
}

export const halfBox: GeneratorDef = {
  meta: {
    id: 'halfbox',
    name: 'Half Box',
    group: 'Box',
    summary: 'Two walls at right angles on triangular supports',
    description:
      'Half of a box: a bottom and a back held square by triangular ' +
      'supports. Use it as a bookend, a hanging shelf, an angle clamping ' +
      'jig and more. The sturdy version adds full sides.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Of the bottom.' },
    {
      key: 'sy',
      kind: 'sections',
      label: 'Supports apart',
      default: '50:50',
      group: 'dimensions',
      itemLabel: 'gap',
      help: 'Widths between the supports, left to right.',
    },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Of the back.' },
    {
      key: 'Sturdy',
      kind: 'bool',
      label: 'Sturdy',
      default: false,
      group: 'dimensions',
      help: 'Add full sides, for a shelf or a clamping jig.',
    },
    { key: 'Clamping', kind: 'bool', label: 'Clamping holes', default: false, group: 'dimensions' },
    {
      key: 'ClampingSize',
      kind: 'length',
      label: 'Clamping hole size',
      unit: 'mm',
      default: 25,
      min: 5,
      max: 200,
      step: 1,
      group: 'dimensions',
      showIf: (v) => v['Clamping'] === true,
    },
    { key: 'Mounting', kind: 'bool', label: 'Mounting holes', default: false, group: 'dimensions', help: 'Keyhole slots in the back, to hang it on a wall.' },
    ...MOUNTING_PARAMS.map((spec) => ({ ...spec, showIf: (v: ParamValues) => v['Mounting'] === true })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new HalfBox(
      {
        x: n(v, 'x', 100),
        sy: parseSections(s(v, 'sy', '50:50')),
        h: n(v, 'h', 100),
        clamping: b(v, 'Clamping', false),
        clampingSize: n(v, 'ClampingSize', 25),
        mounting: b(v, 'Mounting', false),
        sturdy: b(v, 'Sturdy', false),
      },
      config,
    ),
};
