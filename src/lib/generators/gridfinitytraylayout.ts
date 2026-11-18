/**
 * Gridfinity tray layout — ported from boxes.py
 * `boxes/generators/gridfinitytraylayout.py` (class `GridfinityTrayLayout`).
 *
 * A TrayLayout sized to drop into a Gridfinity grid: the outside is a whole
 * number of 42 mm cells less a margin, the height can be given in Gridfinity
 * units, and square pads with magnet holes are cut to glue under the floor so
 * the tray seats on a baseplate.
 */
import type { Boxes, BoxesConfig } from '../boxes';
import { ETCHING } from '../geom/colors';
import { LID_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { decodeLayout, TrayLayout } from './traylayout';
import { b, n, s, type GeneratorDef } from './types';

/** Gridfinity's cell pitch, fixed by the system. */
export const GRIDFINITY_PITCH = 42.0;
/** The opening a bin's foot sits in. */
export const GRIDFINITY_OPENING = 38;
/** How much smaller than the opening the pads and etched outlines are. */
export const GRIDFINITY_OPENING_MARGIN = 2;

const sum = (v: number[]): number => v.reduce((a, x) => a + x, 0);

/**
 * boxes.py's `rectangularEtching`, a `@restore` method: a rectangle traced
 * clockwise from the middle of its bottom edge. Not `rectangularHole`, whose
 * path starts and turns differently.
 */
export function rectangularEtching(box: Boxes, x: number, y: number, dx: number, dy: number, r = 0): void {
  box.savedContext(() => {
    r = Math.min(r, dx / 2.0, dy / 2.0);
    // boxes.py's centre_x/centre_y are always left at True by its callers.
    box.moveTo(x, y - dy / 2.0, 180);
    box.edge(dx / 2.0 - r); // start with an edge to allow easier change of inner corners
    for (const d of [dy, dx, dy, dx / 2.0 + r]) {
      box.corner(-90, r);
      box.edge(d - 2 * r);
    }
  });
  box.ctx.moveTo(0, 0);
}

/**
 * Etched outlines of the four corner cells on a floor, so the pads can be
 * glued on square. Drawn from the floor's inner corner, which sits a wall
 * thickness and half the margin in from the grid.
 */
export function gridfinityBaseplateEtching(box: Boxes, nx: number, ny: number, margin: number): void {
  const x = -box.thickness - margin / 2;
  const y = -box.thickness - margin / 2;
  const o = GRIDFINITY_OPENING;
  const p = GRIDFINITY_PITCH;
  const m = GRIDFINITY_OPENING_MARGIN;
  // boxes.py iterates the sets {0, nx-1} and {0, ny-1}, so a grid one cell
  // across etches that cell once, not twice.
  const xs = [...new Set([0, nx - 1])];
  const ys = [...new Set([0, ny - 1])];
  box.ctx.stroke();
  box.savedContext(() => {
    for (const xx of xs) {
      for (const yy of ys) {
        box.setSourceColor(ETCHING);
        rectangularEtching(box, x + p / 2 + xx * p, y + p / 2 + yy * p, o - m, o - m);
      }
    }
    box.ctx.stroke();
  });
}

/**
 * The starting sketch: `countx` by `county` equal compartments filling the
 * grid. Mirrors boxes.py's `generate_layout` text, including the row lines'
 * missing space before the depth.
 */
export function gridfinityLayout(nx: number, ny: number, countx: number, county: number, margin: number): string {
  if (countx === 0) countx = nx;
  if (county === 0) county = ny;

  const x = GRIDFINITY_PITCH * nx - margin;
  const y = GRIDFINITY_PITCH * ny - margin;
  const stepx = x / countx;
  const stepy = y / county;

  let layout = '';
  for (let i = 0; i < countx; i++) layout += ' |'.repeat(i) + ` ,> ${stepx}mm\n`;
  for (let i = 0; i < county; i++) {
    layout += '+-'.repeat(countx) + '+\n';
    layout += '| '.repeat(countx) + `|${stepy}mm\n`;
  }
  layout += '+-'.repeat(countx) + '+\n';
  return layout;
}

interface GridfinityTrayLayoutOptions {
  /** Height as typed: millimetres, or a count of 7 mm units ending in "u". */
  h: string;
  hi: number;
  nx: number;
  ny: number;
  margin: number;
  stacking: boolean;
  genPads: boolean;
  padRadius: number;
  cutPadsMagDiameter: number;
  cutPadsMagOffset: number;
  baseThickness: number;
  layout: string;
}

class GridfinityTrayLayout extends TrayLayout {
  constructor(
    private g: GridfinityTrayLayoutOptions,
    config: Partial<BoxesConfig>,
  ) {
    // Gridfinity trays are always measured outside: they must fit the grid.
    super({ h: 0, hi: g.hi, outside: true, layout: g.layout }, config);
  }

  /** The height in mm, or null where boxes.py raises ValueError. */
  private parseHeight(): number | null {
    const raw = this.g.h;
    // Python's str.isdigit(): digits only, so "50.5" is rejected too.
    if (/^\d+$/.test(raw)) return parseFloat(raw);
    if (raw.toUpperCase().endsWith('U')) {
      // int() of what precedes the "u", which tolerates surrounding spaces.
      const units = raw.slice(0, -1);
      if (!/^\s*[+-]?\d+\s*$/.test(units)) return null;
      // A unit is 7 mm including the foot the tray stands on, which here is
      // the base plate (or the given base). Stacking adds the lip boxes.py
      // takes from the Gridfinity spec for a rounded R0.5 top, so a stack of
      // laser-cut trays ends up as tall as a stack of printed ones.
      let h = parseInt(units, 10) * 7;
      h -= this.g.baseThickness === 0 ? this.thickness : this.g.baseThickness;
      if (this.g.stacking) h += 3.69;
      return h;
    }
    return null;
  }

  /** A pad to glue under the floor, with its magnet holes. */
  private generatePad(x: number, y: number, r: number, move: string, label: string): void {
    if (this.move(x, y, move, true)) return;

    r = Math.min(r, x / 2, y / 2);
    this.savedContext(() => {
      this.moveTo(x / 2, 0);
      this.edge(x / 2 - r); // start with an edge to allow easier change of inner corners
      for (const d of [y, x, y, x / 2.0 + r]) {
        this.corner(90, r);
        this.edge(d - 2 * r);
      }
    });

    // Not inside the saved context: boxes.py leaves the cursor at the centre,
    // and move() restores it afterwards.
    this.moveTo(x / 2, y / 2);
    if (this.g.cutPadsMagDiameter > 0) {
      const ofs = this.g.cutPadsMagOffset;
      const dia = this.g.cutPadsMagDiameter;
      for (const [xoff, yoff] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ] as const) {
        const holeX = (Math.floor(GRIDFINITY_PITCH / 2) - ofs) * xoff;
        const holeY = (Math.floor(GRIDFINITY_PITCH / 2) - ofs) * yoff;
        this.hole(holeX, holeY, 0, dia);
      }
    }

    this.move(x, y, move, false, label);
  }

  override render(): void {
    const h = this.parseHeight();
    if (h === null) {
      this.warn('Give the height as a whole number of mm, or of Gridfinity units ending in "u".', 'h');
      return;
    }
    this.h = h;
    if (!this.hi && this.g.stacking) this.hi = this.h - 4.4;

    const { nx, ny, margin } = this.g;
    const etching = [() => gridfinityBaseplateEtching(this, nx, ny, margin)];

    this.prepare();
    this.walls();
    this.savedContext(() => {
      this.basePlate({ callback: etching, move: 'mirror right', label: 'Base plate' });
      if (this.g.genPads) {
        const foot = GRIDFINITY_OPENING - GRIDFINITY_OPENING_MARGIN;
        for (let i = 0; i < Math.min(nx * ny, 4); i++) {
          this.generatePad(foot, foot, this.g.padRadius, 'right', `pad ${i + 1}`);
        }
      }
    });
    this.basePlate({ callback: etching, move: 'up only' });
    this.lid(sum(this.x) + (this.x.length - 1) * this.thickness, sum(this.y) + (this.y.length - 1) * this.thickness);
  }
}

const cells = (key: string, label: string, def: number, help?: string) =>
  ({ key, kind: 'number', label, default: def, min: 1, max: 20, step: 1, integer: true, group: 'dimensions', help }) as const;

export const gridfinityTrayLayout: GeneratorDef = {
  meta: {
    id: 'gridfinitytraylayout',
    name: 'Gridfinity Tray Layout',
    group: 'Tray',
    summary: 'Compartment tray sized to sit on a Gridfinity grid',
    description:
      'A Tray Layout whose outside fits a whole number of Gridfinity cells, so ' +
      'it drops onto a Gridfinity Base or any other Gridfinity baseplate. Edit ' +
      'the layout sketch to remove walls or floors, give the height in mm or ' +
      'in Gridfinity units, and cut pads with magnet holes to glue underneath.',
  },
  params: [
    cells('nx', 'Cells across', 3),
    cells('ny', 'Cells deep', 2),
    {
      key: 'h',
      kind: 'text',
      label: 'Height',
      default: '50',
      group: 'dimensions',
      help: 'A whole number of mm, or of 7 mm Gridfinity units with a "u" after it, such as 6u.',
    },
    {
      key: 'hi',
      kind: 'length',
      label: 'Divider height',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'Height of the inner walls. 0 matches the outer walls, less the stacking lip when stacking.',
    },
    {
      key: 'countx',
      kind: 'number',
      label: 'Compartments across',
      default: 5,
      min: 0,
      max: 50,
      step: 1,
      integer: true,
      group: 'dimensions',
      help: 'Builds the starting layout. 0 gives one per cell.',
    },
    {
      key: 'county',
      kind: 'number',
      label: 'Compartments deep',
      default: 3,
      min: 0,
      max: 50,
      step: 1,
      integer: true,
      group: 'dimensions',
      help: 'Builds the starting layout. 0 gives one per cell.',
    },
    {
      key: 'layout',
      kind: 'text',
      label: 'Layout sketch',
      default: '',
      multiline: true,
      group: 'dimensions',
      placeholder: 'Leave empty for an even grid of the compartments above',
      help:
        'One "+-+" line per row of walls, one "| |" line per row of compartments ' +
        'ending in its depth. Replace a "-" or "|" with a space to drop that wall, ' +
        'and the space inside a compartment with an "X" to leave it without a floor.',
    },
    {
      key: 'stacking',
      kind: 'bool',
      label: 'Stacking lip',
      default: false,
      group: 'dimensions',
      help: 'Leave room at the top for another Gridfinity bin to stack on.',
    },
    {
      key: 'margin',
      kind: 'length',
      label: 'Margin',
      unit: 'mm',
      default: 0.75,
      min: 0,
      max: 10,
      step: 0.05,
      group: 'advanced',
      help: 'Total clearance taken off the outside, so the tray fits the grid.',
    },
    {
      key: 'base_thickness',
      kind: 'length',
      label: 'Base thickness',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 20,
      step: 0.05,
      group: 'advanced',
      help: 'What the tray sits on, for heights in units. 0 uses the material thickness; 4.65 is a printed Gridfinity base.',
    },
    { key: 'gen_pads', kind: 'bool', label: 'Pads', default: true, group: 'dimensions', help: 'Cut pads to glue under the floor.' },
    {
      key: 'pad_radius',
      kind: 'length',
      label: 'Pad corner radius',
      unit: 'mm',
      default: 0.8,
      min: 0,
      max: 18,
      step: 0.1,
      group: 'advanced',
      showIf: (v) => v['gen_pads'] === true,
    },
    {
      key: 'cut_pads_mag_diameter',
      kind: 'length',
      label: 'Magnet hole diameter',
      unit: 'mm',
      default: 6.5,
      min: 0,
      max: 20,
      step: 0.1,
      group: 'dimensions',
      help: '0 leaves them out.',
      showIf: (v) => v['gen_pads'] === true,
    },
    {
      key: 'cut_pads_mag_offset',
      kind: 'length',
      label: 'Magnet hole inset',
      unit: 'mm',
      default: 7.75,
      min: 0,
      max: 21,
      step: 0.05,
      group: 'advanced',
      help: 'From the corners of each cell.',
      showIf: (v) => v['gen_pads'] === true,
    },
    ...LID_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) => {
    const nx = n(v, 'nx', 3);
    const ny = n(v, 'ny', 2);
    const margin = n(v, 'margin', 0.75);
    // Not trimmed: every size line in the sketch starts with a space.
    const layout = decodeLayout(s(v, 'layout', ''));
    return new GridfinityTrayLayout(
      {
        h: s(v, 'h', '50'),
        hi: n(v, 'hi', 0),
        nx,
        ny,
        margin,
        stacking: b(v, 'stacking', false),
        genPads: b(v, 'gen_pads', true),
        padRadius: n(v, 'pad_radius', 0.8),
        cutPadsMagDiameter: n(v, 'cut_pads_mag_diameter', 6.5),
        cutPadsMagOffset: n(v, 'cut_pads_mag_offset', 7.75),
        baseThickness: n(v, 'base_thickness', 0),
        layout:
          layout.trim() === '' ? gridfinityLayout(nx, ny, n(v, 'countx', 5), n(v, 'county', 3), margin) : layout,
      },
      config,
    );
  },
};
