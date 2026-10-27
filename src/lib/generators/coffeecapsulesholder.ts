/**
 * Coffee capsule holder — ported from boxes.py
 * `boxes/generators/coffeecapsulesholder.py` (class `CoffeeCapsuleHolder`).
 *
 * Stacked plates with slots that hold coffee capsules by their rims, in
 * columns, to screw to a wall or under a shelf.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface CoffeeCapsuleHolderOptions {
  columns: number;
  rows: number;
  lidSize: number;
  bodySize: number;
  backplate: boolean;
}

class CoffeeCapsuleHolder extends Boxes {
  private lidSizeWithMargin = 0;
  private columnSpacing = 5;
  private cornerRadius = 3;
  private screwMargin = 6;
  private outerMargin = 7;
  private rows = 0;

  constructor(
    private o: CoffeeCapsuleHolderOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    this.lidSizeWithMargin = this.o.lidSize + 2;
    // Room for the opening; it needs less than a full row.
    this.rows = this.o.rows + 0.6;

    this.renderPlate(7, () => this.renderFrontHole(), 'right', 'front plate');
    this.renderPlate(3.5, () => this.renderMiddleHole(), 'right', 'middle plate');
    if (this.o.backplate) this.renderPlate(3.5, null, 'right', 'back plate');
  }

  private renderPlate(screwHole: number, holeRenderer: (() => void) | null, move: string, label: string): void {
    const { columns, lidSize } = this.o;
    const cr = this.cornerRadius;
    const width = columns * (this.lidSizeWithMargin + this.columnSpacing) - this.columnSpacing + 2 * this.outerMargin;
    const height = this.rows * lidSize + 2 * this.outerMargin;

    if (this.move(width, height, move, true)) return;

    this.savedContext(() => {
      this.moveTo(cr);
      this.polyline(width - 2 * cr, [90, cr], height - 2 * cr, [90, cr], width - 2 * cr, [90, cr], height - 2 * cr, [90, cr]);
    });

    if (holeRenderer) {
      for (let col = 0; col < columns; col++) {
        this.savedContext(() => {
          this.moveTo(
            this.outerMargin + col * (this.lidSizeWithMargin + this.columnSpacing) - this.burn,
            this.outerMargin + (this.rows - 0.5) * lidSize + this.burn,
            -90,
          );
          holeRenderer();
        });
      }
    }

    if (screwHole) {
      for (const x of [this.screwMargin, width - this.screwMargin]) {
        for (const y of [this.screwMargin, height - this.screwMargin]) {
          this.hole(x, y + this.burn, 0, screwHole);
        }
      }
    }

    this.move(width, height, move, false, label);
  }

  private renderFrontHole(): void {
    const { lidSize, bodySize } = this.o;
    const radians = Math.acos(bodySize / this.lidSizeWithMargin);
    const heightDifference = (lidSize / 2) * Math.sin(radians);
    const degrees = (radians * 180) / Math.PI;
    const half: Array<number | [number, number]> = [
      0,
      [degrees, this.lidSizeWithMargin / 2],
      0,
      -degrees,
      (this.rows - 1) * lidSize - heightDifference,
    ];
    this.polyline(...half, [180, bodySize / 2], ...[...half].reverse(), [180, this.lidSizeWithMargin / 2]);
  }

  private renderMiddleHole(): void {
    const half: Array<number | [number, number]> = [(this.rows - 1) * this.o.lidSize, [180, this.lidSizeWithMargin / 2]];
    this.polyline(...half, ...half);
  }
}

export const coffeeCapsuleHolder: GeneratorDef = {
  meta: {
    id: 'coffeecapsulesholder',
    name: 'Coffee Capsule Holder',
    group: 'Misc',
    summary: 'Plates that hold coffee capsules by their rims, in columns',
    description: 'Keep capsules by the espresso machine: screw the stacked plates to a wall, or upside down under a shelf.',
  },
  params: [
    { key: 'columns', kind: 'number', label: 'Columns', default: 4, min: 1, max: 30, step: 1, integer: true, group: 'dimensions' },
    { key: 'rows', kind: 'number', label: 'Capsules per column', default: 5, min: 1, max: 50, step: 1, integer: true, group: 'dimensions' },
    { key: 'lid_size', kind: 'length', label: 'Rim diameter', unit: 'mm', default: 37, min: 10, max: 100, step: 0.5, group: 'dimensions' },
    { key: 'body_size', kind: 'length', label: 'Body width', unit: 'mm', default: 30, min: 5, max: 100, step: 0.5, group: 'dimensions', help: 'Of the capsule at the top, under the rim.' },
    { key: 'backplate', kind: 'bool', label: 'Back plate', default: true, group: 'dimensions' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new CoffeeCapsuleHolder(
      {
        columns: n(v, 'columns', 4),
        rows: n(v, 'rows', 5),
        lidSize: n(v, 'lid_size', 37),
        bodySize: n(v, 'body_size', 30),
        backplate: b(v, 'backplate', true),
      },
      config,
    ),
};
