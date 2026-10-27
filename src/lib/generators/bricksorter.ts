/**
 * Brick sorter — ported from boxes.py `boxes/generators/brick_sorter.py`
 * (class `BrickSorter`).
 *
 * One level of a stack of sieves for sorting toy bricks by size. Each level
 * is a little smaller than the one above, so the set nests for storage.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

/** Hole size and grid bar width in mm, outermost level first. */
const SIEVE_SIZES = {
  large_sieve: [30, 5],
  medium_sieve: [20, 5],
  small_sieve: [15, 4],
  tiny_sieve: [10, 3],
} as const;

type Sieve = keyof typeof SIEVE_SIZES;
type Level = Sieve | 'bottom';

const LEVELS: Level[] = [...(Object.keys(SIEVE_SIZES) as Sieve[]), 'bottom'];

/**
 * boxes.py nests the levels by this many thicknesses of finger edge, from a
 * class attribute rather than the edge-width setting it also defaults.
 */
const EDGE_WIDTH = 3;

class BrickSorter extends Boxes {
  constructor(
    private o: { x: number; y: number; h: number; level: Level; radius: number; wiggle: number },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private get levelIndex(): number {
    return LEVELS.indexOf(this.o.level);
  }

  private get gridThickness(): number {
    return SIEVE_SIZES[this.o.level as Sieve][1];
  }

  private get holeSize(): number {
    return SIEVE_SIZES[this.o.level as Sieve][0];
  }

  private xyAfterNesting(a: number): number {
    return a - (2 * this.thickness + this.o.wiggle) * this.levelIndex;
  }

  private gridCountAndOffset(inner: number): [number, number] {
    const holeCount = Math.trunc((inner - this.gridThickness) / (this.holeSize + this.gridThickness));
    const gridSize = (this.holeSize + this.gridThickness) * holeCount + this.gridThickness;
    return [holeCount, (inner - gridSize) / 2];
  }

  private drawSieve(x: number, y: number): void {
    const [xCount, xOffset] = this.gridCountAndOffset(x);
    const [yCount, yOffset] = this.gridCountAndOffset(y);
    const size = this.holeSize;
    const g = this.gridThickness;

    for (let relx = 0; relx < xCount; relx++) {
      for (let rely = 0; rely < yCount; rely++) {
        const xPos = x - xOffset - size - relx * (size + g) - g;
        const yPos = y - yOffset - size - rely * (size + g) - g;
        this.rectangularHole(xPos, yPos, size, size, this.o.radius, false, false);
      }
    }
  }

  render(): void {
    // Adapted in boxes.py from ABox.render.
    const i = this.levelIndex;
    let x = this.xyAfterNesting(this.o.x);
    let y = this.xyAfterNesting(this.o.y);
    let h = this.o.h - (EDGE_WIDTH + 1) * this.thickness * i - i * 2;

    const [t1, t2, t3, t4] = ['e', 'e', 'e', 'e'];
    const bottom: EdgeSpec = 'h';
    const sideedge = 'F';

    x = this.adjustSize(x, sideedge, sideedge);
    y = this.adjustSize(y);
    h = this.adjustSize(h, bottom, t1);

    this.savedContext(() => {
      this.rectangularWall(x, h, [bottom, sideedge, t1, sideedge], { ignoreWidths: [1, 6], move: 'up', label: 'front' });
      this.rectangularWall(x, h, [bottom, sideedge, t3, sideedge], { ignoreWidths: [1, 6], move: 'up', label: 'back' });

      const callback = this.o.level === 'bottom' ? null : [() => this.drawSieve(x, y)];
      this.rectangularWall(x, y, 'ffff', { move: 'up', callback, label: this.o.level === 'bottom' ? 'bottom' : 'sieve' });
    });

    this.rectangularWall(x, h, [bottom, sideedge, t3, sideedge], { ignoreWidths: [1, 6], move: 'right only' });
    this.rectangularWall(y, h, [bottom, 'f', t2, 'f'], { ignoreWidths: [1, 6], move: 'up', label: 'left' });
    this.rectangularWall(y, h, [bottom, 'f', t4, 'f'], { ignoreWidths: [1, 6], move: 'up', label: 'right' });
  }
}

export const brickSorter: GeneratorDef = {
  meta: {
    id: 'brick_sorter',
    name: 'Brick Sorter',
    group: 'Box',
    summary: 'Stackable sieves for sorting toy bricks by size',
    description:
      'Make one of each level for a full set: four sieves with smaller and ' +
      'smaller holes, and a solid bottom. Width, depth and height are the ' +
      'outer size of the largest sieve; the others are smaller, so the set ' +
      'nests for storage. 256 or 384 mm, a base plate’s size, work well.',
  },
  // boxes.py's own default: the levels' height steps assume this edge width.
  paramDefaults: { fj_edge_width: EDGE_WIDTH },
  params: [
    {
      key: 'level',
      kind: 'enum',
      label: 'Level',
      default: 'large_sieve',
      choices: [
        { value: 'large_sieve', label: 'Large sieve (30 mm holes)' },
        { value: 'medium_sieve', label: 'Medium sieve (20 mm holes)' },
        { value: 'small_sieve', label: 'Small sieve (15 mm holes)' },
        { value: 'tiny_sieve', label: 'Tiny sieve (10 mm holes)' },
        { value: 'bottom', label: 'Bottom' },
      ],
      group: 'dimensions',
    },
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 256, min: 100, max: 1000, step: 1, group: 'dimensions', help: 'Outside, of the largest level.' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 256, min: 100, max: 1000, step: 1, group: 'dimensions', help: 'Outside, of the largest level.' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 120, min: 50, max: 500, step: 1, group: 'dimensions', help: 'Outside, of the largest level.' },
    {
      key: 'radius',
      kind: 'number',
      label: 'Hole corner radius',
      unit: 'mm',
      default: 3,
      min: 0,
      max: 30,
      step: 1,
      integer: true,
      group: 'dimensions',
      help: '30 makes the holes round.',
    },
    { key: 'wiggle', kind: 'length', label: 'Nesting play', unit: 'mm', default: 4, min: 0, max: 20, step: 0.5, group: 'dimensions', help: 'Room for each level to slide into the one below.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new BrickSorter(
      {
        x: n(v, 'x', 256),
        y: n(v, 'y', 256),
        h: n(v, 'h', 120),
        level: s(v, 'level', 'large_sieve') as Level,
        radius: n(v, 'radius', 3),
        wiggle: n(v, 'wiggle', 4),
      },
      config,
    ),
};
