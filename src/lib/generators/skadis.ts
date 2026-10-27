/**
 * Skadis board — ported from boxes.py `boxes/generators/skadis.py`
 * (class `SkadisBoard`).
 *
 * A pegboard with the slot pattern of IKEA's SKÅDIS, plus washers to mount
 * it clear of the wall.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

class SkadisBoard extends Boxes {
  constructor(
    private columns: number,
    private rows: number,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private CB = (): void => {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        if ((r + c) % 2 === 0) continue;
        this.rectangularHole((c + 1) * 20 - 8, (r + 1) * 20, 5, 15, 2.5);
      }
    }
  };

  render(): void {
    this.roundedPlate((this.columns + 1) * 20, (this.rows + 1) * 20, 8, {
      edge: 'e',
      extendCorners: false,
      callback: [this.CB],
      move: 'up',
      label: 'board',
    });
    // The washers are named without a drawn label: boxes.py leaves them
    // unlabelled, and the text is wider than a washer, which would change
    // the sheet size.
    const name = () => this.ctx.nameCurrentPart('washer');
    this.partsMatrix(8, 4, 'up', (move) => this.parts.disc(15, { hole: 5, move, callback: name }));
  }
}

export const skadis: GeneratorDef = {
  meta: {
    id: 'skadis',
    name: 'Skadis Board',
    group: 'Wall mounted',
    summary: 'Pegboard with the IKEA SKÅDIS slot pattern',
    description:
      'Best cut from 5 mm material to match the original; mount it with the ' +
      'washers, which leave room behind for hooks. Wall-mounted generators ' +
      'with the Skadis wall type hang on it. Inner distances between slots are ' +
      '35 + n × 40 mm; for accessories cut from 4 mm material, use inner widths ' +
      'of 36 + n × 40 mm.',
  },
  params: [
    {
      key: 'columns',
      kind: 'number',
      label: 'Columns',
      default: 17,
      min: 1,
      max: 100,
      step: 1,
      integer: true,
      group: 'dimensions',
      help: 'Holes left to right, counting both even and odd rows.',
    },
    { key: 'rows', kind: 'number', label: 'Rows', default: 27, min: 1, max: 100, step: 1, integer: true, group: 'dimensions' },
  ],
  create: (v: ParamValues, config: BoxesConfig) => new SkadisBoard(n(v, 'columns', 17), n(v, 'rows', 27), config),
};
