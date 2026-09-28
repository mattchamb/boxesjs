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
import { HANDLE_PARAMS, STACKABLE_PARAMS } from '../params/common';
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
      this.fingerHolesAt(posh, 0, this.x);
    }
  };

  render(): void {
    const be0 = this.o.bottomEdge;

    if (this.o.outside) {
      this.sy = this.adjustSize(this.sy);
      // Top before bottom, as upstream — the shelf heights run bottom to top,
      // so this is the reverse of the usual argument order.
      this.sh = this.adjustSize(this.sh, this.o.topEdge, be0);
      // Only the back of the shelf has material to lose; the front is open.
      this.x = this.adjustSize(this.x, true, false);
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
      this.rectangularWall(x, h, [bottom, 'F', t1, 'e'] as EdgeSpec[], {
        callback: hHoles,
        move: 'up',
        label: 'left',
      });
      this.rectangularWall(x, h, [bottom, 'e', t3, 'F'] as EdgeSpec[], {
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

      for (let i = 0; i < this.sh.length - 1; i++) {
        const e: EdgeSpec[] = [
          'f',
          new SlottedEdge(this, [...this.sy].reverse(), 'f', 0.5 * x),
          'f',
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
    this.rectangularWall(x, h, 'ffff', { move: 'right only' });

    this.rectangularWall(y, h, [bottom, 'f', t2, 'f'] as EdgeSpec[], {
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
      },
      config,
    ),
};
