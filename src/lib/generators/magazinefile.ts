/**
 * Magazine file — ported from boxes.py `boxes/generators/magazinefile.py`
 * (class `MagazineFile`).
 *
 * An open file box for magazines: tall at the back, low at the front, with
 * a rounded cut-out down the sides.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { MOUNTING_PARAMS, MOUNTING_SIDE_PARAM } from '../params/common';
import type { ParamValues } from '../params/schema';
import { topEdges } from '../topedge';
import { b, n, s, type GeneratorDef } from './types';

interface MagazineFileOptions {
  x: number;
  y: number;
  h: number;
  hi: number;
  outside: boolean;
  topEdge: string;
}

class MagazineFile extends Boxes {
  constructor(
    private o: MagazineFileOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private side(w: number, h: number, hi: number, topEdgeSpec: EdgeSpec): void {
    let r: number;
    let lx: number;
    let ly: number;

    if (h - hi > w) {
      r = w / 2.0;
      lx = 0;
      ly = h - hi - w;
    } else {
      r = (h - hi) / 2.0;
      lx = (w - 2 * r) / 2.0;
      ly = 0;
    }

    const topEdge = this.getEdge(topEdgeSpec);
    const F = this.getEdge('F');

    const eW = F.startWidth();
    this.moveTo(3, 3);
    this.edge(eW);
    F.call(w);
    this.edge(eW);
    this.corner(90);
    this.edge(eW);
    F.call(hi);
    this.corner(90);
    this.edge(eW);
    topEdge.call(lx);
    this.corner(-90, r);
    this.edge(ly);
    this.corner(90, r);
    topEdge.call(lx);
    this.edge(eW);
    this.corner(90);
    F.call(h);
    this.edge(eW);
    this.corner(90);
  }

  render(): void {
    let { x, y, h } = this.o;
    if (this.o.outside) {
      x = this.adjustSize(x);
      y = this.adjustSize(y);
      h = this.adjustSize(h, true, false);
    }

    const hi = this.o.hi || h / 2.0;
    const [t1, t2, t3] = topEdges(this, this.o.topEdge);

    this.savedContext(() => {
      this.rectangularWall(x, h, ['F', 'f', t2, 'f'], { move: 'up', label: 'back' });
      this.rectangularWall(x, hi, 'Ffef', { move: 'up', label: 'front' });
      this.rectangularWall(x, y, 'ffff', { label: 'bottom' });
    });

    this.rectangularWall(x, h, 'Ffef', { move: 'right only' });
    // boxes.py draws both sides without moves, into one part.
    this.side(y, h, hi, t1);
    this.moveTo(y + 15, h + hi + 15, 180);
    this.side(y, h, hi, t3);
    this.ctx.nameCurrentPart('sides');
  }
}

export const magazineFile: GeneratorDef = {
  meta: {
    id: 'magazinefile',
    name: 'Magazine File',
    group: 'Misc',
    summary: 'Open file box for magazines, tall at the back and low at the front',
    description: 'A box for standing magazines on a shelf, with a rounded cut-out down each side to get at them. Mounting holes can hang it on a wall.',
  },
  // boxes.py's own defaults: one mounting hole, with no margin.
  paramDefaults: { mount_margin: 0, mount_num: 1 },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 200, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 300, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'At the back.' },
    { key: 'hi', kind: 'length', label: 'Front height', unit: 'mm', default: 0, min: 0, max: 1000, step: 1, group: 'dimensions', help: '0 makes it half the height.' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: false, group: 'dimensions' },
    { key: 'top_edge', kind: 'edge', label: 'Top edge', choices: 'eG', default: 'e', group: 'top', help: 'Mounting holes along one top edge.' },
    ...[...MOUNTING_PARAMS, MOUNTING_SIDE_PARAM].map((spec) => ({ ...spec, showIf: (v: ParamValues) => v['top_edge'] === 'G' })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new MagazineFile(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 200),
        h: n(v, 'h', 300),
        hi: n(v, 'hi', 0),
        outside: b(v, 'outside', false),
        topEdge: s(v, 'top_edge', 'e'),
      },
      config,
    ),
};
