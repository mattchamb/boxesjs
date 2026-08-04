/**
 * Stackable paint storage — ported from boxes.py `boxes/generators/paintbox.py`
 * (class `PaintStorage`).
 *
 * Two side walls stand on stackable feet and carry a shelf drilled with a grid
 * of holes; paint pots drop through the holes and hang by their rims. Stack a
 * second unit on top and its feet drop into the recesses of this one.
 *
 * The `drawer` flag reuses the same parts as a stackable drawer instead: the
 * drilled shelf is replaced by two plain sides, and the walls gain finger
 * joints where they had plain outset edges.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { StackableBaseEdge, type StackableSettings } from '../edges/stackable';
import { STACKABLE_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface PaintStorageOptions {
  x: number;
  y: number;
  canheight: number;
  candiameter: number;
  minspace: number;
  additionalBottom: boolean;
  additionalTop: boolean;
  hexpattern: boolean;
  drawer: boolean;
}

class PaintStorage extends Boxes {
  constructor(
    private o: PaintStorageOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /** The generator sizes itself from the feet, so it reads them off the edge. */
  private get stack(): StackableSettings {
    return (this.getEdge('s') as StackableBaseEdge).settings;
  }

  /** Wall height: the cans, less what the feet and their slots consume. */
  private get wallHeight(): number {
    const stack = this.stack;
    return this.o.canheight - stack.height - stack.holedistance + this.thickness;
  }

  /** Holes for the paint cans, spread evenly over the shelf. */
  private paintholes(): void {
    const { x, y, candiameter, minspace } = this.o;

    if (this.o.hexpattern) {
      this.moveTo(minspace / 2, minspace / 2);
      // boxes.py mutates the shared settings object rather than making its own.
      const settings = this.hexHolesSettings;
      settings.setValues(this.thickness, true, {
        diameter: candiameter,
        distance: minspace,
        style: 'circle',
      });
      // Width and height arrive swapped, matching the axis flip below.
      this.hexHolesRectangle(y - minspace, x - minspace, settings);
      return;
    }

    const nX = Math.floor(x / (candiameter + minspace));
    const nY = Math.floor(y / (candiameter + minspace));
    if (nX <= 0 || nY <= 0) return;

    const spacingX = (x - nX * candiameter) / nX;
    const spacingY = (y - nY * candiameter) / nY;
    for (let i = 0; i < nY; i++) {
      for (let j = 0; j < nX; j++) {
        // The y counter drives the hole's x coordinate and vice versa. That is
        // boxes.py's own transposition, and the shelf is drawn rotated to suit.
        this.hole(
          i * (candiameter + spacingY) + (candiameter + spacingY) / 2,
          j * (candiameter + spacingX) + (candiameter + spacingX) / 2,
          candiameter / 2,
        );
      }
    }
  }

  /** Hand hole in each side wall, plus the slots the shelves pass through. */
  private sidesCb(): void {
    const { x, canheight } = this.o;
    const t = this.thickness;
    const h = this.wallHeight;

    const hx = 0.5 * x;
    const hh = h / 4.0;
    const hr = Math.min(hx, hh) / 2;

    // boxes.py repeats this call identically in both branches of `drawer`.
    this.rectangularHole(h / 3, x / 2.0 - t, hh, hx, hr);

    if (this.o.drawer) return;

    this.fingerHolesAt((canheight / 3) * 2 - t * 2, -t, x, 90);
    if (this.o.additionalBottom) {
      this.fingerHolesAt(canheight / 6 - t / 2, -t, x, 90);
    }
    if (this.o.additionalTop) {
      this.fingerHolesAt(canheight - (canheight / 6 + t), -t, x, 90);
    }
  }

  render(): void {
    const { x, y, drawer } = this.o;
    const t = this.thickness;
    const stack = this.stack;
    const h = this.wallHeight;

    const wallKeys = drawer ? 'FsFS' : 'EsES';
    const bottomKeys = drawer ? 'FfFf' : 'EfEf';
    const sides = [() => this.sidesCb()];

    this.rectangularWall(h, x - 2 * t, wallKeys, {
      ignoreWidths: [1, 2, 5, 6],
      callback: sides,
      move: 'up',
      label: 'Side left',
    });
    this.rectangularWall(h, x - 2 * t, wallKeys, {
      ignoreWidths: [1, 2, 5, 6],
      callback: sides,
      move: 'right',
      label: 'Side right',
    });

    // Spacers that pack out the gap between the feet and the bottom slots. The
    // first draws in place; the second does the stepping for both.
    const plate = 0.8 * stack.height + stack.holedistance;
    this.rectangularWall(plate, x, 'eeee', { move: '', label: 'Plate' });
    this.rectangularWall(plate, x, 'eeee', { move: 'down right', label: 'Plate' });

    this.rectangularWall(y, x - 2 * t, bottomKeys, {
      ignoreWidths: [1, 2, 5, 6],
      move: 'up',
      label: 'Bottom',
    });

    if (!drawer) {
      const holes = [() => this.paintholes()];
      this.rectangularWall(y, x, 'efef', { callback: holes, move: 'up', label: 'Top' });
      if (this.o.additionalBottom) {
        this.rectangularWall(y, x, 'efef', { callback: holes, move: 'up', label: 'Floor' });
      }
      if (this.o.additionalTop) {
        this.rectangularWall(y, x, 'efef', { callback: holes, move: 'up', label: 'Shelf' });
      }
    } else {
      this.rectangularWall(y, h, 'efff', { move: 'up', label: 'Drawer front' });
      this.rectangularWall(y, h, 'efff', { move: 'up', label: 'Drawer back' });
    }
  }
}

export const paintStorage: GeneratorDef = {
  meta: {
    id: 'paintstorage',
    name: 'Paint Storage',
    group: 'Shelf',
    summary: 'Stackable rack that holds paint pots by their rims',
    description:
      'A shelf drilled with a grid of holes, carried between two walls that ' +
      'stand on stackable feet. Pots drop through and hang by their rims, and ' +
      'a second rack stacks on top. Switch it to a drawer and the same parts ' +
      'make a stackable open tray instead.',
  },
  params: [
    {
      key: 'x',
      kind: 'length',
      label: 'Width',
      unit: 'mm',
      default: 100,
      min: 20,
      max: 1000,
      step: 1,
      group: 'dimensions',
      help: 'Inner width, across the shelf.',
    },
    {
      key: 'y',
      kind: 'length',
      label: 'Depth',
      unit: 'mm',
      default: 300,
      min: 20,
      max: 2000,
      step: 1,
      group: 'dimensions',
      help: 'Inner depth, along the shelf.',
    },
    {
      key: 'canheight',
      kind: 'length',
      label: 'Pot height',
      unit: 'mm',
      default: 50,
      min: 20,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'Height of the pots. The walls are sized from this, less the feet.',
    },
    {
      key: 'candiameter',
      kind: 'length',
      label: 'Pot diameter',
      unit: 'mm',
      default: 30,
      min: 5,
      max: 200,
      step: 1,
      group: 'dimensions',
      help: 'Diameter of the holes the pots drop through.',
    },
    {
      key: 'minspace',
      kind: 'length',
      label: 'Minimum gap',
      unit: 'mm',
      default: 10,
      min: 1,
      max: 100,
      step: 1,
      group: 'dimensions',
      help: 'Least material left between neighbouring holes.',
    },
    {
      key: 'hexpattern',
      kind: 'bool',
      label: 'Stagger the holes',
      default: false,
      group: 'dimensions',
      help: 'Packs the holes hexagonally instead of on a square grid, fitting more in.',
    },
    {
      key: 'additional_bottom',
      kind: 'bool',
      label: 'Extra floor below',
      default: false,
      group: 'dimensions',
      help: 'A second drilled shelf low down, so tall pots are held at two heights.',
    },
    {
      key: 'additional_top',
      kind: 'bool',
      label: 'Extra floor above',
      default: false,
      group: 'dimensions',
    },
    {
      key: 'drawer',
      kind: 'bool',
      label: 'Build as a drawer',
      default: false,
      group: 'dimensions',
      help: 'Replaces the drilled shelf with plain sides, making a stackable open tray.',
    },
    ...STACKABLE_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new PaintStorage(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 300),
        canheight: n(v, 'canheight', 50),
        candiameter: n(v, 'candiameter', 30),
        minspace: n(v, 'minspace', 10),
        additionalBottom: b(v, 'additional_bottom', false),
        additionalTop: b(v, 'additional_top', false),
        hexpattern: b(v, 'hexpattern', false),
        drawer: b(v, 'drawer', false),
      },
      config,
    ),
};
