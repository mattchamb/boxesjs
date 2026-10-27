/**
 * Electronics box — ported from boxes.py `boxes/generators/electronicsbox.py`
 * (class `ElectronicsBox`).
 *
 * A closed box whose top screws onto triangles in the corners, with a
 * bottom that can extend into flanges for screwing it down.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface ElectronicsBoxOptions {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  triangle: number;
  d1: number;
  d2: number;
  d3: number;
  outsidemounts: boolean;
  holedist: number;
}

class ElectronicsBox extends Boxes {
  private x: number;
  private y: number;
  private h: number;

  constructor(
    private o: ElectronicsBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.x = o.x;
    this.y = o.y;
    this.h = o.h;
  }

  private wallxCB = (): void => {
    const t = this.thickness;
    this.fingerHolesAt(0, this.h - 1.5 * t, this.o.triangle, 0);
    this.fingerHolesAt(this.x, this.h - 1.5 * t, this.o.triangle, 180);
  };

  private wallyCB = (): void => {
    const t = this.thickness;
    this.fingerHolesAt(0, this.h - 1.5 * t, this.o.triangle, 0);
    this.fingerHolesAt(this.y, this.h - 1.5 * t, this.o.triangle, 180);
  };

  render(): void {
    const t = this.thickness;
    this.h = this.h + 2 * t; // compensate for lid
    const { d1, d2, d3, holedist: hd, triangle: tr } = this.o;
    const trh = tr / 3;

    if (this.o.outside) {
      this.x = this.adjustSize(this.x);
      this.y = this.adjustSize(this.y);
      this.h = this.h - 3 * t;
    }
    const { x, y, h } = this;

    this.rectangularWall(x, h, 'fFeF', { callback: [this.wallxCB], move: 'right', label: 'Wall 1' });
    this.rectangularWall(y, h, 'ffef', { callback: [this.wallyCB], move: 'up', label: 'Wall 2' });
    this.rectangularWall(y, h, 'ffef', { callback: [this.wallyCB], label: 'Wall 4' });
    this.rectangularWall(x, h, 'fFeF', { callback: [this.wallxCB], move: 'left up', label: 'Wall 3' });

    const mountHole = () => this.hole(hd, hd, 0, d3);
    const mountHoles = [mountHole, mountHole, mountHole, mountHole];
    if (!this.o.outsidemounts) {
      this.rectangularWall(x, y, 'FFFF', { callback: mountHoles, move: 'right', label: 'Bottom' });
    } else {
      this.flangedWall(x, y, 'FFFF', { flanges: [0.0, 2 * hd, 0, 2 * hd], r: hd, callback: mountHoles, move: 'up', label: 'Bottom' });
    }
    const lidHole = () => this.hole(trh, trh, 0, d2);
    this.rectangularWall(x, y, 'eeee', { callback: [lidHole, lidHole, lidHole, lidHole], move: 'up', label: 'Top' });

    this.rectangularTriangle(tr, tr, 'ffe', { num: 4, callback: [null, () => this.hole(trh, trh, 0, d1)], label: 'lid supports' });
  }
}

export const electronicsBox: GeneratorDef = {
  meta: {
    id: 'electronicsbox',
    name: 'Electronics Box',
    group: 'Box',
    summary: 'Closed box with a screw-on top and mounting holes',
    description:
      'The top screws onto triangles glued into the corners. The bottom has ' +
      'mounting holes, on flanges outside the box or within it.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 30, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 30, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 30, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    { key: 'triangle', kind: 'length', label: 'Lid support size', unit: 'mm', default: 25, min: 10, max: 200, step: 1, group: 'top', help: 'Sides of the triangles the top screws onto.' },
    { key: 'd1', kind: 'length', label: 'Support screw holes', unit: 'mm', default: 2, min: 0.5, max: 10, step: 0.1, group: 'top', help: 'Diameter, in the triangles.' },
    { key: 'd2', kind: 'length', label: 'Top screw holes', unit: 'mm', default: 3, min: 0.5, max: 10, step: 0.1, group: 'top', help: 'Diameter, in the top.' },
    { key: 'd3', kind: 'length', label: 'Mounting screw holes', unit: 'mm', default: 3, min: 0.5, max: 15, step: 0.1, group: 'dimensions', help: 'Diameter, in the bottom.' },
    { key: 'outsidemounts', kind: 'bool', label: 'Mounting flanges', default: true, group: 'dimensions', help: 'Put the mounting holes on flanges outside the box.' },
    { key: 'holedist', kind: 'length', label: 'Screw hole inset', unit: 'mm', default: 7, min: 2, max: 50, step: 0.5, group: 'dimensions', help: 'Of the mounting holes from the wall.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new ElectronicsBox(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        triangle: n(v, 'triangle', 25),
        d1: n(v, 'd1', 2),
        d2: n(v, 'd2', 3),
        d3: n(v, 'd3', 3),
        outsidemounts: b(v, 'outsidemounts', true),
        holedist: n(v, 'holedist', 7),
      },
      config,
    ),
};
