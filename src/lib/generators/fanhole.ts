/**
 * Fan hole — ported from boxes.py `boxes/generators/fanhole.py`
 * (class `FanHole`).
 *
 * The hole pattern for mounting a fan: four screw holes round a plain hole
 * or a swirl of blades.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

type Style = 'CW Swirl' | 'CCW Swirl' | 'Hole';

interface FanHoleOptions {
  diameter: number;
  mountingHoles: number;
  mountingHolesInset: number;
  arms: number;
  innerDisc: number;
  style: Style;
}

class FanHole extends Boxes {
  constructor(
    private o: FanHoleOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private arc(d: number, a: number): void {
    const r = Math.abs((1 / Math.cos((90 - a / 2) * DEG)) * d / 2);
    this.corner(-a / 2);
    this.corner(a, r);
    this.corner(-a / 2);
  }

  private swirl(r: number, riRel = 0.1, n = 20): void {
    const ri = riRel * r;

    const ai = 90;
    const ao = (360 / n) * 0.8;
    // angle going in
    const a1 = Math.atan((ri * Math.sin(ai * DEG)) / (r - ri * Math.cos(ai * DEG))) / DEG;
    // boxes.py squares only the sine here, not ri times it.
    const d1 = (ri * Math.sin(ai * DEG) ** 2 + (r - ri * Math.cos(ai * DEG)) ** 2) ** 0.5;
    const d2 = (ri * Math.sin((ai - ao) * DEG) ** 2 + (r - ri * Math.cos((ai - ao) * DEG)) ** 2) ** 0.5;

    // angle coming out
    const aI2 =
      Math.atan((r * Math.sin(ao * DEG) - ri * Math.sin(ai * DEG)) / (r * Math.cos(ao * DEG) - ri * Math.cos(ai * DEG))) / DEG;
    const a3 = a1 + aI2;
    const a2 = 90 + aI2 - ao;

    this.moveTo(0, -r, 180);

    for (let i = 0; i < n; i++) {
      this.savedContext(() => {
        this.corner(-ao, r);
        this.corner(-a2);
        this.arc(d2, -90);
        this.corner(-180 + a3);
        this.arc(d1, 85);
        this.corner(-90 - a1);
      });

      this.moveArc(-360 / n, r);
    }
  }

  render(): void {
    const rH = this.o.mountingHoles / 2;
    const d = this.o.diameter;
    const inset = this.o.mountingHolesInset;

    for (const px of [inset, d - inset]) {
      for (const py of [inset, d - inset]) {
        this.hole(px, py, rH);
      }
    }
    this.moveTo(d / 2, d / 2);

    if (this.o.style === 'CW Swirl') {
      this.ctx.scale(-1, 1);
      this.swirl(d / 2, this.o.innerDisc, this.o.arms);
    } else if (this.o.style === 'CCW Swirl') {
      this.swirl(d / 2, this.o.innerDisc, this.o.arms);
    } else {
      this.hole(0, 0, 0, d);
    }
    // boxes.py draws the pattern without a move, so it has no name of its own.
    this.ctx.nameCurrentPart('fan hole');
  }
}

export const fanHole: GeneratorDef = {
  meta: {
    id: 'fanhole',
    name: 'Fan Hole',
    group: 'Misc',
    summary: 'Hole pattern for mounting a fan',
    description: 'Four mounting holes round a plain hole or a swirl of blades, to copy into another design.',
  },
  params: [
    { key: 'diameter', kind: 'length', label: 'Fan size', unit: 'mm', default: 80, min: 10, max: 500, step: 1, group: 'dimensions' },
    { key: 'mounting_holes', kind: 'length', label: 'Mounting hole diameter', unit: 'mm', default: 3, min: 0.5, max: 20, step: 0.1, group: 'dimensions' },
    { key: 'mounting_holes_inset', kind: 'length', label: 'Mounting hole inset', unit: 'mm', default: 5, min: 1, max: 50, step: 0.5, group: 'dimensions', help: 'From the outside of the fan.' },
    {
      key: 'style',
      kind: 'enum',
      label: 'Style',
      default: 'CW Swirl',
      choices: [
        { value: 'CW Swirl', label: 'Clockwise swirl' },
        { value: 'CCW Swirl', label: 'Anticlockwise swirl' },
        { value: 'Hole', label: 'Plain hole' },
      ],
      group: 'dimensions',
    },
    { key: 'arms', kind: 'number', label: 'Blades', default: 10, min: 3, max: 50, step: 1, integer: true, group: 'dimensions', showIf: (v) => v['style'] !== 'Hole' },
    {
      key: 'inner_disc',
      kind: 'number',
      label: 'Hub size',
      unit: '× radius',
      default: 0.2,
      min: 0.05,
      max: 0.8,
      step: 0.05,
      group: 'dimensions',
      showIf: (v) => v['style'] !== 'Hole',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new FanHole(
      {
        diameter: n(v, 'diameter', 80),
        mountingHoles: n(v, 'mounting_holes', 3),
        mountingHolesInset: n(v, 'mounting_holes_inset', 5),
        arms: n(v, 'arms', 10),
        innerDisc: n(v, 'inner_disc', 0.2),
        style: s(v, 'style', 'CW Swirl') as Style,
      },
      config,
    ),
};
