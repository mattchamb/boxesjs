/**
 * Two-piece box — ported from boxes.py `boxes/generators/two_piece.py`
 * (class `TwoPiece`).
 *
 * Two open boxes, one a wall thickness plus some play larger than the other,
 * so the outer one slides down over the inner one to close it. The inner
 * shell's floor has finger holes and the outer's finger joints, so each is
 * a tray standing on its own.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { FingerJointSettings } from '../edges/fingerjoint';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface TwoPieceOptions {
  x: number;
  y: number;
  h: number;
  hi: number;
  outside: boolean;
  /** Clearance between the shells, as a multiple of the thickness. */
  play: number;
}

class TwoPiece extends Boxes {
  constructor(
    private o: TwoPieceOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    let { x, y, h } = this.o;
    let hi = this.o.hi || h;
    const t = this.thickness;
    const p = this.o.play * t;

    if (this.o.outside) {
      x -= 4 * t + 2 * p;
      y -= 4 * t + 2 * p;
      h -= 2 * t;
      hi -= 2 * t;
    }

    // Widening the finger joints' edge by the play moves the inner floor's
    // holes in by that much, so the outer shell's walls clear the inner's.
    // This retunes the shared settings, as boxes.py does: every f, F and h
    // edge drawn afterwards uses it.
    const fj = this.getEdge('f').settings as FingerJointSettings;
    fj.setValues(t, false, { edge_width: fj.edge_width + p });

    let d = 0;
    for (let i = 0; i < 2; i++) {
      d = i * 2 * (t + p);
      const height = [hi, h][i]!;
      const shell = i === 0 ? 'inner' : 'outer';
      this.savedContext(() => {
        this.rectangularWall(x + d, height, 'fFeF', { move: 'right', label: `${shell} front` });
        this.rectangularWall(y + d, height, 'ffef', { move: 'right', label: `${shell} left` });
        this.rectangularWall(x + d, height, 'fFeF', { move: 'right', label: `${shell} back` });
        this.rectangularWall(y + d, height, 'ffef', { move: 'right', label: `${shell} right` });
      });
      this.rectangularWall(y, height, 'ffef', { move: 'up only' });
    }

    this.rectangularWall(x, y, 'hhhh', { move: 'right', label: 'inner floor' });
    this.rectangularWall(x + d, y + d, 'FFFF', { move: 'right', label: 'outer floor' });
  }
}

export const twoPiece: GeneratorDef = {
  meta: {
    id: 'two_piece',
    name: 'Two-Piece Box',
    group: 'Box',
    summary: 'Box whose top slips down over the bottom half to close it',
    description:
      'Two open shells, one slightly larger than the other, so the outer one ' +
      'slides over the inner to form a closed box. Make the inner walls taller ' +
      'than the outer to leave a gap that makes it easier to open, or shorter ' +
      'to leave only a small ridge so the contents show once it is open.',
  },
  // Finer fingers than the library default, as upstream.
  paramDefaults: { fj_finger: 2.0, fj_space: 2.0 },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions', help: 'Height of the outer shell.' },
    {
      key: 'hi',
      kind: 'length',
      label: 'Inner shell height',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 1000,
      step: 1,
      group: 'dimensions',
      help: 'Leave at 0 to match the outer shell. Taller leaves a gap between the shells; shorter leaves a small ridge.',
    },
    {
      key: 'outside',
      kind: 'bool',
      label: 'Outside measurements',
      default: true,
      group: 'dimensions',
      help: 'When on, the sizes above are the closed box’s exterior. When off, they are the inner shell’s interior.',
    },
    {
      key: 'play',
      kind: 'number',
      label: 'Play between the shells',
      unit: '× thickness',
      default: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'joints',
      help: 'Clearance between the inner and outer shell walls.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new TwoPiece(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        hi: n(v, 'hi', 0),
        outside: b(v, 'outside', true),
        play: n(v, 'play', 0.15),
      },
      config,
    ),
};
