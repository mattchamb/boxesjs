/**
 * Tetris pieces — ported from boxes.py `boxes/generators/tetris.py`
 * (class `Tetris`).
 *
 * A hollow block in the shape of one of the falling-block pieces: two faces
 * with the square divisions etched on, and the walls between them.
 */
import { Boxes, type BoxesConfig, type PolygonBorder } from '../boxes';
import { ETCHING } from '../geom/colors';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

type Shape = 'I' | 'L' | 'O' | 'S' | 'T';

class Tetris extends Boxes {
  constructor(
    private blocksize: number,
    private shape: Shape,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /** Etches the lines between the squares, from the start of each leg. */
  private cb = (nr: number): void => {
    const t = this.thickness;
    const s = this.blocksize;
    const shape = this.shape;
    this.ctx.stroke();
    this.setSourceColor(ETCHING);

    if (nr === 0) {
      if ('LT'.includes(shape)) {
        for (let i = 1; i < 3; i++) {
          this.savedContext(() => {
            this.moveTo(s * i - t, 0, 90);
            this.edge(s - 2 * t);
          });
        }
        if (shape === 'L') this.moveTo(s * 2, s - t, 0);
        else this.moveTo(s, s - t, 0);
        this.edge(s - 2 * t);
      }
      if (shape === 'I') {
        for (let i = 1; i < 4; i++) {
          this.savedContext(() => {
            this.moveTo(s * i - t, 0, 90);
            this.edge(s - 2 * t);
          });
        }
      }
    }
    if (shape === 'S' && [0, 1, 4, 5].includes(nr)) {
      this.moveTo(s - t, 0, 90);
      this.edge(s - 2 * t);
    }
    if (shape === 'O') {
      this.moveTo(s - t, 0, 90);
      this.edge(s - t);
    }

    this.ctx.stroke();
  };

  render(): void {
    const t = this.thickness;
    const s = this.blocksize;

    let borders: PolygonBorder[];
    const twice = (b: PolygonBorder[]) => [...b, ...b];
    if (this.shape === 'L') {
      borders = [3 * s - 2 * t, 90, 2 * s - 2 * t, 90, s - 2 * t, 90, s, -90, 2 * s, 90, s - 2 * t, 90];
    } else if (this.shape === 'I') {
      borders = twice([4 * s - 2 * t, 90, s - 2 * t, 90]);
    } else if (this.shape === 'S') {
      borders = twice([2 * s - 2 * t, 90, s, -90, s, 90, s - 2 * t, 90]);
    } else if (this.shape === 'O') {
      borders = twice(twice([2 * s - 2 * t, 90]));
    } else {
      const half: PolygonBorder[] = [90, s - 2 * t, 90, s, -90, s, 90];
      borders = [3 * s - 2 * t, ...half, s - 2 * t, ...[...half].reverse()];
    }
    this.polygonWall(borders, { callback: this.cb, move: 'right', label: 'face' });
    this.polygonWall(borders, { callback: this.cb, move: 'mirror right', label: 'back' });

    this.polygonWalls(borders, s - 2 * t);
  }
}

export const tetris: GeneratorDef = {
  meta: {
    id: 'tetris',
    name: 'Tetris Piece',
    group: 'Misc',
    summary: 'Hollow block in the shape of a falling-block puzzle piece',
    description:
      'A closed block shaped like one of the classic four-square puzzle ' +
      'pieces, with the squares etched on both faces. Make a set in ' +
      'different shapes.',
  },
  params: [
    { key: 'blocksize', kind: 'length', label: 'Square size', unit: 'mm', default: 40, min: 10, max: 300, step: 1, group: 'dimensions' },
    {
      key: 'shape',
      kind: 'enum',
      label: 'Shape',
      default: 'L',
      choices: [
        { value: 'I', label: 'I' },
        { value: 'L', label: 'L' },
        { value: 'O', label: 'O' },
        { value: 'S', label: 'S' },
        { value: 'T', label: 'T' },
      ],
      group: 'dimensions',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Tetris(n(v, 'blocksize', 40), s(v, 'shape', 'L') as Shape, config),
};
