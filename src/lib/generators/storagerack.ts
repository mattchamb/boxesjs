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
 *
 * `wedged` is this port's own: the floors, rails and back pass through the
 * sides and are held by wedges outside them, so the rack comes apart again.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { tenonFootprints, wedgeClearance, type FaceRect } from '../edges/wedgedtenon';
import { STACKABLE_PARAMS, WEDGED_TENON_PARAMS, assemblyParam } from '../params/common';
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
  /** This port's own option: floors, rails and back held by wedged through-tenons. */
  wedged: boolean;
}

/**
 * A top or bottom edge whose floor can be wedged: a finger-hole edge or a
 * corner joint becomes a line of tenon holes. A stackable edge carries its
 * floor's slots inside its own profile, so that floor stays finger-jointed.
 */
const wedgeable = (e: string) => e === 'h' || e === 'F';

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
      if (this.o.wedged) this.tenonHolesAt(posh, 0, this.depth);
      else this.fingerHolesAt(posh, 0, this.depth);
    }
  }

  /** A top or bottom edge as drawn: under `wedged`, a line of tenon holes where it can be. */
  private outerEdge(e: string): string {
    return this.o.wedged && wedgeable(e) ? 'W' : e;
  }

  /**
   * A full floor's edges. One that closes the rack at a wedged top or bottom
   * is wedged to the back as well; one on an inner level meets the back's
   * slots, fitted dry, as the rails do.
   */
  private floorEdges(e: string): EdgeSpec[] {
    if (!this.o.wedged) return Array.from('fffE');
    if (e === 'e') return ['w', 'f', 'w', 'E'];
    if (wedgeable(e)) return ['w', 'w', 'w', 'E'];
    return Array.from('fffE');
  }

  /**
   * Outside each side wall lie the wedges of every level, of the back near
   * the back edge, and of any wedged top and bottom floors. Where they meet,
   * or hang off the side, the rack cannot be assembled as drawn.
   */
  private checkWedgeClearance(h: number, d: number, be: string, te: string): void {
    const s = this.wedgedTenonSettings;
    const t = this.thickness;
    // From the back's inner face forwards, and up from the inner bottom.
    const tenons: FaceRect[][] = tenonFootprints(s, -t / 2, 0, h, 90);
    let posh = -0.5 * t;
    for (const level of this.sh.slice(0, -1)) {
      posh += level + t;
      tenons.push(...tenonFootprints(s, 0, posh, d, 0));
    }
    if (be === 'W') tenons.push(...tenonFootprints(s, 0, -t / 2, d, 0));
    if (te === 'W') tenons.push(...tenonFootprints(s, 0, h + t / 2, d, 0));

    const back = this.getEdge('W').startWidth();
    const below = this.getEdge(be).startWidth();
    const above = this.getEdge(te).startWidth();
    const { clash, overhang } = wedgeClearance(tenons, [[-back, -below], [d, -below], [d, h + above], [-back, h + above]]);
    if (clash) {
      this.warn(
        'Some of the wedges outside the side walls meet each other. Change the shelf heights or the tenon spacing.',
        'wt_pitch',
      );
    }
    if (overhang) {
      this.warn(
        'Some wedges hang off the edge of the side walls, so they bear on one side of their tenon only. ' +
          'Make the shelves taller or shorten the wedges.',
        'wt_wedge_length',
      );
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
      // A wedged back is recessed into the sides, which costs more depth.
      this.depth = this.adjustSize(this.depth, this.o.wedged ? 'W' : true, false);
      this.sh = this.adjustSize(this.sh, this.outerEdge(te), this.outerEdge(be));
      this.x = this.adjustSize(this.x);
    }

    const t = this.thickness;
    const h = this.sh.reduce((a, c) => a + c, 0) + t * (this.sh.length - 1);
    const x = this.x;
    const d = this.depth;

    // boxes.py also sets `self.closedtop` here; nothing in the engine or this
    // generator reads it, so it is left out rather than carried as dead state.

    const hHoles = [null, () => this.hHoles()];
    const wedged = this.o.wedged;
    // With wedged tenons the back passes through the sides near their back
    // edges, and a wedged top or bottom floor through a line of holes.
    const backJoint = wedged ? 'W' : 'F';
    const sbe = this.outerEdge(be);
    const ste = this.outerEdge(te);

    this.savedContext(() => {
      this.rectangularWall(d, h, [sbe, backJoint, ste, 'E'] as EdgeSpec[], {
        callback: hHoles,
        move: 'up',
        label: 'left side',
      });
      this.rectangularWall(d, h, [sbe, 'E', ste, backJoint] as EdgeSpec[], {
        callback: hHoles,
        move: 'up',
        label: 'right side',
      });

      // Full floors close the top and bottom of the stack.
      this.rectangularWall(d, x, this.floorEdges(be), { move: 'up', label: 'floor 1' });
      this.rectangularWall(d, x, this.floorEdges(te), { move: 'up', label: 'floor 2' });

      // An open top or bottom edge means that level is a full floor too, so it
      // needs no rails.
      let num = this.sh.length - 1;
      if (be === 'e') num -= 1;
      if (te === 'e') num -= 1;

      for (let i = 0; i < num; i++) {
        // Wedged rails pass through the sides; their ends meet the back's
        // slots dry, held there by the wedged sides.
        const side = wedged ? 'w' : 'f';
        this.rectangularWall(d, this.o.rail, [side, 'f', 'e', 'e'], { move: 'up', label: `left rail ${i + 1}` });
        this.rectangularWall(d, this.o.rail, [side, 'e', 'e', 'f'], { move: 'up', label: `right rail ${i + 1}` });
      }
    });
    // Wedged, the sides and the floors' tenoned backs both stand wider than
    // the 'ffff' panel boxes.py steps over; step over the wider of the two.
    const wider = this.getEdge('W').spacing() > this.getEdge('w').spacing() ? 'W' : 'w';
    this.rectangularWall(d, h, wedged ? ['f', wider, 'f', 'f'] : 'ffff', { move: 'right only' });

    const backSides = wedged ? 'w' : 'f';
    this.rectangularWall(x, h, [sbe, backSides, ste, backSides] as EdgeSpec[], {
      callback: [() => this.backHoles()],
      move: 'up',
      label: 'back wall',
    });

    if (wedged) {
      this.checkWedgeClearance(h, d, sbe, ste);
      const n = (l: number) => this.tenonCount(l);
      // Two side edges per inner level, whether rails or a floor; the back's
      // two sides; and a wedged top or bottom floor's sides and back.
      let count = (this.sh.length - 1) * 2 * n(d) + 2 * n(h);
      for (const e of [sbe, ste]) if (e === 'W') count += 2 * n(d) + n(x);
      this.wedges(count, 'up');
    }
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
    assemblyParam(
      ['wedges'],
      'The floors, rails and back pass through the sides, the back recessed; a floor on a stackable edge stays finger-jointed.',
    ),
    ...WEDGED_TENON_PARAMS,
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
        wedged: s(v, 'assembly', 'glue') === 'wedges',
      },
      config,
    ),
};
