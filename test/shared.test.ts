/**
 * `dropSharedRuns`: a line two outlines share is cut once, by the outline
 * drawn first, and nothing else moves.
 */
import { describe, expect, it } from 'vitest';
import type { PathCmd } from '~/lib/geom/context';
import { dropSharedRuns } from '~/lib/geom/shared';

type Pt = [number, number];

/** A closed polyline through the points, back to the first. */
const ring = (...pts: Pt[]): PathCmd[] => [
  { c: 'M', x: pts[0]![0], y: pts[0]![1] },
  ...pts.slice(1).map(([x, y]) => ({ c: 'L' as const, x, y })),
  { c: 'L', x: pts[0]![0], y: pts[0]![1] },
];

const rect = (x0: number, y0: number, x1: number, y1: number) => ring([x0, y0], [x1, y0], [x1, y1], [x0, y1]);

/** Every straight segment drawn, as [x0, y0, x1, y1]. */
function segments(cmds: PathCmd[]): number[][] {
  const out: number[][] = [];
  let x = 0;
  let y = 0;
  for (const c of cmds) {
    if (c.c === 'T') continue;
    if (c.c === 'L') out.push([x, y, c.x, c.y]);
    x = c.x;
    y = c.y;
  }
  return out;
}

const length = (cmds: PathCmd[]) => segments(cmds).reduce((s, [a, b, c, d]) => s + Math.hypot(c! - a!, d! - b!), 0);
const moves = (cmds: PathCmd[]) => cmds.filter((c) => c.c === 'M').length;

/** Whether a point lies on some segment. */
const onAny = (segs: number[][], [px, py]: Pt) =>
  segs.some(([a, b, c, d]) => {
    const t = Math.abs(c! - a!) > Math.abs(d! - b!) ? (px - a!) / (c! - a!) : (py - b!) / (d! - b!);
    return t >= -1e-9 && t <= 1 + 1e-9 && Math.abs(a! + t * (c! - a!) - px) < 1e-9 && Math.abs(b! + t * (d! - b!) - py) < 1e-9;
  });

/** Points along a stroke's segments, finely enough to see any gap or extra. */
function samples(cmds: PathCmd[]): Pt[] {
  return segments(cmds).flatMap(([a, b, c, d]) =>
    Array.from({ length: 41 }, (_, i): Pt => [a! + ((c! - a!) * i) / 40, b! + ((d! - b!) * i) / 40]),
  );
}

describe('dropSharedRuns', () => {
  it('takes the whole shared edge from the later of two touching rectangles', () => {
    const lower = rect(0, 0, 10, 5);
    const upper = rect(0, 5, 10, 10);
    const [a, b] = dropSharedRuns([
      { layer: 'cut', cmds: lower },
      { layer: 'cut', cmds: upper },
    ]);
    expect(a).toBe(lower);
    expect(length(b!)).toBeCloseTo(30 - 10, 9);
    // One open cut: up the right, across the top, down the left.
    expect(moves(b!)).toBe(1);
    expect(b![0]).toMatchObject({ c: 'M', x: 10, y: 5 });
    expect(b![b!.length - 1]).toMatchObject({ x: 0, y: 5 });
  });

  it('takes only the overlap, and leaves the rest of the edge', () => {
    const lower = rect(0, 0, 10, 5);
    const upper = rect(5, 5, 20, 10);
    const [, b] = dropSharedRuns([
      { layer: 'cut', cmds: lower },
      { layer: 'cut', cmds: upper },
    ]);
    expect(length(b!)).toBeCloseTo(15 + 5 + 15 + 5 - 5, 9);
    expect(onAny(segments(b!), [15, 5])).toBe(true);
    expect(onAny(segments(b!), [7, 5])).toBe(false);
  });

  it('matches runs drawn in opposite directions, and splits one cut open in its middle', () => {
    // The upper outline is clockwise, so its bottom runs right to left and
    // starts at the right; the lower one's top covers only the middle of it.
    const lower = rect(4, 0, 6, 5);
    const upper = ring([10, 5], [0, 5], [0, 10], [10, 10]);
    const [, b] = dropSharedRuns([
      { layer: 'cut', cmds: lower },
      { layer: 'cut', cmds: upper },
    ]);
    expect(length(b!)).toBeCloseTo(30 - 2, 9);
    // The gap falls inside the outline, so the piece before it runs on into
    // the piece after: still one cut.
    expect(moves(b!)).toBe(1);
    expect(b![0]).toMatchObject({ c: 'M', x: 4, y: 5 });
    expect(b![b!.length - 1]).toMatchObject({ x: 6, y: 5 });
  });

  it('leaves lines that are not collinear, or not on the same layer, alone', () => {
    const lower = rect(0, 0, 10, 5);
    const near = rect(0, 5.001, 10, 10);
    const etch = rect(0, 5, 10, 10);
    const out = dropSharedRuns([
      { layer: 'cut', cmds: lower },
      { layer: 'cut', cmds: near },
      { layer: 'etching', cmds: etch },
    ]);
    expect(out[1]).toBe(near);
    expect(out[2]).toBe(etch);
  });

  it('leaves outlines that only touch at a corner, or end to end, alone', () => {
    const a = rect(0, 0, 10, 5);
    const b = rect(10, 5, 20, 10);
    const c = rect(10, 0, 20, 5);
    const out = dropSharedRuns([
      { layer: 'cut', cmds: a },
      { layer: 'cut', cmds: b },
    ]);
    expect(out[1]).toBe(b);
    // Side by side the shared edge is vertical, and goes just the same.
    const [, d] = dropSharedRuns([
      { layer: 'cut', cmds: a },
      { layer: 'cut', cmds: c },
    ]);
    expect(length(d!)).toBeCloseTo(25, 9);
  });

  it('leaves exactly the original outline less the overlap', () => {
    // A slotted upper strip over a slotted lower one: the overlap is the
    // stretches where both are solid.
    const lower = ring([0, 0], [30, 0], [30, 5], [22, 5], [22, 3], [18, 3], [18, 5], [0, 5]);
    const upper = ring([0, 5], [8, 5], [8, 7], [12, 7], [12, 5], [26, 5], [26, 10], [0, 10]);
    const [, b] = dropSharedRuns([
      { layer: 'cut', cmds: lower },
      { layer: 'cut', cmds: upper },
    ]);
    const shared = [
      [0, 8],
      [12, 18],
      [22, 26],
    ];
    const overlap = shared.reduce((s, [x0, x1]) => s + x1! - x0!, 0);
    expect(length(b!)).toBeCloseTo(length(upper) - overlap, 9);
    const kept = segments(b!);
    const original = segments(upper);
    const inOverlap = ([x, y]: Pt) => Math.abs(y - 5) < 1e-9 && shared.some(([x0, x1]) => x > x0! + 1e-9 && x < x1! - 1e-9);
    // Everything kept was in the original, and nothing kept is shared…
    for (const p of samples(b!)) {
      expect(onAny(original, p)).toBe(true);
      expect(inOverlap(p)).toBe(false);
    }
    // …and everything in the original that is not shared is kept.
    for (const p of samples(upper)) if (!inOverlap(p)) expect(onAny(kept, p), JSON.stringify(p)).toBe(true);
  });

  it('keeps curves, and text, through a rebuild', () => {
    const lower = rect(0, 0, 10, 5);
    const upper: PathCmd[] = [
      { c: 'M', x: 0, y: 5 },
      { c: 'L', x: 10, y: 5 },
      { c: 'C', x: 10, y: 10, x1: 12, y1: 6, x2: 12, y2: 9 },
      { c: 'L', x: 0, y: 10 },
      { c: 'L', x: 0, y: 5 },
    ];
    const text = { c: 'T', x: 5, y: 7, text: 'X1' } as unknown as PathCmd;
    const [, b] = dropSharedRuns([
      { layer: 'cut', cmds: lower },
      { layer: 'cut', cmds: [...upper, text] },
    ]);
    expect(b!.filter((c) => c.c === 'C')).toEqual([upper[2]]);
    expect(b!.filter((c) => c.c === 'T')).toEqual([text]);
    expect(b![0]).toMatchObject({ c: 'M', x: 10, y: 5 });
  });
});
