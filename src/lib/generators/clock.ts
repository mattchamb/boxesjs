/**
 * Clock — ported from boxes.py `boxes/generators/clock.py` (class `Clock`).
 *
 * A round clock face for a quartz clock mechanism mounted behind it, with a
 * front ring, two front legs and a back leg held by two support plates.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { ETCHING } from '../geom/colors';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

/** Angle of the front feet from the vertical. */
const Af = Math.PI / 6;
/** Angles of the bottom and top back leg supports from the vertical. */
const Ab = Math.PI / 6;
const At = Math.PI / 3;

type NumberStyle = 'None' | 'Arabic' | 'Roman';

interface ClockOptions {
  clockHandsMaxLength: number;
  externalRadius: number;
  backLegDistance: number;
  margin: number;
  needlesAxisHoleDiameter: number;
  hourLines: number;
  minuteLines: number;
  numberStyle: NumberStyle;
  fontSize: number;
}

class Clock extends Boxes {
  constructor(
    private o: ClockOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /** Radii: outside, inside the ring, and halfway between, where the legs fix. */
  private get radii(): { Re: number; Ri: number; Rm: number } {
    const Re = this.o.externalRadius;
    const Ri = this.o.clockHandsMaxLength + this.o.margin;
    return { Re, Ri, Rm: (Re + Ri) / 2 };
  }

  /** Only 1 to 12 are ever asked for. */
  private roman(i: number): string {
    let r: string;
    if (i > 8) {
      r = 'X';
      i -= 10;
    } else if (i > 3) {
      r = 'V';
      i -= 5;
    } else {
      r = '';
    }

    if (i >= 0) r += 'I'.repeat(i);
    else r = 'I'.repeat(-i) + r;
    return r;
  }

  private mainPlate(move: string, label: string): void {
    const t = this.thickness;
    const { Re, Ri, Rm } = this.radii;
    const o = this.o;
    if (this.move(Re * 2, Re * 2, move, true)) return;

    // Holes for the back leg supports.
    this.rectangularHole(Re - Rm * Math.sin(Ab), Re - Rm * Math.cos(Ab), t - this.burn, t - this.burn);
    this.rectangularHole(Re + Rm * Math.sin(Ab), Re - Rm * Math.cos(Ab), t - this.burn, t - this.burn);
    this.rectangularHole(Re - Rm * Math.sin(At), Re - Rm * Math.cos(At), t - this.burn, t - this.burn);
    // boxes.py has `+ burn` in this one's width, unlike the other three.
    this.rectangularHole(Re + Rm * Math.sin(At), Re - Rm * Math.cos(At), t + this.burn, t - this.burn);

    this.hole(Re, Re, 0, o.needlesAxisHoleDiameter);

    this.circle(Re, Re, Re);

    this.setSourceColor(ETCHING);
    this.circle(Re, Re, Ri);

    this.moveTo(Re, Re);
    const fontsize = o.fontSize * Ri;
    for (let i = 0; i < 60; i++) {
      this.savedContext(() => {
        this.moveTo(0, 0, (i * 360) / 60);
        this.moveTo(Ri, 0, 180);
        this.setSourceColor(ETCHING);
        if (i % 5) {
          this.edge(o.minuteLines * Ri);
        } else {
          this.edge(o.hourLines * Ri);
          if (o.numberStyle !== 'None') {
            this.moveTo(fontsize * 0.7, 0, -i * 6 - 180);
            const nr = (Math.trunc(14 - i / 5) % 12) + 1;
            const text = o.numberStyle === 'Roman' ? this.roman(nr) : String(nr);
            this.text(text, 0, -0.1 * fontsize, 0, 'middle center', fontsize, ETCHING);
          }
        }
      });
    }
    this.ctx.stroke();
    this.move(Re * 2, Re * 2, move, false, label);
  }

  private frontRing(move: string, label: string): void {
    const { Re, Ri } = this.radii;
    if (this.move(Re * 2, Re * 2, move, true)) return;
    this.hole(Re, Re, Ri);
    this.circle(Re, Re, Re);
    this.move(Re * 2, Re * 2, move, false, label);
  }

  private frontLegs(move: string, label: string): void {
    const t = this.thickness;
    const { Re, Ri, Rm } = this.radii;
    // Foot thickness
    const Tf = (Re - Ri) / 2;
    const Afd = Af / DEG;
    const tw = Tf * 4 + (Rm * (1 - Math.cos(Af))) / Math.sin(Af) + Rm * 2 * Math.sin(Ab) - t * 3;
    const th = Tf * 2 + Rm * (1 - Math.cos(Af)) + t * 2 + Rm * (Math.cos(Ab) - Math.cos(At));
    if (this.move(tw, th, move, true)) return;

    const foot = Tf + (Rm * (1 - Math.cos(Af))) / Math.cos(Af);
    const rise = t + Rm * (Math.cos(Ab) - Math.cos(At));
    this.moveTo(Tf, 0);
    this.polyline(
      Tf * 2, [90 - Afd, Tf / 2],
      foot, -90 + Afd,
      Rm * 2 * Math.sin(Ab) - t - Tf * 2, -90 + Afd,
      foot, [90 - Afd, Tf / 2],
      Tf * 2, [180, Tf / 2],
      Tf, [-90 + Afd, Tf / 2],
      foot, 90 - Afd,
      t, -90,
      rise, 90,
      Rm * 2 * Math.sin(Ab) - t * 3, 90,
      rise, -90,
      t, 90 - Afd,
      foot, [-90 + Afd, Tf / 2],
      Tf, [180, Tf / 2],
    );

    this.move(tw, th, move, false, label);
  }

  private backLeg(move: string, label: string): void {
    const t = this.thickness;
    const { Re, Ri, Rm } = this.radii;
    const Tf = (Re - Ri) / 2;
    const span = Rm * (Math.cos(Ab) - Math.cos(At));
    const tw = t * 2 + Tf * 3 + Rm * (1 - Math.cos(Af)) + span;
    const th = t * 2;
    if (this.move(tw, th, move, true)) return;

    this.polyline(
      t, 90 + this.burn / 2,
      t, -90,
      t - this.burn, -90,
      t, 90,
      span - t + this.burn, 90,
      t, -90,
      t - this.burn, -90,
      t, 90,
      Tf * 2 - t + Rm * (1 - Math.cos(Af)) + this.burn / 2, [180, t],
      t * 2 + Tf * 2 - t + Rm * (1 - Math.cos(Af)) + span, 90,
      t * 2, 90,
    );

    this.move(tw, th, move, false, label);
  }

  private legsSupport(width: number, move: string, label: string): void {
    const t = this.thickness;
    const h = this.o.backLegDistance;
    const Rc = Math.min(width / 2, h - t * 2);
    if (this.move(width + t, h + t * 3, move, true)) return;

    this.polyline(
      t, 90, t, -90, t, 90, t, -90,
      width - t * 3, -90,
      t, 90, t, -90, t, 90, t, 90,
      h + t * 2 - Rc, [90, Rc],
      width / 2 + this.burn / 2 - Rc, 90,
      t, -90,
      t - this.burn, -90,
      t, 90,
      width / 2 + this.burn / 2 - Rc, [90, Rc],
      h + t * 2 - Rc, 90,
    );

    this.move(width + t, h + t * 3, move, false, label);
  }

  render(): void {
    const { Rm } = this.radii;

    this.mainPlate('up', 'main plate');
    this.frontRing('up', 'front ring');
    this.frontLegs('up', 'front legs');
    this.backLeg('up', 'back leg');
    this.legsSupport(Rm * 2 * Math.sin(At), 'up', 'top leg support');
    this.legsSupport(Rm * 2 * Math.sin(Ab), 'up', 'bottom leg support');
  }
}

export const clock: GeneratorDef = {
  meta: {
    id: 'clock',
    name: 'Clock',
    group: 'Misc',
    summary: 'Round clock face on three legs, for a quartz movement',
    description:
      'A clock face with an etched dial and hour numbers, a front ring, and ' +
      'three legs. Mount a standard clock movement behind it, its spindle ' +
      'through the centre hole.',
  },
  params: [
    { key: 'ExternalRadius', kind: 'length', label: 'Outside radius', unit: 'mm', default: 100, min: 30, max: 500, step: 1, group: 'dimensions' },
    { key: 'ClockHandsMaxLength', kind: 'length', label: 'Longest hand', unit: 'mm', default: 70, min: 10, max: 450, step: 1, group: 'dimensions', help: 'From the centre. Keep it well inside the outside radius, which the ring and legs need.' },
    { key: 'Margin', kind: 'length', label: 'Hand clearance', unit: 'mm', default: 2, min: 0, max: 50, step: 0.5, group: 'dimensions', help: 'Between the longest hand and the ring.' },
    { key: 'BackLegDistance', kind: 'length', label: 'Back leg distance', unit: 'mm', default: 50, min: 10, max: 300, step: 1, group: 'dimensions', help: 'From the face to the back leg.' },
    { key: 'NeedlesAxisHoleDiameter', kind: 'length', label: 'Spindle hole', unit: 'mm', default: 8, min: 1, max: 30, step: 0.5, group: 'dimensions', help: 'Diameter, for the movement’s hand spindle.' },
    {
      key: 'NumberStyle',
      kind: 'enum',
      label: 'Hour numbers',
      default: 'Roman',
      choices: [
        { value: 'None', label: 'None' },
        { value: 'Arabic', label: 'Arabic' },
        { value: 'Roman', label: 'Roman' },
      ],
      group: 'dimensions',
    },
    { key: 'FontSize', kind: 'number', label: 'Number size', unit: '× radius', default: 0.12, min: 0.02, max: 0.3, step: 0.01, group: 'advanced', help: 'Height of the numbers, as a fraction of the dial’s radius.' },
    { key: 'HourLines', kind: 'number', label: 'Hour mark length', unit: '× radius', default: 0.08, min: 0, max: 0.3, step: 0.01, group: 'advanced' },
    { key: 'MinuteLines', kind: 'number', label: 'Minute mark length', unit: '× radius', default: 0.04, min: 0, max: 0.3, step: 0.01, group: 'advanced' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Clock(
      {
        clockHandsMaxLength: n(v, 'ClockHandsMaxLength', 70),
        externalRadius: n(v, 'ExternalRadius', 100),
        backLegDistance: n(v, 'BackLegDistance', 50),
        margin: n(v, 'Margin', 2),
        needlesAxisHoleDiameter: n(v, 'NeedlesAxisHoleDiameter', 8),
        hourLines: n(v, 'HourLines', 0.08),
        minuteLines: n(v, 'MinuteLines', 0.04),
        numberStyle: s(v, 'NumberStyle', 'Roman') as NumberStyle,
        fontSize: n(v, 'FontSize', 0.12),
      },
      config,
    ),
};
