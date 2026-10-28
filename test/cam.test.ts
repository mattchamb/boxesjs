/**
 * The cam generator is this port's own, so there is no boxes.py golden to
 * compare against. These tests pin what a cam profile must do instead: the
 * follower, put where the displacement diagram says at each cam angle, touches
 * the outline and never cuts into it.
 */
import { describe, expect, it } from 'vitest';
import { camProfile, parseMotion, sampleMotion, type CamOptions } from '~/lib/generators/cam';
import { defaultsFor } from '~/lib/generators/registry';
import { buildDrawing } from '~/lib/preview';
import type { ParamValues } from '~/lib/params/schema';

const DEG = Math.PI / 180;
const MOTION = 'rise 20 120\ndwell 60\nreturn 120 harmonic\ndwell 60';

function opts(over: Partial<CamOptions> = {}): CamOptions {
  return {
    segments: parseMotion(MOTION).segments,
    baseRadius: 30,
    follower: 'knife',
    rollerRadius: 8,
    offset: 0,
    direction: 1,
    burn: 0,
    ...over,
  };
}

/** A cam-frame point turned into the follower's frame at cam angle `theta`. */
function toFollower([x, y]: [number, number], theta: number, d: number): [number, number] {
  const a = d * theta * DEG;
  return [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y];
}

/** Distance from a point to a closed polyline. */
function distanceTo(poly: [number, number][], [px, py]: [number, number]): number {
  let best = Infinity;
  poly.forEach(([ax, ay], i) => {
    const [bx, by] = poly[(i + 1) % poly.length]!;
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2)) : 0;
    best = Math.min(best, Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay)));
  });
  return best;
}

function area(poly: [number, number][]): number {
  return Math.abs(poly.reduce((a, [x, y], i) => {
    const [u, v] = poly[(i + 1) % poly.length]!;
    return a + x * v - u * y;
  }, 0)) / 2;
}

function selfCrossings(poly: [number, number][]): number {
  const side = (a: number[], b: number[], c: number[]) => (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
  const n = poly.length;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const [a, b, c, d] = [poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!];
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) count++;
    }
  }
  return count;
}

function warnings(values: ParamValues) {
  return buildDrawing('cam', { ...defaultsFor('cam'), ...values }).warnings;
}

describe('parseMotion', () => {
  it('reads every segment kind and fills the turn with a dwell', () => {
    const { segments, errors } = parseMotion('rise 10 90 harmonic; fall 4 30\nreturn 60 345 # back down\ndwell 30');
    expect(errors).toEqual([]);
    expect(segments.map((g) => [g.span, g.lift, g.law])).toEqual([
      [90, 10, 'harmonic'],
      [30, -4, 'cycloidal'],
      [60, -6, 'polynomial'],
      [30, 0, 'uniform'],
      [150, 0, 'uniform'],
    ]);
  });

  it('scales an over-full turn down and reports bad lines', () => {
    const { segments, errors } = parseMotion('rise 10 300\nreturn 300\nwobble 3\nrise x 10\nrise 2 10 bouncy');
    expect(segments.reduce((a, g) => a + g.span, 0)).toBeCloseTo(360);
    expect(errors).toHaveLength(4);
  });
});

describe('sampleMotion', () => {
  it('hits each segment end exactly and returns to zero', () => {
    const samples = sampleMotion(parseMotion(MOTION).segments);
    const at = (t: number) => samples.find((x) => Math.abs(x.theta - t) < 1e-9)!;
    expect(at(0).s).toBe(0);
    expect(at(120).s).toBeCloseTo(20, 9);
    expect(at(180).s).toBeCloseTo(20, 9);
    expect(at(300).s).toBeCloseTo(0, 9);
    expect(at(360).s).toBeCloseTo(0, 9);
  });
});

describe('camProfile', () => {
  it('is the base circle, grown by the kerf, for a profile that never moves', () => {
    const p = camProfile(opts({ segments: parseMotion('dwell 360').segments, burn: 0.1 }));
    for (const [x, y] of p.outline) expect(Math.hypot(x, y)).toBeCloseTo(30.1, 9);
  });

  for (const direction of [1, -1] as const) {
    it(`puts a knife edge on the outline at every angle, turning ${direction > 0 ? 'anticlockwise' : 'clockwise'}`, () => {
      const p = camProfile(opts({ offset: 7, direction }));
      const s0 = Math.sqrt(30 * 30 - 49);
      // With no roller and no kerf the cut is the follower's path itself.
      expect(p.outline).toEqual(p.pitch);
      p.pitch.forEach((q, i) => {
        const { theta, s } = p.samples[i]!;
        const [x, y] = toFollower(q, theta, direction);
        expect(x).toBeCloseTo(7, 9);
        expect(y).toBeCloseTo(s0 + s, 9);
      });
    });
  }

  it('keeps a roller touching the outline and never cutting into it', () => {
    const r = 8;
    const p = camProfile(opts({ follower: 'roller', rollerRadius: r, offset: 5, resolution: 8 }));
    for (let i = 0; i < p.pitch.length; i += 37) {
      const [cx, cy] = p.pitch[i]!;
      const dist = Math.min(...p.outline.map(([x, y]) => Math.hypot(x - cx, y - cy)));
      expect(dist).toBeGreaterThan(r - 1e-3);
      expect(dist).toBeLessThan(r + 1e-3);
    }
  });

  it('keeps a flat face resting on the outline at every angle', () => {
    for (const direction of [1, -1] as const) {
      const p = camProfile(opts({ follower: 'flat', baseRadius: 40, direction, resolution: 8 }));
      for (let i = 0; i < p.samples.length; i += 29) {
        const { theta, s } = p.samples[i]!;
        // The face is y = Rb + s in the follower's frame: the cam's highest point there must be on it.
        const top = Math.max(...p.outline.map((q) => toFollower(q, theta, direction)[1]));
        expect(top).toBeCloseTo(40 + s, 2);
      }
    }
  });

  it('offsets the cut by the kerf along the normal', () => {
    for (const follower of ['knife', 'roller', 'flat'] as const) {
      const a = camProfile(opts({ follower, baseRadius: 40 }));
      const b = camProfile(opts({ follower, baseRadius: 40, burn: 0.1 }));
      for (const q of b.outline) expect(distanceTo(a.outline, q)).toBeCloseTo(0.1, 3);
      expect(area(b.outline)).toBeGreaterThan(area(a.outline));
    }
  });

  describe('with sudden changes of speed', () => {
    // Uniform moves stop and start instantly: corners a knife edge rides, and a
    // roller or flat face must round off.
    const uniform = parseMotion('rise 60 120\ndwell 120\nreturn 120', 'uniform').segments;

    for (const follower of ['flat', 'roller', 'knife'] as const) {
      it(`cuts a ${follower} cam that never crosses itself`, () => {
        for (const burn of [0, 0.1]) {
          const p = camProfile(opts({ follower, segments: uniform, baseRadius: 29.5, burn }));
          expect(selfCrossings(p.outline)).toBe(0);
          // Only the corners where the follower would have to slow at once are trimmed.
          if (burn === 0) expect(p.trimmed.map(Math.round)).toEqual(follower === 'knife' ? [] : [120, 240]);
        }
      });
    }

    it('never lets the follower cut into the trimmed cam', () => {
      const flat = camProfile(opts({ follower: 'flat', segments: uniform, baseRadius: 29.5 }));
      const roller = camProfile(opts({ follower: 'roller', segments: uniform, baseRadius: 29.5 }));
      flat.samples.forEach(({ theta, s }) => {
        const top = Math.max(...flat.outline.map((q) => toFollower(q, theta, 1)[1]));
        expect(top).toBeLessThan(29.5 + s + 1e-6);
      });
      for (const c of roller.pitch) expect(distanceTo(roller.outline, c)).toBeGreaterThan(8 - 1e-3);
    });

    it('swings the roller round the corners its path turns inward at', () => {
      // At the start of the rise and the end of the return the roller pivots
      // about one point: the cam there is an arc of its radius about it.
      const p = camProfile(opts({ follower: 'roller', segments: uniform, baseRadius: 29.5 }));
      const corner = p.pitch[0]!;
      const arc = p.outline.filter((q) => Math.abs(Math.hypot(q[0] - corner[0], q[1] - corner[1]) - 8) < 1e-9);
      expect(arc.length).toBeGreaterThan(5);
    });
  });

  it('measures the pressure angle', () => {
    // Centred knife on a uniform rise: tan φ = s' / (Rb + s), largest at the start.
    const p = camProfile(opts({ segments: parseMotion('rise 10 90 uniform\nreturn 90 uniform').segments }));
    const ds = 10 / (Math.PI / 2);
    expect(p.maxPressureAngle).toBeCloseTo(Math.atan(ds / 30) / DEG, 6);
  });
});

describe('cam generator', () => {
  it('draws a cam and a roller at defaults, with no warnings', () => {
    const d = buildDrawing('cam', defaultsFor('cam'));
    expect(d.parts.map((p) => p.name)).toEqual(['cam', 'roller']);
    expect(d.warnings).toEqual([]);
  });

  it('hands the panel a displacement diagram that matches the profile', () => {
    const d = buildDrawing('cam', defaultsFor('cam'));
    const [chart, ...rest] = d.charts ?? [];
    expect(rest).toEqual([]);
    expect(chart!.param).toBe('motion');
    expect(chart!.points[0]).toEqual([0, 0]);
    expect(chart!.points.at(-1)![0]).toBe(360);
    expect(Math.max(...chart!.points.map((p) => p[1]))).toBeCloseTo(20, 9);
    expect(chart!.spans!.map((s) => [s.from, s.to, s.label])).toEqual([
      [0, 120, 'rise 20 mm, cycloidal'],
      [120, 180, 'dwell'],
      [180, 300, 'fall 20 mm, cycloidal'],
      [300, 360, 'dwell'],
    ]);
  });

  it('warns on a steep rise, a big roller, a cusped flat face and an open profile', () => {
    expect(warnings({ motion: 'rise 40 30\nreturn 330', base_radius: 20 }).map((w) => w.param)).toContain('base_radius');
    expect(warnings({ roller_diameter: 40, base_radius: 10, shaft: 4, motion: 'rise 25 60\nreturn 60' }).map((w) => w.param)).toContain('roller_diameter');
    expect(warnings({ follower: 'flat', motion: 'rise 30 40\nreturn 40', base_radius: 15 }).map((w) => w.param)).toContain('base_radius');
    expect(warnings({ motion: 'rise 10 350' }).map((w) => w.param)).toContain('motion');
  });

  it('warns once, on the law, where a uniform move leaves corners a roller or flat face cannot follow', () => {
    const v = { motion: 'rise 60 120\ndwell 120\nreturn 120', law: 'uniform', base_radius: 29.5 };
    for (const follower of ['flat', 'roller']) {
      const w = warnings({ ...v, follower });
      expect(w.filter((x) => x.param === 'law')).toHaveLength(1);
      // The corners are not the roller's size, nor a cusp in a smooth stretch.
      expect(w.map((x) => x.param)).not.toContain('roller_diameter');
      expect(w.filter((x) => x.param === 'base_radius' && /turns back/.test(x.message))).toEqual([]);
      expect(w.find((x) => x.param === 'law')!.message).toContain('120°, 240°');
    }
    expect(warnings({ ...v, follower: 'knife' }).filter((x) => x.param === 'law')).toEqual([]);
  });
});
