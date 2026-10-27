/**
 * Spice rack — ported from boxes.py `boxes/generators/spicesrack.py`
 * (class `SpicesRack`).
 *
 * A wall-hung back panel carrying rows of shelves. Each shelf has a row of
 * angled slots that the cans sit in, tipped back against the back panel, and
 * a scalloped front edge. Small supports under each shelf hold it at the
 * angle; optional feet let the rack stand instead of hang.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { BaseEdge } from '../edges/base';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

/**
 * A row of shallow scallops, one per can. boxes.py hands the generator itself
 * to this edge as its settings and reads the can sizes from it; here it holds
 * the generator directly.
 */
class FrontEdge extends BaseEdge {
  constructor(private rack: SpicesRack) {
    super(rack, null);
  }

  call(length: number): void {
    const r = this.rack;
    this.boxes.savedContext(() => {
      const a = 90;
      const radius = (r.diameter + r.space) / 2;
      this.boxes.ctx.scale(1, r.edgeWidth / radius);
      for (let i = 0; i < r.numx; i++) {
        this.corner(-a);
        this.corner(180, radius);
        this.corner(-a);
      }
    });
    this.moveTo(length);
  }

  override margin(): number {
    return this.rack.edgeWidth;
  }
}

interface SpicesRackOptions {
  diameter: number;
  height: number;
  space: number;
  numx: number;
  numy: number;
  inPlaceSupports: boolean;
  feet: boolean;
}

class SpicesRack extends Boxes {
  readonly diameter: number;
  readonly space: number;
  readonly numx: number;
  /** How far the scallops stand proud of the shelf; set in render(). */
  edgeWidth = 0;

  private feetDone = false;
  private baseAngle = 10;
  private baseR = 0;
  private baseH = 0;
  private holeLength = 0;
  private holeDistance = 0;
  /** Vertical pitch of the shelves. */
  private h = 0;
  private x = 0;

  constructor(
    private o: SpicesRackOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.diameter = o.diameter;
    this.space = o.space;
    this.numx = o.numx;
  }

  private support(width: number, height: number, move?: string): void {
    const t = this.thickness;
    const tw = width + t;
    const th = height;

    const r = Math.min(width - 2 * t, height - 2 * t);

    if (this.move(tw, th, move, true)) return;

    this.polyline(width - r, 90, 0, [-90, r], 0, 90, height - r, 90, width, 90);
    this.getEdge('f').call(height);

    this.move(tw, th, move, false, 'support');
  }

  private foot(width: number, height: number, move?: string): void {
    const t = this.thickness;
    const [tw, th] = [height, width + t];

    if (this.move(tw, th, move, true)) return;

    this.moveTo(0, t);
    this.getEdge('f').call(height);
    this.polyline(0, 90, width, 90, 0, [90, height], width - height, 90);

    this.move(tw, th, move, false, 'foot');
  }

  /** The slots the cans stand in, and in-place supports if asked for. */
  private holes = (): void => {
    const w = 2 * this.baseR;
    const r = this.diameter / 2;
    const a = this.baseAngle;
    const l = this.holeLength;
    this.moveTo(0, this.holeDistance);

    this.savedContext(() => {
      this.ctx.scale(1, l / this.baseH);
      this.moveTo(this.space / 2, 0, 90);
      for (let i = 0; i < this.numx; i++) {
        this.polyline(0, -a, 0, [-180 + 2 * a, r], 0, -90 - a, w, -90);
        this.moveTo(0, -(this.diameter + this.space));
      }
    });
    this.ctx.stroke();
    // With feet, the first shelf's spare room goes to them instead.
    if (this.o.feet && !this.feetDone) {
      this.feetDone = true;
      return;
    }

    if (!this.o.inPlaceSupports) return;
    const innerWidth = this.holeDistance + this.holeLength / 3;
    const t = this.thickness;
    for (let i = 0; i < this.numx - 1; i++) {
      this.savedContext(() => {
        this.moveTo((this.diameter + this.space) * (i + 0.5) - (innerWidth + t) / 2, this.spacing);
        this.support(innerWidth, (this.h - t) / 2);
      });
    }
  };

  private backCB = (): void => {
    const t = this.thickness;
    const dy = this.h / 2 - t / 2;
    for (let i = 0; i < this.o.numy; i++) {
      this.fingerHolesAt(0, (i + 1) * this.h - 0.5 * t - dy, this.x, 0);
      for (let j = 1; j < this.numx; j++) {
        this.fingerHolesAt(j * (this.diameter + this.space), (i + 1) * this.h - t - dy, (this.h - t) / 2, -90);
      }
    }
  };

  render(): void {
    this.feetDone = false;
    const t = this.thickness;
    const x = (this.x = this.numx * (this.diameter + this.space));
    const d = this.diameter;

    this.baseAngle = 10;
    this.baseR = (this.diameter / 2) * Math.cos(this.baseAngle * DEG);
    this.baseH = (this.diameter / 2) * (1 - Math.sin(this.baseAngle * DEG));
    const angle = Math.atan(this.baseR / this.o.height) / DEG;
    this.holeLength = (this.baseH ** 2 + this.o.height ** 2) ** 0.5;
    this.holeDistance = (this.diameter - this.baseR) * Math.sin(angle * DEG);

    this.h = (this.space + d) / Math.cos(angle * DEG);
    const h = this.o.numy * this.h - this.h / 2 + 6 * t;

    const width = this.holeDistance + this.holeLength + this.space / 2;
    const innerWidth = this.holeDistance + this.holeLength / 3;

    this.edgeWidth = width - innerWidth;

    for (let i = 0; i < this.o.numy; i++) {
      this.rectangularWall(x, innerWidth, ['f', 'e', new FrontEdge(this), 'e'], {
        callback: [this.holes],
        move: 'up',
        label: `shelf ${i + 1}`,
      });
    }

    this.rectangularWall(x, h, 'eeee', {
      callback: [this.backCB, null, () => this.hole(3 * t, 3 * t, 1.5), () => this.hole(3 * t, 3 * t, 1.5)],
      move: 'up',
      label: 'back',
    });

    if (!this.o.inPlaceSupports) {
      this.partsMatrix((this.numx - 1) * this.o.numy, this.numx - 1, 'up', (m) =>
        this.support(innerWidth, (this.h - t) / 2, m),
      );
    }
    if (this.o.feet) {
      this.partsMatrix(this.numx - 1, this.numx - 1, 'up', (m) => this.foot(width, (this.h - t) / 2, m));
    }
  }
}

export const spicesRack: GeneratorDef = {
  meta: {
    id: 'spicesrack',
    name: 'Spice Rack',
    group: 'Shelf',
    summary: 'Wall rack of tilted shelves holding rows of spice cans',
    description:
      'Rows of shelves on a back panel, each with a slot per can so the cans ' +
      'lean back at an angle and their labels face forward. The supports can ' +
      'be cut from the shelves’ own slots to save material; check their fit ' +
      'yourself. Add feet to stand the rack on a worktop instead of hanging it.',
  },
  // Shelves are long and shallow; a smaller edge margin keeps fingers on them.
  paramDefaults: { fj_surroundingspaces: 1.0 },
  params: [
    { key: 'diameter', kind: 'length', label: 'Can diameter', unit: 'mm', default: 55, min: 10, max: 200, step: 1, group: 'dimensions' },
    {
      key: 'height',
      kind: 'length',
      label: 'Supported height',
      unit: 'mm',
      default: 60,
      min: 10,
      max: 300,
      step: 1,
      group: 'dimensions',
      help: 'How much of each can’s height the rack supports. Taller tips the cans back less.',
    },
    { key: 'space', kind: 'length', label: 'Space between cans', unit: 'mm', default: 10, min: 0, max: 100, step: 1, group: 'dimensions' },
    { key: 'numx', kind: 'number', label: 'Cans per row', default: 5, min: 1, max: 30, step: 1, group: 'dimensions' },
    { key: 'numy', kind: 'number', label: 'Rows', default: 6, min: 1, max: 30, step: 1, group: 'dimensions' },
    {
      key: 'in_place_supports',
      kind: 'bool',
      label: 'Cut supports from the slots',
      default: false,
      group: 'advanced',
      help: 'Places the supports inside the can slots to save material. Check the fit yourself.',
    },
    {
      key: 'feet',
      kind: 'bool',
      label: 'Feet',
      default: false,
      group: 'dimensions',
      help: 'Lets the rack stand on a surface instead of hanging on a wall.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new SpicesRack(
      {
        diameter: n(v, 'diameter', 55),
        height: n(v, 'height', 60),
        space: n(v, 'space', 10),
        numx: Math.floor(n(v, 'numx', 5)),
        numy: Math.floor(n(v, 'numy', 6)),
        inPlaceSupports: b(v, 'in_place_supports', false),
        feet: b(v, 'feet', false),
      },
      config,
    ),
};
