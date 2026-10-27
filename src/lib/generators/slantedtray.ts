/**
 * Slanted tray — ported from boxes.py `boxes/generators/slantedtray.py`
 * (class `SlantedTray`).
 *
 * One row of compartments with a tall back and a low front, so the dividers
 * and sides are trapezoids. Stands as a display, or lies on its back to hold
 * piles of cards or tokens to draw from.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

interface SlantedTrayOptions {
  sx: number[];
  y: number;
  h: number;
  outside: boolean;
  /** Height of the front as a fraction of the back. */
  frontHeight: number;
}

class SlantedTray extends Boxes {
  constructor(
    private o: SlantedTrayOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /** Slots for the dividers, across a panel of height `h`. */
  private fingerHolesCB(sx: number[], h: number): () => void {
    return () => {
      const t = this.thickness;
      let pos = -0.5 * t;
      for (const x of sx.slice(0, -1)) {
        pos += x + t;
        this.fingerHolesAt(pos, 0, h);
      }
    };
  }

  render(): void {
    let { sx, y, h } = this.o;
    const t = this.thickness;

    if (this.o.outside) {
      sx = this.adjustSize(sx);
      y = this.adjustSize(y);
      h = this.adjustSize(h, false);
    }

    const frontHeight = h * this.o.frontHeight;
    const x = sx.reduce((a, c) => a + c, 0) + t * (sx.length - 1);

    this.rectangularWall(x, h, 'eFfF', { move: 'up', callback: [this.fingerHolesCB(sx, h)], label: 'back' });
    this.rectangularWall(x, y, 'FFfF', { move: 'up', callback: [this.fingerHolesCB(sx, y)], label: 'bottom' });
    this.rectangularWall(x, frontHeight, 'FFeF', {
      move: 'up',
      callback: [this.fingerHolesCB(sx, frontHeight)],
      label: 'front',
    });

    // The two sides and every divider are the same trapezoid.
    for (let i = 0; i < sx.length + 1; i++) {
      const label = i === 0 ? 'left' : i === sx.length ? 'right' : `divider ${i}`;
      this.trapezoidWall(y, h, frontHeight, 'ffef', { move: 'right', label });
    }
  }
}

export const slantedTray: GeneratorDef = {
  meta: {
    id: 'slantedtray',
    name: 'Slanted Tray',
    group: 'Tray',
    summary: 'One row of compartments with a tall back and low front',
    description:
      'A single row of compartments that slopes from a tall back down to a ' +
      'low front. Use it as a display, or lay it on its back to hold piles of ' +
      'cards or gaming tokens to draw from.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartment widths, left to right',
      default: '40*3',
      group: 'dimensions',
      itemLabel: 'compartment',
    },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 40, min: 10, max: 500, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Back height', unit: 'mm', default: 40, min: 10, max: 500, step: 1, group: 'dimensions' },
    {
      key: 'front_height',
      kind: 'number',
      label: 'Front height',
      unit: '× back height',
      default: 0.3,
      min: 0.05,
      max: 1,
      step: 0.05,
      group: 'dimensions',
    },
    {
      key: 'outside',
      kind: 'bool',
      label: 'Outside measurements',
      default: false,
      group: 'dimensions',
      help: 'When on, the sizes above are the exterior. When off, they are the inside of the compartments.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new SlantedTray(
      {
        sx: parseSections(s(v, 'sx', '40*3')),
        y: n(v, 'y', 40),
        h: n(v, 'h', 40),
        outside: b(v, 'outside', false),
        frontHeight: n(v, 'front_height', 0.3),
      },
      config,
    ),
};
