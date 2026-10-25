/**
 * Storage shelf — ported from boxes.py `boxes/generators/storageshelf.py`
 * (class `StorageShelf`).
 *
 * A pigeonhole shelf: a closed carcass divided into a grid of open-fronted
 * compartments, sized to hold type trays. Unlike StorageRack every level is a
 * full shelf rather than a pair of rails, and the compartments can also be
 * split left-to-right by vertical dividers.
 *
 * The optional retainer is a low lip across the front of each level that stops
 * whatever is on the shelf sliding out.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { SlottedEdge } from '../edges/slots';
import { HANDLE_PARAMS, STACKABLE_PARAMS, WEDGED_TENON_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { BOTTOM_EDGE_CHOICES, drawLid, isClosedTop, topEdges, TOP_EDGE_CHOICES } from '../topedge';
import { b, n, s, type GeneratorDef } from './types';

interface StorageShelfOptions {
  x: number;
  sy: number[];
  sh: number[];
  outside: boolean;
  bottomEdge: string;
  topEdge: string;
  retainer: number;
  retainerHoleEdge: boolean;
  /** This port's own option: shelves held by wedged through-tenons. */
  wedged: boolean;
}

class StorageShelf extends Boxes {
  /** Mutated by the `outside` adjustment in render(), as boxes.py does. */
  private x: number;
  private sy: number[];
  private sh: number[];

  constructor(
    private o: StorageShelfOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.x = o.x;
    this.sy = [...o.sy];
    this.sh = [...o.sh];
  }

  /** Full-height slots in the back wall, one per vertical divider. */
  private ySlots = (): void => {
    const t = this.thickness;
    let posy = -0.5 * t;
    const h = this.sh.reduce((a, c) => a + c, 0) + t * (this.sh.length - 1);
    for (const y of this.sy.slice(0, -1)) {
      posy += y + t;
      this.fingerHolesAt(posy, 0, h, 90);
    }
  };

  /**
   * Slots in the back wall for the horizontal shelves. Each level is cut as one
   * run per bay, so the slots stop either side of a vertical divider.
   */
  private hSlots = (): void => {
    const t = this.thickness;
    let posh = -0.5 * t;
    for (const h of this.sh.slice(0, -1)) {
      posh += h + t;
      let posy = 0;
      for (const y of [...this.sy].reverse()) {
        this.fingerHolesAt(posh, posy, y);
        posy += y + t;
      }
    }
  };

  /** Slots for the vertical dividers, in a full-depth panel. */
  private yHoles = (): void => {
    const t = this.thickness;
    let posy = -0.5 * t;
    for (const y of this.sy.slice(0, -1)) {
      posy += y + t;
      this.fingerHolesAt(posy, 0, this.x);
    }
  };

  /** Slots for the shelves, in a side wall. */
  private hHoles = (): void => {
    const t = this.thickness;
    let posh = -0.5 * t;
    for (const h of this.sh.slice(0, -1)) {
      posh += h + t;
      if (this.o.wedged) this.tenonHolesAt(posh, 0, this.x);
      else this.fingerHolesAt(posh, 0, this.x);
    }
  };

  /**
   * Outside each side wall, the back's wedges lie horizontally near its back
   * edge and the shelves' wedges stand vertically. On a shallow shelf the two
   * can meet; a part that cannot be assembled is worth a warning.
   */
  private checkWedgeClearance(x: number, h: number): void {
    const s = this.wedgedTenonSettings;
    const t = this.thickness;
    const half = s.wedge_length / 2;
    const backCentre = s.holeInset();
    // Measured from the side wall's back edge: the back's wedges span its
    // hole line ± half a wedge; each shelf wedge is a wedge thickness wide,
    // centred on its tenon, which is measured from the back's inner face.
    const shelfStart = s.holeInset() + t / 2;
    const backWedges = s.centres(h).map((z) => ({ x0: backCentre - half, x1: backCentre + half, z0: z - t / 2, z1: z + t / 2 }));
    let posh = -0.5 * t;
    for (const level of this.sh.slice(0, -1)) {
      posh += level + t;
      for (const c of s.centres(x)) {
        const sx0 = shelfStart + c - t / 2;
        const sx1 = shelfStart + c + t / 2;
        for (const b of backWedges) {
          if (sx0 < b.x1 && b.x0 < sx1 && posh - half < b.z1 && b.z0 < posh + half) {
            this.warn(
              'A shelf wedge meets one of the back’s wedges outside the side walls. ' +
                'Make the shelf deeper or change the tenon spacing.',
              'wt_pitch',
            );
            return;
          }
        }
      }
    }
  }

  render(): void {
    const be0 = this.o.bottomEdge;

    if (this.o.outside) {
      this.sy = this.adjustSize(this.sy);
      // Top before bottom, as upstream — the shelf heights run bottom to top,
      // so this is the reverse of the usual argument order.
      this.sh = this.adjustSize(this.sh, this.o.topEdge, be0);
      // Only the back of the shelf has material to lose; the front is open.
      // A wedged back is recessed into the sides, which costs more depth.
      this.x = this.adjustSize(this.x, this.o.wedged ? 'W' : true, false);
    }

    const t = this.thickness;
    const y = this.sy.reduce((a, c) => a + c, 0) + t * (this.sy.length - 1);
    const h = this.sh.reduce((a, c) => a + c, 0) + t * (this.sh.length - 1);
    const x = this.x;

    const bottom = be0;
    let [t1, t2, t3, t4] = topEdges(this, this.o.topEdge);
    // The handle triangle belongs on the two wide walls, which here are the x
    // sides rather than the y sides topEdges() assumes.
    if (this.o.topEdge === 't') [t1, t2, t3, t4] = [t2, t1, t4, t3];
    const closedtop = isClosedTop(this.o.topEdge);

    const hHoles = [null, this.hHoles];

    this.savedContext(() => {
      // With wedged tenons the back passes through the sides near their back
      // edges instead of meeting them at a finger-jointed corner.
      const backJoint = this.o.wedged ? 'W' : 'F';
      this.rectangularWall(x, h, [bottom, backJoint, t1, 'e'] as EdgeSpec[], {
        callback: hHoles,
        move: 'up',
        label: 'left',
      });
      this.rectangularWall(x, h, [bottom, 'e', t3, backJoint] as EdgeSpec[], {
        callback: hHoles,
        move: 'up',
        label: 'right',
      });

      if (bottom !== 'e') {
        // A retainer across the front of the lowest level needs a joint to sit
        // in, so the floor's front edge stops being plain.
        const e = this.o.retainer ? 'ffff' : 'fffe';
        this.rectangularWall(x, y, e, {
          callback: [null, this.yHoles],
          move: 'up',
          label: 'bottom',
        });
      }

      // With wedged tenons the shelves' side edges pass through the side
      // walls and are wedged outside them.
      const sideJoint = this.o.wedged ? 'w' : 'f';
      for (let i = 0; i < this.sh.length - 1; i++) {
        const e: EdgeSpec[] = [
          sideJoint,
          new SlottedEdge(this, [...this.sy].reverse(), 'f', 0.5 * x),
          sideJoint,
          this.o.retainer ? 'f' : 'e',
        ];
        this.rectangularWall(x, y, e, { move: 'up', label: `inner horizontal ${i + 1}` });
      }

      if (closedtop) {
        this.rectangularWall(x, y, this.o.topEdge === 'f' ? 'FFFe' : 'fffe', {
          callback: [null, this.yHoles],
          move: 'up',
          label: 'top',
        });
      } else {
        drawLid(this, x, y, this.o.topEdge);
      }
    });
    // A wedged back makes the side walls wider than the nominal 'ffff' panel
    // boxes.py steps over here; step over the widest part of the column then.
    this.rectangularWall(x, h, this.o.wedged ? 'fWff' : 'ffff', { move: 'right only' });

    const backSides = this.o.wedged ? 'w' : 'f';
    this.rectangularWall(y, h, [bottom, backSides, t2, backSides] as EdgeSpec[], {
      callback: [this.ySlots, this.hSlots],
      move: 'up',
      label: 'back',
    });

    const be: EdgeSpec = bottom !== 'e' ? 'f' : 'e';
    for (let i = 0; i < this.sy.length - 1; i++) {
      // The dividers slot into the shelves from the opposite side, so their
      // slotted edge runs up the back of the panel rather than the front.
      const e: EdgeSpec[] = [
        be,
        new SlottedEdge(this, this.sh, 'e', 0.5 * x),
        closedtop ? 'f' : 'e',
        'f',
      ];
      this.rectangularWall(x, h, e, { move: 'up', label: `inner vertical ${i + 1}` });
    }

    if (this.o.retainer) {
      for (let i = 0; i < this.sh.length; i++) {
        // The lowest retainer sits on the bottom panel when there is one, so it
        // gets the same finger-hole edge the bottom edge asks for.
        const e =
          this.o.retainerHoleEdge || (i === 0 && bottom === 'h') ? 'hEeE' : 'FEeE';
        this.rectangularWall(y, this.o.retainer, e, {
          move: 'up',
          label: `retainer ${i + 1}`,
        });
      }
    }

    if (this.o.wedged) {
      this.checkWedgeClearance(x, h);
      // Two side edges per inner shelf, and the back's two side edges.
      this.wedges(this.tenonCount(x) * 2 * (this.sh.length - 1) + this.tenonCount(h) * 2, 'up');
    }
  }
}

export const storageShelf: GeneratorDef = {
  meta: {
    id: 'storageshelf',
    name: 'Storage Shelf',
    group: 'Shelf',
    summary: 'Pigeonhole shelf of open-fronted compartments, sized for trays',
    description:
      'A closed carcass split into a grid of open-fronted compartments. Shelf ' +
      'heights and bay widths are set individually, so a column of type trays ' +
      'can each get the height they need. An optional retainer lip across the ' +
      'front of every level stops the contents sliding out.',
  },
  // Shelves and dividers are short walls; the standard edge margin would leave
  // many of them with no fingers at all, so this generator starts smaller. The
  // handle outset clears the side walls it rises between.
  paramDefaults: { fj_surroundingspaces: 0.5, rt_outset: 1 },
  params: [
    {
      key: 'x',
      kind: 'length',
      label: 'Depth',
      unit: 'mm',
      default: 100,
      min: 20,
      max: 1000,
      step: 1,
      group: 'dimensions',
      help: 'Front to back. The front is open.',
    },
    {
      key: 'sy',
      kind: 'sections',
      label: 'Bay widths, left to right',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'bay',
      help: 'Clear width of each column of compartments.',
    },
    {
      key: 'sh',
      kind: 'sections',
      label: 'Shelf heights, bottom to top',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'shelf',
      help: 'Clear height of each level.',
    },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'retainer',
      kind: 'length',
      label: 'Retainer height',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 200,
      step: 1,
      group: 'dimensions',
      help: 'A lip across the front of every level. 0 leaves the fronts fully open.',
    },
    {
      key: 'retainer_hole_edge',
      kind: 'bool',
      label: 'Retainers sit in slots',
      default: false,
      group: 'dimensions',
      help: 'Joins each retainer with a finger-hole edge instead of fingers on the shelf front.',
    },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: BOTTOM_EDGE_CHOICES,
      default: 'h',
      group: 'joints',
      help: 'Straight leaves the lowest level without its own floor.',
    },
    {
      key: 'top_edge',
      kind: 'edge',
      label: 'Top edge',
      choices: TOP_EDGE_CHOICES,
      default: 'e',
      group: 'top',
      help: 'Straight leaves the shelf open at the top. Finger joints close it with a panel.',
    },
    ...HANDLE_PARAMS,
    // Shelf heights are scaled to fit the outside height, so the depth of the
    // stackable feet changes how much room the shelves actually get.
    ...STACKABLE_PARAMS,
    {
      key: 'wedged',
      kind: 'bool',
      label: 'Wedged tenons on the shelves',
      default: false,
      group: 'joints',
      help:
        'The shelves and the back pass through the side walls and are locked by wedges outside ' +
        'them, so the shelf can be taken apart again without glue. The back is recessed so its ' +
        'wedges stay within the depth. Not part of boxes.py.',
    },
    ...WEDGED_TENON_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new StorageShelf(
      {
        x: n(v, 'x', 100),
        sy: parseSections(s(v, 'sy', '50*3')),
        sh: parseSections(s(v, 'sh', '50*3')),
        outside: b(v, 'outside', true),
        bottomEdge: s(v, 'bottom_edge', 'h'),
        topEdge: s(v, 'top_edge', 'e'),
        retainer: n(v, 'retainer', 0),
        retainerHoleEdge: b(v, 'retainer_hole_edge', false),
        wedged: b(v, 'wedged', false),
      },
      config,
    ),
};
