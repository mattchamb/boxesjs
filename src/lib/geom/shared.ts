/**
 * Cutting a shared edge once.
 *
 * Parts laid edge to edge, each kerf-compensated on its own, meet on one
 * line: the lower part's outline a kerf above its edge, the upper's a kerf
 * below its own. Cut twice, that line takes twice the kerf and a second pass
 * over a part that is already loose. This drops the second copy.
 *
 * Only straight, axis-aligned runs are matched. Compensated corners curve away
 * from each other, so where outlines coincide it is along straight lines, and
 * an exact test on those needs nothing cleverer than intervals.
 *
 * It is the building block for merging coincident lines across arbitrary
 * parts on a sheet; today only one part's own paths are compared.
 */
import { pointsEqual, type PathCmd } from './context';

export interface Stroke {
  cmds: PathCmd[];
  /** Lines are only shared within a layer: a cut does not stand in for an etch. */
  layer: string;
}

/** How far apart two lines may lie and still be one cut. */
export const SHARED_TOL = 1e-6;

interface Run {
  stroke: number;
  /** Index of the `L` in its stroke. */
  cmd: number;
  horizontal: boolean;
  /** The coordinate the run lies on: y when horizontal, x when vertical. */
  at: number;
  lo: number;
  hi: number;
}

/** Every axis-aligned straight run in a stroke. */
function runsOf(cmds: PathCmd[], stroke: number, tol: number): Run[] {
  const runs: Run[] = [];
  let x = 0;
  let y = 0;
  cmds.forEach((c, i) => {
    if (c.c === 'T') return;
    if (c.c === 'L') {
      const dx = c.x - x;
      const dy = c.y - y;
      if (Math.abs(dy) <= tol && Math.abs(dx) > tol) {
        runs.push({ stroke, cmd: i, horizontal: true, at: (y + c.y) / 2, lo: Math.min(x, c.x), hi: Math.max(x, c.x) });
      } else if (Math.abs(dx) <= tol && Math.abs(dy) > tol) {
        runs.push({ stroke, cmd: i, horizontal: false, at: (x + c.x) / 2, lo: Math.min(y, c.y), hi: Math.max(y, c.y) });
      }
    }
    x = c.x;
    y = c.y;
  });
  return runs;
}

/** Sorted, overlapping or touching intervals joined. */
function mergeIntervals(iv: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of [...iv].sort((p, q) => p[0] - q[0])) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/**
 * Each stroke's commands with every straight run that an earlier stroke on
 * the same layer already cuts taken out. Strokes are compared, not a stroke
 * with itself, and the earlier one always keeps its line: drawing order is
 * cutting order, so the line goes with whichever part is finished first.
 *
 * A stroke that loses a run becomes open subpaths. When the gap falls inside
 * a closed outline, the pieces either side of it are rejoined so what is left
 * is still one continuous cut.
 *
 * Strokes that lose nothing are returned as the same arrays.
 */
export function dropSharedRuns(strokes: Stroke[], tol = SHARED_TOL): PathCmd[][] {
  const runs = strokes.map((s, i) => runsOf(s.cmds, i, tol));

  // Bucket by the line a run lies on. A bucket far wider than the tolerance
  // means a coincident pair is in the same bucket or the next.
  const BUCKET = 1e-3;
  const key = (r: Run, at: number) => `${strokes[r.stroke]!.layer}|${r.horizontal ? 'h' : 'v'}|${at}`;
  const buckets = new Map<string, Run[]>();
  for (const list of runs) {
    for (const r of list) {
      const k = key(r, Math.round(r.at / BUCKET));
      const b = buckets.get(k);
      if (b) b.push(r);
      else buckets.set(k, [r]);
    }
  }

  // Per stroke, per command: the stretches already cut by an earlier stroke.
  const removed = strokes.map(() => new Map<number, [number, number][]>());
  for (const list of runs) {
    for (const r of list) {
      const at = Math.round(r.at / BUCKET);
      for (const k of [at - 1, at, at + 1]) {
        for (const o of buckets.get(key(r, k)) ?? []) {
          if (o.stroke >= r.stroke || Math.abs(o.at - r.at) > tol) continue;
          const a = Math.max(r.lo, o.lo);
          const b = Math.min(r.hi, o.hi);
          if (b - a <= tol) continue;
          const m = removed[r.stroke]!;
          const iv = m.get(r.cmd);
          if (iv) iv.push([a, b]);
          else m.set(r.cmd, [[a, b]]);
        }
      }
    }
  }

  return strokes.map((s, i) => (removed[i]!.size ? rebuild(s.cmds, removed[i]!, tol) : s.cmds));
}

/** A stroke redrawn without the given stretches of its runs. */
function rebuild(cmds: PathCmd[], removed: Map<number, [number, number][]>, tol: number): PathCmd[] {
  const subpaths: PathCmd[][] = [];
  const texts: PathCmd[] = [];
  let sub: PathCmd[] | null = null;
  let x = 0;
  let y = 0;
  // Where the pen was lifted, so the next line starts with a move from there.
  let lifted = false;

  const lineTo = (c: PathCmd) => {
    if (lifted || !sub) {
      sub = [{ c: 'M', x, y }];
      subpaths.push(sub);
      lifted = false;
    }
    sub.push(c);
  };

  cmds.forEach((c, i) => {
    if (c.c === 'T') {
      texts.push(c);
      return;
    }
    if (c.c === 'M') {
      sub = [c];
      subpaths.push(sub);
      lifted = false;
    } else if (c.c === 'L' && removed.has(i)) {
      const horizontal = Math.abs(c.y - y) <= tol;
      const from = horizontal ? x : y;
      const to = horizontal ? c.x : c.y;
      const dir = Math.sign(to - from);
      const point = (v: number): [number, number] => (horizontal ? [v, c.y] : [c.x, v]);
      // The stretches to drop, in the order the run travels.
      const gaps = mergeIntervals(removed.get(i)!).map(([a, b]) => (dir > 0 ? [a, b] : [b, a]) as [number, number]);
      if (dir < 0) gaps.reverse();
      let at = from;
      for (const [g0, g1] of gaps) {
        if ((g0 - at) * dir > tol) {
          const [px, py] = point(g0);
          lineTo({ c: 'L', x: px, y: py });
        }
        at = g1;
        [x, y] = point(at);
        lifted = true;
      }
      if ((to - at) * dir > tol) lineTo({ c: 'L', x: c.x, y: c.y });
    } else {
      lineTo(c);
    }
    x = c.x;
    y = c.y;
  });

  const drawn = subpaths.filter((p) => p.length > 1);
  // A closed outline cut open in the middle: the last piece runs on into the
  // first, so they are one cut.
  if (drawn.length > 1) {
    const first = drawn[0]!;
    const last = drawn[drawn.length - 1]!;
    const end = last[last.length - 1]!;
    if (pointsEqual(first[0]!.x, first[0]!.y, end.x, end.y)) {
      drawn[0] = [...last, ...first.slice(1)];
      drawn.pop();
    }
  }
  return [...drawn.flat(), ...texts];
}
