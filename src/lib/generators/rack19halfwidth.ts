/**
 * Half-width 19" rack unit — ported from boxes.py
 * `boxes/generators/rack19halfwidth.py` (class `Rack19HalfWidth`).
 *
 * A half-width 19-inch rack enclosure for musical equipment, with openings
 * in the front for the usual connectors.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

class Rack19HalfWidth extends Boxes {
  private x = 0;
  private y = 0;

  constructor(
    private o: { ruCount: number; holes: string; z: number; deepz: number },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const t = this.thickness;
    const z = this.o.z;
    const x = (this.x = 223 - 2 * t);
    const y = (this.y = this.o.ruCount * 44.45 - 0.787 - 2 * t);
    const deepz = this.o.deepz;

    this.flangedWall(x, y, 'FFFF', {
      callback: [this.utilHoles, this.rackHoles],
      r: t,
      flanges: [0, 17, 0, 0],
      move: 'up',
      label: 'front',
    });

    this.trapezoidWall(x, deepz, z, 'fFeF', { move: 'up', label: 'top' });
    this.trapezoidWall(x, deepz, z, 'fFeF', { move: 'up', label: 'bottom' });

    this.rectangularWall(deepz, y, 'fffe', { move: 'right', label: 'side' });
    this.rectangularWall(z, y, 'fffe', { move: 'up', label: 'rack ear side' });
  }

  /** Rack-mounting holes, in the ear. */
  private rackHoles = (): void => {
    const t = this.thickness;
    this.rectangularHole(6, 8.5, 6.5, 10, 3.25);
    this.rectangularHole(this.y + 2 * t - 6, 8.5, 6.5, 10, 3.25);
  };

  private utilHoles = (): void => {
    this.moveTo(10, (44.45 - 4.45) / 2);
    for (const line of this.o.holes.split(/\s+/).filter(Boolean)) {
      this.savedContext(() => {
        for (const hole of line) {
          const draw = HOLES[hole];
          if (draw) draw(this);
        }
      });
      this.moveTo(0, 44.45);
    }
  };

  holeXlr(): void {
    this.moveTo(16);
    this.hole(-9.5, 12, 1);
    this.hole(0, 0, 11.8);
    this.hole(9.5, -12, 1);
    this.moveTo(16);
  }

  holeMidi(): void {
    this.moveTo(17);
    this.hole(-11.1, 0, 1);
    this.hole(0, 0, 7.5);
    this.hole(11.1, 0, 1);
    this.moveTo(17);
  }

  /** A 9 V power socket. */
  holePower(): void {
    this.moveTo(11);
    this.rectangularHole(0, 0, 9, 11);
    this.moveTo(11);
  }

  holeWire(): void {
    this.moveTo(3);
    this.hole(0, 0, 3.25);
    this.moveTo(3);
  }
}

/** boxes.py skips any other character. */
const HOLES: Record<string, (r: Rack19HalfWidth) => void> = {
  m: (r) => r.holeMidi(),
  p: (r) => r.holePower(),
  w: (r) => r.holeWire(),
  x: (r) => r.holeXlr(),
};

export const rack19HalfWidth: GeneratorDef = {
  meta: {
    id: 'rack19halfwidth',
    name: 'Half-Width 19" Rack Unit',
    group: 'Box',
    summary: 'Half-width 19-inch rack enclosure with connector openings',
    description:
      'A half-width rack unit for musical equipment, with openings in the ' +
      'front for XLR and MIDI sockets, a 9 V power socket and cable holes, ' +
      'in the order you type them. The long side screws to another half-width unit.',
  },
  params: [
    { key: 'ru_count', kind: 'number', label: 'Height', unit: 'U', default: 1, min: 1, max: 10, step: 0.5, group: 'dimensions', help: 'In rack units.' },
    {
      key: 'holes',
      kind: 'text',
      label: 'Openings',
      default: 'xxmpwx',
      group: 'dimensions',
      placeholder: 'xxmpwx',
      help: 'Left to right: x XLR, m MIDI, p 9 V power, w 6.5 mm cable. A space starts a new row, in the next rack unit up.',
    },
    { key: 'z', kind: 'length', label: 'Rack-ear side depth', unit: 'mm', default: 20, min: 5, max: 500, step: 1, group: 'dimensions', help: 'The shorter side.' },
    { key: 'deepz', kind: 'length', label: 'Inner side depth', unit: 'mm', default: 124, min: 10, max: 1000, step: 1, group: 'dimensions', help: 'The longer side, screwed to the other half-width unit.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Rack19HalfWidth(
      { ruCount: n(v, 'ru_count', 1), holes: s(v, 'holes', 'xxmpwx'), z: n(v, 'z', 20), deepz: n(v, 'deepz', 124) },
      config,
    ),
};
