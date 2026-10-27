/**
 * Linkage — ported from boxes.py `boxes/generators/linkage.py`
 * (class `Linkage`).
 *
 * A kit for trying out linkages: links of several lengths with holes or
 * slots, discs, and a base plate with a grid of holes to pin them to.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

interface LinkageOptions {
  x: number;
  y: number;
  diameter: number;
  length: number;
  width: number;
  dist: number;
}

class Linkage extends Boxes {
  private linkCount = 0;

  constructor(
    private o: LinkageOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private link(l: number, holes = true, move?: string): void {
    const { dist, width: w, diameter: d } = this.o;

    let l_ = Math.floor(l / dist) * dist;
    if (l_ < l) l_ += dist;

    const holesCB = () => {
      for (let i = 0; i < Math.trunc(Math.floor(l_ / dist)); i++) {
        this.hole(i * dist, w / 2, 0, d);
      }
      this.hole(l_, (w + dist) / 2, 0, d);
      this.hole(l_, (w - dist) / 2, 0, d);
    };

    const slotCB = () => {
      this.rectangularHole(l_ / 2, w / 2, l_ + d - 2 * dist, 1.05 * d, d / 2);
      this.hole(0, w / 2, 0, d);
      this.hole(l_, w / 2, 0, d);
    };

    const drawn = !(move ?? '').includes('only');
    this.polygonWall([l_, [180, w / 2], l_, [180, w / 2]], {
      edge: 'e',
      callback: [holes ? holesCB : slotCB],
      move,
      label: drawn ? `${holes ? 'link' : 'slotted link'} ${++this.linkCount}` : '',
    });
  }

  private plateCB = (): void => {
    const { x, y, dist, diameter } = this.o;
    const nx = Math.floor(Math.trunc(Math.floor(x / dist)) / 2) * 2 - 1;
    const ny = Math.floor(Math.trunc(Math.floor(y / dist)) / 2) * 2 - 1;

    this.moveTo(-this.thickness);
    for (const posY of [y / 2 - dist * ((ny - 1) / 2), y / 2, y / 2 + dist * ((ny - 1) / 2)]) {
      for (let i = 0; i < nx; i++) {
        this.hole(i * dist + (x - (nx - 1) * dist) / 2, posY, 0, diameter);
      }
    }
    for (const posX of [x / 2 - (dist * (nx - 1)) / 2, x / 2, x / 2 + (dist * (nx - 1)) / 2]) {
      for (let i = 0; i < ny; i++) {
        if (i === 0 || i === (ny - 1) / 2 || i === ny - 1) continue;
        this.hole(posX, i * dist + (y - (ny - 1) * dist) / 2, 0, diameter);
      }
    }
  };

  render(): void {
    const { width: w, length: l, diameter: d, dist } = this.o;

    // Discs are named without a drawn label: boxes.py leaves them
    // unlabelled, and the text is wider than a disc, which would change the
    // sheet size.
    const name = (label: string) => () => this.ctx.nameCurrentPart(label);
    this.savedContext(() => {
      this.partsMatrix(8, 8, 'right', (move) => this.parts.disc(w, { hole: 0.95 * d, move, callback: name('disc') }));
      this.partsMatrix(2, 2, '', (move) =>
        this.parts.disc(w, {
          move,
          callback: () => {
            this.hole(-dist / 2, 0, 0, 0.95 * d);
            this.hole(+dist / 2, 0, 0, 0.95 * d);
            name('double disc')();
          },
        }),
      );
    });
    this.partsMatrix(8, 8, 'up only', (move) => this.parts.disc(w, { move }));

    for (const lengths of [[l], [l], [(l * 3) / 4, l / 4], [(l * 3) / 4, l / 4], [l / 2, l / 2], [l / 3, l / 3]]) {
      this.savedContext(() => {
        for (const length of lengths) this.link(length, true, 'right');
      });
      this.link(l, false, 'up only');
    }
    for (const lengths of [[l], [(l * 3) / 4, l / 4], [l / 2, l / 2], [l / 3, l / 3]]) {
      this.savedContext(() => {
        for (const length of lengths) this.link(length, false, 'right');
      });
      this.link(l, false, 'up only');
    }

    this.roundedPlate(this.o.x, this.o.y, this.thickness, {
      edge: 'e',
      extendCorners: false,
      callback: [this.plateCB],
      move: 'up',
      label: 'base plate',
    });
  }
}

export const linkage: GeneratorDef = {
  meta: {
    id: 'linkage',
    name: 'Linkage',
    group: 'Misc',
    summary: 'Kit of links and a pegboard for trying out linkages',
    description:
      'Links of several lengths, some with holes and some slotted, discs, ' +
      'and a base plate with a grid of holes to pin them to. You also need ' +
      'pins two and three thicknesses long; the longer ones with a disc on ' +
      'their first and middle third.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Base plate width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Base plate depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'length', kind: 'length', label: 'Longest link', unit: 'mm', default: 200, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Hole to hole.' },
    { key: 'width', kind: 'length', label: 'Link width', unit: 'mm', default: 15, min: 5, max: 100, step: 0.5, group: 'dimensions' },
    { key: 'diameter', kind: 'length', label: 'Hole diameter', unit: 'mm', default: 3.3, min: 0.5, max: 20, step: 0.1, group: 'dimensions' },
    { key: 'dist', kind: 'length', label: 'Hole spacing', unit: 'mm', default: 5, min: 1, max: 50, step: 0.5, group: 'dimensions' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Linkage(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        diameter: n(v, 'diameter', 3.3),
        length: n(v, 'length', 200),
        width: n(v, 'width', 15),
        dist: n(v, 'dist', 5),
      },
      config,
    ),
};
