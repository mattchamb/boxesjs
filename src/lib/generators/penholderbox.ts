/**
 * Pen holder box — ported from boxes.py `boxes/generators/penholderbox.py`
 * (class `PenHolderBox`).
 *
 * An open box with two plates inside, one above the other, drilled with a
 * grid of holes that hold pens upright.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { ETCHING } from '../geom/colors';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

interface PenHolderBoxOptions {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  bottomEdge: string;
  plateGap: number;
  plate1Offset: number;
  nx: number;
  ny: number;
  penDiam: number;
  capDiam: number;
}

class PenHolderBox extends Boxes {
  constructor(
    private o: PenHolderBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private penHoles(plateW: number, plateH: number): void {
    const rPen = this.o.penDiam / 2.0;
    const rCap = this.o.capDiam / 2.0;
    const step = this.o.capDiam;

    const gridW = (this.o.nx - 1) * step;
    const gridH = (this.o.ny - 1) * step;

    const x0 = (plateW - gridW) / 2.0;
    const y0 = (plateH - gridH) / 2.0;

    for (let row = 0; row < this.o.ny; row++) {
      for (let col = 0; col < this.o.nx; col++) {
        const cx = x0 + col * step;
        const cy = y0 + row * step;
        this.hole(cx, cy, rPen);

        // Etch the room a cap needs, as a 60-sided polygon.
        this.ctx.save();
        this.setSourceColor(ETCHING);
        const circleSteps = 60;
        for (let i = 0; i <= circleSteps; i++) {
          const angle = (2 * Math.PI * i) / circleSteps;
          const px = cx + rCap * Math.cos(angle);
          const py = cy + rCap * Math.sin(angle);
          if (i === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
        }
        this.ctx.stroke();
        this.ctx.restore();
      }
    }
  }

  private fingerHoles(wallWidth: number, yP1: number, yP2: number): void {
    this.fingerHolesAt(0, yP1, wallWidth, 0);
    this.fingerHolesAt(0, yP2, wallWidth, 0);
  }

  render(): void {
    let { x, y, h } = this.o;
    const t = this.thickness;
    const [t1, t2, t3, t4] = ['e', 'e', 'e', 'e'];
    const bottom: EdgeSpec = this.edges[this.o.bottomEdge] ? this.o.bottomEdge : 'F';
    const sideedge = 'F';

    if (this.o.outside) {
      x = this.adjustSize(x, sideedge, sideedge);
      y = this.adjustSize(y);
      h = this.adjustSize(h, bottom, t1);
    }

    const yP1 = h - this.o.plate1Offset - t / 2.0;
    const yP2 = yP1 - this.o.plateGap;

    this.savedContext(() => {
      this.rectangularWall(x, h, [bottom, sideedge, t1, sideedge], {
        ignoreWidths: [1, 6],
        move: 'up',
        label: 'front_face',
        callback: [() => this.fingerHoles(x, yP1, yP2)],
      });
      this.rectangularWall(x, h, [bottom, sideedge, t3, sideedge], {
        ignoreWidths: [1, 6],
        move: 'up',
        label: 'back_face',
        callback: [() => this.fingerHoles(x, yP1, yP2)],
      });
      if (this.o.bottomEdge !== 'e') {
        this.rectangularWall(x, y, 'ffff', { move: 'up', label: 'bottom' });
      }
    });

    this.rectangularWall(x, h, [bottom, sideedge, t3, sideedge], { ignoreWidths: [1, 6], move: 'right only' });

    this.savedContext(() => {
      this.rectangularWall(y, h, [bottom, 'f', t2, 'f'], {
        ignoreWidths: [1, 6],
        move: 'up',
        label: 'left_side',
        callback: [() => this.fingerHoles(y, yP1, yP2)],
      });
      this.rectangularWall(y, h, [bottom, 'f', t4, 'f'], {
        ignoreWidths: [1, 6],
        move: 'up',
        label: 'right_side',
        callback: [() => this.fingerHoles(y, yP1, yP2)],
      });
    });

    this.rectangularWall(y, h, [bottom, 'f', t4, 'f'], { ignoreWidths: [1, 6], move: 'right only' });

    this.savedContext(() => {
      this.rectangularWall(x, y, 'ffff', { move: 'up', label: 'plate_1', callback: [() => this.penHoles(x, y)] });
      this.rectangularWall(x, y, 'ffff', { move: 'up', label: 'plate_2', callback: [() => this.penHoles(x, y)] });
    });
  }
}

export const penHolderBox: GeneratorDef = {
  meta: {
    id: 'penholderbox',
    name: 'Pen Holder Box',
    group: 'Tray',
    summary: 'Open box with two plates of holes that hold pens upright',
    description:
      'Two plates inside the box, one above the other, have a grid of holes ' +
      'for pens. The room each pen’s cap needs is etched round its hole.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: 'Fhse',
      default: 'h',
      group: 'dimensions',
      help: 'How the bottom panel attaches.',
    },
    { key: 'plate1_offset', kind: 'length', label: 'Top plate depth', unit: 'mm', default: 3, min: 0, max: 500, step: 0.5, group: 'dimensions', help: 'From the top of the box.' },
    { key: 'plate_gap', kind: 'length', label: 'Gap between plates', unit: 'mm', default: 80, min: 5, max: 1000, step: 1, group: 'dimensions' },
    { key: 'nx', kind: 'number', label: 'Holes across', default: 4, min: 1, max: 50, step: 1, integer: true, group: 'dimensions' },
    { key: 'ny', kind: 'number', label: 'Holes deep', default: 4, min: 1, max: 50, step: 1, integer: true, group: 'dimensions' },
    { key: 'pen_diam', kind: 'length', label: 'Pen diameter', unit: 'mm', default: 12, min: 2, max: 100, step: 0.5, group: 'dimensions' },
    {
      key: 'cap_diam',
      kind: 'length',
      label: 'Cap diameter',
      unit: 'mm',
      default: 16,
      min: 2,
      max: 100,
      step: 0.5,
      group: 'dimensions',
      help: 'Sets the hole spacing; etched round each hole.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new PenHolderBox(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        bottomEdge: s(v, 'bottom_edge', 'h'),
        plateGap: n(v, 'plate_gap', 80),
        plate1Offset: n(v, 'plate1_offset', 3),
        nx: n(v, 'nx', 4),
        ny: n(v, 'ny', 4),
        penDiam: n(v, 'pen_diam', 12),
        capDiam: n(v, 'cap_diam', 16),
      },
      config,
    ),
};
