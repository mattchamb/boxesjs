/**
 * Disc rack — ported from boxes.py `boxes/generators/discrack.py`
 * (class `DiscRack`).
 *
 * Two grids of slots, one low and one at the back, that hold discs (records,
 * plates, CDs) upright side by side, tilted back between two square sides.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { FingerJointSettings } from '../edges/fingerjoint';
import type { ParamValues } from '../params/schema';
import { parseSections } from '../params/sections';
import { n, s, type GeneratorDef } from './types';

/**
 * From the centre of a square, rotate by `angle` degrees from the vertical,
 * move `outset` away from the centre (down at angle 0), then go at a right
 * angle to the square's border; the length of that last leg.
 */
function offsetRadiusInSquare(squareside: number, angle: number, outset: number): number {
  if (angle <= -90) return offsetRadiusInSquare(squareside, angle + 180, outset);
  if (angle > 90) return offsetRadiusInSquare(squareside, angle - 180, outset);

  angle = (angle / 180) * Math.PI;

  const stepRight = outset * Math.sin(angle);
  const stepDown = outset * Math.cos(angle);

  // boxes.py catches the division by zero at 90 degrees; JavaScript just
  // divides, so check for it.
  const c = Math.cos(angle);
  if (c === 0) return squareside / 2;
  const lenRight = (squareside / 2 - stepRight) / c;

  if (angle === 0) return lenRight;
  if (angle > 0) {
    const lenUp = (squareside / 2 + stepDown) / Math.sin(angle);
    return Math.min(lenUp, lenRight);
  }
  const lenDown = -(squareside / 2 - stepDown) / Math.sin(angle);
  return Math.min(lenDown, lenRight);
}

interface DiscRackOptions {
  sx: number[];
  discDiameter: number;
  discThickness: number;
  lowerFactor: number;
  rearFactor: number;
  discOutset: number;
  angle: number;
}

class DiscRack extends Boxes {
  private lowerFactor: number;
  private rearFactor: number;
  /** Derived sizes; set by calculate(). */
  private outer = 0;
  private lowerHalfslit = 0;
  private rearHalfslit = 0;
  private lowerOutset = 0;
  private rearOutset = 0;
  private lowerSize = 0;
  private rearSize = 0;

  constructor(
    private o: DiscRackOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.lowerFactor = o.lowerFactor;
    this.rearFactor = o.rearFactor;
  }

  /** boxes.py runs this from parseArgs, before render() clamps the factors. */
  private calculate(): string[] {
    const { discDiameter, discOutset, angle } = this.o;
    this.outer = discDiameter + 2 * discOutset;

    const r = discDiameter / 2;

    // distance between radius line and front (or rear) end of the slit
    this.lowerHalfslit = r * Math.sqrt(1 - this.lowerFactor ** 2);
    this.rearHalfslit = r * Math.sqrt(1 - this.rearFactor ** 2);

    {
      const toplim = offsetRadiusInSquare(this.outer, angle, r * this.lowerFactor);
      // With typical positive angles, the lower surface of board will be limiting
      const bottomlim = offsetRadiusInSquare(this.outer, angle, r * this.lowerFactor + this.thickness);
      this.lowerOutset = Math.min(toplim, bottomlim) - this.lowerHalfslit;
    }

    {
      // With typical positive angles, the upper surface of board will be limiting
      const toplim = offsetRadiusInSquare(this.outer, -angle, r * this.rearFactor);
      const bottomlim = offsetRadiusInSquare(this.outer, -angle, r * this.rearFactor + this.thickness);
      this.rearOutset = Math.min(toplim, bottomlim) - this.rearHalfslit;
    }

    // front outset, space to radius, space to rear part, plus nothing as fingers extend out
    this.lowerSize = this.lowerOutset + this.lowerHalfslit + r * this.rearFactor;

    this.rearSize = r * this.lowerFactor + this.rearHalfslit + this.rearOutset;

    return this.warnOnDemand();
  }

  private warnOnDemand(): string[] {
    const warnings: string[] = [];
    const t = this.thickness;

    // Are the discs supported on the outer ends?
    const wordThickness = (length: number) =>
      length > 0 ? `very thin (${length.toPrecision(2)} mm at a thickness of ${t.toPrecision(2)} mm)` : 'absent';

    if (this.rearOutset < t) {
      warnings.push(
        `Rear upper constraint is ${wordThickness(this.rearOutset)}. Consider increasing the disc outset, or move the angle away from 45°.`,
      );
    }

    if (this.lowerOutset < t) {
      warnings.push(
        `Lower front constraint is ${wordThickness(this.lowerOutset)}. Consider increasing the disc outset, or move the angle away from 45°.`,
      );
    }

    // Are the discs supported where the grids meet?
    const r = this.o.discDiameter / 2;
    const innerLowerdistance = r * this.rearFactor - this.lowerHalfslit;
    const innerReardistance = r * this.lowerFactor - this.rearHalfslit;

    if (innerLowerdistance < 0 || innerReardistance < 0) {
      warnings.push('The corner is inside the disc radius, so the discs would not be supported. Increase the grid positions.');
    }

    // Would the finger holes on the rear grid stick out of the bottom edge
    // and make the whole thing wobble?
    const maxSlitlengthplush = offsetRadiusInSquare(this.outer, this.o.angle, r * this.rearFactor + t);
    // boxes.py reads the user's edge width as a multiple of the thickness.
    const edgeWidth = (this.getEdge('f').settings as FingerJointSettings).edge_width;
    const slitlengthplush = this.rearHalfslit + t + edgeWidth;

    if (slitlengthplush > maxSlitlengthplush) {
      warnings.push('The joint would stick out of the lower edge. Consider increasing the disc outset, or move the angle away from 45°.');
    }

    return warnings;
  }

  private sidewallHoles = (): void => {
    const r = this.o.discDiameter / 2;
    const t = this.thickness;

    this.moveTo(this.outer / 2, this.outer / 2, -this.o.angle);
    // can now move down to paint horizontal lower part, or right to paint
    // vertical rear part
    this.savedContext(() => {
      this.moveTo(r * this.rearFactor, -r * this.lowerFactor - t / 2, 90);
      this.fingerHolesAt(0, 0, this.lowerSize);
    });
    this.savedContext(() => {
      this.moveTo(r * this.rearFactor + t / 2, -r * this.lowerFactor, 0);
      this.fingerHolesAt(0, 0, this.rearSize);
    });

    if (this.debug) this.circle(0, 0, r);
  };

  private drawSlits(inset: number, halfslit: number): void {
    let totalX = 0;

    for (const x of this.o.sx) {
      const centerX = totalX + x / 2;

      totalX += x;
      this.rectangularHole(inset, centerX, 2 * halfslit, this.o.discThickness);
      if (this.debug) this.ctx.rectangle(inset - halfslit, centerX - x / 2, 2 * halfslit, x);
    }
  }

  private lowerHoles = (): void => {
    this.drawSlits(this.lowerOutset + this.lowerHalfslit, this.lowerHalfslit);
  };

  private rearHoles = (): void => {
    this.drawSlits((this.o.discDiameter / 2) * this.lowerFactor, this.rearHalfslit);
  };

  render(): void {
    const warnings = this.calculate();
    if (warnings.length) {
      // boxes.py refuses these settings outright.
      for (const w of warnings) this.warn(w, 'disc_outset');
      return;
    }

    const o = this.outer;
    const sumX = this.o.sx.reduce((a, c) => a + c, 0);

    this.lowerFactor = Math.min(this.lowerFactor, 0.99);
    this.rearFactor = Math.min(this.rearFactor, 0.99);

    this.rectangularWall(o, o, 'eeee', { move: 'right', callback: [this.sidewallHoles], label: 'left' });
    this.rectangularWall(o, o, 'eeee', { move: 'right mirror', callback: [this.sidewallHoles], label: 'right' });

    this.rectangularWall(this.lowerSize, sumX, 'fffe', { move: 'right', callback: [this.lowerHoles], label: 'lower grid' });
    this.rectangularWall(this.rearSize, sumX, 'fefh', { move: 'right', callback: [this.rearHoles], label: 'rear grid' });
  }
}

export const discRack: GeneratorDef = {
  meta: {
    id: 'discrack',
    name: 'Disc Rack',
    group: 'Shelf',
    summary: 'Rack holding records, plates or CDs upright side by side',
    description:
      'Two slotted grids, one low at the front and one at the back, hold the ' +
      'discs upright and tilted back between two square sides. Each slot can ' +
      'have its own spacing.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Slot spacing',
      default: '20*10',
      group: 'dimensions',
      itemLabel: 'slot',
      help: 'Space given to each disc, side to side.',
    },
    { key: 'disc_diameter', kind: 'length', label: 'Disc diameter', unit: 'mm', default: 150, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'disc_thickness', kind: 'length', label: 'Disc thickness', unit: 'mm', default: 5, min: 0.5, max: 100, step: 0.5, group: 'dimensions' },
    {
      key: 'disc_outset',
      kind: 'length',
      label: 'Disc outset',
      unit: 'mm',
      default: 3,
      min: 0,
      max: 200,
      step: 0.5,
      group: 'dimensions',
      help: 'Extra space between the discs and the edges of the sides.',
    },
    { key: 'angle', kind: 'number', label: 'Tilt', unit: '°', default: 18, min: -80, max: 80, step: 1, group: 'dimensions', help: 'How far the discs lean back.' },
    {
      key: 'lower_factor',
      kind: 'number',
      label: 'Lower grid position',
      unit: '× radius',
      default: 0.75,
      min: 0.05,
      max: 0.99,
      step: 0.01,
      group: 'advanced',
      help: 'How far below the discs’ centre the lower grid sits.',
    },
    {
      key: 'rear_factor',
      kind: 'number',
      label: 'Rear grid position',
      unit: '× radius',
      default: 0.75,
      min: 0.05,
      max: 0.99,
      step: 0.01,
      group: 'advanced',
      help: 'How far behind the discs’ centre the rear grid sits.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new DiscRack(
      {
        sx: parseSections(s(v, 'sx', '20*10')),
        discDiameter: n(v, 'disc_diameter', 150),
        discThickness: n(v, 'disc_thickness', 5),
        lowerFactor: n(v, 'lower_factor', 0.75),
        rearFactor: n(v, 'rear_factor', 0.75),
        discOutset: n(v, 'disc_outset', 3),
        angle: n(v, 'angle', 18),
      },
      config,
    ),
};
