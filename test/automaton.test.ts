/**
 * The Automaton is this port's own, so there is no boxes.py golden. These
 * tests pin what the mechanism must do instead: every rod sits on its cam at
 * every crank angle and clears the deck, levers and plates move as reported,
 * and the drawn parts agree with the layout.
 */
import { describe, expect, it } from 'vitest';
import {
  automatonLayout,
  parseCams,
  rockerAngle,
  rockerContact,
  type AutomatonOptions,
} from '~/lib/generators/automaton';
import { polylines } from '~/lib/geom/crossings';
import { defaultsFor } from '~/lib/generators/registry';
import { buildDrawing } from '~/lib/preview';
import type { ParamValues } from '~/lib/params/schema';

const DEG = Math.PI / 180;

function opts(cams: string, over: Partial<AutomatonOptions> = {}): AutomatonOptions {
  return {
    stations: parseCams(cams).stations,
    thickness: 3,
    baseRadius: 20,
    direction: 1,
    pitch: 30,
    h: 0,
    y: 0,
    shaft: 8,
    shaftFit: 0.1,
    bearingPlay: 0.4,
    shaftPlay: 0.5,
    handleDiameter: 8,
    crankLength: 35,
    rodWidth: 6,
    rodPlay: 0.4,
    rodAbove: 25,
    figureHole: 2,
    footHeight: 6,
    guides: 'below',
    guideLength: 20,
    guideWall: 3,
    indexPin: 3,
    margin: 5,
    pivotPin: 3,
    pivotHeight: 0,
    pegPin: 3,
    pegSpacing: 8,
    pegLength: 8,
    spinShaft: 5,
    ...over,
  };
}

const MIXED = [
  'rise 15 120\ndwell 60\nreturn 120',
  'phase 120\noutput rocker 25\nrise 10 90 harmonic\nreturn 90 harmonic',
  'rise 12 180\nreturn 180',
  'output pair 30\nphase 180\nrise 12 180\nreturn 180',
].join('\n---\n');

function turn([x, y]: [number, number], a: number): [number, number] {
  return [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y];
}

function warnings(values: ParamValues) {
  return buildDrawing('automaton', { ...defaultsFor('automaton'), ...values }).warnings;
}

describe('parseCams', () => {
  it('splits blocks on blank lines and ---, and reads phase and output', () => {
    const { stations, errors } = parseCams('rise 10 90\n\nphase 90\noutput rocker 20 30\nrise 5 180\n---\noutput pair 25\nrise 5 90\n---\noutput spin 12 8');
    // The pair cannot join a rocker, so it falls back to a lift.
    expect(errors).toEqual(['Cam 3: "output pair" joins a cam to the lift cam before it, and there is none.']);
    expect(stations.map((s) => [s.phase, s.output])).toEqual([
      [0, { kind: 'lift' }],
      [90, { kind: 'rocker', arm: 20, out: 30 }],
      [0, { kind: 'lift' }],
      [0, { kind: 'spin', drive: 12, driven: 8 }],
    ]);
    expect(parseCams('output pair\nrise 5 90').errors[0]).toMatch(/^Cam 1: "output pair"/);
  });

  it('names the cam in every error', () => {
    const { errors } = parseCams('rise 10 90\n---\nrise ten 90\n---\noutput wobble\n---\noutput spin 12 2.5\nrise 4 90');
    expect(errors).toEqual([
      'Cam 2: Could not read "rise ten 90".',
      'Cam 3: unknown output "wobble": use lift, rocker, pair or spin.',
      'Cam 4: a peg wheel needs a whole number of pegs, at least three.',
      'Cam 4: a peg wheel has no motion profile; its rise and fall lines are ignored.',
    ]);
  });

  it('keeps comments inside a block, so they do not split it', () => {
    expect(parseCams('# first\nrise 10 90\n# still first\nreturn 90').stations).toHaveLength(1);
  });
});

describe('automatonLayout', () => {
  const lay = automatonLayout(opts(MIXED));

  it('stacks cams and washers wall to wall, a whole number of sheets apart', () => {
    const t = 3;
    const stack = lay.washersLeft + lay.washersRight + lay.washersBetween.reduce((a, b) => a + b, 0) + lay.stations.length;
    expect(lay.W).toBeCloseTo(stack * t + 0.5, 9);
    lay.stations.forEach((L, i) => {
      if (i) expect(L.x - lay.stations[i - 1]!.x).toBeCloseTo((lay.washersBetween[i - 1]! + 1) * t, 9);
      expect(L.x + L.lo).toBeGreaterThanOrEqual(1);
      expect(L.x + L.hi).toBeLessThanOrEqual(lay.W - 1);
    });
    // A pair's cams are a rod, a plate and a rod apart.
    expect(lay.washersBetween[2]).toBe(2);
    expect(lay.warnings).toEqual([]);
  });

  it('keeps every rod on its cam at every crank angle, its foot clear of the guides', () => {
    const guideBottom = lay.H - lay.guideBlocks * 3;
    lay.stations.forEach((L, i) => {
      const e = L.rodY - lay.yAxis;
      const phased = L.profile.outline.map((p) => turn(p, -L.station.phase * DEG));
      for (let a = 0; a < 360; a += 3) {
        const pts = phased.map((p) => turn(p, a * DEG));
        // The cam's top across the foot's width is exactly where the foot sits.
        const under = pts.filter(([x]) => x - e >= L.footMin && x - e <= L.footMax);
        const top = Math.max(...under.map((p) => p[1]));
        expect(top, `cam ${i + 1} at ${a}°`).toBeCloseTo(20 + L.lift[a]!, 1);
        expect(lay.zShaft + 20 + L.lift[a]! + 6, `foot ${i + 1}`).toBeLessThanOrEqual(guideBottom - 2 + 1e-9);
      }
      // The cam clears the base.
      expect(lay.zShaft - L.maxRadius).toBeGreaterThanOrEqual(3 - 1e-9);
    });
  });

  it('stands every rod top at least `rod_above` over its guide', () => {
    for (const L of lay.stations) {
      for (const s of L.lift) expect(L.top0 + (s - L.sRef)).toBeGreaterThanOrEqual(lay.guideTop + 25 - 1e-9);
      expect(L.top0 - L.rodLength).toBeCloseTo(lay.zShaft + 20 + L.sRef, 9);
    }
  });

  it('rests the lever on the rod tip at the reported tilt', () => {
    const L = lay.stations[1]!;
    const r = L.rocker!;
    const q = r.tipRadius + r.width / 2;
    L.lift.forEach((s, a) => {
      const phi = -r.tilt[a]! * DEG;
      // The underside line, through the pivot at -width/2 along its normal.
      const [ex, ey] = [Math.cos(phi), Math.sin(phi)];
      const [nx, ny] = [-ey, ex];
      const cy = L.top0 - r.tipRadius + (s - L.sRef) - r.pivotZ;
      const cx = -r.arm;
      const dist = cx * nx + cy * ny + r.width / 2;
      expect(dist, `${a}°`).toBeCloseTo(-r.tipRadius, 6);
      // The tip touches the straight part of the underside.
      expect(cx * ex + cy * ey).toBeGreaterThan(r.near);
    });
    // Levelled at mid-lift: it tilts as far up as down.
    expect(Math.max(...r.tilt) + Math.min(...r.tilt)).toBeLessThan(2);
    expect(Math.max(...r.tilt)).toBeGreaterThan(5);
  });

  it('solves the lever angle in closed form', () => {
    expect(rockerAngle(25, -6, 6)).toBeCloseTo(0, 12);
    const a = rockerAngle(25, 4, 6);
    expect(a).toBeGreaterThan(0);
    const h = 4;
    // Tangency: arm·sin φ + h·cos φ = -q with φ = -a.
    expect(25 * Math.sin(-a) + h * Math.cos(-a)).toBeCloseTo(-6, 12);
    expect(rockerContact(25, -6, 0)).toBeCloseTo(-25, 12);
  });

  it('keeps the plate on its pins, within its slot, and above the guides', () => {
    const B = lay.stations[3]!;
    const A = lay.stations[2]!;
    const p = B.pair!;
    expect(A.rodY).toBeCloseTo(lay.yAxis - 15, 9);
    expect(B.rodY).toBeCloseTo(lay.yAxis + 15, 9);
    B.lift.forEach((sb, k) => {
      const za = A.top0 - 3 + (A.lift[k]! - A.sRef);
      const zb = B.top0 - 3 + (sb - B.sRef);
      const dist = Math.hypot(30, zb - za);
      expect(dist).toBeGreaterThanOrEqual(p.span - 1e-9);
      expect(dist).toBeLessThanOrEqual(p.reach + 1e-9);
      expect(Math.atan2(zb - za, 30) / DEG).toBeCloseTo(p.tilt[k]!, 9);
      const lowest = Math.min(za, za + p.reach * Math.sin(p.tilt[k]! * DEG)) - p.width / 2;
      expect(lowest).toBeGreaterThanOrEqual(lay.guideTop + 1 - 1e-6);
    });
  });

  it('meshes the peg wheels', () => {
    const l = automatonLayout(opts('output spin 12 8\n---\nrise 10 180\nreturn 180', { pitch: 40 }));
    const sp = l.stations[0]!.spin!;
    expect(sp.r1 / sp.r2).toBeCloseTo(12 / 8, 12);
    expect(2 * Math.PI * sp.r1 / 12).toBeCloseTo(8, 12);
    // The driven wheel clears the drive disc; its pegs hang below the drive pegs' centres.
    expect(sp.wheelZ).toBeGreaterThan(l.zShaft + sp.disc1);
    expect(sp.wheelZ - sp.pegDrop).toBeCloseTo(l.zShaft + sp.r1 - 1.5, 9);
    // The driven pegs nearest the drive wheel sit over the drive pegs' length.
    const x = l.stations[0]!.x;
    expect(sp.axisX - sp.r2).toBeGreaterThan(x + 1.5);
    expect(sp.axisX - sp.r2).toBeLessThan(x + 1.5 + 8);
    // The bearing stack and the wheel fit under the deck.
    expect(sp.wheelZ + 3 + l.guideBlocks * 3).toBeLessThanOrEqual(l.H);
    expect(l.warnings).toEqual([]);
  });

  it('spaces stations further apart than asked when their parts would meet', () => {
    const l = automatonLayout(opts('rise 10 90\n---\noutput rocker\nrise 10 90', { pitch: 3 }));
    expect(l.warnings.map((w) => w.param)).toEqual(['pitch']);
    const [a, b] = l.stations;
    expect(b!.x + b!.lo).toBeGreaterThanOrEqual(a!.x + a!.hi + 1 - 1e-9);
  });

  it('warns when a given height or depth is too small, and draws at it anyway', () => {
    const l = automatonLayout(opts('rise 10 90', { h: 30, y: 30 }));
    expect(l.H).toBe(30);
    expect(l.D).toBe(30);
    expect(l.warnings.map((w) => w.param).sort()).toEqual(['h', 'y']);
  });
});

describe('the drawing', () => {
  const values: ParamValues = { ...defaultsFor('automaton'), burn: 0, labels: false };

  it('has no warnings at its defaults', () => {
    expect(buildDrawing('automaton', values).warnings).toEqual([]);
  });

  it('cuts a guide hole in the deck under each rod, where the layout puts it', () => {
    const d = buildDrawing('automaton', values);
    const deck = d.parts.find((p) => p.name === 'Deck')!;
    const holes = deck.paths
      .filter((p) => p.layer === 'inner')
      .flatMap((p) => polylines(p.cmds))
      .map((ring) => {
        const xs = ring.map((q) => q[0]);
        const ys = ring.map((q) => q[1]);
        return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), x: (Math.max(...xs) + Math.min(...xs)) / 2 };
      });
    const guides = holes.filter((h) => Math.abs(h.w - 3.4) < 0.01 && Math.abs(h.h - 6.4) < 0.01).map((h) => h.x).sort((a, b) => a - b);
    const lay = automatonLayout(opts(String(values['cams'])));
    expect(guides).toHaveLength(4);
    guides.forEach((x, i) => expect(x - guides[0]!).toBeCloseTo(lay.stations[i]!.x - lay.stations[0]!.x, 6));
  });

  it('cuts as many washers as the stack holds, and guides for every rod', () => {
    const d = buildDrawing('automaton', values);
    const lay = automatonLayout(opts(String(values['cams'])));
    const count = (name: string) => d.parts.filter((p) => p.name === name).length;
    expect(count('Washer')).toBe(lay.washersLeft + lay.washersRight + lay.washersBetween.reduce((a, b) => a + b, 0));
    expect(count('Guide 1')).toBe(lay.guideBlocks);
    expect(count('Bracket 2')).toBe(2);
    expect(count('Lever 2')).toBe(1);
    expect(count('Plate 3–4')).toBe(1);
  });

  it('wedges the base and deck through the sides: one wedge per tenon', () => {
    const d = buildDrawing('automaton', { ...values, assembly: 'wedges' });
    const wedges = d.parts.filter((p) => p.name === 'wedge').length;
    const side = d.parts.find((p) => p.name === 'Left side')!;
    const slots = side.paths.filter((p) => p.layer === 'inner').length - 1; // less the bearing
    expect(wedges).toBe(2 * slots);
    expect(d.warnings).toEqual([]);
  });

  it('bolts the base and deck to the sides clear of the deck holes', () => {
    expect(warnings({ assembly: 'bolts', thickness: 6 })).toEqual([]);
  });

  it('only draws the panels asked for', () => {
    const names = (v: ParamValues) => buildDrawing('automaton', { ...values, ...v }).parts.map((p) => p.name);
    expect(names({ front: 'open', back: 'open' })).not.toContain('Back');
    expect(names({ front: 'window' })).toContain('Front');
  });

  it('charts every lift and every tilt', () => {
    const charts = buildDrawing('automaton', values).charts!;
    expect(charts.map((c) => [c.title, c.series!.map((s) => s.label)])).toEqual([
      ['Follower timing', ['Cam 1', 'Cam 2', 'Cam 3', 'Cam 4']],
      ['Figure tilt', ['Lever on cam 2', 'Plate on cams 3 & 4']],
    ]);
  });
});
