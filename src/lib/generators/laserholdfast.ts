/**
 * Laser holdfast — ported from boxes.py `boxes/generators/laserholdfast.py`
 * (class `LaserHoldfast`).
 *
 * A hook that wedges into a honeycomb laser table to hold material down.
 */
import { Boxes, type BoxesConfig, type PolygonBorder } from '../boxes';
import { INNER_CUT } from '../geom/colors';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface LaserHoldfastOptions {
  x: number;
  h: number;
  hookheight: number;
  shaftwidth: number;
  cutlength: number;
  num: number;
}

class LaserHoldfast extends Boxes {
  constructor(
    private o: LaserHoldfastOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const [mx, my] = this.offset();
    for (let i = 0; i < this.o.num; i++) {
      this.renderOne(`holdfast ${i + 1}`);
      this.moveTo(mx, my);
    }
  }

  /** Offset to the next holdfast. */
  private offset(): [number, number] {
    const hh = this.o.hookheight;
    const a = 30;
    const r = this.o.x / (a * DEG);
    const d = r - r * Math.cos((a / 2) * DEG);
    const dd = hh - hh * Math.cos((a / 2) * DEG);
    const mx = hh + d - dd + this.spacing;
    const my = this.o.shaftwidth + this.spacing;
    return [mx, my];
  }

  private renderOne(label: string): void {
    const { x, hookheight: hh, h, shaftwidth: sw } = this.o;

    const a = 30;
    const r = x / (a * DEG);
    const dd = hh - hh * Math.cos((a / 2) * DEG) + this.burn;

    // Hook
    const borders: Array<PolygonBorder | null> = [
      hh + h - dd, [180, sw / 2],
      h, [-90 + a / 2, this.burn],
      0, [-a, r],
      0, [180, hh / 2],
      0, [a, r + hh],
      0, [-a / 2, this.burn],
      sw - Math.sin((a / 2) * DEG) * hh + this.burn / 2, 0,
      null,
    ];
    this.polygonWall(borders, {
      edge: 'e',
      correctCorners: false,
      callback: this.o.cutlength ? this.cutcallback : null,
      label,
    });
  }

  /** A cut down the shaft, if asked for, so it springs. */
  private cutcallback = (num: number): void => {
    if (num === 1) {
      this.ctx.stroke();
      this.savedContext(() => {
        this.setSourceColor(INNER_CUT);
        this.moveTo(-this.o.shaftwidth / 2 - this.burn, this.o.shaftwidth / 2);
        this.edge(this.o.cutlength);
        this.ctx.stroke();
      });
    }
  };
}

export const laserHoldfast: GeneratorDef = {
  meta: {
    id: 'laserholdfast',
    name: 'Laser Holdfast',
    group: 'Misc',
    summary: 'Hook that wedges into a honeycomb table to hold material down',
    description: 'Push the shaft into the honeycomb at an angle and the hook presses the material flat. A cut down the shaft lets it spring.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Reach', unit: 'mm', default: 25, min: 5, max: 200, step: 1, group: 'dimensions', help: 'Length of the curved hook.' },
    { key: 'h', kind: 'length', label: 'Shaft length', unit: 'mm', default: 40, min: 5, max: 300, step: 1, group: 'dimensions' },
    { key: 'hookheight', kind: 'length', label: 'Hook height', unit: 'mm', default: 5, min: 1, max: 50, step: 0.5, group: 'dimensions' },
    { key: 'shaftwidth', kind: 'length', label: 'Shaft width', unit: 'mm', default: 5, min: 1, max: 50, step: 0.5, group: 'dimensions' },
    { key: 'cutlength', kind: 'length', label: 'Cut length', unit: 'mm', default: 0, min: 0, max: 300, step: 1, group: 'dimensions', help: 'Down the shaft. 0 leaves it out.' },
    { key: 'num', kind: 'number', label: 'Number', default: 1, min: 1, max: 50, step: 1, integer: true, group: 'dimensions' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new LaserHoldfast(
      {
        x: n(v, 'x', 25),
        h: n(v, 'h', 40),
        hookheight: n(v, 'hookheight', 5),
        shaftwidth: n(v, 'shaftwidth', 5),
        cutlength: n(v, 'cutlength', 0),
        num: n(v, 'num', 1),
      },
      config,
    ),
};
