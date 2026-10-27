/**
 * Pizza shovel — ported from boxes.py `boxes/generators/pizzashovel.py`
 * (class `PizzaShovel`).
 *
 * A pizza peel with a conveyor: baking paper wrapped round the blade and
 * fixed to a pusher on the handle, so sliding the handle sets the pizza down.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { HANDLE_EDGE_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

interface PizzaShovelOptions {
  x: number;
  y: number;
  gripLength: number;
  gripHeight: number;
  topHoles: number;
  bottomHoles: number;
  gripHoles: number;
}

class PizzaShovel extends Boxes {
  constructor(
    private o: PizzaShovelOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private holesCB(d: number) {
    return (): void => {
      for (let i = 0; i < 5; i++) this.hole(((this.o.x - 3) / 5) * (i + 0.5), 20, 0, d);
    };
  }

  private gripCB(top: boolean) {
    return (): void => {
      const t = this.thickness;
      if (this.o.gripLength) {
        for (const d of [-t, +t]) this.fingerHolesAt(this.o.x / 2 + d, 0, 40, 90);
      } else {
        for (const y of top ? [10, 30] : [15, 35, 60]) this.hole(this.o.x / 2, y, 0, this.o.gripHoles);
      }
    };
  }

  render(): void {
    const { x, y } = this.o;
    const h = this.o.gripHeight;
    const grip = this.o.gripLength;
    const t = this.thickness;

    const ce = this.makeCompoundEdge(['f', 'e'], [y / 2, y / 2]);
    const ec = this.makeCompoundEdge(['e', 'f'], [y / 2, y / 2]);

    this.rectangularWall(x, y, ['e', ce, 'e', ec], { move: 'up', label: 'blade' });
    this.rectangularWall(x, 40, 'efef', { callback: [this.gripCB(true)], move: 'up', label: 'top beam' });
    this.rectangularWall(x, 80, 'efef', { callback: [this.gripCB(false)], move: 'up', label: 'bottom beam' });
    for (let i = 0; i < 2; i++) {
      let a = Math.atan((h + 2 * t) / (y / 2 - 30));
      const l = (y / 2 - 30) / Math.cos(a);
      a = (a * 180) / Math.PI;
      this.polygonWall([y / 2 + 40, [90, t], h + 2 * t, [90, t], 70, a, l, -a, 0, [180, t]], {
        edge: 'e',
        callback: [
          () => {
            this.fingerHolesAt(0, 1.5 * t, y / 2, 0);
            this.fingerHolesAt(y / 2 + t, 1.5 * t, 40, 0);
          },
          null,
          () => this.fingerHolesAt(-t, 1.5 * t, 80, 0),
        ],
        move: 'up',
        label: `side ${i + 1}`,
      });
    }

    this.rectangularWall(x - 3, 40, 'eeee', { callback: [this.holesCB(this.o.bottomHoles)], move: 'up', label: 'pusher bottom' });
    this.rectangularWall(x - 3, 40, 'yeee', { callback: [this.holesCB(this.o.topHoles)], move: 'up', label: 'pusher top' });

    if (grip) {
      const ce1 = this.makeCompoundEdge(['f', 'e'], [40, grip - h / 2]);
      const ce2 = this.makeCompoundEdge(['e', 'f'], [grip - h / 2, 40]);
      const outer = { flanges: [0, h / 2], r: h / 2, move: 'up' };
      const inner = { flanges: [0, h / 2 - t], r: h / 2 - t, move: 'up' };
      this.flangedWall(40 + grip - h / 2, h, [ce1, 'e', ce2, 'e'], { ...outer, label: 'grip side' });
      this.flangedWall(40 + grip - h / 2, h, 'eeee', { ...outer, label: 'grip middle' });
      this.flangedWall(40 + grip - h / 2, h, [ce1, 'e', ce2, 'e'], { ...outer, label: 'grip side' });
      this.flangedWall(30 + grip - h / 2, h - 2 * t, 'eeee', { ...inner, label: 'grip cover' });
      this.flangedWall(30 + grip - h / 2, h - 2 * t, 'eeee', { ...inner, label: 'grip cover' });
    }
  }
}

export const pizzaShovel: GeneratorDef = {
  meta: {
    id: 'pizzashovel',
    name: 'Pizza Shovel',
    group: 'Misc',
    summary: 'Pizza peel with a conveyor belt of baking paper',
    description:
      'Wrap (permanent) baking paper round the blade and fix it to the ' +
      'pusher on the handle. Sliding the handle runs the paper round the ' +
      'blade, to pick a pizza up or set it down.',
  },
  // boxes.py's own defaults: a tall handle edge, flush, with three holes.
  paramDefaults: { he_outset: 0, he_height: 40, he_hole_width: '30:30:30' },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 382, min: 100, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Length', unit: 'mm', default: 400, min: 100, max: 1000, step: 1, group: 'dimensions', help: 'Of the blade.' },
    { key: 'grip_length', kind: 'length', label: 'Grip length', unit: 'mm', default: 250, min: 0, max: 1000, step: 1, group: 'dimensions', help: '0 leaves holes for a screw-in handle instead.' },
    { key: 'grip_height', kind: 'length', label: 'Grip height', unit: 'mm', default: 30, min: 10, max: 100, step: 1, group: 'dimensions', help: 'Between the cross beams.' },
    { key: 'top_holes', kind: 'length', label: 'Pusher top screw holes', unit: 'mm', default: 3, min: 0.5, max: 10, step: 0.1, group: 'dimensions', help: 'Diameter, where the screws pass through.' },
    { key: 'bottom_holes', kind: 'length', label: 'Pusher bottom screw holes', unit: 'mm', default: 2, min: 0.5, max: 10, step: 0.1, group: 'dimensions', help: 'Diameter, where the screws hold.' },
    {
      key: 'grip_holes',
      kind: 'length',
      label: 'Handle screw holes',
      unit: 'mm',
      default: 3,
      min: 0.5,
      max: 10,
      step: 0.1,
      group: 'dimensions',
      showIf: (v) => v['grip_length'] === 0,
    },
    ...HANDLE_EDGE_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new PizzaShovel(
      {
        x: n(v, 'x', 382),
        y: n(v, 'y', 400),
        gripLength: n(v, 'grip_length', 250),
        gripHeight: n(v, 'grip_height', 30),
        topHoles: n(v, 'top_holes', 3),
        bottomHoles: n(v, 'bottom_holes', 2),
        gripHoles: n(v, 'grip_holes', 3),
      },
      config,
    ),
};
