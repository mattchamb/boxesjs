/**
 * The pantograph is this port's own, so there is no boxes.py golden to
 * compare against. These tests pin what a pantograph must do instead: for
 * every ratio, at any angle of the arms, the pen is k times as far from the
 * pivot as the tracer, in the same direction.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_RATIOS, pantographLayout, parseRatios, type PantographOptions } from '~/lib/generators/pantograph';
import { defaultsFor } from '~/lib/generators/registry';
import { buildDrawing } from '~/lib/preview';
import type { ParamValues } from '~/lib/params/schema';

type V = [number, number];
const add = (p: V, q: V): V => [p[0] + q[0], p[1] + q[1]];
const sub = (p: V, q: V): V => [p[0] - q[0], p[1] - q[1]];
const mul = (p: V, f: number): V => [p[0] * f, p[1] * f];
const len = (p: V) => Math.hypot(p[0], p[1]);
const dir = (deg: number): V => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];

function opts(over: Partial<PantographOptions> = {}): PantographOptions {
  return { length: 300, ratios: parseRatios(DEFAULT_RATIOS).ratios, width: 20, hole: 4.2, pen: 10, ...over };
}

/** Etched ratios, leaving out the part labels. */
const ratioTexts = (p: { texts: { text: string }[] }) => p.texts.map((t) => t.text).filter((t) => /^[\d.]+$/.test(t));

function drawing(values: ParamValues) {
  return buildDrawing('pantograph', { ...defaultsFor('pantograph'), ...values });
}

describe('parseRatios', () => {
  it('sorts, dedupes and accepts ratio notations', () => {
    expect(parseRatios('3, 2;1.5 2 x4 5x 1:6')).toEqual({ ratios: [1.5, 2, 3, 4, 5, 6], errors: [] });
  });
  it('rejects ratios of 1 or less, and junk', () => {
    const { ratios, errors } = parseRatios('1 0.5 two 2');
    expect(ratios).toEqual([2]);
    expect(errors).toHaveLength(3);
  });
  it('wants at least one', () => {
    expect(parseRatios('  ').errors).toEqual(['No ratios given.']);
  });
});

describe('pantographLayout', () => {
  const lay = pantographLayout(opts());

  it('makes both long arms L long', () => {
    expect(Math.max(...lay.pivots.map((p) => p.at))).toBeCloseTo(lay.L, 9);
  });

  it('scales the pen by k about the pivot at any arm angle', () => {
    for (const [i, { k }] of lay.pivots.entries()) {
      const x = lay.pivots[i]!.at;
      const t = lay.tracers[i]!.at;
      for (let alpha = 0; alpha < 360; alpha += 37) {
        for (const elbow of [25, 60, 90, 120, 155]) {
          const u = dir(alpha);
          const v = dir(alpha + elbow);
          const O: V = [12, -7];
          const A = sub(O, mul(u, x));
          const C = add(A, mul(u, lay.a));
          const D = add(A, mul(v, lay.b));
          const E = add(C, mul(v, lay.b));
          const P = add(C, mul(v, t));
          const Q = add(A, mul(v, lay.L));
          // The parallelogram closes: E is on both short arms.
          expect(len(sub(E, D))).toBeCloseTo(lay.a, 9);
          const diff = sub(sub(Q, O), mul(sub(P, O), k));
          expect(len(diff)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('keeps every hole a web clear of its neighbours at defaults', () => {
    expect(lay.crowded).toEqual([]);
    expect(lay.penClash).toBe(false);
  });

  it('reports ratios whose holes crowd', () => {
    expect(pantographLayout(opts({ length: 150, ratios: [2, 8, 9, 10] })).crowded).toEqual([8, 9, 10]);
  });

  it('reports a parallelogram that reaches the pen', () => {
    expect(pantographLayout(opts({ ratios: [1.02, 2] })).penClash).toBe(true);
  });
});

describe('drawing', () => {
  it('cuts four arms, the spacers and the block', () => {
    const d = drawing({});
    expect(d.warnings).toEqual([]);
    const names = d.parts.map((p) => p.name);
    expect(names.slice(0, 4)).toEqual(['long arm (pivot)', 'long arm (pen)', 'short arm (tracer)', 'short arm']);
    expect(names.filter((x) => x === 'spacer')).toHaveLength(6);
    expect(names.slice(-2)).toEqual(['base block 1', 'base block 2']);
  });

  it('draws arms the layout length plus round ends, with a hole per joint and ratio', () => {
    const d = drawing({ burn: 0 });
    const lay = pantographLayout(opts());
    const [pivot, pen, tracer, short] = d.parts;
    const length = (p: (typeof d.parts)[number]) => p.bbox.width;
    expect(length(pivot!)).toBeCloseTo(lay.L + 20, 1);
    expect(length(pen!)).toBeCloseTo(lay.L + 20, 1);
    expect(length(tracer!)).toBeCloseTo(lay.b + 20, 1);
    expect(length(short!)).toBeCloseTo(lay.a + 20, 1);
    // Outline plus holes.
    expect(pivot!.paths).toHaveLength(1 + 2 + 6);
    expect(pen!.paths).toHaveLength(1 + 3);
    expect(tracer!.paths).toHaveLength(1 + 2 + 6);
    expect(ratioTexts(pivot!)).toEqual(['1.5', '2', '2.5', '3', '4', '5']);
    expect(ratioTexts(tracer!)).toEqual(['1.5', '2', '2.5', '3', '4', '5']);
  });

  it('leaves the ratios unetched when asked', () => {
    expect(drawing({ etch: false }).parts.flatMap(ratioTexts)).toEqual([]);
  });

  it('warns on the ratios field', () => {
    expect(drawing({ ratios: '2 0.5' }).warnings.map((w) => w.param)).toEqual(['ratios']);
    expect(drawing({ length: 150, ratios: '2 8 9 10' }).warnings.map((w) => w.param)).toEqual(['ratios']);
    expect(drawing({ pen: 18 }).warnings.map((w) => w.param)).toEqual(['pen']);
  });
});
