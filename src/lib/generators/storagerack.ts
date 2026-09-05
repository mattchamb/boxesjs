/**
 * Storage rack — ported from boxes.py `boxes/generators/storagerack.py`
 * (class `StorageRack`).
 *
 * An open-fronted rack for boxes and trays that bring their own floor. Two side
 * walls carry a stack of shelf levels; the top and bottom levels get a full
 * floor, while every level in between is only a pair of narrow rails, so a
 * drawer slides in on its own bottom and the rack stays light.
 *
 * The back wall ties the sides together and takes the slots for those rails.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { STACKABLE_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

interface StorageRackOptions {
  x: number;
  sh: number[];
  depth: number;
  rail: number;
  outside: boolean;
  bottomEdge: string;
  topEdge: string;
}

class StorageRack extends Boxes {
  /** Mutated by the `outside` adjustment in render(), as boxes.py does. */
  private x: number;
  private sh: number[];
  private depth: number;

  constructor(
    private o: StorageRackOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.x = o.x;
    this.sh = [...o.sh];
    this.depth = o.depth;
  }

  /** Slots in a side wall, one per shelf level below the top one. */
  private hHoles(): void {
    let posh = -0.5 * this.thickness;
    for (const h of this.sh.slice(0, -1)) {
      posh += h + this.thickness;
      this.fingerHolesAt(posh, 0, this.depth);
    }
  }

  /**
   * Slots in the back wall. A level normally gets two short slots, one for each
   * rail; where an open edge leaves the rack's own top or bottom without a
   * panel, that level carries a full-width floor instead and needs one long
   * slot.
   */
  private backHoles(): void {
    let posh = -0.5 * this.thickness;
    const inner = this.sh.slice(0, -1);
    inner.forEach((h, nr) => {
      posh += h + this.thickness;
      if (
        (this.o.bottomEdge === 'e' && nr === 0) ||
        (this.o.topEdge === 'e' && nr === this.sh.length - 2)
      ) {
        this.fingerHolesAt(0, posh, this.x, 0);
      } else {
        this.fingerHolesAt(0, posh, this.o.rail, 0);
        this.fingerHolesAt(this.x, posh, this.o.rail, 180);
      }
    });
  }

  render(): void {
    const be = this.o.bottomEdge;
    const te = this.o.topEdge;

    if (this.o.outside) {
      // Only the back of the rack has material to lose; the front is open.
      this.depth = this.adjustSize(this.depth, true, false);
      this.sh = this.adjustSize(this.sh, te, be);
      this.x = this.adjustSize(this.x);
    }

    const t = this.thickness;
    const h = this.sh.reduce((a, c) => a + c, 0) + t * (this.sh.length - 1);
    const x = this.x;
    const d = this.depth;

    // boxes.py also sets `self.closedtop` here; nothing in the engine or this
    // generator reads it, so it is left out rather than carried as dead state.

    const hHoles = [null, () => this.hHoles()];

    this.savedContext(() => {
      this.rectangularWall(d, h, [be, 'F', te, 'E'] as EdgeSpec[], {
        callback: hHoles,
        move: 'up',
        label: 'left side',
      });
      this.rectangularWall(d, h, [be, 'E', te, 'F'] as EdgeSpec[], {
        callback: hHoles,
        move: 'up',
        label: 'right side',
      });

      // Full floors close the top and bottom of the stack.
      this.rectangularWall(d, x, 'fffE', { move: 'up', label: 'floor 1' });
      this.rectangularWall(d, x, 'fffE', { move: 'up', label: 'floor 2' });

      // An open top or bottom edge means that level is a full floor too, so it
      // needs no rails.
      let num = this.sh.length - 1;
      if (be === 'e') num -= 1;
      if (te === 'e') num -= 1;

      for (let i = 0; i < num; i++) {
        this.rectangularWall(d, this.o.rail, 'ffee', { move: 'up', label: `left rail ${i + 1}` });
        this.rectangularWall(d, this.o.rail, 'feef', { move: 'up', label: `right rail ${i + 1}` });
      }
    });
    this.rectangularWall(d, h, 'ffff', { move: 'right only' });

    this.rectangularWall(x, h, [be, 'f', te, 'f'] as EdgeSpec[], {
      callback: [() => this.backHoles()],
      move: 'up',
      label: 'back wall',
    });
  }
}

export const storageRack: GeneratorDef = {
  meta: {
    id: 'storagerack',
    name: 'Storage Rack',
    group: 'Shelf',
    summary: 'Open rack of shelf levels for boxes and trays that have their own floor',
    description:
      'A rack to slide drawers into. The top and bottom levels get a full floor; ' +
      'every level between them is just a pair of narrow rails, so whatever you ' +
      'put in rides on its own bottom and the rack uses far less material. ' +
      'Shelf heights are set individually, bottom to top. The drawers are not ' +
      'part of this generator — build them with one of the tray or box designs.',
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
    },
    {
      key: 'depth',
      kind: 'length',
      label: 'Depth',
      unit: 'mm',
      default: 200,
      min: 20,
      max: 1000,
      step: 1,
      group: 'dimensions',
      help: 'Front to back. The front is open.',
    },
    {
      key: 'sh',
      kind: 'sections',
      label: 'Shelf heights, bottom to top',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'shelf',
      help: 'Clear height of each level. One entry per shelf.',
    },
    {
      key: 'rail',
      kind: 'length',
      label: 'Rail depth',
      unit: 'mm',
      default: 30,
      min: 5,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'How far each intermediate level reaches in from the sides. The middle stays open.',
    },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: 'Fhse',
      default: 'h',
      group: 'joints',
      help: 'Straight leaves the lowest level open at the bottom, so it gets a full floor instead of rails.',
    },
    {
      key: 'top_edge',
      kind: 'edge',
      label: 'Top edge',
      choices: 'FheSŠ',
      default: 'F',
      group: 'top',
      help: 'Straight leaves the rack open at the top. The stackable edges let a second rack sit on this one.',
    },
    // Shelf heights are scaled to fit the outside height, so the depth of the
    // stackable feet changes how much room the shelves actually get.
    ...STACKABLE_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new StorageRack(
      {
        x: n(v, 'x', 100),
        sh: parseSections(s(v, 'sh', '50*3')),
        depth: n(v, 'depth', 200),
        rail: n(v, 'rail', 30),
        outside: b(v, 'outside', true),
        bottomEdge: s(v, 'bottom_edge', 'h'),
        topEdge: s(v, 'top_edge', 'F'),
      },
      config,
    ),
};
