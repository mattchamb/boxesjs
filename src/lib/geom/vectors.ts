/**
 * 2D vector helpers, ported from boxes.py `boxes/vectors.py` — only the ones
 * `kerf` and the gears module use.
 */
export type Vec = readonly [number, number];

export function normalize(v: Vec): Vec {
  const l = Math.sqrt(v[0] ** 2 + v[1] ** 2);
  if (l === 0.0) return [0.0, 0.0];
  return [v[0] / l, v[1] / l];
}

export function vlength(v: Vec): number {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2);
}

/** Vector from p1 to p2. */
export function vdiff(p1: Vec, p2: Vec): Vec {
  return [p2[0] - p1[0], p2[1] - p1[1]];
}

export function vadd(v1: Vec, v2: Vec): Vec {
  return [v1[0] + v2[0], v1[1] + v2[1]];
}

export function vorthogonal(v: Vec): Vec {
  return [-v[1], v[0]];
}

export function vscalmul(v: Vec, a: number): Vec {
  return [a * v[0], a * v[1]];
}

export function dotproduct(v1: Vec, v2: Vec): number {
  return v1[0] * v2[0] + v1[1] * v2[1];
}

/**
 * Offset a polyline by `k`, moving each vertex along the bisector of its two
 * segments so both stay parallel to the originals. This is how boxes.py
 * kerf-compensates point lists (gear teeth), which never go through the
 * turtle's per-corner arcs.
 *
 * Python indexes `points[i - 1]` at `i = 0`, which wraps to the last point;
 * the explicit wrap below reproduces that.
 */
export function kerf(points: readonly Vec[], k: number, closed = true): Vec[] {
  const result: Vec[] = [];
  const lp = points.length;

  for (let i = 0; i < lp; i++) {
    const prev = points[(i - 1 + lp) % lp]!;
    const cur = points[i]!;
    const next = points[(i + 1) % lp]!;
    let v1 = vorthogonal(normalize(vdiff(prev, cur)));
    let v2 = vorthogonal(normalize(vdiff(cur, next)));

    if (!closed) {
      if (i === 0) v1 = v2;
      if (i === lp - 1) v2 = v1;
    }
    const d = normalize(vadd(v1, v2));
    // cos of half the angle between the segments
    const cosAlpha = dotproduct(v1, d);
    result.push(vadd(cur, vscalmul(d, -k / cosAlpha)));
  }

  return result;
}
