/**
 * Rack box — ported from boxes.py `boxes/generators/rackbox.py`
 * (class `RackBox`).
 *
 * A closed box whose top screws onto triangles in the corners, with a front
 * panel extended into ears for mounting in a rack.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface RackBoxOptions {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  triangle: number;
  d1: number;
  d2: number;
  d3: number;
  holedist: number;
}

class RackBox extends Boxes {
  private x: number;
  private y: number;
  private h: number;

  constructor(
    private o: RackBoxOptions,
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

  /** The front, with the rack's screw holes in its ears. */
  private wallxfCB = (): void => {
    const t = this.thickness;
    const hd = this.o.holedist;
    for (const x of [hd, this.x + 3 * hd + 2 * t]) {
      for (const y of [hd, this.h - hd + t]) {
        this.hole(x, y, this.o.d3 / 2);
      }
    }

    this.moveTo(t + 2 * hd, t);
    this.wallxCB();
  };

  private wallyCB = (): void => {
    const t = this.thickness;
    this.fingerHolesAt(0, this.h - 1.5 * t, this.o.triangle, 0);
    this.fingerHolesAt(this.y, this.h - 1.5 * t, this.o.triangle, 180);
  };

  render(): void {
    const t = this.thickness;
    const { d1, d2, holedist: hd, triangle: tr } = this.o;
    const trh = tr / 3;

    if (this.o.outside) {
      this.x = this.adjustSize(this.x);
      this.y = this.adjustSize(this.y);
      this.h = this.h - 1 * t;
    } else {
      this.h = this.h + 2 * t; // compensate for lid
    }
    const { x, y, h } = this;

    this.rectangularWall(x, h, 'fFeF', { callback: [this.wallxCB], move: 'right', label: 'back' });
    this.rectangularWall(y, h, 'ffef', { callback: [this.wallyCB], move: 'up', label: 'right' });
    this.flangedWall(x, h, 'FFeF', { callback: [this.wallxfCB], r: t, flanges: [0, 2 * hd, 0, 2 * hd], label: 'front' });
    this.rectangularWall(y, h, 'ffef', { callback: [this.wallyCB], move: 'left up', label: 'left' });

    this.rectangularWall(x, y, 'fFFF', { move: 'right', label: 'bottom' });
    const lidHole = () => this.hole(trh, trh, 0, d2);
    this.rectangularWall(x, y, 'eeee', { callback: [lidHole, lidHole, lidHole, lidHole], move: 'up', label: 'top' });

    this.rectangularTriangle(tr, tr, 'ffe', { num: 4, callback: [null, () => this.hole(trh, trh, 0, d1)], label: 'lid supports' });
  }
}

export const rackBox: GeneratorDef = {
  meta: {
    id: 'rackbox',
    name: 'Rack Box',
    group: 'Box',
    summary: 'Closed box with a screw-on top and rack-mounting ears',
    description:
      'The top screws onto triangles glued into the corners, and the front ' +
      'extends into ears with holes for mounting in a rack.',
  },
  // boxes.py's own default: a smaller edge margin.
  paramDefaults: { fj_surroundingspaces: 1.2 },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 30, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 30, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 30, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    { key: 'triangle', kind: 'length', label: 'Lid support size', unit: 'mm', default: 25, min: 10, max: 200, step: 1, group: 'top', help: 'Sides of the triangles the top screws onto.' },
    { key: 'd1', kind: 'length', label: 'Support screw holes', unit: 'mm', default: 2, min: 0.5, max: 10, step: 0.1, group: 'top', help: 'Diameter, in the triangles.' },
    { key: 'd2', kind: 'length', label: 'Top screw holes', unit: 'mm', default: 3, min: 0.5, max: 10, step: 0.1, group: 'top', help: 'Diameter, in the top.' },
    { key: 'd3', kind: 'length', label: 'Rack screw holes', unit: 'mm', default: 4, min: 0.5, max: 15, step: 0.1, group: 'dimensions', help: 'Diameter, in the ears.' },
    { key: 'holedist', kind: 'length', label: 'Screw hole inset', unit: 'mm', default: 7, min: 2, max: 50, step: 0.5, group: 'dimensions', help: 'Of the screw holes from the wall.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new RackBox(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        triangle: n(v, 'triangle', 25),
        d1: n(v, 'd1', 2),
        d2: n(v, 'd2', 3),
        d3: n(v, 'd3', 4),
        holedist: n(v, 'holedist', 7),
      },
      config,
    ),
};
