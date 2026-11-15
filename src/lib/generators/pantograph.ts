/**
 * Pantograph — not from boxes.py, which has no pantograph.
 *
 * A drawing pantograph: trace a picture with the stylus and the pen draws it
 * k times larger. Four bars form a parallelogram A–C–E–D, A being the elbow
 * where the two long arms meet:
 *
 *     O pivot row ─── C ───────── A
 *                     │           │
 *             tracer  P           │
 *                     │           │
 *                     E ───────── D ─────────── Q pen
 *
 * With u the direction A→C and v the direction A→D, the pivot O sits on the
 * first long arm at x from A, the tracer P on the short arm C–E at t from C,
 * and the pen Q at the end of the second long arm, L from A. Writing O as the
 * origin, P = (a − x)·u + t·v and Q = −x·u + L·v; Q = k·P exactly when
 * x = a·k/(k − 1) and t = L/k, whatever the arms' angles. So every ratio is
 * one hole on the pivot row and one on the tracer row, and changing scale
 * moves only those two pins; the pen and the parallelogram stay put.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { ETCHING } from '../geom/colors';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

/** Material left between two holes, or a hole and the edge, mm. */
export const MIN_WEB = 2;

export const DEFAULT_RATIOS = '1.5 2 2.5 3 4 5';

export function parseRatios(text: string): { ratios: number[]; errors: string[] } {
  const errors: string[] = [];
  const seen = new Set<number>();
  for (const word of text.split(/[\s,;]+/).filter(Boolean)) {
    const k = Number(word.replace(/[×x:]$/i, '').replace(/^(1:|[×x])/i, ''));
    if (!Number.isFinite(k)) errors.push(`"${word}" is not a number.`);
    else if (k <= 1) errors.push(`A ratio must be larger than 1; ${word} is not. Swap pen and tracer to reduce.`);
    else seen.add(k);
  }
  const ratios = [...seen].sort((p, q) => p - q);
  if (ratios.length === 0 && errors.length === 0) errors.push('No ratios given.');
  return { ratios, errors };
}

export interface PantographOptions {
  /** Elbow to pen, mm. */
  length: number;
  ratios: number[];
  width: number;
  hole: number;
  pen: number;
}

export interface HoleAt {
  k: number;
  /** Distance along the arm from its reference joint (A for the pivot row, C for the tracer row). */
  at: number;
}

export interface PantographLayout {
  /** |AC|, along the pivot arm. */
  a: number;
  /** |AD| = |CE|, along the pen arm and the tracer arm. */
  b: number;
  /** |AQ|, elbow to pen. */
  L: number;
  pivots: HoleAt[];
  tracers: HoleAt[];
  /** Ratios whose holes come closer than a hole and a web to a neighbour. */
  crowded: number[];
  /** D would sit at or past the pen. */
  penClash: boolean;
}

/**
 * Where every joint and hole goes. The smallest ratio's pivot hole lands at
 * the end of the pivot arm, so both long arms are L long, and E sits a hole
 * and a web past the smallest ratio's tracer hole.
 */
export function pantographLayout(o: PantographOptions): PantographLayout {
  const L = o.length;
  const ratios = o.ratios.length ? o.ratios : [2];
  const kmin = ratios[0]!;
  const spacing = o.hole + MIN_WEB;
  const a = (L * (kmin - 1)) / kmin;
  const b = L / kmin + spacing;

  const pivots = ratios.map((k) => ({ k, at: (a * k) / (k - 1) }));
  const tracers = ratios.map((k) => ({ k, at: L / k }));

  const crowded = new Set<number>();
  const check = (row: { k: number | null; at: number }[]) => {
    const sorted = [...row].sort((p, q) => p.at - q.at);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.at - sorted[i - 1]!.at < spacing - 1e-9) {
        for (const h of [sorted[i - 1]!, sorted[i]!]) if (h.k !== null) crowded.add(h.k);
      }
    }
  };
  // Joints are in the rows too: C sits among the pivot arm's holes, and C
  // and E bracket the tracer row.
  check([{ k: null, at: 0 }, { k: null, at: a }, ...pivots]);
  check([{ k: null, at: 0 }, { k: null, at: b }, ...tracers]);

  return {
    a,
    b,
    L,
    pivots,
    tracers,
    crowded: [...crowded].sort((p, q) => p - q),
    penClash: L - b < spacing,
  };
}

interface Options extends PantographOptions {
  ratiosText: string;
  blockX: number;
  blockY: number;
  blockLayers: number;
  spacers: number;
  etch: boolean;
}

/** Ratios as etched: no trailing zeros, at most two decimals. */
const fmt = (k: number) => String(Math.round(k * 100) / 100);

class Pantograph extends Boxes {
  constructor(
    private o: Options,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /**
   * A bar with round ends, `l` between its end holes. Holes lie on the
   * centre line at `at` from the left end hole; ratio labels alternate above
   * and below so neighbours at high ratios have twice the room.
   */
  private arm(l: number, holes: { at: number; d: number; k?: number }[], label: string): void {
    const w = this.o.width;
    const fs = Math.min(5, w / 2 - this.o.hole / 2 - 1.5);
    this.polygonWall([l, [180, w / 2], l, [180, w / 2]], {
      edge: 'e',
      callback: [
        () => {
          let side = 0;
          for (const h of holes) {
            this.hole(h.at, w / 2, 0, h.d);
            if (h.k === undefined || !this.o.etch || fs < 1.5) continue;
            const up = side++ % 2 === 0;
            // Text hangs below its anchor, as in boxes.py's own SVG output, so
            // the anchor is the label's top edge either side of the hole.
            const y = up ? w / 2 + h.d / 2 + 0.75 + fs : w / 2 - h.d / 2 - 0.75;
            this.text(fmt(h.k), h.at, y, 0, 'center', fs, ETCHING);
          }
        },
      ],
      move: 'up',
      label,
    });
  }

  render(): void {
    const o = this.o;
    const { ratios, errors } = parseRatios(o.ratiosText);
    for (const e of errors) this.warn(e, 'ratios');

    const lay = pantographLayout(o);
    if (lay.crowded.length) {
      this.warn(
        `The holes for ${lay.crowded.map(fmt).join(', ')} are closer than ${(o.hole + MIN_WEB).toFixed(1)} mm to a ` +
          'neighbour and would break into each other. Drop some of them, or make the arms longer.',
        'ratios',
      );
    }
    if (lay.penClash) {
      this.warn(
        `With a smallest ratio of ${fmt(ratios[0] ?? 2)} the parallelogram reaches the pen. Use ratios of 1.5 or more.`,
        'ratios',
      );
    }
    if (o.width - o.pen < 2 * MIN_WEB) {
      this.warn(`The pen hole leaves less than ${MIN_WEB} mm of arm around it; widen the arms or use a thinner pen.`, 'pen');
    }
    if (o.width - o.hole < 2 * MIN_WEB) {
      this.warn(`The bolt holes leave less than ${MIN_WEB} mm of arm either side.`, 'hole');
    }

    const d = o.hole;
    this.arm(lay.L, [{ at: 0, d }, { at: lay.a, d }, ...lay.pivots.map((p) => ({ ...p, d }))], 'long arm (pivot)');
    this.arm(lay.L, [{ at: 0, d }, { at: lay.b, d }, { at: lay.L, d: o.pen }], 'long arm (pen)');
    this.arm(lay.b, [{ at: 0, d }, { at: lay.b, d }, ...lay.tracers.map((t) => ({ ...t, d }))], 'short arm (tracer)');
    this.arm(lay.a, [{ at: 0, d }, { at: lay.a, d }], 'short arm');

    // Discs are named without a drawn label, as Linkage's are: the text is
    // wider than a small disc.
    this.partsMatrix(o.spacers, 0, 'up', (move) =>
      this.parts.disc(o.width, { hole: d, move, callback: () => this.ctx.nameCurrentPart('spacer') }),
    );

    for (let i = 1; i <= o.blockLayers; i++) {
      this.rectangularWall(o.blockX, o.blockY, 'eeee', {
        callback: [() => this.hole(o.blockX / 2, o.blockY / 2, 0, d)],
        move: 'right',
        label: `base block ${i}`,
      });
    }
  }
}

export const pantograph: GeneratorDef = {
  meta: {
    id: 'pantograph',
    name: 'Pantograph',
    group: 'Misc',
    summary: 'Drawing pantograph that copies a picture larger',
    description:
      'Four arms bolted into a parallelogram. Bolt the pivot arm to the base block, clamp the block to the table, ' +
      'put a pen through the hole at the end of the pen arm and a pointed bolt or dowel through the tracer arm: ' +
      'whatever the tracer follows, the pen draws larger. To change the scale, move the pivot and the tracer to the ' +
      'holes etched with the same ratio. Swap pen and tracer to draw smaller instead. Spacers go under the arms ' +
      'where they stack, to keep them level.',
  },
  params: [
    { key: 'length', kind: 'length', label: 'Arm length', unit: 'mm', default: 300, min: 60, max: 1000, step: 1, group: 'dimensions', help: 'Elbow to pen. The pen reaches about twice this.' },
    {
      key: 'ratios',
      kind: 'text',
      label: 'Enlargements',
      default: DEFAULT_RATIOS,
      placeholder: DEFAULT_RATIOS,
      group: 'dimensions',
      help: 'Each gets a pivot hole and a tracer hole, etched with its number. The smallest sets how long the short arms are.',
    },
    { key: 'width', kind: 'length', label: 'Arm width', unit: 'mm', default: 20, min: 8, max: 60, step: 0.5, group: 'dimensions' },
    { key: 'hole', kind: 'length', label: 'Bolt hole', unit: 'mm', default: 4.2, min: 1, max: 12, step: 0.1, group: 'dimensions', help: 'Joints, pivot and tracer. 4.2 fits an M4 bolt.' },
    { key: 'pen', kind: 'length', label: 'Pen hole', unit: 'mm', default: 10, min: 2, max: 40, step: 0.1, group: 'dimensions' },
    { key: 'etch', kind: 'bool', label: 'Etch ratios', default: true, group: 'dimensions' },
    { key: 'block_x', kind: 'length', label: 'Base block width', unit: 'mm', default: 60, min: 20, max: 300, step: 1, group: 'advanced' },
    { key: 'block_y', kind: 'length', label: 'Base block depth', unit: 'mm', default: 40, min: 20, max: 300, step: 1, group: 'advanced' },
    { key: 'block_layers', kind: 'number', label: 'Base block layers', default: 2, min: 0, max: 10, integer: true, group: 'advanced' },
    { key: 'spacers', kind: 'number', label: 'Spacers', default: 6, min: 0, max: 30, integer: true, group: 'advanced', help: 'Washers the width of an arm.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) => {
    const ratiosText = s(v, 'ratios', DEFAULT_RATIOS);
    return new Pantograph(
      {
        length: n(v, 'length', 300),
        ratios: parseRatios(ratiosText).ratios,
        ratiosText,
        width: n(v, 'width', 20),
        hole: n(v, 'hole', 4.2),
        pen: n(v, 'pen', 10),
        etch: b(v, 'etch', true),
        blockX: n(v, 'block_x', 60),
        blockY: n(v, 'block_y', 40),
        blockLayers: Math.max(0, Math.round(n(v, 'block_layers', 2))),
        spacers: Math.max(0, Math.round(n(v, 'spacers', 6))),
      },
      config,
    );
  },
};
