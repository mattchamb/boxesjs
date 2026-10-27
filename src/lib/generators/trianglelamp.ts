/**
 * Triangle lamp — ported from boxes.py `boxes/generators/trianglelamp.py`
 * (class `TriangleLamp`).
 *
 * A right-triangle LED lamp: a screen and a back, low walls round the edge,
 * and small triangles in the corners to screw the screen to.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { Edge } from '../edges/base';
import { Color } from '../geom/colors';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

/**
 * A plain edge extended to meet its neighbour at a sharp 45° corner, with a
 * guide line marking where to grind the 22.5° bevel.
 */
class CornerEdge extends Edge {
  override char: string | null = 'C';

  override startWidth(): number {
    return this.boxes.thickness * Math.tan((90 - 22.5) * DEG);
  }

  override call(length: number): void {
    this.boxes.savedContext(() => {
      this.boxes.ctx.stroke();
      this.boxes.setSourceColor(Color.RED);
      this.moveTo(0, this.startWidth());
      this.edge(length);
      this.boxes.ctx.stroke();
      this.boxes.setSourceColor(Color.BLACK);
    });
    super.call(length);
  }
}

interface TriangleLampOptions {
  x: number;
  h: number;
  cornersize: number;
  screenholesize: number;
  screwholesize: number;
  sharpcorners: boolean;
}

class TriangleLamp extends Boxes {
  constructor(
    private o: TriangleLampOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private CB(l: number, size: number) {
    return (): void => {
      const t = this.thickness;
      this.fingerHolesAt(0, this.o.h - 1.5 * t, size, 0);
      this.fingerHolesAt(l, this.o.h - 1.5 * t, size, 180);
    };
  }

  render(): void {
    const { x, h } = this.o;
    const l = (x ** 2 + x ** 2) ** 0.5;
    const c = this.o.cornersize;

    const r1 = this.o.screwholesize / 2;
    const r2 = this.o.screenholesize / 2;

    this.addPart(new CornerEdge(this, null));

    this.rectangularTriangle(x, x, 'eee', {
      num: 2,
      move: 'up',
      callback: [
        () => this.hole((2 / 3) * c, (1 / 4) * c, r2),
        () => {
          this.hole((1 / 3) * c, (1 / 3) * c, r2);
          this.hole(x - (2 / 3) * c, (1 / 4) * c, r2);
        },
      ],
      label: 'screen',
    });
    this.rectangularTriangle(x, x, 'fff', { num: 2, move: 'up', label: 'back' });

    const C = this.o.sharpcorners ? 'C' : 'e';

    this.rectangularWall(x, h, 'Ffe' + C, { callback: [this.CB(x, c)], move: 'up', label: 'side' });
    this.rectangularWall(x, h, 'Ffe' + C, { callback: [this.CB(x, c)], move: 'up', label: 'side' });

    this.rectangularWall(x, h, 'F' + C + 'eF', { callback: [this.CB(x, c)], move: 'up', label: 'side' });
    this.rectangularWall(x, h, 'F' + C + 'eF', { callback: [this.CB(x, c)], move: 'up', label: 'side' });

    this.rectangularWall(l, h, 'F' + C + 'e' + C, { callback: [this.CB(l, c * 2 ** 0.5)], move: 'up', label: 'long side' });
    this.rectangularWall(l, h, 'F' + C + 'e' + C, { callback: [this.CB(l, c * 2 ** 0.5)], move: 'up', label: 'long side' });

    this.rectangularTriangle(c, c, 'ffe', {
      num: 2,
      move: 'right',
      callback: [() => this.hole((2 / 3) * c, (1 / 3) * c, r1)],
      label: 'corner',
    });
    this.rectangularTriangle(c, c, 'fef', {
      num: 4,
      move: 'up',
      callback: [() => this.hole((2 / 3) * c, (1 / 4) * c, r1)],
      label: 'corner',
    });
  }
}

export const triangleLamp: GeneratorDef = {
  meta: {
    id: 'trianglelamp',
    name: 'Triangle Lamp',
    group: 'Misc',
    summary: 'Right-triangle LED lamp with a screen',
    description:
      'A shallow right-triangle box for LEDs, with a screen screwed to ' +
      'triangles in the corners. Sharp corners extend the walls to meet at ' +
      '45°, which needs a 22.5° bevel ground on them.',
  },
  // boxes.py's own defaults: big fingers, and a smaller edge margin.
  paramDefaults: { fj_finger: 3, fj_space: 3, fj_surroundingspaces: 0.5 },
  params: [
    { key: 'x', kind: 'length', label: 'Size', unit: 'mm', default: 250, min: 50, max: 1000, step: 1, group: 'dimensions', help: 'Of the two short sides.' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 40, min: 10, max: 300, step: 1, group: 'dimensions' },
    { key: 'cornersize', kind: 'length', label: 'Corner triangle size', unit: 'mm', default: 30, min: 10, max: 200, step: 1, group: 'dimensions', help: 'Short side.' },
    { key: 'screenholesize', kind: 'length', label: 'Screen hole diameter', unit: 'mm', default: 4, min: 0.5, max: 20, step: 0.1, group: 'dimensions' },
    { key: 'screwholesize', kind: 'length', label: 'Screw hole diameter', unit: 'mm', default: 2, min: 0.5, max: 20, step: 0.1, group: 'dimensions', help: 'In the wood.' },
    { key: 'sharpcorners', kind: 'bool', label: 'Sharp corners', default: false, group: 'dimensions', help: 'Extend the walls to meet at 45°. Needs a 22.5° bevel ground on them.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new TriangleLamp(
      {
        x: n(v, 'x', 250),
        h: n(v, 'h', 40),
        cornersize: n(v, 'cornersize', 30),
        screenholesize: n(v, 'screenholesize', 4),
        screwholesize: n(v, 'screwholesize', 2),
        sharpcorners: b(v, 'sharpcorners', false),
      },
      config,
    ),
};
