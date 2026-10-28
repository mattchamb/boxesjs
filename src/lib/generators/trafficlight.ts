/**
 * Traffic light — ported from boxes.py `boxes/generators/trafficlight.py`
 * (class `TrafficLight`).
 *
 * A row of lights, each a box with a round window in the front and a shade
 * slanting out above it, stacked upright or set side by side.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { BaseEdge } from '../edges/base';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface TrafficLightOptions {
  h: number;
  holeDD: number[];
  depth: number;
  shades: number;
  n: number;
  upright: boolean;
  backEdge: string;
}

/** The sides' front edge: a slanting shade over each light, fingered into its top. */
class ShadyEdge extends BaseEdge {
  override char: string | null = 'S';

  constructor(private light: TrafficLight) {
    super(light, null);
  }

  call(_length: number): void {
    const { shades: s, h, n } = this.light.o;
    const a = Math.atan(s / h);
    const angle = a / DEG;
    for (let i = 0; i < n; i++) {
      this.polyline(0, -angle, h / Math.cos(a), angle + 90);
      this.boxes.getEdge('f').call(s);
      this.corner(-90);
      if (i < n - 1) this.edge(this.thickness);
    }
  }

  override margin(): number {
    return this.light.o.shades;
  }
}

class TrafficLight extends Boxes {
  constructor(
    readonly o: TrafficLightOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private backCB = (): void => {
    const t = this.thickness;
    for (let i = 1; i < this.o.n; i++) {
      this.fingerHolesAt(i * (this.o.h + t) - 0.5 * t, 0, this.o.h);
    }
  };

  private sideCB = (): void => {
    const t = this.thickness;
    const { h, n, depth } = this.o;
    for (let i = 1; i < n; i++) this.fingerHolesAt(i * (h + t) - 0.5 * t, 0, depth);
    for (let i = 0; i < n; i++) this.fingerHolesAt(i * (h + t), depth - 2 * t, h, 0);
  };

  private topCB = (): void => {
    const t = this.thickness;
    const { h, n, depth, shades } = this.o;
    for (let i = 1; i < n; i++) this.fingerHolesAt(i * (h + t) - 0.5 * t, 0, depth + shades);
    for (let i = 0; i < n; i++) this.fingerHolesAt(i * (h + t), depth - 2 * t, h, 0);
  };

  private frontCB = (): void => {
    this.hole(this.o.h / 2, this.o.h / 2, this.o.h / 2 - this.thickness);
  };

  private addMountH(width: number, height: number): void {
    const t = this.thickness;
    const dD = this.o.holeDD;
    const ds = dD[0]!;
    let dh: number;
    let y: number;

    if (dD.length < 2) {
      // Without a head diameter, a plain round hole, placed as if the head
      // were twice the shaft.
      dh = 0;
      y = height - Math.max(t * 1.25, t * 1.0 + ds);
    } else {
      dh = dD[1]!;
      y = height - Math.max(t * 1.25, t * 1.0 + dh / 2);
    }

    this.mountingHole(width * 0.125, y, ds, dh, 90);
    this.mountingHole(width * 0.875, y, ds, dh, 90);
  }

  private addMountV(width: number, height: number): void {
    const t = this.thickness;
    const dD = this.o.holeDD;
    if (dD[0]! < 2 * this.burn) return;

    const ds = dD[0]!;
    let dh: number;
    let x: number;

    if (dD.length < 2) {
      dh = 0;
      x = Math.max(t * 2.75, t * 2.25 + ds);
    } else {
      dh = dD[1]!;
      x = Math.max(t * 2.75, t * 2.25 + dh / 2);
    }

    this.mountingHole(x, t * 0.75 + height * 0.125, ds, dh, 180);
    this.mountingHole(x, t * 0.75 + height * 0.875, ds, dh, 180);
  }

  render(): void {
    const { depth: d, h, n, shades: s, upright } = this.o;
    const t = this.thickness;

    const th = n * (h + t) - t;

    const be = this.o.backEdge;

    this.addPart(new ShadyEdge(this));

    if (be !== 'e') {
      this.rectangularWall(th, h, 'ffff', {
        callback: [
          () => {
            this.backCB();
            if (upright) this.addMountV(th, h);
            else this.addMountH(th, h);
          },
        ],
        move: 'up',
        label: 'back',
      });
    }

    if (upright) {
      this.rectangularWall(th, d, be + 'FSF', { callback: [this.sideCB], move: 'up', label: 'left' });
      this.rectangularWall(th, d, be + 'FSF', { callback: [this.sideCB], move: 'up', label: 'right' });

      // The tops of the lights, carrying on out as the shades' tops.
      const e = this.makeCompoundEdge(['f', 'F'], [d, s]);
      const e2 = this.makeCompoundEdge(['F', 'f'], [s, d]);
      for (let i = 0; i < n; i++) {
        this.rectangularWall(h, d + s, [i < n - 1 ? 'f' : be, e, 'e', e2], {
          move: i < n - 1 ? 'right' : 'right up',
          label: `horizontal Wall ${i + 1}`,
        });
      }
    } else {
      this.rectangularWall(th, d, be + 'FeF', { callback: [this.sideCB], move: 'up', label: 'bottom' });
      this.rectangularWall(th, d + s, be + 'FeF', { callback: [this.topCB], move: 'up', label: 'top' });
      for (let i = 0; i < n; i++) {
        this.trapezoidWall(h, d, d + s, i < n - 1 ? 'ffef' : be + 'fef', {
          move: i < n - 1 ? 'right' : 'right up',
          label: `vertical wall ${i + 1}`,
        });
      }
    }

    for (let i = 0; i < n; i++) {
      this.rectangularWall(h, h, 'efef', {
        callback: [this.frontCB],
        move: i < n - 1 ? 'left' : 'left up',
        label: `front ${i + 1}`,
      });
    }

    if (upright) {
      this.rectangularWall(h, d, be + 'fef', { move: 'up', label: 'bottom wall' });
    } else {
      this.trapezoidWall(h, d, d + s, be + 'fef', { move: 'mirror up', label: 'vertical wall' });
    }

    for (let i = 0; i < n; i++) {
      this.parts.disc(h - 2 * t, { move: 'right', label: 'colored windows' });
    }
  }
}

export const trafficLight: GeneratorDef = {
  meta: {
    id: 'trafficlight',
    name: 'Traffic Light',
    group: 'Misc',
    summary: 'Row of shaded lights, stacked upright or side by side',
    description:
      'Each light is a box with a round window in the front and a shade ' +
      'slanting out above it. Made to show a monitored system’s status; ' +
      'turned on its side, it also makes a bottle holder.',
  },
  params: [
    { key: 'h', kind: 'length', label: 'Light size', unit: 'mm', default: 100, min: 20, max: 500, step: 1, group: 'dimensions', help: 'Height and width of each light.' },
    { key: 'depth', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 500, step: 1, group: 'dimensions', help: 'Inside, not counting the shades.' },
    { key: 'shades', kind: 'length', label: 'Shade depth', unit: 'mm', default: 50, min: 5, max: 300, step: 1, group: 'dimensions' },
    { key: 'n', kind: 'number', label: 'Lights', default: 3, min: 1, max: 10, step: 1, integer: true, group: 'dimensions' },
    { key: 'upright', kind: 'bool', label: 'Stack upright', default: true, group: 'dimensions', help: 'Off sets the lights side by side.' },
    {
      key: 'back_edge',
      kind: 'edge',
      label: 'Back edge',
      choices: 'Fhse',
      default: 'F',
      group: 'joints',
      help: 'How the back attaches. Plain leaves the back off.',
    },
    {
      key: 'hole_dD',
      kind: 'text',
      label: 'Mounting holes',
      default: '3.5:6.5',
      group: 'advanced',
      placeholder: 'shaft:head',
      help: 'Screw shaft and head diameter in mm, as shaft:head, in the back. A shaft alone cuts plain round holes.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new TrafficLight(
      {
        h: n(v, 'h', 100),
        holeDD: parseSections(s(v, 'hole_dD', '3.5:6.5')),
        depth: n(v, 'depth', 100),
        shades: n(v, 'shades', 50),
        n: n(v, 'n', 3),
        upright: b(v, 'upright', true),
        backEdge: s(v, 'back_edge', 'F'),
      },
      config,
    ),
};
