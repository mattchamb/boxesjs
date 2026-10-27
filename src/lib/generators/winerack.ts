/**
 * Wine rack — ported from boxes.py `boxes/generators/winerack.py`
 * (class `WineRack`).
 *
 * A honeycomb of hexagonal cells, each holding a bottle: a front with the
 * cell openings, a back, a face plate, and the comb walls between them.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

type Walls = 'minimal' | 'no_verticals' | 'all';

interface WineRackOptions {
  x: number;
  y: number;
  h: number;
  radius: number;
  walls: Walls;
}

class WineRack extends Boxes {
  /** Comb geometry; set in render(). */
  private r = 0;
  private dx = 0;
  private dy = 0;
  private cx = 0;
  private cy = 0;
  private delta = 0;

  constructor(
    private o: WineRackOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private hexFingerHoles(x: number, y: number, l: number, angle = 90): void {
    this.savedContext(() => {
      this.moveTo(x, y, angle);
      this.moveTo(this.delta, 0, 0);
      this.fingerHolesAt(0, 0, l - 2 * this.delta, 0);
    });
  }

  private wallCB(frontwall = false, backwall = false): void {
    const { r, dx, dy, cx, cy } = this;
    const { x, y, walls } = this.o;
    const t = this.thickness;
    const half = Math.floor(cy / 2);

    const ty = cy % 2 ? half * (2 * dy + 2 * r) + 2 * dy + r : half * (2 * dy + 2 * r) + dy;

    this.moveTo((x - dx * 2 * cx) / 2, (y - ty) / 2);

    const wmin = walls === 'minimal';

    for (let i = 0; i < half + (cy % 2); i++) {
      if (!frontwall && walls === 'all') {
        this.hexFingerHoles(0, (2 * r + 2 * dy) * i + dy, r, 90);
      }
      for (let j = 0; j < cx; j++) {
        if (!backwall) this.hole(j * 2 * dx + dx, (2 * r + 2 * dy) * i + r, dx - t);
        if (frontwall) continue;
        this.hexFingerHoles(j * 2 * dx + dx, (2 * r + 2 * dy) * i, r, 150);
        this.hexFingerHoles(j * 2 * dx + dx, (2 * r + 2 * dy) * i, r, 30);
        if (walls === 'all') {
          this.hexFingerHoles(j * 2 * dx + 2 * dx, (2 * r + 2 * dy) * i + dy, r, 90);
        }
        if (wmin && i === half) continue; // top row
        if (j > 0 || !wmin) {
          this.hexFingerHoles(j * 2 * dx + dx, (2 * r + 2 * dy) * i + r + 2 * dy, r, -150);
        }
        if (j < cx - 1 || !wmin) {
          this.hexFingerHoles(j * 2 * dx + dx, (2 * r + 2 * dy) * i + r + 2 * dy, r, -30);
        }
      }
      if (i < half) {
        for (let j = 0; j < cx; j++) {
          if (!frontwall && walls === 'all') {
            this.hexFingerHoles(j * 2 * dx + dx, (2 * r + 2 * dy) * i + r + 2 * dy, r, 90);
          }
        }
        if (!backwall) {
          for (let j = 1; j < cx; j++) {
            this.hole(j * 2 * dx, (2 * r + 2 * dy) * i + 2 * r + dy, dx - t);
          }
        }
      }
    }
    if (cy % 2 === 0) {
      const i = half;
      for (let j = 0; j < cx; j++) {
        if (frontwall || wmin) break;
        if (j > 0) this.hexFingerHoles(j * 2 * dx + dx, (2 * r + 2 * dy) * i, r, 150);
        if (j < cx - 1) this.hexFingerHoles(j * 2 * dx + dx, (2 * r + 2 * dy) * i, r, 30);
      }
    }
  }

  render(): void {
    const { x, y, h, radius, walls } = this.o;

    const t = this.thickness;
    const r = (this.r = 2 * (radius + t) * Math.tan(Math.PI / 6));

    const dx = (this.dx = r * Math.cos(Math.PI / 6));
    const dy = (this.dy = r * Math.sin(Math.PI / 6));
    const cx = (this.cx = Math.floor((x - 2 * t) / (2 * dx)));
    const cy = (this.cy = Math.floor((y - dy - t) / (r + dy)));
    this.delta = (3 ** 0.5 / 6) * t;

    this.rectangularWall(x, y, 'eeee', { callback: [() => this.wallCB()], move: 'up', label: 'front' });
    this.rectangularWall(x, y, 'eeee', { callback: [() => this.wallCB(false, true)], move: 'up', label: 'back' });
    this.rectangularWall(x, y, 'eeee', { callback: [() => this.wallCB(true)], move: 'up', label: 'face' });

    const half = Math.floor(cy / 2);
    let tc = walls === 'all' ? (half + (cy % 2)) * (6 * cx + 1) : (half + (cy % 2)) * (4 * cx);

    if (walls === 'minimal') tc -= 2 * half; // roofs of outer cells

    if (cy % 2) {
      if (walls === 'all') tc -= cx;
    } else if (walls !== 'minimal') {
      tc += 2 * cx - 2; // very top row
    }

    let wall = 0;
    this.partsMatrix(tc, cx, 'up', (move) =>
      this.rectangularWall(r - 2 * this.delta, h, 'fefe', {
        move,
        label: move.includes('only') ? '' : `wall ${++wall}`,
      }),
    );
  }
}

export const wineRack: GeneratorDef = {
  meta: {
    id: 'winerack',
    name: 'Wine Rack',
    group: 'Shelf',
    summary: 'Honeycomb rack with a hexagonal cell for each bottle',
    description:
      'As many hexagonal cells as fit the front, each with a round opening ' +
      'for the bottle neck end. Choose how many of the comb walls to cut: ' +
      'all of them, all but the upright ones, or only enough to hold it together.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 400, min: 100, max: 2000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Height', unit: 'mm', default: 300, min: 100, max: 2000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Depth', unit: 'mm', default: 210, min: 20, max: 1000, step: 1, group: 'dimensions' },
    {
      key: 'radius',
      kind: 'length',
      label: 'Cell radius',
      unit: 'mm',
      default: 46,
      min: 10,
      max: 300,
      step: 1,
      group: 'dimensions',
      help: 'Of the circle that fits inside each cell.',
    },
    {
      key: 'walls',
      kind: 'enum',
      label: 'Comb walls',
      default: 'all',
      choices: [
        { value: 'all', label: 'All' },
        { value: 'no_verticals', label: 'No upright walls' },
        { value: 'minimal', label: 'Minimal' },
      ],
      group: 'dimensions',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WineRack(
      {
        x: n(v, 'x', 400),
        y: n(v, 'y', 300),
        h: n(v, 'h', 210),
        radius: n(v, 'radius', 46),
        walls: s(v, 'walls', 'all') as Walls,
      },
      config,
    ),
};
