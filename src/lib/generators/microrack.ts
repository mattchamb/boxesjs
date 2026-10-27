/**
 * SBC micro rack — ported from boxes.py `boxes/generators/microrack.py`
 * (class `SBCMicroRack`).
 *
 * A stackable rack of shelves for Raspberry Pi-style single-board
 * computers, with mounting holes for each board and openings in one side
 * for its network and USB ports.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { STACKABLE_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface MicroRackOptions {
  x: number;
  y: number;
  sbcs: number;
  clearanceX: number;
  clearanceY: number;
  clearanceZ: number;
  holeDistEdge: number;
  holeGridX: number;
  holeGridY: number;
  holeDiameter: number;
  netusbZ: number;
  netusbX: number;
  stable: boolean;
  switch: boolean;
}

class MicroRack extends Boxes {
  constructor(
    private o: MicroRackOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private paintMountingHoles = (): void => {
    const cy = this.o.clearanceY;
    const cx = this.o.clearanceX;

    const h2r = this.o.holeDiameter;
    const hde = this.o.holeDistEdge;
    const hgdx = this.o.holeGridX;
    const hgdy = this.o.holeGridY;

    this.hole(h2r + cx + hde / 2, h2r + cy + hde / 2, h2r / 2);
    this.hole(h2r + cx + hgdx + hde / 2, h2r + cy + hde / 2, h2r / 2);
    this.hole(h2r + cx + hde / 2, h2r + cy + hgdy + hde / 2, h2r / 2);
    this.hole(h2r + cx + hgdx + hde / 2, h2r + cy + hgdy + hde / 2, h2r / 2);
  };

  private paintStableFeatures = (): void => {
    if (this.o.stable) this.hole(10, 10, 0, 6.5);
  };

  private paintNetusbHoles = (): void => {
    const t = this.thickness;
    const w = this.o.x + this.o.holeDistEdge * 2;
    const heightPer = this.o.clearanceZ + t;
    for (let i = 0; i < this.o.sbcs; i++) {
      this.rectangularHole(w / 2, heightPer * i + 15, this.o.netusbX, this.o.netusbZ, 1);
    }
  };

  private paintFingerHoles = (): void => {
    const t = this.thickness;
    const heightPer = this.o.clearanceZ + t;
    for (let i = 0; i < this.o.sbcs; i++) {
      this.fingerHolesAt(heightPer * i + heightPer / 2 + 1.5, this.o.holeDistEdge, this.o.x, 90);
    }
  };

  render(): void {
    const { x, y, sbcs, holeDistEdge: hde } = this.o;
    const t = this.thickness;

    const heightPer = this.o.clearanceZ + t;
    const heightTotal = sbcs * heightPer;
    const sideW = heightTotal + heightPer / 2;
    const width = x + hde * 2;

    this.savedContext(() => {
      // The callbacks run one per edge, so the port openings go along the
      // second edge, not the first.
      this.rectangularWall(sideW, width, 'eseS', {
        callback: [this.paintFingerHoles, this.paintNetusbHoles],
        move: 'up',
        label: 'port side',
      });

      this.rectangularWall(sideW, width, 'eseS', {
        callback: [this.paintFingerHoles, this.paintStableFeatures],
        move: 'up',
        label: 'side',
      });

      if (this.o.switch) {
        this.rectangularWall(sideW, width, 'eseS', {
          callback: [this.paintStableFeatures],
          move: 'up',
          label: 'switch holder',
        });
      }
    });

    this.rectangularWall(sideW, width, 'eseS', { move: 'right only' });

    this.rectangularWall(y + hde * 2, width, 'efef', { move: 'up', label: 'top' });

    for (let i = 0; i < sbcs; i++) {
      this.rectangularWall(y + hde * 2, width, 'efef', {
        callback: [this.paintMountingHoles],
        move: 'up',
        label: `shelf ${i + 1}`,
      });
    }
  }
}

const mm = (key: string, label: string, def: number, help?: string, integer = true) =>
  ({ key, kind: 'number', label, unit: 'mm', default: def, min: 0, max: 300, step: integer ? 1 : 0.05, integer, group: 'dimensions', help }) as const;

export const microRack: GeneratorDef = {
  meta: {
    id: 'microrack',
    name: 'SBC Micro Rack',
    group: 'Shelf',
    summary: 'Stackable rack of shelves for Raspberry Pi-style boards',
    description:
      'One shelf per board, with its mounting holes, between two sides that ' +
      'stack onto another rack. One side has an opening for each board’s ' +
      'network and USB ports.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Board width', unit: 'mm', default: 56, min: 20, max: 500, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Board length', unit: 'mm', default: 85, min: 20, max: 500, step: 1, group: 'dimensions' },
    { key: 'sbcs', kind: 'number', label: 'Boards', default: 5, min: 1, max: 30, step: 1, integer: true, group: 'dimensions' },
    mm('clearance_x', 'Clearance across', 3, 'Space round the board, across it.'),
    mm('clearance_y', 'Clearance along', 3, 'Space round the board, along it.'),
    mm('clearance_z', 'Space per board', 28, 'Height of the space above each shelf.'),
    mm('hole_dist_edge', 'Hole inset', 3.5, 'Of the mounting holes from the board’s edge.', false),
    mm('hole_grid_dimension_x', 'Hole spacing across', 58),
    mm('hole_grid_dimension_y', 'Hole spacing along', 49),
    mm('hole_diameter', 'Mounting hole diameter', 2.75, undefined, false),
    mm('netusb_z', 'Port opening height', 18),
    mm('netusb_x', 'Port opening width', 53),
    {
      key: 'stable',
      kind: 'bool',
      label: 'Dowel holes',
      default: false,
      group: 'dimensions',
      help: 'Holes for a 1/4" dowel through the base and top, to steady a stack.',
    },
    {
      key: 'switch',
      kind: 'bool',
      label: 'Switch holder',
      default: false,
      group: 'dimensions',
      help: 'An extra upright to hold a network switch. Works best with dowel holes.',
    },
    ...STACKABLE_PARAMS.map((spec) => ({ ...spec, showIf: undefined })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new MicroRack(
      {
        x: n(v, 'x', 56),
        y: n(v, 'y', 85),
        sbcs: n(v, 'sbcs', 5),
        clearanceX: n(v, 'clearance_x', 3),
        clearanceY: n(v, 'clearance_y', 3),
        clearanceZ: n(v, 'clearance_z', 28),
        holeDistEdge: n(v, 'hole_dist_edge', 3.5),
        holeGridX: n(v, 'hole_grid_dimension_x', 58),
        holeGridY: n(v, 'hole_grid_dimension_y', 49),
        holeDiameter: n(v, 'hole_diameter', 2.75),
        netusbZ: n(v, 'netusb_z', 18),
        netusbX: n(v, 'netusb_x', 53),
        stable: b(v, 'stable', false),
        switch: b(v, 'switch', false),
      },
      config,
    ),
};
