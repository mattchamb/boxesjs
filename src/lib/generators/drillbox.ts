/**
 * Drill bit box — ported from boxes.py `boxes/generators/drillbox.py`.
 *
 * A stack of shelves in a tray, each shelf drilled with a grid of holes that
 * grows by a fixed increment. The bottom shelf also gets the sizes engraved, so
 * the box tells you which bit goes where.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { ETCHING } from '../geom/colors';
import { HANDLE_PARAMS, LID_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { BOTTOM_EDGE_CHOICES, topEdges } from '../topedge';
import { n, s, type GeneratorDef } from './types';

/** The subset of top edges that suits an open tray. */
const DRILLBOX_TOP_EDGES = 'eStG';

const sum = (v: number[]) => v.reduce((a, x) => a + x, 0);

interface DrillBoxOptions {
  sx: number[];
  sy: number[];
  sh: number[];
  bottomEdge: string;
  topEdge: string;
  holes: number;
  firsthole: number;
  holeincrement: number;
}

class DrillBox extends Boxes {
  constructor(private o: DrillBoxOptions, config: Partial<BoxesConfig>) {
    super(config);
  }

  /** Slots up the side wall, one row per shelf. */
  private sideholes(l: number): void {
    const t = this.thickness;
    let h = -0.5 * t;
    for (const d of this.o.sh.slice(0, -1)) {
      h += d + t;
      this.fingerHolesAt(0, h, l, 0);
    }
  }

  private drillholes(description = false): void {
    let y = 0;
    // The size runs on across rows rather than restarting, so the grid reads
    // left to right, back to front, as one continuous sequence.
    let d = this.o.firsthole;
    for (const dy of this.o.sy) {
      let x = 0;
      for (const dx of this.o.sx) {
        const iy = dy / this.o.holes;
        for (let k = 0; k < this.o.holes; k++) {
          this.hole(x + dx / 2, y + (k + 0.5) * iy, 0, d + 0.05);
        }
        if (description) {
          this.rectangularHole(x + dx / 2, y + dy / 2, dx - 2, dy - 2, 0, true, true, ETCHING);
          this.text(d.toFixed(1), x + 2, y + 2, 270, 'right', 6, ETCHING);
        }
        d += this.o.holeincrement;
        x += dx;
      }
      y += dy;
    }
  }

  render(): void {
    const t = this.thickness;
    const x = sum(this.o.sx);
    const y = sum(this.o.sy);

    const h = sum(this.o.sh) + t * (this.o.sh.length - 1);
    const b = this.o.bottomEdge;
    const [t1, t2, t3, t4] = topEdges(this, this.o.topEdge);

    this.rectangularWall(x, h, [b, 'f', t1, 'F'], {
      ignoreWidths: [1, 6],
      callback: [() => this.sideholes(x)],
      move: 'right',
      label: 'Front',
    });
    this.rectangularWall(y, h, [b, 'f', t2, 'F'], {
      callback: [() => this.sideholes(y)],
      ignoreWidths: [1, 6],
      move: 'up',
      label: 'Left',
    });
    this.rectangularWall(y, h, [b, 'f', t3, 'F'], {
      callback: [() => this.sideholes(y)],
      ignoreWidths: [1, 6],
      label: 'Right',
    });
    this.rectangularWall(x, h, [b, 'f', t4, 'F'], {
      ignoreWidths: [1, 6],
      callback: [() => this.sideholes(x)],
      move: 'left up',
      label: 'Back',
    });
    if (b !== 'e') {
      this.rectangularWall(x, y, 'ffff', { move: 'right', label: 'Bottom' });
    }
    for (let i = 0; i < this.o.sh.length - 2; i++) {
      this.rectangularWall(x, y, 'ffff', {
        callback: [() => this.drillholes()],
        move: 'right',
        label: 'Shelf',
      });
    }
    this.rectangularWall(x, y, 'ffff', {
      callback: [() => this.drillholes(true)],
      move: 'right',
      label: 'Sizes',
    });
    this.lid(x, y, this.o.topEdge);
  }
}

export const drillBox: GeneratorDef = {
  meta: {
    id: 'drillbox',
    name: 'Drill Box',
    group: 'Tray',
    summary: 'Stacked shelves drilled for a set of drill bits',
    description:
      'Each shelf carries a grid of holes that grows by a fixed step, so a whole ' +
      'set of bits has a place. The lowest shelf gets the sizes engraved beside ' +
      'each group.',
  },
  // boxes.py widens the fingers and the margin for this design: the shelves are
  // thin and the default proportions leave the joints too weak to hold them.
  paramDefaults: { fj_space: 3, fj_finger: 3, fj_surroundingspaces: 1, rt_outset: 1 },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Columns left to right',
      default: '25*3',
      group: 'dimensions',
      itemLabel: 'column',
      help: 'Width of each column of holes.',
    },
    {
      key: 'sy',
      kind: 'sections',
      label: 'Rows back to front',
      default: '60*4',
      group: 'dimensions',
      itemLabel: 'row',
    },
    {
      key: 'sh',
      kind: 'sections',
      label: 'Shelf spacings bottom to top',
      default: '5:25:10',
      group: 'dimensions',
      itemLabel: 'shelf',
      help: 'Gap below each shelf. The last value is the space above the top shelf.',
    },
    {
      key: 'holes',
      kind: 'number',
      label: 'Holes per size',
      default: 3,
      min: 1,
      max: 20,
      step: 1,
      group: 'dimensions',
      help: 'How many of each bit the box holds.',
    },
    {
      key: 'firsthole',
      kind: 'length',
      label: 'Smallest bit',
      unit: 'mm',
      default: 1.0,
      min: 0.1,
      max: 50,
      step: 0.1,
      group: 'dimensions',
    },
    {
      key: 'holeincrement',
      kind: 'length',
      label: 'Step between sizes',
      unit: 'mm',
      default: 0.5,
      min: 0.1,
      max: 10,
      step: 0.1,
      group: 'dimensions',
    },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: BOTTOM_EDGE_CHOICES,
      default: 'h',
      group: 'joints',
    },
    {
      key: 'top_edge',
      kind: 'edge',
      label: 'Top edge',
      choices: DRILLBOX_TOP_EDGES,
      default: 'e',
      group: 'top',
      help: 'The tray is open at the top; this only changes how the rim finishes.',
    },
    ...HANDLE_PARAMS,
    ...LID_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new DrillBox(
      {
        sx: parseSections(s(v, 'sx', '25*3')),
        sy: parseSections(s(v, 'sy', '60*4')),
        sh: parseSections(s(v, 'sh', '5:25:10')),
        bottomEdge: s(v, 'bottom_edge', 'h'),
        topEdge: s(v, 'top_edge', 'e'),
        holes: n(v, 'holes', 3),
        firsthole: n(v, 'firsthole', 1.0),
        holeincrement: n(v, 'holeincrement', 0.5),
      },
      config,
    ),
};
