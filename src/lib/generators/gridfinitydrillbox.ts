/**
 * Gridfinity drill box — ported from boxes.py
 * `boxes/generators/gridfinitydrillbox.py` (class `GridfinityDrillBox`).
 *
 * The Drill Box's stack of shelves, sized to sit on a Gridfinity grid. Unlike
 * the Drill Box, the shelves come blank: you add whatever hole pattern your
 * tools need. The floor is etched with the corner cells so the pads glue on
 * square.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { LID_PARAMS, MOUNTING_PARAMS, MOUNTING_SIDE_PARAM, STACKABLE_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { topEdges } from '../topedge';
import {
  GRIDFINITY_OPENING,
  GRIDFINITY_OPENING_MARGIN,
  GRIDFINITY_PITCH,
  gridfinityBaseplateEtching,
} from './gridfinitytraylayout';
import { n, s, type GeneratorDef } from './types';

const sum = (v: number[]) => v.reduce((a, x) => a + x, 0);

interface GridfinityDrillBoxOptions {
  nx: number;
  ny: number;
  margin: number;
  sh: number[];
  topEdge: string;
}

class GridfinityDrillBox extends Boxes {
  constructor(
    private o: GridfinityDrillBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
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

  render(): void {
    const t = this.thickness;
    const { nx, ny, margin, sh } = this.o;
    const x = GRIDFINITY_PITCH * nx - margin - 2 * t;
    const y = GRIDFINITY_PITCH * ny - margin - 2 * t;

    const h = sum(sh) + t * (sh.length - 1);
    // boxes.py fixes the bottom edge; it has no option for it.
    const b = 'F';
    const [t1, t2, t3, t4] = topEdges(this, this.o.topEdge);

    this.rectangularWall(x, h, [b, 'f', t1, 'f'], {
      ignoreWidths: [1, 6],
      callback: [() => this.sideholes(x)],
      move: 'right',
      label: 'Front',
    });
    this.rectangularWall(y, h, [b, 'F', t2, 'F'], {
      callback: [() => this.sideholes(y)],
      ignoreWidths: [1, 6],
      move: 'up',
      label: 'Left',
    });
    this.rectangularWall(y, h, [b, 'F', t3, 'F'], {
      callback: [() => this.sideholes(y)],
      ignoreWidths: [1, 6],
      label: 'Right',
    });
    this.rectangularWall(x, h, [b, 'f', t4, 'f'], {
      ignoreWidths: [1, 6],
      callback: [() => this.sideholes(x)],
      move: 'left up',
      label: 'Back',
    });
    this.rectangularWall(x, y, 'ffff', {
      callback: [() => gridfinityBaseplateEtching(this, nx, ny, margin)],
      move: 'right',
      label: 'Bottom',
    });
    for (let i = 0; i < sh.length - 1; i++) {
      this.rectangularWall(x, y, 'ffff', { move: 'right', label: `Shelf ${i + 1}` });
    }
    this.lid(x, y, this.o.topEdge);
    const foot = GRIDFINITY_OPENING - GRIDFINITY_OPENING_MARGIN;
    for (let i = 0; i < Math.min(nx * ny, 4); i++) {
      this.rectangularWall(foot, foot, 'eeee', { move: 'right', label: `pad ${i + 1}` });
    }
  }
}

const cells = (key: string, label: string, def: number) =>
  ({ key, kind: 'number', label, default: def, min: 1, max: 20, step: 1, integer: true, group: 'dimensions' }) as const;

export const gridfinityDrillBox: GeneratorDef = {
  meta: {
    id: 'gridfinitydrillbox',
    name: 'Gridfinity Drill Box',
    group: 'Tray',
    summary: 'Stacked shelves for drills or tools, sized for a Gridfinity grid',
    description:
      'A box of shelves that drops onto a Gridfinity baseplate, with pads to ' +
      'glue underneath. The shelves are blank: add a hole pattern for your ' +
      'drills or tools to every one except the bottom.',
  },
  // boxes.py widens the fingers and the margin, as for the Drill Box: the
  // shelves are thin and the default proportions leave the joints too weak.
  paramDefaults: { fj_space: 3, fj_finger: 3, fj_surroundingspaces: 1, rt_outset: 1 },
  params: [
    cells('nx', 'Cells across', 3),
    cells('ny', 'Cells deep', 2),
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
      key: 'margin',
      kind: 'length',
      label: 'Margin',
      unit: 'mm',
      default: 0.75,
      min: 0,
      max: 10,
      step: 0.05,
      group: 'advanced',
      help: 'Total clearance taken off the outside, so the box fits the grid.',
    },
    {
      key: 'top_edge',
      kind: 'edge',
      label: 'Top edge',
      choices: 'eStG',
      default: 'e',
      group: 'top',
    },
    ...STACKABLE_PARAMS,
    ...MOUNTING_PARAMS,
    MOUNTING_SIDE_PARAM,
    ...LID_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new GridfinityDrillBox(
      {
        nx: n(v, 'nx', 3),
        ny: n(v, 'ny', 2),
        margin: n(v, 'margin', 0.75),
        sh: parseSections(s(v, 'sh', '5:25:10')),
        topEdge: s(v, 'top_edge', 'e'),
      },
      config,
    ),
};
