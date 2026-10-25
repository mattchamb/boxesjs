/**
 * Whether cuts meet: the geometry behind the layout check in the tests, and
 * behind the runtime check that a part's own cuts stay clear of each other.
 *
 * Cuts are flattened to polylines. A cubic is sampled rather than solved:
 * boxes.py's arcs are shallow at this scale, and the question is only whether
 * two cuts meet, not where.
 */
import type { PathCmd } from './context';

export type Pt = [number, number];

/** Each subpath of `cmds` as a polyline. */
export function polylines(cmds: PathCmd[]): Pt[][] {
  const rings: Pt[][] = [];
  let ring: Pt[] = [];
  let x = 0;
  let y = 0;
  for (const c of cmds) {
    if (c.c === 'M') {
      if (ring.length > 1) rings.push(ring);
      ring = [[c.x, c.y]];
    } else if (c.c === 'L') {
      ring.push([c.x, c.y]);
    } else if (c.c === 'C') {
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const u = 1 - t;
        ring.push([
          u * u * u * x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        ]);
      }
    } else {
      continue;
    }
    x = c.x;
    y = c.y;
  }
  if (ring.length > 1) rings.push(ring);
  return rings;
}

const cross = (o: Pt, p: Pt, q: Pt) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);

/** Proper crossing only: segments that merely touch at an end do not count. */
export function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
}

export function insideRing(p: Pt, ring: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function bounds(r: Pt[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of r) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

/** Which crossings count: given the two segments, [a, b] and [c, d]. */
type Counts = (a: Pt, b: Pt, c: Pt, d: Pt) => boolean;

/** Whether any segment of one ring crosses a segment of another. */
export function ringsCross(a: Pt[], b: Pt[], counts?: Counts): boolean {
  const [ax0, ay0, ax1, ay1] = bounds(a);
  const [bx0, by0, bx1, by1] = bounds(b);
  if (ax1 < bx0 || bx1 < ax0 || ay1 < by0 || by1 < ay0) return false;
  for (let k = 1; k < a.length; k++) {
    for (let l = 1; l < b.length; l++) {
      if (segmentsCross(a[k - 1]!, a[k]!, b[l - 1]!, b[l]!) && (!counts || counts(a[k - 1]!, a[k]!, b[l - 1]!, b[l]!))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Whether a ring crosses itself. Neighbouring segments share an end, which is
 * not a crossing, and nor is the closing joint of a closed ring.
 */
export function ringCrossesItself(r: Pt[], counts?: Counts): boolean {
  const n = r.length - 1;
  // A full turn comes back to its start only to within rounding.
  const closed = n > 2 && Math.hypot(r[0]![0] - r[n]![0], r[0]![1] - r[n]![1]) < 1e-6;
  for (let k = 1; k <= n; k++) {
    for (let l = k + 2; l <= n; l++) {
      if (closed && k === 1 && l === n) continue;
      if (segmentsCross(r[k - 1]!, r[k]!, r[l - 1]!, r[l]!) && (!counts || counts(r[k - 1]!, r[k]!, r[l - 1]!, r[l]!))) {
        return true;
      }
    }
  }
  return false;
}

/** Distance from `p` to the segment [a, b]. */
function toSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Whether `p` lies inside `zone`, or within `margin` of it. */
function near(p: Pt, zone: Pt[], margin: number): boolean {
  if (insideRing(p, zone)) return true;
  for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
    if (toSegment(p, zone[j]!, zone[i]!) <= margin) return true;
  }
  return false;
}

/**
 * Whether a part's cuts meet one another: its outline crossing itself, or
 * crossing a hole, or two holes crossing. Any of these cuts away material the
 * design meant to keep. With `zones`, only crossings with a segment ending in
 * or by one of them count; the margin covers the kerf, which moves the cut off
 * the line the zone was taken from.
 */
export function cutsMeet(paths: { layer: string; cmds: PathCmd[] }[], zones?: Pt[][]): boolean {
  const rings = paths.filter((p) => p.layer === 'cut' || p.layer === 'inner').flatMap((p) => polylines(p.cmds));
  const counts: Counts | undefined = zones && ((...ends) => ends.some((e) => zones.some((z) => near(e, z, 1))));
  for (let i = 0; i < rings.length; i++) {
    if (ringCrossesItself(rings[i]!, counts)) return true;
    for (let j = i + 1; j < rings.length; j++) if (ringsCross(rings[i]!, rings[j]!, counts)) return true;
  }
  return false;
}
