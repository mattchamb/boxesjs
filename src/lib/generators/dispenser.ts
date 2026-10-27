/**
 * Dispenser — ported from boxes.py `boxes/generators/dispenser.py`
 * (class `Dispenser`).
 *
 * A dispenser for a stack of flat things of one size: a tall box with a
 * slot at the bottom of the front to slide the lowest one out, and a
 * viewing slot up the front.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { BaseEdge } from '../edges/base';
import { STACKABLE_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

/**
 * The floor's front, cut back so you can get your fingers round the bottom
 * item. boxes.py hands the generator itself to this edge as its settings;
 * here it holds the generator directly.
 */
class FrontEdge extends BaseEdge {
  constructor(private dispenser: Dispenser) {
    super(dispenser, null);
  }

  call(length: number): void {
    const depth = (this.dispenser.y * 2) / 3;
    const t = this.thickness;
    const r = Math.min(depth - t, length / 4);
    this.edge(length / 4 - t, 2);
    this.corner(90, t);
    this.edge(depth - t - r, 2);
    this.corner(-90, r);
    this.edge(length / 2 - 2 * r);
    this.corner(-90, r);
    this.edge(depth - t - r, 2);
    this.corner(90, t);
    this.edge(length / 4 - t, 2);
  }
}

interface DispenserOptions {
  x: number;
  y: number;
  h: number;
  slotheight: number;
  viewingwidth: number;
  bottomheight: number;
  sideedges: string;
}

class Dispenser extends Boxes {
  readonly y: number;

  constructor(
    private o: DispenserOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.y = o.y;
  }

  render(): void {
    const { x, y, h, slotheight: hs } = this.o;
    const t = this.thickness;

    const se = this.o.sideedges;
    const fe = new FrontEdge(this);

    const hb = Math.max(0, this.o.bottomheight - this.getEdge('š').spacing());
    const th = h + (hb ? hb + t : 0.0);
    const hh = hb + 0.5 * t;

    this.savedContext(() => {
      this.rectangularWall(x, y, [fe, 'f', 'f', 'f'], { label: 'Floor', move: 'right' });
      this.rectangularWall(x, y, 'eeee', { label: 'Lid bottom', move: 'right' });
      this.rectangularWall(x, y, 'EEEE', { label: 'Lid top', move: 'right' });
    });

    this.rectangularWall(x, y, 'ffff', { move: 'up only' });

    if (hb) {
      const frontedge = this.makeCompoundEdge(['E', 'f'], [hb + t + hs, h - hs]);
      const sideEdges: EdgeSpec[] = ['š', frontedge, 'e', 'f'];
      this.rectangularWall(y, th, sideEdges, {
        ignoreWidths: [6],
        callback: [() => this.fingerHolesAt(0, hh, y, 0)],
        label: 'Left wall',
        move: 'right mirror',
      });
      this.rectangularWall(x, th, ['š', se, 'e', se], {
        ignoreWidths: [1, 6],
        callback: [() => this.fingerHolesAt(0, hh, x, 0)],
        label: 'Back wall',
        move: 'right',
      });
      this.rectangularWall(y, th, sideEdges, {
        ignoreWidths: [6],
        callback: [() => this.fingerHolesAt(0, hh, y, 0)],
        label: 'Right wall',
        move: 'right',
      });
    } else {
      const frontedge = this.makeCompoundEdge(['E', 'f'], [hs, h - hs]);
      const sideEdges: EdgeSpec[] = ['h', frontedge, 'e', 'f'];
      this.rectangularWall(y, th, sideEdges, { label: 'Left wall', ignoreWidths: [6], move: 'right mirror' });
      this.rectangularWall(x, th, ['h', se, 'e', se], { ignoreWidths: [1, 6], label: 'Back wall', move: 'right' });
      this.rectangularWall(y, th, sideEdges, { label: 'Right wall', ignoreWidths: [6], move: 'right' });
    }

    const viewingwidth = Math.max(Math.min(this.o.viewingwidth, 0.9), 0.0);
    if (viewingwidth === 0.0) {
      this.rectangularWall(x, h - hs, 'e' + se + 'e' + se, { label: 'front', move: 'right' });
    } else {
      const w = (x * (1 - viewingwidth)) / 2;
      this.rectangularWall(w, h - hs, 'eee' + se, { label: 'Left front', move: 'right' });
      this.rectangularWall(w, h - hs, 'eee' + se, { label: 'Right front', move: 'mirror right' });
    }
  }
}

export const dispenser: GeneratorDef = {
  meta: {
    id: 'dispenser',
    name: 'Dispenser',
    group: 'Misc',
    summary: 'Dispenser for a stack of flat things of one size',
    description:
      'A tall box with a slot at the bottom of the front to slide the ' +
      'lowest item out, and a viewing slot up the front. With no height ' +
      'underneath it hangs on a wall; add mounting holes yourself.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Inside, of the items.' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Inside, of the items.' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'slotheight', kind: 'length', label: 'Slot height', unit: 'mm', default: 10, min: 1, max: 200, step: 0.5, group: 'dimensions', help: 'Of the dispensing slot: the items’ thickness.' },
    {
      key: 'viewingwidth',
      kind: 'number',
      label: 'Viewing slot width',
      unit: '× width',
      default: 0.333333,
      min: 0,
      max: 0.9,
      step: 0.05,
      group: 'dimensions',
      help: '0 closes the front.',
    },
    { key: 'bottomheight', kind: 'length', label: 'Height underneath', unit: 'mm', default: 0, min: 0, max: 300, step: 1, group: 'dimensions', help: 'Room under the dispenser, on stackable feet. 0 for hanging on a wall.' },
    { key: 'sideedges', kind: 'edge', label: 'Front and back joints', choices: 'Fh', default: 'F', group: 'joints' },
    ...STACKABLE_PARAMS.map((spec) => ({ ...spec, showIf: (v: ParamValues) => v['bottomheight'] !== 0 })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Dispenser(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        slotheight: n(v, 'slotheight', 10),
        viewingwidth: n(v, 'viewingwidth', 0.333333),
        bottomheight: n(v, 'bottomheight', 0),
        sideedges: s(v, 'sideedges', 'F'),
      },
      config,
    ),
};
