/**
 * Uneven height box — ported from boxes.py `boxes/generators/unevenheightbox.py`.
 *
 * A box whose four corners can each be a different height, so its walls are
 * trapezoids. The lid makes up the difference, so box and lid together stand
 * level; its walls are drawn rotated, below the box's.
 */
import { Boxes, type BoxesConfig, type Callback } from '../boxes';
import { groovedParams } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

interface UnevenHeightBoxOptions {
  x: number;
  y: number;
  outside: boolean;
  bottomEdge: string;
  heights: [number, number, number, number];
  addLid: boolean;
  lidHeight: number;
  edgeTypes: string;
}

class UnevenHeightBox extends Boxes {
  constructor(private o: UnevenHeightBoxOptions, config: Partial<BoxesConfig>) {
    super(config);
  }

  /** boxes.py labels none of the parts; a label would print on the sheet. */
  private named(name: string): Callback {
    return [() => this.ctx.nameCurrentPart(name)];
  }

  render(): void {
    let { x, y } = this.o;
    const heights = [...this.o.heights];

    let edgeTypes = this.o.edgeTypes;
    if (edgeTypes.length !== 4 || [...edgeTypes].some((et) => !'ezZ'.includes(et))) {
      throw new Error(`Wrong edge_types style: ${edgeTypes})`);
    }

    if (this.o.outside) {
      x = this.adjustSize(x);
      y = this.adjustSize(y);
      for (let i = 0; i < 4; i++) {
        heights[i] = this.adjustSize(heights[i]!, this.o.bottomEdge, this.o.addLid);
      }
    }

    let [h0, h1, h2, h3] = heights as [number, number, number, number];
    const bEdge = this.o.bottomEdge;
    const lidHeight = this.o.lidHeight;

    this.trapezoidWall(x, h0, h1, [bEdge, 'F', edgeTypes[0]!, 'F'], { move: 'right', callback: this.named('front') });
    this.trapezoidWall(y, h1, h2, [bEdge, 'f', edgeTypes[1]!, 'f'], { move: 'right', callback: this.named('right') });
    this.trapezoidWall(x, h2, h3, [bEdge, 'F', edgeTypes[2]!, 'F'], { move: 'right', callback: this.named('back') });
    this.trapezoidWall(y, h3, h0, [bEdge, 'f', edgeTypes[3]!, 'f'], { move: 'right', callback: this.named('left') });

    const maxh = Math.max(...heights);
    this.savedContext(() => {
      if (bEdge !== 'e') this.rectangularWall(x, y, 'ffff', { move: 'up', callback: this.named('bottom') });

      if (this.o.addLid) {
        const lidheights = heights.map((h) => maxh - h + lidHeight);
        [h0, h1, h2, h3] = lidheights as [number, number, number, number];
        const ring = [...lidheights, ...lidheights];
        // A lid side with no wall under it at either end has nothing to join.
        const edges = [0, 1, 2, 3].map((i) => (ring[i] === 0.0 && ring[i + 1] === 0.0 ? 'E' : 'f'));
        this.rectangularWall(x, y, edges, { move: 'up', callback: this.named('lid') });
      }
    });

    if (this.o.addLid) {
      this.moveTo(
        0,
        maxh + lidHeight + this.getEdge('F').spacing() + this.getEdge(bEdge).spacing() + 1 * this.spacing,
        180,
      );
      const edgeInverse: Record<string, string> = { e: 'e', z: 'Z', Z: 'z' };
      edgeTypes = [...edgeTypes].map((et) => edgeInverse[et]!).join('');

      // A wall of no height on either end is skipped, but still takes its place.
      const only = (a: number, b: number): string => (a === 0.0 && b === 0.0 ? ' only' : '');
      this.trapezoidWall(y, h0, h3, 'Ff' + edgeTypes[3] + 'f', { move: 'right' + only(h0, h3), callback: this.named('lid left') });
      this.trapezoidWall(x, h3, h2, 'FF' + edgeTypes[2] + 'F', { move: 'right' + only(h3, h2), callback: this.named('lid back') });
      this.trapezoidWall(y, h2, h1, 'Ff' + edgeTypes[1] + 'f', { move: 'right' + only(h2, h1), callback: this.named('lid right') });
      this.trapezoidWall(x, h1, h0, 'FF' + edgeTypes[0] + 'F', { move: 'right' + only(h1, h0), callback: this.named('lid front') });
    }
  }
}

export const unevenHeightBox: GeneratorDef = {
  meta: {
    id: 'unevenheightbox',
    name: 'Uneven Height Box',
    group: 'Box',
    summary: 'Box with a different height at each corner',
    description:
      'Each corner can be a different height, so the walls slope. The lid is shaped ' +
      'to make up the difference, which works best with the high corners opposite ' +
      'each other. Top edges can be grooved, with the lid grooved to match.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    {
      key: 'outside',
      kind: 'bool',
      label: 'Outside measurements',
      default: true,
      group: 'dimensions',
      help: 'When on, the sizes above are the finished exterior. When off, they are the usable interior.',
    },
    { key: 'height0', kind: 'length', label: 'Front left height', unit: 'mm', default: 50, min: 0, max: 1000, step: 1, group: 'dimensions' },
    { key: 'height1', kind: 'length', label: 'Front right height', unit: 'mm', default: 50, min: 0, max: 1000, step: 1, group: 'dimensions' },
    { key: 'height2', kind: 'length', label: 'Back right height', unit: 'mm', default: 100, min: 0, max: 1000, step: 1, group: 'dimensions' },
    { key: 'height3', kind: 'length', label: 'Back left height', unit: 'mm', default: 100, min: 0, max: 1000, step: 1, group: 'dimensions' },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: 'Fhse',
      default: 'F',
      group: 'joints',
    },
    {
      key: 'add_lid',
      kind: 'bool',
      label: 'Lid',
      default: true,
      group: 'top',
      help: 'Works best with the high corners opposite each other.',
    },
    {
      key: 'lid_height',
      kind: 'length',
      label: 'Extra lid height',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 500,
      step: 1,
      group: 'top',
      help: 'Added to every lid wall. At zero the lid has no wall at the highest corner.',
      showIf: (v) => v['add_lid'] === true,
    },
    {
      key: 'edge_types',
      kind: 'text',
      label: 'Top edges',
      default: 'eeee',
      group: 'top',
      help: 'One letter per wall, counter-clockwise from the front: e for straight, z for grooves cut in, Z for grooves standing out. The lid gets the opposite, so it nests.',
    },
    ...groovedParams((v) => /[zZ]/.test(s(v, 'edge_types', 'eeee'))),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new UnevenHeightBox(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        outside: b(v, 'outside', true),
        bottomEdge: s(v, 'bottom_edge', 'F'),
        heights: [n(v, 'height0', 50), n(v, 'height1', 50), n(v, 'height2', 100), n(v, 'height3', 100)],
        addLid: b(v, 'add_lid', true),
        lidHeight: n(v, 'lid_height', 0),
        edgeTypes: s(v, 'edge_types', 'eeee'),
      },
      config,
    ),
};
