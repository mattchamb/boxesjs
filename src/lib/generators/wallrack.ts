/**
 * Wall rack — ported from boxes.py `boxes/generators/wallrack.py`
 * (class `WallRack`).
 *
 * A back plate carrying shelves with a low lip round three sides, for
 * spices or other small things.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { HANDLE_EDGE_PARAMS, MOUNTING_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { parseSections } from '../params/sections';
import { b, n, s, type GeneratorDef } from './types';

interface WallRackOptions {
  x: number;
  y: number;
  sh: number[];
  outside: boolean;
  topEdge: string;
  fullHeightTop: boolean;
  wallHeight: number;
  backHeight: number;
  sideEdges: string;
  flatBottom: boolean;
}

class WallRack extends Boxes {
  constructor(
    private o: WallRackOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private generateShelves(x: number, y: number, frontHeight: number, backHeight: number): void {
    const se = this.o.sideEdges;
    for (let i = 0; i < this.o.sh.length; i++) {
      this.rectangularWall(x, y, 'ffff', { move: 'up', label: `shelf ${i + 1}` });
      this.rectangularWall(x, frontHeight, se + 'fef', { move: 'up', label: `front lip ${i + 1}` });
      this.trapezoidWall(y, frontHeight, backHeight, se + 'fe' + se, { move: 'right', label: `right lip ${i + 1}` });
      this.trapezoidWall(y, frontHeight, backHeight, se + 'fe' + se, { move: 'up', label: `left lip ${i + 1}` });
      this.move(y + this.thickness * 2, backHeight, 'left', true);
    }
  }

  /** Finger holes for the back part. */
  private generateFingerHoles(x: number, backHeight: number): void {
    const t = this.thickness;
    let posY = 0;
    for (const h of this.o.sh) {
      this.fingerHolesAt(t * 0.5, posY + 0.5 * t, x, 0);
      this.fingerHolesAt(0, posY + t, backHeight, 90);
      this.fingerHolesAt(x + t, posY + t, backHeight, 90);
      posY += h;
    }
  }

  render(): void {
    let { x, y } = this.o;
    const { sh, fullHeightTop } = this.o;
    let frontHeight = this.o.wallHeight;
    let backHeight = frontHeight * this.o.backHeight;
    const t = this.thickness;
    if (this.o.outside) {
      x = this.adjustSize(x, 'h', 'f');
      y = this.adjustSize(y);
      frontHeight = this.adjustSize(frontHeight);
      backHeight = this.adjustSize(backHeight);
    }

    const sum = (l: number[]) => l.reduce((a, c) => a + c, 0);
    let totalHeight = fullHeightTop ? sum(sh) : sum(sh.slice(0, -1)) + backHeight;

    for (const h of fullHeightTop ? sh : sh.slice(0, -1)) {
      if (h < backHeight) {
        // boxes.py raises a ValueError.
        this.warn(`Each shelf must be at least the back’s height, ${backHeight} mm tall; ${h} found.`, 'sh');
        return;
      }
    }

    const be = this.o.flatBottom && this.o.sideEdges === 'F' ? 'e' : 'E';
    if (be === 'E' && fullHeightTop) totalHeight -= t;

    this.rectangularWall(x + this.thickness, totalHeight, be + 'E' + this.o.topEdge + 'E', {
      callback: [() => this.generateFingerHoles(x, backHeight)],
      label: 'back wall',
      move: 'right',
    });
    this.generateShelves(x, y, frontHeight, backHeight);
  }
}

export const wallRack: GeneratorDef = {
  meta: {
    id: 'wallrack',
    name: 'Wall Rack',
    group: 'Wall mounted',
    summary: 'Back plate with lipped shelves, for spices and other small things',
    description:
      'Shelves with a low lip round the front and sides, on a back plate ' +
      'that hangs on the wall by keyhole slots or a handle along the top. ' +
      'With a flat bottom and finger joints at the sides it can stand too.',
  },
  // boxes.py's own default: a smaller edge margin, for fingers on the lips.
  paramDefaults: { fj_surroundingspaces: 1 },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 200, min: 20, max: 2000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Shelf depth', unit: 'mm', default: 50, min: 10, max: 500, step: 1, group: 'dimensions' },
    {
      key: 'sh',
      kind: 'sections',
      label: 'Shelf spacing, bottom to top',
      default: '100*3',
      group: 'dimensions',
      itemLabel: 'shelf',
      help: 'One entry per shelf: the height it takes up on the back.',
    },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: false, group: 'dimensions' },
    { key: 'wall_height', kind: 'length', label: 'Lip height', unit: 'mm', default: 20, min: 2, max: 200, step: 1, group: 'dimensions', help: 'At the front.' },
    {
      key: 'back_height',
      kind: 'number',
      label: 'Lip height at the back',
      unit: '× front',
      default: 1.5,
      min: 0.5,
      max: 5,
      step: 0.1,
      group: 'dimensions',
    },
    {
      key: 'full_height_top',
      kind: 'bool',
      label: 'Full height above the top shelf',
      default: true,
      group: 'dimensions',
      help: 'Carry the back plate up the top shelf’s full spacing, not just its lip.',
    },
    { key: 'flat_bottom', kind: 'bool', label: 'Flat bottom', default: false, group: 'dimensions', help: 'So the rack can also stand. Needs finger joints at the sides.' },
    {
      key: 'top_edge',
      kind: 'edge',
      label: 'Top edge',
      choices: 'eEGy',
      default: 'G',
      group: 'top',
      help: 'Mounting holes or a handle to hang it by.',
    },
    {
      key: 'side_edges',
      kind: 'edge',
      label: 'Shelf joints',
      choices: 'Fh',
      default: 'h',
      group: 'joints',
      help: 'How the lips hold onto the shelves.',
    },
    ...MOUNTING_PARAMS.map((spec) => ({ ...spec, showIf: (v: ParamValues) => v['top_edge'] === 'G' })),
    ...HANDLE_EDGE_PARAMS.map((spec) => ({ ...spec, showIf: (v: ParamValues) => v['top_edge'] === 'y' })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new WallRack(
      {
        x: n(v, 'x', 200),
        y: n(v, 'y', 50),
        sh: parseSections(s(v, 'sh', '100*3')),
        outside: b(v, 'outside', false),
        topEdge: s(v, 'top_edge', 'G'),
        fullHeightTop: b(v, 'full_height_top', true),
        wallHeight: n(v, 'wall_height', 20),
        backHeight: n(v, 'back_height', 1.5),
        sideEdges: s(v, 'side_edges', 'h'),
        flatBottom: b(v, 'flat_bottom', false),
      },
      config,
    ),
};
