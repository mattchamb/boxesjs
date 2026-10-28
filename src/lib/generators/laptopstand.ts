/**
 * Laptop stand — ported from boxes.py `boxes/generators/laptopstand.py`
 * (class `LaptopStand`).
 *
 * Two triangular sides that slot together into an X, holding a laptop at a
 * chosen tilt with a nub at the front to stop it sliding off.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface LaptopStandOptions {
  lDepth: number;
  lThickness: number;
  angle: number;
  groundOffset: number;
  nubSize: number;
}

interface Calcs {
  height: number;
  base: number;
  hyp: number;
  /** The sides' own slope, in degrees: shallower than the laptop's, as they cross at 45°. */
  angle: number;
  baseExtra: number;
  lipOuter: number;
  bottomSlotDepth: number;
  topSlotDepthSmall: number;
  topSlotDepthBig: number;
  halfHyp: number;
}

class LaptopStand extends Boxes {
  constructor(
    private o: LaptopStandOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private performCalculations(): Calcs {
    const { lDepth, nubSize, groundOffset, lThickness } = this.o;
    const t = this.thickness;
    const a = this.o.angle * DEG;

    const height = lDepth * Math.sin(a);
    const base = Math.SQRT2 * lDepth * Math.cos(a);
    const hyp = lDepth * Math.sqrt(Math.cos(a) ** 2 + 1);
    const b = Math.atan(Math.tan(a) / Math.SQRT2);
    const baseExtra = (1 / Math.cos(b)) * (nubSize - groundOffset * Math.sin(b));
    const lipOuter = groundOffset / Math.cos(b) + lThickness - nubSize * Math.tan(b);

    return {
      height,
      base,
      hyp,
      angle: b / DEG,
      baseExtra,
      lipOuter,
      bottomSlotDepth: height / 4 + groundOffset / 2,
      topSlotDepthBig: height / 4 + groundOffset / 2 + (t * height) / (2 * base),
      topSlotDepthSmall: height / 4 + groundOffset / 2 - (t * height) / (2 * base),
      halfHyp: (hyp * (base - t)) / (2 * base),
    };
  }

  private laptopstandTriangles(calcs: Calcs, move?: string): void {
    const { groundOffset } = this.o;
    const lean = Math.sin(calcs.angle * DEG) * (calcs.lipOuter + 1);
    const tw = calcs.base + this.spacing + 2 * (calcs.baseExtra + lean);
    const th = calcs.height + 2 * groundOffset + this.spacing;

    if (this.move(tw, th, move, true)) return;
    this.moveTo(calcs.baseExtra + this.spacing + lean);
    this.drawTriangle(calcs, false);
    this.moveTo(calcs.base - this.spacing, th, 180);
    this.drawTriangle(calcs, true);

    // boxes.py gives the pair no label.
    this.ctx.nameCurrentPart('sides');
    this.move(tw, th, move);
  }

  private drawTriangle(calcs: Calcs, top: boolean): void {
    this.withRestore(() => {
      const { groundOffset, nubSize, lThickness } = this.o;
      const t = this.thickness;

      // Rear end
      this.moveTo(0, calcs.height + groundOffset, -90);

      this.edge(calcs.height + groundOffset);
      this.corner(90);

      const footLength = 10 + nubSize;
      // -7 for the width the 45° steps up to and down from the feet take.
      const baseLengthWithoutFeet = calcs.base - footLength * 2 - 7;

      if (top) {
        this.polyline(footLength, 45, 5, -45, baseLengthWithoutFeet, -45, 5, 45, footLength + calcs.baseExtra, 0);
      } else {
        // The slot the other side's top slides down into.
        this.polyline(
          footLength, 45,
          5, -45,
          (baseLengthWithoutFeet - t) / 2, 90,
          calcs.bottomSlotDepth - 3.5, -90,
          t, -90,
          calcs.bottomSlotDepth - 3.5, 90,
          (baseLengthWithoutFeet - t) / 2, -45,
          5, 45,
          footLength + calcs.baseExtra, 0,
        );
      }

      // End nub
      this.corner(90 - calcs.angle);
      this.edge(calcs.lipOuter);
      this.corner(90, 1);
      this.edge(nubSize - 2);
      this.corner(90, 1);
      this.edge(lThickness);
      this.corner(-90);

      if (top) {
        this.edge(calcs.halfHyp);
        this.corner(90 + calcs.angle);
        this.edge(calcs.topSlotDepthSmall);
        this.corner(-90);
        this.edge(t);
        this.corner(-90);
        this.edge(calcs.topSlotDepthBig);
        this.corner(90 - calcs.angle);
        this.edge(calcs.halfHyp);
      } else {
        this.edge(calcs.hyp);
      }

      this.corner(90 + calcs.angle);
    });
  }

  render(): void {
    this.laptopstandTriangles(this.performCalculations(), 'up');
  }
}

export const laptopStand: GeneratorDef = {
  meta: {
    id: 'laptopstand',
    name: 'Laptop Stand',
    group: 'Misc',
    summary: 'X-shaped stand that tilts a laptop',
    description:
      'Two triangular sides slot together into an X and hold a laptop at a ' +
      'chosen tilt, with a nub at the front so it cannot slide off.',
  },
  params: [
    { key: 'l_depth', kind: 'length', label: 'Laptop depth', unit: 'mm', default: 250, min: 100, max: 600, step: 1, group: 'dimensions', help: 'Front to back.' },
    { key: 'l_thickness', kind: 'length', label: 'Laptop thickness', unit: 'mm', default: 10, min: 3, max: 60, step: 0.5, group: 'dimensions', help: 'At the front, where the nub holds it.' },
    { key: 'angle', kind: 'number', label: 'Tilt', unit: '°', default: 15, min: 3, max: 40, step: 1, group: 'dimensions', help: 'Of the keyboard.' },
    { key: 'ground_offset', kind: 'length', label: 'Ground clearance', unit: 'mm', default: 10, min: 0, max: 100, step: 1, group: 'dimensions', help: 'Under the laptop at the front.' },
    { key: 'nub_size', kind: 'length', label: 'Nub size', unit: 'mm', default: 10, min: 3, max: 50, step: 1, group: 'dimensions', help: 'Thickness of the front lip.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new LaptopStand(
      {
        lDepth: n(v, 'l_depth', 250),
        lThickness: n(v, 'l_thickness', 10),
        angle: n(v, 'angle', 15),
        groundOffset: n(v, 'ground_offset', 10),
        nubSize: n(v, 'nub_size', 10),
      },
      config,
    ),
};
