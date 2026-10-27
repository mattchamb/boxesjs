/**
 * Gridfinity base — ported from boxes.py `boxes/generators/gridfinitybase.py`
 * (class `GridfinityBase`).
 *
 * A baseplate for Zack Freedman's Gridfinity storage system: a plate with a
 * grid of openings on the 42 mm pitch, optionally walled into a tray, and
 * split into panels joined with dovetails when it is too big for the sheet.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { ETCHING } from '../geom/colors';
import { DOVETAIL_PARAMS, LID_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

type BaseType = 'standard' | 'refined';
type PlateHolePos = '<' | 'v' | '^' | '>';

interface GridfinityBaseOptions {
  sizeX: number;
  sizeY: number;
  x: number;
  y: number;
  h: number;
  m: number;
  bottomEdge: string;
  panelEdge: string;
  pitch: number;
  opening: number;
  radius: number;
  cutPads: boolean;
  cutPadsMagDiameter: number;
  cutPadsMagOffset: number;
  padRadius: number;
  panelX: number;
  panelY: number;
  baseType: BaseType;
}

const QUADRANTS = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
] as const;

class GridfinityBase extends Boxes {
  private exactSize = false;

  constructor(
    private o: GridfinityBaseOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private generateGrid(nx: number, ny: number, shiftX = 0, shiftY = 0): void {
    const { radius, padRadius, pitch, opening } = this.o;

    for (let col = 0; col < nx; col++) {
      for (let row = 0; row < ny; row++) {
        const lx = col * pitch + pitch / 2 + shiftX;
        const ly = row * pitch + pitch / 2 + shiftY;

        this.rectangularHole(lx, ly, opening, opening, radius);
        if (this.o.cutPads) {
          this.rectangularHole(lx, ly, opening - 2, opening - 2, padRadius);

          if (this.o.cutPadsMagDiameter > 0) {
            const ofs = this.o.cutPadsMagOffset;
            const dia = this.o.cutPadsMagDiameter;
            for (const [xoff, yoff] of QUADRANTS) {
              const x = lx + (Math.floor(pitch / 2) - ofs) * xoff;
              const y = ly + (Math.floor(pitch / 2) - ofs) * yoff;
              this.hole(x, y, 0, dia);
            }
          }
        }
      }
    }
  }

  private generateRefinedGrid(nx: number, ny: number, shiftX = 0, shiftY = 0, dovetails = true): void {
    const { radius, pitch, opening } = this.o;

    for (let col = 0; col < nx; col++) {
      for (let row = 0; row < ny; row++) {
        const lx = col * pitch + pitch / 2 + shiftX;
        const ly = row * pitch + pitch / 2 + shiftY;

        this.rectangularHole(lx, ly, opening, opening, radius, true, true, ETCHING);
        this.hole(lx, ly, 0, 17);
        // 0,0 is bottom-left grid
        if (dovetails) {
          if (col === 0) this.plateToPlateHole(lx, ly, '<');
          if (row === 0) this.plateToPlateHole(lx, ly, 'v');
          if (row === ny - 1) this.plateToPlateHole(lx, ly, '^');
          if (col === nx - 1) this.plateToPlateHole(lx, ly, '>');
        }
        if (this.o.cutPadsMagDiameter > 0) {
          const ofs = this.o.cutPadsMagOffset;
          // make the pads slightly smaller for press fit
          const dia = this.o.cutPadsMagDiameter - 0.5;
          for (const [xoff, yoff] of QUADRANTS) {
            const x = lx + (Math.floor(pitch / 2) - ofs) * xoff;
            const y = ly + (Math.floor(pitch / 2) - ofs) * yoff;
            this.hole(x, y, 0, dia);
          }
        }
      }
    }
  }

  /** Socket for a plate_to_plate tab, on the plate's edge. */
  private plateToPlateHole(ctrX: number, ctrY: number, pos: PlateHolePos): void {
    this.withRestore(() => {
      const { pitch } = this.o;
      if (pos === '<') this.moveTo(ctrX - pitch / 2, ctrY - 3 + this.burn, 0);
      else if (pos === 'v') this.moveTo(ctrX + 3 - this.burn, ctrY - pitch / 2, 90);
      else if (pos === '^') this.moveTo(ctrX - 3 + this.burn, ctrY + pitch / 2, -90);
      else this.moveTo(ctrX + pitch / 2, ctrY + 3 - this.burn, 180);

      this.edge(3);
      this.corner(-53, 0);
      this.edge(5);
      this.corner(53, 0);
      this.edge(3);
      this.corner(90, 0);
      this.edge(13.5 - this.burn * 2);
      this.corner(90, 0);
      this.edge(3);
      this.corner(53, 0);
      this.edge(5);
      this.corner(-53, 0);
      this.edge(3);
    });
  }

  /** Double dovetail that joins two refined plates edge to edge. */
  private plateToPlateTab(): void {
    this.withRestore(() => {
      for (let i = 0; i < 2; i++) {
        this.edge(3);
        this.corner(53, 0);
        this.edge(5);
        this.corner(-53, 0);
        this.edge(6);
        this.corner(-53, 0);
        this.edge(5);
        this.corner(53, 0);
        this.edge(3);
        this.corner(90, 0);
        this.edge(13.5);
        if (i === 0) this.corner(90, 0);
      }
    });
  }

  /** Split X by Y cells into near-equal panels of at most A by B. */
  private subdivideGrid(
    X: number,
    Y: number,
    A: number,
    B: number,
  ): [number, number, Map<string, [number, number, number, number]>] {
    const numX = Math.ceil(X / A);
    const numY = Math.ceil(Y / B);

    // Balanced segment sizes, the remainder spread from the start.
    const segmentWidths = Array<number>(numX).fill(Math.floor(X / numX));
    for (let i = 0; i < X % numX; i++) segmentWidths[i]! += 1;

    const segmentHeights = Array<number>(numY).fill(Math.floor(Y / numY));
    for (let i = 0; i < Y % numY; i++) segmentHeights[i]! += 1;

    const gridSegments = new Map<string, [number, number, number, number]>();
    let yStart = 0;
    segmentHeights.forEach((h, row) => {
      let xStart = 0;
      segmentWidths.forEach((w, col) => {
        gridSegments.set(`${col},${row}`, [xStart, yStart, w, h]);
        xStart += w;
      });
      yStart += h;
    });

    return [segmentWidths.length, segmentHeights.length, gridSegments];
  }

  render(): void {
    let { sizeX, sizeY, x, y } = this.o;
    const { pitch, h } = this.o;

    if (x === 0 && sizeX === 0) {
      this.warn('Give either a width in cells or an overall width.', 'x');
      return;
    }
    if (y === 0 && sizeY === 0) {
      this.warn('Give either a depth in cells or an overall depth.', 'y');
      return;
    }

    if (sizeX === 0) {
      // a minimally sized base
      sizeX = x * pitch;
    } else {
      // as many columns as fit; a given column count takes precedence
      if (x === 0) x = Math.trunc(sizeX / pitch);
      sizeX = Math.max(sizeX, x * pitch);
    }

    if (sizeY === 0) {
      sizeY = y * pitch;
    } else {
      if (y === 0) y = Math.trunc(sizeY / pitch);
      sizeY = Math.max(sizeY, y * pitch);
    }

    this.exactSize = sizeX === x * pitch && sizeY === y * pitch;

    // Tabs join refined plates only when there are no walls to hold them
    // together, and the plates sit exactly on the pitch.
    if (h === 0 && this.o.baseType === 'refined' && this.exactSize) {
      const numTabs = 8;
      for (let ii = 0; ii < numTabs; ii++) {
        const dontdraw = this.move(17, 14, 'right', true);
        if (!dontdraw) this.plateToPlateTab();
        this.move(17, 14, 'right', false, `tab ${ii + 1}`);
      }
      this.moveTo(-(17 + this.spacing) * 8, 15);
    }

    if (this.o.panelX !== 0 && this.o.panelY !== 0) {
      this.renderSplit(sizeX, sizeY, h, x, y, pitch, this.o.m);
    } else {
      this.renderUnsplit(sizeX, sizeY, h, x, y, pitch, this.o.m);
    }
  }

  private renderSplit(x: number, y: number, h: number, nx: number, ny: number, pitch: number, margin: number): void {
    const padX = x - nx * pitch;
    const padY = y - ny * pitch;
    // the most cells that fit each panel
    const panelNx = Math.floor((this.o.panelX - padX) / pitch);
    const panelNy = Math.floor((this.o.panelY - padY) / pitch);

    const [segmentsCols, segmentsRows, segments] = this.subdivideGrid(nx, ny, panelNx, panelNy);
    const seg = (col: number, row: number) => segments.get(`${col},${row}`)!;
    const dovetailed = this.o.panelEdge !== 'e';

    let boxWidth = 0;
    let boxHeight = 0;
    let edges: EdgeSpec[] = [];

    // The grid panels
    for (let row = 0; row < segmentsRows; row++) {
      const t0 = row === 0 ? 'e' : dovetailed ? 'd' : 'e';
      const t2 = row === segmentsRows - 1 ? 'e' : dovetailed ? 'D' : 'e';

      const padBottom = row === 0 ? Math.floor(padY / 2) : 0;
      const padTop = row === segmentsRows - 1 ? Math.floor(padY / 2) : 0;

      this.savedContext(() => {
        for (let col = 0; col < segmentsCols; col++) {
          const [, , cnx, cny] = seg(col, row);
          const t1 = col === segmentsCols - 1 ? 'e' : dovetailed ? 'd' : 'e';
          const t3 = col === 0 ? 'e' : dovetailed ? 'D' : 'e';

          const padLeft = col === 0 ? Math.floor(padX / 2) : 0;
          const padRight = col === segmentsCols - 1 ? Math.floor(padX / 2) : 0;

          boxWidth = cnx * this.o.pitch + padLeft + padRight;
          boxHeight = cny * this.o.pitch + padBottom + padTop;
          edges = [t0, t1, t2, t3];

          this.rectangularWall(boxWidth, boxHeight, edges, {
            callback: [() => this.generateGrid(cnx, cny, padLeft, padBottom)],
            label: `grid ${row + 1}.${col + 1}`,
          });
          this.rectangularWall(boxWidth, boxHeight, edges, { move: 'right only' });
        }
      });
      this.rectangularWall(boxWidth, boxHeight, edges, { move: 'up only' });
    }

    if (!(h > 0)) return;

    // The floor, unless the walls stand on a plain edge
    if (this.o.bottomEdge !== 'e') {
      // boxes.py sets m on the first column and never clears it, so every
      // floor panel gets the margin.
      const m = margin;
      for (let row = 0; row < segmentsRows; row++) {
        const t0 = row === 0 ? 'f' : 'd';
        const t2 = row === segmentsRows - 1 ? 'f' : 'D';

        const padBottom = row === 0 ? Math.floor(padY / 2) : 0;
        const padTop = row === segmentsRows - 1 ? Math.floor(padY / 2) : 0;

        this.savedContext(() => {
          for (let col = 0; col < segmentsCols; col++) {
            const [, , cnx, cny] = seg(col, row);
            const t1 = col === segmentsCols - 1 ? 'f' : 'd';
            const t3 = col === 0 ? 'f' : 'D';

            const padLeft = col === 0 ? Math.floor(padX / 2) : 0;
            const padRight = col === segmentsCols - 1 ? Math.floor(padX / 2) : 0;

            boxWidth = cnx * pitch + padLeft + padRight + m;
            boxHeight = cny * pitch + padBottom + padTop + m;
            edges = [t0, t1, t2, t3];

            this.rectangularWall(boxWidth, boxHeight, edges, { label: `floor ${row + 1}.${col + 1}` });
            this.rectangularWall(boxWidth, boxHeight, edges, { move: 'right only' });
          }
        });
        this.rectangularWall(boxWidth, boxHeight, edges, { move: 'up only' });
      }
    }

    // The walls
    const bottom: EdgeSpec = this.edges[this.o.bottomEdge] ? this.o.bottomEdge : 'F';

    // along x
    for (let ii = 0; ii < 2; ii++) {
      const resets: [number, EdgeSpec[]][] = [];
      let ee: EdgeSpec[] = [];
      for (let col = 0; col < segmentsCols; col++) {
        const [, , cnx] = seg(col, 0);
        const padLeft = col === 0 ? Math.floor(padX / 2) : 0;
        const padRight = col === segmentsCols - 1 ? Math.floor(padX / 2) : 0;
        boxWidth = cnx * this.o.pitch + padLeft + padRight;

        let m: number;
        if (col === 0) {
          ee = [bottom, 'f', 'e', 'f'];
          m = margin;
        } else if (col === segmentsCols - 1) {
          ee = [bottom, 'f', 'e', 'F'];
          m = margin;
        } else {
          ee = [bottom, 'f', 'e', 'F'];
          m = 0;
        }

        this.rectangularWall(boxWidth + m, h, ee, {
          ignoreWidths: [1, 6],
          move: 'right',
          label: `${ii ? 'back' : 'front'} ${col + 1}`,
        });
        resets.push([boxWidth + m, ee]);
      }

      for (const [val, e] of resets) this.rectangularWall(val, 0, e, { ignoreWidths: [1, 6], move: 'left only' });

      this.rectangularWall(x, h, ee, { ignoreWidths: [1, 6], move: 'up only' });
    }

    // along y
    for (let ii = 0; ii < 2; ii++) {
      const resets: [number, EdgeSpec[]][] = [];
      let ee: EdgeSpec[] = [];
      for (let row = 0; row < segmentsRows; row++) {
        const [, , , cny] = seg(0, row);
        const padBottom = row === 0 ? Math.floor(padY / 2) : 0;
        const padTop = row === segmentsRows - 1 ? Math.floor(padY / 2) : 0;
        boxHeight = cny * pitch + padBottom + padTop;

        let m: number;
        if (row === 0) {
          ee = [bottom, 'f', 'e', 'F'];
          m = margin;
        } else if (row === segmentsRows - 1) {
          ee = [bottom, 'F', 'e', 'F'];
          m = margin;
        } else {
          ee = [bottom, 'f', 'e', 'F'];
          m = 0;
        }
        this.rectangularWall(boxHeight + m, h, ee, {
          ignoreWidths: [1, 6],
          move: 'right',
          label: `${ii ? 'right' : 'left'} ${row + 1}`,
        });

        resets.push([boxHeight + m, ee]);
      }

      for (const [val, e] of resets) this.rectangularWall(val, 0, e, { ignoreWidths: [1, 6], move: 'left only' });

      this.rectangularWall(y, h, ee, { ignoreWidths: [1, 6], move: 'up only' });
    }

    // boxes.py has no lid for a split base.
  }

  private renderUnsplit(x: number, y: number, h: number, nx: number, ny: number, pitch: number, margin: number): void {
    const [t1, t2, t3, t4] = ['e', 'e', 'e', 'e'];
    const bottom: EdgeSpec = this.edges[this.o.bottomEdge] ? this.o.bottomEdge : 'F';
    const sideedge = 'F';

    let shiftX = Math.floor((x - nx * pitch) / 2);
    let shiftY = Math.floor((y - ny * pitch) / 2);

    {
      const [sx, sy] = [shiftX, shiftY];
      this.rectangularWall(x, y, 'eeee', { move: 'up', callback: [() => this.generateGrid(nx, ny, sx, sy)], label: 'grid' });
    }

    if (h > 0) {
      // add margin for walls and lid
      x += 2 * margin;
      y += 2 * margin;
      shiftX += margin;
      shiftY += margin;

      this.rectangularWall(x, h, [bottom, sideedge, t1, sideedge], { ignoreWidths: [1, 6], move: 'right', label: 'front' });
      this.rectangularWall(y, h, [bottom, 'f', t2, 'f'], { ignoreWidths: [1, 6], move: 'up', label: 'left' });
      this.rectangularWall(y, h, [bottom, 'f', t4, 'f'], { ignoreWidths: [1, 6], move: '', label: 'right' });
      this.rectangularWall(x, h, [bottom, sideedge, t3, sideedge], { ignoreWidths: [1, 6], move: 'left up', label: 'back' });

      if (this.o.bottomEdge !== 'e') {
        if (this.o.baseType !== 'refined') {
          this.rectangularWall(x, y, 'ffff', { move: 'right', label: 'bottom' });
        } else {
          this.rectangularWall(x, y, 'ffff', {
            move: 'right',
            callback: [() => this.generateRefinedGrid(nx, ny, shiftX, shiftY, false)],
            label: 'bottom',
          });
        }
      }

      this.lid(x, y);
    } else if (this.o.baseType === 'refined') {
      // A refined base, with dovetails to the next if exactly sized
      this.rectangularWall(x, y, 'eeee', {
        move: 'right',
        callback: [() => this.generateRefinedGrid(nx, ny, shiftX, shiftY, this.exactSize)],
        label: 'refined base',
      });
    }
  }
}

const int = (key: string, label: string, def: number, max: number, help?: string) =>
  ({ key, kind: 'number', label, default: def, min: 0, max, step: 1, integer: true, group: 'dimensions', help }) as const;

export const gridfinityBase: GeneratorDef = {
  meta: {
    id: 'gridfinitybase',
    name: 'Gridfinity Base',
    group: 'Tray',
    summary: 'Baseplate for the Gridfinity storage system, optionally walled',
    description:
      'A plate with a grid of openings on the Gridfinity pitch, for Zack ' +
      'Freedman’s modular storage system. Add walls to make it a tray, cut ' +
      'pads with magnet holes from the openings, or split a big base into ' +
      'panels that fit your sheet and join with dovetails.',
  },
  // boxes.py's own defaults: big fingers, and small, shallow dovetails.
  paramDefaults: { fj_space: 4, fj_finger: 4, dt_size: 3, dt_depth: 0.3, dt_radius: 0.05, dt_angle: 40 },
  params: [
    int('x', 'Cells across', 3, 50, '0 fits as many as the overall width allows.'),
    int('y', 'Cells deep', 2, 50, '0 fits as many as the overall depth allows.'),
    { ...int('size_x', 'Overall width', 0, 2000, 'Larger than the cells leaves a border. 0 fits the cells exactly.'), unit: 'mm' },
    { ...int('size_y', 'Overall depth', 0, 2000, 'Larger than the cells leaves a border. 0 fits the cells exactly.'), unit: 'mm' },
    { key: 'h', kind: 'length', label: 'Wall height', unit: 'mm', default: 21, min: 0, max: 500, step: 1, group: 'dimensions', help: '0 makes a bare baseplate.' },
    {
      key: 'm',
      kind: 'length',
      label: 'Margin',
      unit: 'mm',
      default: 0.5,
      min: 0,
      max: 10,
      step: 0.1,
      group: 'dimensions',
      help: 'Extra room inside the walls, so the base drops in.',
      showIf: (v) => v['h'] !== 0,
    },
    {
      key: 'base_type',
      kind: 'enum',
      label: 'Base type',
      default: 'standard',
      choices: [
        { value: 'standard', label: 'Standard' },
        { value: 'refined', label: 'Refined', help: 'Etched outlines with round holes, plus dovetail tabs between plates when there are no walls.' },
      ],
      group: 'dimensions',
    },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: 'Fhse',
      default: 'F',
      group: 'joints',
      showIf: (v) => v['h'] !== 0,
    },
    { ...int('pitch', 'Pitch', 42, 200, 'Should always be 42.'), unit: 'mm', group: 'advanced' },
    { ...int('opening', 'Opening', 38, 200, 'Typically 38.'), unit: 'mm', group: 'advanced' },
    { key: 'radius', kind: 'length', label: 'Opening corner radius', unit: 'mm', default: 1.6, min: 0, max: 20, step: 0.1, group: 'advanced' },
    { key: 'cut_pads', kind: 'bool', label: 'Cut pads', default: false, group: 'dimensions', help: 'Cut pads for Gridfinity bins from the openings.' },
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
      showIf: (v) => v['cut_pads'] === true || v['base_type'] === 'refined',
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
    },
    { key: 'pad_radius', kind: 'length', label: 'Pad corner radius', unit: 'mm', default: 0.8, min: 0, max: 20, step: 0.1, group: 'advanced' },
    { ...int('panel_x', 'Largest panel width', 0, 2000, 'Split the base into panels no wider than this. 0 leaves it whole.'), unit: 'mm', group: 'joints' },
    { ...int('panel_y', 'Largest panel depth', 0, 2000, 'Split the base into panels no deeper than this. 0 leaves it whole.'), unit: 'mm', group: 'joints' },
    {
      key: 'panel_edge',
      kind: 'edge',
      label: 'Panel joints',
      choices: 'De',
      default: 'D',
      group: 'joints',
      showIf: (v) => v['panel_x'] !== 0 && v['panel_y'] !== 0,
    },
    ...DOVETAIL_PARAMS.map((spec) => ({ ...spec, showIf: undefined })),
    ...LID_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new GridfinityBase(
      {
        sizeX: n(v, 'size_x', 0),
        sizeY: n(v, 'size_y', 0),
        x: n(v, 'x', 3),
        y: n(v, 'y', 2),
        h: n(v, 'h', 21),
        m: n(v, 'm', 0.5),
        bottomEdge: s(v, 'bottom_edge', 'F'),
        panelEdge: s(v, 'panel_edge', 'D'),
        pitch: n(v, 'pitch', 42),
        opening: n(v, 'opening', 38),
        radius: n(v, 'radius', 1.6),
        cutPads: b(v, 'cut_pads', false),
        cutPadsMagDiameter: n(v, 'cut_pads_mag_diameter', 6.5),
        cutPadsMagOffset: n(v, 'cut_pads_mag_offset', 7.75),
        padRadius: n(v, 'pad_radius', 0.8),
        panelX: n(v, 'panel_x', 0),
        panelY: n(v, 'panel_y', 0),
        baseType: s(v, 'base_type', 'standard') as BaseType,
      },
      config,
    ),
};
