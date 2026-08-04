/**
 * Universal box — ported from boxes.py `boxes/generators/universalbox.py`.
 *
 * The box with the most options: any supported top edge, any bottom edge, and a
 * choice of how the corners join. Everything it draws comes from the shared
 * `_TopEdge` machinery in `src/lib/topedge.ts`.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { Color } from '../geom/colors';
import { HANDLE_PARAMS, LID_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { BOTTOM_EDGE_CHOICES, TOP_EDGE_CHOICES, drawLid, topEdges } from '../topedge';
import { b, n, s, type GeneratorDef } from './types';

interface UniversalBoxOptions {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  bottomEdge: string;
  topEdge: string;
  verticalEdges: 'finger joints' | 'finger holes';
}

class UniversalBox extends Boxes {
  constructor(private o: UniversalBoxOptions, config: Partial<BoxesConfig>) {
    super(config);
  }

  /**
   * The opening in the spacer plate that sits under a finger-jointed top. The
   * plate is 4t larger than the box all round, and this cuts the hole the walls
   * pass through.
   */
  private topHole(x: number, y: number, topEdge: string): void {
    const t = this.thickness;
    let edge;

    if (topEdge === 'f') {
      edge = this.edges['F']!;
      this.moveTo(2 * t + this.burn, 2 * t, 90);
    } else if (topEdge === 'F') {
      edge = this.edges['f']!;
      this.moveTo(t + this.burn, 2 * t, 90);
    } else {
      throw new Error('Only f and F supported');
    }

    for (const l of [y, x, y, x]) {
      edge.call(l);
      if (topEdge === 'F') this.edge(t);
      this.corner(-90);
      if (topEdge === 'F') this.edge(t);
    }
  }

  render(): void {
    let { x, y, h } = this.o;
    const t = this.thickness;

    const [tl, tb, tr, tf] = topEdges(this, this.o.topEdge);
    const b: EdgeSpec = this.edges[this.o.bottomEdge] ?? this.edges['F']!;

    const sideedge = this.o.verticalEdges === 'finger joints' ? 'F' : 'h';

    if (this.o.outside) {
      x = this.adjustSize(x, sideedge, sideedge);
      y = this.adjustSize(y);
      h = this.adjustSize(h, b, this.o.topEdge);
    }

    // Dropping the widths of edges 1 and 6 runs the side joints past the top and
    // bottom edges, so the corners still close when those edges add height.
    const ignoreWidths = [1, 6];

    this.savedContext(() => {
      this.rectangularWall(x, h, [b, sideedge, tf, sideedge], {
        ignoreWidths,
        move: 'up',
        label: 'Front',
      });
      this.rectangularWall(x, h, [b, sideedge, tb, sideedge], {
        ignoreWidths,
        move: 'up',
        label: 'Back',
      });

      if (this.o.bottomEdge !== 'e') {
        this.rectangularWall(x, y, 'ffff', { move: 'up', label: 'Bottom' });
      }
      if ('fF'.includes(this.o.topEdge)) {
        // Magenta, following boxes.py: this plate is a spacer rather than a
        // wall and wants to stand out, and red already means annotations.
        this.setSourceColor(Color.MAGENTA);
        this.rectangularWall(x + 4 * t, y + 4 * t, 'eeee', {
          callback: [() => this.topHole(x, y, this.o.topEdge)],
          move: 'up',
          label: 'Top hole',
        });
        this.setSourceColor(Color.BLACK);
      }

      drawLid(this, x, y, this.o.topEdge);
      this.lid(x, y, this.o.topEdge);
    });

    this.rectangularWall(x, h, [b, sideedge, tf, sideedge], {
      ignoreWidths,
      move: 'right only',
    });
    this.rectangularWall(y, h, [b, 'f', tl, 'f'], { ignoreWidths, move: 'up', label: 'Left' });
    this.rectangularWall(y, h, [b, 'f', tr, 'f'], { ignoreWidths, move: 'up', label: 'Right' });
  }
}

export const universalBox: GeneratorDef = {
  meta: {
    id: 'universalbox',
    name: 'Universal Box',
    group: 'Box',
    summary: 'One box, every top and bottom edge this build supports',
    description:
      'The general-purpose box. Choose how the top closes, how the bottom attaches ' +
      'and whether the corners use finger joints or finger holes, and it covers most ' +
      'of what the more specialised generators do.',
  },
  // boxes.py widens the handle triangle by one thickness so it clears the side
  // walls when the top edge is the carry handle.
  paramDefaults: { rt_outset: 1 },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: BOTTOM_EDGE_CHOICES,
      default: 'h',
      group: 'joints',
      help: 'How the bottom panel attaches. "Stackable feet" lets boxes nest on top of each other.',
    },
    {
      key: 'top_edge',
      kind: 'edge',
      label: 'Top edge',
      choices: TOP_EDGE_CHOICES,
      default: 'e',
      group: 'top',
      help: 'Straight leaves the box open. Finger joints add a closed top.',
    },
    {
      key: 'vertical_edges',
      kind: 'enum',
      label: 'Corner joints',
      default: 'finger joints',
      choices: [
        { value: 'finger joints', label: 'Finger joints' },
        { value: 'finger holes', label: 'Finger holes' },
      ],
      group: 'joints',
      help: 'Finger joints show the end grain at every corner; finger holes hide the joint behind a flush face.',
    },
    ...HANDLE_PARAMS,
    ...LID_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new UniversalBox(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        bottomEdge: s(v, 'bottom_edge', 'h'),
        topEdge: s(v, 'top_edge', 'e'),
        verticalEdges: s(v, 'vertical_edges', 'finger joints') as
          | 'finger joints'
          | 'finger holes',
      },
      config,
    ),
};
