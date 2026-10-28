/**
 * Carbon filter — ported from boxes.py `boxes/generators/carbonfilter.py`
 * (class `CarbonFilter`).
 *
 * A compact air filter of V-shaped pockets for activated charcoal pellets,
 * held between two sides by rails, bottom plates and ribs. Several sizes are
 * fixed by boxes.py: 50 mm rails, 40 mm borders and charcoal width, and
 * 100 mm bottoms.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface CarbonFilterOptions {
  x: number;
  y: number;
  h: number;
  pockets: number;
  ribs: number;
}

class CarbonFilter extends Boxes {
  private y: number;
  /** Width of each pocket, and the slope of its sides in degrees; set in render(). */
  private w = 0;
  private a = 0;

  constructor(
    private o: CarbonFilterOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.y = o.y;
  }

  private sideCB = (): void => {
    const { x, h, pockets: p } = this.o;
    const t = this.thickness;
    const { w, a } = this;
    let posx = t;

    this.fingerHolesAt(t / 2, h, 50, -90);
    this.fingerHolesAt(x - t / 2, h, 50, -90);

    for (let i = 0; i < p; i++) {
      this.fingerHolesAt(posx + t / 2, h, 50, -90 + a);
      this.fingerHolesAt(posx + 40 + t / 2, h, 50, -90 + a);
      this.fingerHolesAt(posx + w - t / 2, h, 50, -90 - a);
      this.fingerHolesAt(posx + w - 40 - t / 2, h, 50, -90 - a);

      this.fingerHolesAt(posx + w / 2 - 50 + t, 3.5 * t, 100 - 2 * t, 0);

      posx += w;
    }
  };

  private bottomCB = (): void => {
    const t = this.thickness;
    const ribs = this.o.ribs;
    for (let i = 0; i < ribs; i++) {
      this.fingerHolesAt(((i + 1) * this.y) / (ribs + 1) - 1.5 * t, 0, 4 * t, 90);
      this.fingerHolesAt(((i + 1) * this.y) / (ribs + 1) - 1.5 * t, 40 - t, 20, 90);
    }
  };

  private topRailCB = (): void => {
    const t = this.thickness;
    const ribs = this.o.ribs;
    for (let i = 0; i < ribs; i++) {
      this.fingerHolesAt(((i + 1) * this.y) / (ribs + 1) - 1.5 * t, 0, 30, 90);
    }
  };

  private innerRibs(n: number, move?: string): void {
    const { h } = this.o;
    const t = this.thickness;
    const a = this.a;
    const a_ = a * DEG;

    const l = (h - 4 * t) / Math.cos(a_) - 0.5 * t * Math.sin(a_);

    const tw = n * (20 + this.spacing) + l * Math.sin(a_);
    const th = h - 3 * t - 20 * Math.cos(a_) + this.spacing;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(0, t);

    for (let i = 0; i < n; i++) {
      this.getEdge('f').call(20);
      this.polyline(0, 90 - a, l - 50, 90, t, -90);
      this.getEdge('f').call(30);
      this.polyline(0, 90 + a, 20 - t, 90 - a, l - 20 + t * Math.sin(a_), 90 + a);

      this.moveTo(20 + this.spacing);
      this.ctx.stroke();
    }

    this.move(tw, th, move, false, 'Inner ribs');
  }

  private sideHolders(n: number, move?: string): void {
    const { h } = this.o;
    const t = this.thickness;
    const a = this.a;
    const a_ = a * DEG;

    const l = (h - 4 * t) / Math.cos(a_) - 0.5 * t * Math.sin(a_) - 50;

    const tw = n * (10 + this.spacing) + l * Math.sin(a_);
    const th = h - 4 * t - 50;

    if (this.move(tw, th, move, true)) return;

    for (let i = 0; i < n; i++) {
      this.polyline(10, 90 - a, l, 90 + a, 10, 90 - a, l, 90 + a);
      this.ctx.stroke();
      this.moveTo(10 + this.spacing);
    }

    // boxes.py labels these, and the stabilizers, "Inner ribs" too.
    this.move(tw, th, move, false, 'Inner ribs');
  }

  private topStabilizers(n: number, move?: string): void {
    const t = this.thickness;

    const l = 2 * (this.o.h - 60) * Math.sin(this.a * DEG) - 20;
    const tw = n * (6 * t + this.spacing);
    const th = l + 4 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(t);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2; j++) {
        this.polyline(0, 90, 2 * t, -90, t, -90, 2 * t, 90, 3 * t, [90, t], l + 2 * t, [90, t]);
      }
      this.ctx.stroke();
      this.moveTo(6 * t + this.spacing);
    }

    this.move(tw, th, move, false, 'Inner ribs');
  }

  private outerRibs(n: number, nEdge: number, move?: string): void {
    const { h } = this.o;
    const t = this.thickness;
    const a = this.a;
    const a_ = a * DEG;

    const l = (h - 4 * t) / Math.cos(a_) + 0.5 * t * Math.sin(a_);

    const dl = (20 - t) * (Math.tan(Math.PI / 2 - 2 * a_) + Math.sin(a_));
    const dll = (20 - t) * (1 / Math.sin(2 * a_));

    const dl2 = (20 - t) * (Math.tan(Math.PI / 2 - a_) + Math.sin(a_));
    const dll2 = (20 - t) * (1 / Math.sin(a_));

    const half = Math.floor(n / 2);
    const tw = half * (40 + t) + l * Math.sin(a_);
    const th = h + 5 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(2 * t);

    for (let i = 0; i < n; i++) {
      this.polyline(0 * t + 20, [90, 2 * t], 2 * t, -a);
      // The ribs at the outer sides meet the side holders at a pointier angle.
      if (i < nEdge) {
        this.polyline(l - dl2 - t * Math.sin(a_), a, dll2, 180 - a, 20);
      } else {
        this.polyline(l - dl - t * Math.sin(a_), 2 * a, dll, 180 - 2 * a, 20);
      }
      this.getEdge('f').call(30);
      this.polyline(0, -90, t, 90, l - 50, a, t, -90);
      this.getEdge('f').call(4 * t);
      this.polyline(0, 90, 1 * t, [90, 2 * t]);

      this.moveTo(t + 40);
      // The second half go upside down above the first, interleaved with them.
      if (i + 1 === half) {
        this.moveTo(2 * t + 0.7 * this.spacing, h + 5 * t, 180);
      }
      this.ctx.stroke();
    }

    this.move(tw, th, move, false, 'Outer ribs');
  }

  render(): void {
    const { x, h, pockets } = this.o;
    const ribs = this.o.ribs;

    const y = (this.y = this.adjustSize(this.y));

    const t = this.thickness;

    this.w = (x - 2 * t) / pockets;
    this.a = Math.atan((this.w - 100) / 2 / (h - 4 * t)) / DEG;

    for (let i = 0; i < 2; i++) {
      // boxes.py gives the two big sides no label.
      this.rectangularWall(x, h, 'eeee', {
        callback: [
          () => {
            this.ctx.nameCurrentPart('side');
            this.sideCB();
          },
        ],
        move: 'up',
      });
    }
    for (let i = 0; i < 2; i++) {
      this.rectangularWall(y, 50, 'efef', { label: 'Sides', move: 'up' });
    }

    for (let i = 0; i < pockets * 4; i++) {
      this.rectangularWall(y, 50, 'efef', { callback: [this.topRailCB], label: 'Top rails', move: 'up' });
    }

    const w = 100 - 2 * t;
    for (let i = 0; i < pockets; i++) {
      this.rectangularWall(y, w, 'efef', {
        callback: [this.bottomCB, null, this.bottomCB],
        label: 'bottom plate',
        move: 'up',
      });
    }

    this.innerRibs(pockets * ribs * 2, 'up');
    this.outerRibs(pockets * ribs * 2, ribs * 2, 'up');
    this.sideHolders(pockets * 8, 'up');
    this.topStabilizers(Math.min(3, ribs) * pockets);
    // Drawn without a move, so boxes.py's label for them never prints.
    this.ctx.nameCurrentPart('top stabilizers');
  }
}

export const carbonFilter: GeneratorDef = {
  meta: {
    id: 'carbonfilter',
    name: 'Carbon Filter',
    group: 'Misc',
    summary: 'Compact air filter of V-shaped pockets for activated charcoal',
    description:
      'The charcoal sits in V-shaped pockets of mesh, held by ribs on bottom ' +
      'plates between two sides. Glue a wooden strip 2–3 cm wide round the top ' +
      'as a rim; it is not included, so make the width and depth about 5 cm ' +
      'under the filter’s nominal size. Put all the bottom plates in the same ' +
      'way up, so the ribs of neighbouring pockets pass each other. Ribs with ' +
      'straight tops go in the middle of the bottom plates, the pointiest ' +
      'ones at the outer sides against the side bars, and the rest at the ' +
      'other sides.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 550, min: 150, max: 2000, step: 1, group: 'dimensions', help: 'Across the pockets, without the rim.' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 550, min: 100, max: 2000, step: 1, group: 'dimensions', help: 'Along the pockets, without the rim.' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 250, min: 120, max: 1000, step: 1, group: 'dimensions' },
    { key: 'pockets', kind: 'number', label: 'Pockets', default: 3, min: 1, max: 10, step: 1, integer: true, group: 'dimensions', help: 'Each needs more than 100 mm of the width.' },
    { key: 'ribs', kind: 'number', label: 'Ribs', default: 12, min: 1, max: 40, step: 1, integer: true, group: 'dimensions', help: 'Per side of each pocket, holding the bottom and the mesh.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new CarbonFilter(
      {
        x: n(v, 'x', 550),
        y: n(v, 'y', 550),
        h: n(v, 'h', 250),
        pockets: n(v, 'pockets', 3),
        ribs: n(v, 'ribs', 12),
      },
      config,
    ),
};
