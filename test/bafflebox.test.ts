/**
 * The vent baffle box is this port's own, so there is no boxes.py golden to
 * compare against. These tests pin what it must do instead: the air has a path
 * at least as large as the duct, the gate's slider shuts and opens the port,
 * and the gate's bolts meet the same holes in every layer.
 */
import { describe, expect, it } from 'vitest';
import { LIGHT_MARGIN, baffleBoxLayout, sightWindow, type BaffleBoxOptions, type Opening, type Window } from '~/lib/generators/bafflebox';
import { defaultsFor } from '~/lib/generators/registry';
import { buildDrawing } from '~/lib/preview';
import { toSVG } from '~/lib/export/svg';
import type { ParamValues } from '~/lib/params/schema';

function opts(over: Partial<BaffleBoxOptions> = {}): BaffleBoxOptions {
  return {
    x: 200,
    y: 150,
    h: 250,
    outside: true,
    thickness: 3,
    vent: { shape: 'round', d: 100 },
    ventOffset: [0, 0],
    port: { shape: 'round', d: 100 },
    portSide: 'front',
    portOffset: [0, 0],
    frontClear: 3,
    lightTrap: false,
    assembly: 'glue',
    recess: 12,
    mountInset: 11,
    minPitch: 3,
    boltReach: 0,
    minBolted: 0,
    openingMargin: 2,
    flange: 25,
    screw: 5,
    baffles: 2,
    gap: 60,
    gate: true,
    rail: 15,
    play: 0.5,
    bolt: 4,
    ...over,
  };
}

const diameter = (o: Opening) => (o.shape === 'round' ? o.d : NaN);

function warnings(values: ParamValues, id = 'bafflebox') {
  return buildDrawing(id, { ...defaultsFor(id), ...values }).warnings;
}

describe('baffleBoxLayout', () => {
  it('splits the depth into equal chambers, the baffles hung and stood in turn', () => {
    for (const baffles of [0, 1, 2, 3]) {
      const lay = baffleBoxLayout(opts({ baffles, y: 250 }));
      const faces = [lay.yi, ...lay.baffles.flatMap((b) => [b.y + lay.t / 2, b.y - lay.t / 2]), 0];
      for (let i = 0; i < faces.length; i += 2) expect(faces[i]! - faces[i + 1]!).toBeCloseTo(lay.pitch, 9);
      expect(lay.baffles.map((b) => b.top)).toEqual([true, false, true].slice(0, baffles));
    }
  });

  it('gives the air no passage smaller than the duct at the defaults', () => {
    const lay = baffleBoxLayout(opts());
    const area = (Math.PI * diameter(lay.portShape) ** 2) / 4;
    expect((lay.hi - lay.baffleHeight) * lay.xi).toBeGreaterThanOrEqual(area);
    expect(lay.pitch * lay.xi).toBeGreaterThanOrEqual(area);
    expect(lay.pitch).toBeGreaterThanOrEqual(diameter(lay.portShape) / 4);
    expect(lay.warnings).toEqual([]);
  });

  it('shuts the port with the slider down, and clears it with the slider up', () => {
    for (const duct of [50, 100, 150]) {
      const lay = baffleBoxLayout(opts({ port: { shape: 'round', d: duct }, x: duct + 120, h: duct + 160, y: 2 * duct + 50, gap: duct }));
      const g = lay.gate!;
      const [px, pz] = [lay.port[0] - g.x0, lay.port[1] - g.z0];
      const r = diameter(lay.portShape) / 2;
      // Shut, resting on the channel's bottom: over the port all round, play or not.
      const left = (g.w - g.slider.w) / 2;
      expect(g.channelBottom).toBeLessThan(pz - r);
      expect(left + (g.channel - g.slider.w)).toBeLessThan(px - r);
      expect(left + g.slider.w - (g.channel - g.slider.w)).toBeGreaterThan(px + r);
      expect(g.channelBottom + g.slider.length - (g.h - g.channelBottom)).toBeGreaterThan(0);
      // Open: its bottom past the port's top, and still held in the channel.
      const bottom = g.channelBottom + g.slider.travel;
      expect(bottom).toBeGreaterThanOrEqual(pz + r);
      expect(g.h - bottom).toBeGreaterThanOrEqual(20);
      expect(lay.warnings).toEqual([]);
    }
  });

  it('puts the gate bolts in the rails, symmetric about the port, clear of the box walls', () => {
    const lay = baffleBoxLayout(opts());
    const g = lay.gate!;
    const r = (g.w - g.channel) / 2;
    const [px, pz] = [lay.port[0] - g.x0, lay.port[1] - g.z0];
    for (const [bx, bz] of g.bolts) {
      // In the frame, off the channel by more than a hole's radius.
      const inChannelX = Math.abs(bx - g.w / 2) < g.channel / 2 + 2;
      expect(inChannelX && bz > g.channelBottom - 2).toBe(false);
      expect(bx).toBeGreaterThan(2);
      expect(bx).toBeLessThan(g.w - 2);
      // The mirror of every bolt about the port is a bolt, so the front fits either way up.
      expect(g.bolts.some(([x, z]) => Math.abs(x - (2 * px - bx)) < 1e-9 && Math.abs(z - (2 * pz - bz)) < 1e-9)).toBe(true);
      // On the front panel, a bolt's diameter from the walls for its nut.
      const [fx, fz] = [bx + g.x0, bz + g.z0];
      expect(Math.min(fx, lay.xi - fx, fz, lay.hi - fz)).toBeGreaterThanOrEqual(4);
    }
    expect(r).toBe(15);
  });

  it('keeps the wall screws on the flange, at most 200 mm apart', () => {
    const lay = baffleBoxLayout(opts({ x: 600, h: 300 }));
    const { w, h, screws } = lay.plate;
    for (const [x, y] of screws) {
      expect(Math.min(x, w - x, y, h - y)).toBeCloseTo(12.5, 9);
    }
    const bottom = screws.filter(([, y]) => y < 20).map(([x]) => x).sort((a, b) => a - b);
    for (let i = 1; i < bottom.length; i++) expect(bottom[i]! - bottom[i - 1]!).toBeLessThanOrEqual(200);
  });
});

describe('warnings', () => {
  it('are none at the defaults', () => {
    expect(warnings({})).toEqual([]);
  });

  it('name a gap that chokes the airflow', () => {
    expect(warnings({ baffle_gap: 20 }).map((w) => w.param)).toEqual(['baffle_gap']);
  });

  it('name too many baffles for the depth', () => {
    expect(warnings({ baffles: 4 }).map((w) => w.param)).toEqual(['baffles']);
    expect(warnings({ baffles: 8, y: 40 }).some((w) => w.param === 'baffles' && /fit in this depth/.test(w.message))).toBe(true);
  });

  it('ask for a taller box when the gate does not fit, and say nothing without it', () => {
    expect(warnings({ h: 140 }).map((w) => w.param)).toEqual(['h']);
    expect(warnings({ h: 140, gate: false })).toEqual([]);
  });

  it('cut a port too big for the front down to fit', () => {
    const lay = baffleBoxLayout(opts({ port: { shape: 'round', d: 300 }, gate: false }));
    expect(diameter(lay.portShape)).toBeLessThan(lay.xi);
    expect(lay.warnings.map((w) => w.param)).toContain('duct_d');
  });
});

describe('sightWindow', () => {
  /** The widest band found by trying a fine grid of slopes. */
  function bruteForce(ws: Window[]): number {
    let best = -Infinity;
    for (let b = -20; b <= 20; b += 0.0005) {
      const up = Math.min(...ws.map((w) => w.hi - b * w.y));
      const lo = Math.max(...ws.map((w) => w.lo - b * w.y));
      best = Math.max(best, up - lo);
    }
    return best;
  }

  it('finds the widest straight band exactly, open or blocked', () => {
    // Fixed pseudo-random windows, so a failure can be reproduced.
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 40; k++) {
      const ws: Window[] = [];
      let y = 0;
      for (let i = 0; i < 2 + (k % 5); i++) {
        y += 1 + 30 * rnd();
        const lo = 100 * rnd();
        ws.push({ y, lo, hi: lo + 5 + 60 * rnd() });
      }
      // The grid lands within its step's worth of the true peak, never above it.
      const exact = sightWindow(ws);
      const grid = bruteForce(ws);
      expect(exact).toBeGreaterThanOrEqual(grid - 1e-9);
      expect(exact - grid).toBeLessThan(0.05);
    }
  });
});

describe('the light trap', () => {
  const trap = (over: Partial<BaffleBoxOptions> = {}) =>
    baffleBoxLayout(opts({ gate: false, lightTrap: true, h: 200, y: 200, baffles: 3, gap: 50, ...over }));

  it('blocks every straight line by the margin at its defaults, and still breathes', () => {
    const lay = trap();
    expect(lay.sight).toBeLessThanOrEqual(-LIGHT_MARGIN);
    expect(lay.warnings).toEqual([]);
    expect(warnings({}, 'lighttrap')).toEqual([]);
  });

  it('with no baffles, lets the light straight through and says to add one', () => {
    const lay = trap({ baffles: 0 });
    expect(lay.sight).toBeGreaterThan(0);
    expect(lay.warnings.map((w) => w.param)).toEqual(['baffles']);
  });

  it('names the largest gap that stops light, and that gap does', () => {
    const lay = trap({ baffles: 1, gap: 60 });
    const msg = lay.warnings.find((w) => w.param === 'baffle_gap' && /Light/.test(w.message))!.message;
    const most = Number(/at most (\d+) mm/.exec(msg)![1]);
    expect(trap({ baffles: 1, gap: most }).sight).toBeLessThanOrEqual(-LIGHT_MARGIN);
    expect(trap({ baffles: 1, gap: most + 2 }).sight).toBeGreaterThan(-LIGHT_MARGIN);
  });

  it('says when no gap both stops light and lets enough air through', () => {
    const lay = trap({ baffles: 1, port: { shape: 'round', d: 150 }, vent: { shape: 'round', d: 150 }, x: 160 });
    expect(lay.warnings.some((w) => w.param === 'baffles' && /No gap both stops light/.test(w.message))).toBe(true);
  });

  it('cuts a fan its blade hole and screws, or warns and cuts a plain hole when it does not fit', () => {
    expect(trap({ port: { shape: 'fan', size: 120 } }).portShape).toEqual({ shape: 'fan', size: 120 });
    const small = trap({ port: { shape: 'fan', size: 140 }, x: 120 });
    expect(small.portShape.shape).toBe('round');
    expect(small.warnings.map((w) => w.param)).toContain('fan_size');
  });
});

describe('knocked down', () => {
  it('puts the back between the walls, screwed through its corners clear of the vent', () => {
    for (const assembly of ['wedges', 'bolts'] as const) {
      const lay = baffleBoxLayout(opts({ assembly, y: 200, h: 280 }));
      expect([lay.plate.w, lay.plate.h]).toEqual([lay.xi, lay.hi]);
      expect(lay.plate.screws).toHaveLength(4);
      for (const [x, y] of lay.plate.screws) expect(Math.hypot(x - lay.xi / 2, y - lay.hi / 2)).toBeGreaterThan(50 + 2.5);
    }
    // A round vent never reaches a tall box's corners; a rectangle can.
    const tight = baffleBoxLayout(opts({ assembly: 'bolts', vent: { shape: 'rect', w: 180, h: 230 } }));
    expect(tight.warnings.map((w) => w.param)).toContain('vent_w');
  });

  it('wedged, takes the recesses out of the outside depth and height', () => {
    const lay = baffleBoxLayout(opts({ assembly: 'wedges', recess: 12 }));
    expect(lay.yi).toBe(150 - 6 - 24);
    expect(lay.hi).toBe(250 - 6 - 24);
    expect(lay.depth).toBe(150);
  });

  it("wedged, stops the gate under the top wall's rim and lengthens the slider through it", () => {
    const glued = baffleBoxLayout(opts({ h: 280, y: 200 })).gate!;
    const wedged = baffleBoxLayout(opts({ assembly: 'wedges', h: 280 + 24, y: 200 + 24 }));
    const g = wedged.gate!;
    expect(g.z0 + g.h).toBeCloseTo(wedged.hi, 9);
    // The same port and box inside, so past the channel the slider is longer by the top wall it passes.
    expect(g.slider.length - (g.h - g.channelBottom)).toBeCloseTo(glued.slider.length - (glued.h - glued.channelBottom) + 3, 9);
    expect(wedged.warnings).toEqual([]);
  });
});

/**
 * Whether any of a grid of straight rays from the outer face of the
 * room-side opening to the back of the vent gets past every part, traced
 * through the parts themselves rather than the windows the layout uses.
 * `inFloor` for an opening in the bottom; `widen` opens every baffle gap by that much.
 */
function rayGetsThrough(lay: ReturnType<typeof baffleBoxLayout>, { inFloor = false, widen = 0 } = {}): boolean {
  const t = lay.t;
  const half = (o: Opening) => (o.shape === 'round' ? o.d / 2 : o.shape === 'rect' ? o.h / 2 : NaN);
  const r = half(lay.portShape);
  const v = half(lay.vent);
  const [z0, z1] = [lay.ventAt[1] - v, lay.ventAt[1] + v];
  const g = lay.hi - lay.baffleHeight + widen;
  const N = 300;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      // From the opening's outer face, through its inner face, to the vent's back.
      const [py, pz] = inFloor ? [lay.port[1] - r + (2 * r * i) / N, -t] : [lay.yi + t, lay.port[1] - r + (2 * r * i) / N];
      const [qy, qz] = [-t, z0 + ((z1 - z0) * j) / N];
      const zAt = (y: number) => pz + ((qz - pz) * (y - py)) / (qy - py);
      const yAt = (z: number) => py + ((qy - py) * (z - pz)) / (qz - pz);
      if (inFloor) {
        if (Math.abs(yAt(0) - lay.port[1]) > r) continue;
      } else if (Math.abs(zAt(lay.yi) - lay.port[1]) > r) continue;
      if (zAt(0) < z0 || zAt(0) > z1) continue;
      const blocked = lay.baffles.some((bf) =>
        [bf.y - t / 2, bf.y + t / 2].some((y) => {
          const z = zAt(y);
          return bf.top ? z > g : z < lay.hi - g;
        }),
      );
      if (!blocked) return true;
    }
  }
  return false;
}

describe('the light trap with its opening in the bottom', () => {
  const floor = (over: Partial<BaffleBoxOptions> = {}) =>
    baffleBoxLayout(opts({ gate: false, lightTrap: true, portSide: 'bottom', h: 200, y: 200, baffles: 1, gap: 50, ...over }));

  it('stands the first baffle up behind the opening, in a front chamber deep enough for it', () => {
    const lay = floor({ baffles: 2 });
    expect(lay.baffles.map((b) => b.top)).toEqual([false, true]);
    const d = (lay.portShape as { d: number }).d;
    // The front clearance (3 here) before it, the margin (two thicknesses) behind it.
    expect(lay.frontChamber).toBeCloseTo(d + 3 + 6, 9);
    expect(lay.yi - (lay.port[1] + d / 2)).toBeCloseTo(3, 9);
    expect(lay.port[1] - d / 2 - (lay.baffles[0]!.y + lay.t / 2)).toBeCloseTo(6, 9);
    const faces = [lay.baffles[0]!.y - lay.t / 2, lay.baffles[1]!.y + lay.t / 2, lay.baffles[1]!.y - lay.t / 2, 0];
    expect(faces[0]! - faces[1]!).toBeCloseTo(lay.pitch, 9);
    expect(faces[2]! - faces[3]!).toBeCloseTo(lay.pitch, 9);
  });

  it('agrees with rays traced through the parts: open with no baffle, shut with one, by its margin', () => {
    const open = floor({ baffles: 0 });
    expect(open.sight).toBeGreaterThan(0);
    expect(rayGetsThrough(open, { inFloor: true })).toBe(true);

    const shut = floor();
    expect(shut.sight).toBeLessThanOrEqual(-LIGHT_MARGIN);
    expect(shut.warnings).toEqual([]);
    expect(rayGetsThrough(shut, { inFloor: true })).toBe(false);
    // Still shut with the gap opened by most of the margin.
    expect(rayGetsThrough(shut, { inFloor: true, widen: LIGHT_MARGIN - 1 })).toBe(false);
  });

  it('warns, and names the gap that would do, once a ray gets through', () => {
    const leaky = floor({ gap: 120 });
    expect(rayGetsThrough(leaky, { inFloor: true })).toBe(true);
    const msg = leaky.warnings.find((w) => /Light/.test(w.message))!.message;
    const most = Number(/at most (\d+) mm/.exec(msg)![1]);
    expect(rayGetsThrough(floor({ gap: most }), { inFloor: true })).toBe(false);
  });

  it('keeps clear of the front panel\'s wedges when wedged', () => {
    const lay = floor({ assembly: 'wedges', y: 240, frontClear: 12 });
    const d = (lay.portShape as { d: number }).d;
    expect(lay.yi - (lay.port[1] + d / 2)).toBeCloseTo(12, 9);
  });
});

describe('an off-centre vent', () => {
  it('moves the vent, and keeps it inside the walls with a warning', () => {
    const lay = baffleBoxLayout(opts({ ventOffset: [20, -30] }));
    expect(lay.ventAt).toEqual([lay.xi / 2 + 20, lay.hi / 2 - 30]);
    expect(lay.warnings).toEqual([]);
    const far = baffleBoxLayout(opts({ ventOffset: [0, 200] }));
    expect(far.ventAt[1] + 50).toBeCloseTo(far.hi - 1, 9);
    expect(far.warnings.map((w) => w.param)).toEqual(['vent_dz']);
  });

  it('is what the light check sees: one hung baffle stops light to a high vent, not to a low one', () => {
    const trap = (dz: number) =>
      baffleBoxLayout(opts({ gate: false, lightTrap: true, h: 200, y: 200, baffles: 1, gap: 35, ventOffset: [0, dz] }));
    const high = trap(40);
    expect(high.sight).toBeLessThanOrEqual(-LIGHT_MARGIN);
    expect(rayGetsThrough(high)).toBe(false);
    const low = trap(-40);
    expect(low.sight).toBeGreaterThan(0);
    expect(rayGetsThrough(low)).toBe(true);
    expect(low.warnings.some((w) => /light/i.test(w.message))).toBe(true);
  });

  it('keeps the back\'s corner screws clear of it, wherever it is', () => {
    const lay = baffleBoxLayout(opts({ assembly: 'bolts', y: 200, h: 280, ventOffset: [-40, 60] }));
    const crowded = lay.plate.screws.some(([x, y]) => Math.hypot(x - lay.ventAt[0], y - lay.ventAt[1]) < 50 + 2.5 + 2);
    expect(crowded).toBe(lay.warnings.some((w) => /screws in the back/.test(w.message)));
  });

  it('etches which way up the back goes, only when it is off centre', () => {
    const etched = (values: ParamValues) =>
      toSVG(buildDrawing('lighttrap', { ...defaultsFor('lighttrap'), labels: false, ...values })).includes('top, seen from the front');
    expect(etched({})).toBe(false);
    expect(etched({ vent_dz: 30 })).toBe(true);
  });
});

describe('an off-centre front opening', () => {
  it('agrees with traced rays wherever the opening and the vent are', () => {
    const verdicts: boolean[] = [];
    for (const pz of [-40, 0, 40]) {
      for (const vz of [-40, 0, 40]) {
        const lay = baffleBoxLayout(
          opts({ gate: false, lightTrap: true, h: 200, y: 200, baffles: 1, gap: 41, portOffset: [0, pz], ventOffset: [0, vz] }),
        );
        expect(lay.port[1]).toBeCloseTo(lay.hi / 2 + pz, 9);
        const leaks = rayGetsThrough(lay);
        // The traced rays and the windows say the same; the margin only ever adds to "leaks".
        if (leaks) expect(lay.sight).toBeGreaterThan(0);
        if (lay.sight <= -LIGHT_MARGIN) expect(leaks).toBe(false);
        verdicts.push(leaks);
      }
    }
    expect(verdicts).toContain(true);
    expect(verdicts).toContain(false);
  });

  it('keeps the opening inside its panel, a fan by its frame', () => {
    const far = baffleBoxLayout(opts({ gate: false, portOffset: [200, 0] }));
    expect(far.port[0] + 50).toBeCloseTo(far.xi - 1, 9);
    expect(far.warnings.map((w) => w.param)).toEqual(['port_dx']);
    const fan = baffleBoxLayout(opts({ gate: false, port: { shape: 'fan', size: 120 }, portOffset: [0, 200] }));
    expect(fan.port[1] + 60 - 1).toBeCloseTo(fan.hi - 1, 9);
  });

  it('in the bottom, moves across only', () => {
    const lay = baffleBoxLayout(opts({ gate: false, portSide: 'bottom', y: 250, baffles: 1, portOffset: [30, 40] }));
    expect(lay.port[0]).toBeCloseTo(lay.xi / 2 + 30, 9);
    expect(lay.port[1]).toBeCloseTo(lay.yi - 3 - 50, 9);
    expect(lay.warnings.map((w) => w.param)).not.toContain('port_dz');
  });

  it('takes the gate with it, and says when the gate then needs a bigger box', () => {
    const lay = baffleBoxLayout(opts({ portOffset: [20, 50] }));
    const g = lay.gate!;
    expect(g.x0 + g.w / 2).toBeCloseTo(lay.port[0], 9);
    const centre = g.bolts.reduce(([x, z], [bx, bz]) => [x + bx / 4, z + bz / 4], [0, 0]);
    expect(centre[0] + g.x0).toBeCloseTo(lay.port[0], 9);
    expect(centre[1] + g.z0).toBeCloseTo(lay.port[1], 9);
    expect(lay.warnings).toEqual([]);
    expect(baffleBoxLayout(opts({ portOffset: [0, 60] })).warnings.map((w) => w.param)).toEqual(['h']);
    expect(baffleBoxLayout(opts({ portOffset: [30, 0] })).warnings.map((w) => w.param)).toEqual(['gate_rail']);
  });

  it('etches which way round its panel goes, only when off centre', () => {
    const svg = (id: string, values: ParamValues) => toSVG(buildDrawing(id, { ...defaultsFor(id), labels: false, ...values }));
    const count = (text: string, needle: string) => text.split(needle).length - 1;
    expect(count(svg('bafflebox', {}), 'seen from the front')).toBe(0);
    expect(count(svg('bafflebox', { port_dx: 20 }), 'top, seen from the front')).toBe(1);
    expect(count(svg('lighttrap', { port_side: 'bottom', baffles: 1, port_dx: 40 }), '↑ front')).toBe(1);
    expect(count(svg('lighttrap', { port_side: 'bottom', baffles: 1 }), '↑ front')).toBe(0);
  });
});

describe('sizes left at 0', () => {
  const AUTO = { x: 0, h: 0, y: 0, baffle_gap: 0 };
  const cases: [string, ParamValues][] = [
    ['bafflebox', {}],
    ['bafflebox', { gate: false, baffles: 3 }],
    ['bafflebox', { assembly: 'wedges' }],
    ['bafflebox', { assembly: 'bolts', thickness: 6 }],
    ['bafflebox', { port_dx: 20, port_dz: -25, vent_shape: 'rect', vent_dz: 30 }],
    ['lighttrap', {}],
    ['lighttrap', { baffles: 1 }],
    ['lighttrap', { baffles: 2, assembly: 'wedges' }],
    ['lighttrap', { port_side: 'bottom', baffles: 1 }],
    ['lighttrap', { port_side: 'bottom', baffles: 2, port_shape: 'fan', assembly: 'bolts', thickness: 6 }],
    ['lighttrap', { port_shape: 'rect', vent_shape: 'rect', vent_w: 300, vent_h: 50 }],
    ['lighttrap', { vent_dz: 40, port_dz: -30, outside: false }],
  ];
  const draw = (id: string, values: ParamValues) => buildDrawing(id, { ...defaultsFor(id), ...values });
  const size = (d: ReturnType<typeof draw>, key: string) => Number(/: ([\d.]+) mm/.exec(d.notes!.find((n) => n.param === key)!.message)![1]);

  for (const [id, extra] of cases) {
    it(`${id} ${JSON.stringify(extra)}: work, say what they came to, and are the least that works`, () => {
      const d = draw(id, { ...AUTO, ...extra });
      expect(d.warnings).toEqual([]);
      expect(d.notes!.map((n) => n.param).sort()).toEqual(['baffle_gap', 'h', 'x', 'y']);
      const [x, h, y] = ['x', 'h', 'y'].map((k) => size(d, k));
      const gap = size(d, 'baffle_gap');
      // Given back as fixed sizes, the same box, with nothing to say.
      const fixed = { ...extra, x, h, y, baffle_gap: gap };
      expect(draw(id, fixed).warnings).toEqual([]);
      expect(draw(id, fixed).notes ?? []).toEqual([]);
      // A millimetre less height or depth, or gap, and something gives. Bolted,
      // the openings are kept a whole T-slot's reach from the edges, which is
      // more than the slots strictly need, so there it is not quite the least.
      if (extra.assembly === 'bolts') return;
      expect(draw(id, { ...fixed, h: h - 1 }).warnings).not.toEqual([]);
      expect(draw(id, { ...fixed, y: y - 1 }).warnings).not.toEqual([]);
      expect(draw(id, { ...fixed, baffle_gap: gap - 1 }).warnings).not.toEqual([]);
    });
  }

  it('picks the width that makes the box smallest overall, not the narrowest', () => {
    const volume = (values: ParamValues) => {
      const d = draw('lighttrap', { ...AUTO, ...values });
      return ['x', 'h', 'y'].map((k) => (values[k] ? Number(values[k]) : size(d, k))).reduce((a, b) => a * b, 1);
    };
    const best = volume({});
    const chosen = size(draw('lighttrap', AUTO), 'x');
    for (const x of [108, 130, chosen - 20, chosen + 20, 260]) expect(volume({ x })).toBeGreaterThanOrEqual(best - 1e-6);
  });

  it('leaves alone what was given, and notes only what was not', () => {
    const d = draw('lighttrap', { x: 250, h: 0, y: 0, baffle_gap: 40 });
    expect(d.notes!.map((n) => n.param).sort()).toEqual(['h', 'y']);
  });

  it('cannot stop light without a baffle, and says so rather than growing for ever', () => {
    const d = draw('lighttrap', { ...AUTO, baffles: 0 });
    expect(d.warnings.map((w) => w.param)).toEqual(['baffles']);
    expect(size(d, 'h')).toBeLessThan(200);
  });
});

describe('the opening margin', () => {
  const draw = (id: string, values: ParamValues) => buildDrawing(id, { ...defaultsFor(id), ...values });

  /** The least distance from anything each opening cuts to the joints round its panel. */
  function clearances(lay: ReturnType<typeof baffleBoxLayout>, inFloor: boolean): number[] {
    const half = (op: Opening): [number, number] =>
      op.shape === 'fan' ? [(105 + 4.4) / 2, (105 + 4.4) / 2] : op.shape === 'round' ? [op.d / 2, op.d / 2] : [op.w / 2, op.h / 2];
    const [px, pz] = lay.port;
    const [phx, phz] = half(lay.portShape);
    const [vx, vz] = lay.ventAt;
    const [vhx, vhz] = half(lay.vent);
    const port = [px - phx, lay.xi - px - phx];
    if (inFloor) port.push(lay.yi - (pz + phz), pz - phz - (lay.baffles[0]!.y + lay.t / 2));
    else port.push(pz - phz, lay.hi - pz - phz);
    return [...port, vx - vhx, lay.xi - vx - vhx, vz - vhz, lay.hi - vz - vhz];
  }

  it('sized to fit, leaves at least the margin between every cut and the joints round it', () => {
    const cases: Partial<BaffleBoxOptions>[] = [
      { lightTrap: true },
      { lightTrap: true, port: { shape: 'fan', size: 120 } },
      { lightTrap: true, portSide: 'bottom', baffles: 1, port: { shape: 'fan', size: 120 }, frontClear: 12 },
      { vent: { shape: 'rect', w: 150, h: 75 }, ventOffset: [0, 20] },
      { gate: true, portOffset: [15, 0] },
    ];
    for (const c of cases) {
      for (const m of [1, 2, 4]) {
        const lay = baffleBoxLayout(opts({ gate: false, ...c, x: 0, h: 0, y: 0, gap: 0, openingMargin: m, frontClear: Math.max(c.frontClear ?? 0, 3 * m) }));
        expect(lay.warnings).toEqual([]);
        expect(Math.min(...clearances(lay, c.portSide === 'bottom'))).toBeGreaterThanOrEqual(3 * m - 1e-6);
      }
    }
  });

  it('warns, without shrinking it, when a set size brings an opening nearer than the margin', () => {
    // 100 mm openings front and back in a 110 mm box: 2 mm either side, inside 3 mm walls.
    const near = (values: ParamValues) => draw('lighttrap', { x: 110, h: 200, y: 200, ...values }).warnings.filter((w) => /too near the walls/.test(w.message));
    expect(near({}).map((w) => [w.param, /less than 6 mm/.test(w.message)])).toEqual([
      ['duct_d', true],
      ['vent_d', true],
    ]);
    expect(near({ opening_margin: 0.5 })).toEqual([]);
    const lay = baffleBoxLayout(opts({ x: 110, gate: false }));
    expect(lay.portShape).toEqual({ shape: 'round', d: 100 });
  });
});

describe('the light trap by default', () => {
  const draw = (values: ParamValues = {}) => buildDrawing('lighttrap', { ...defaultsFor('lighttrap'), ...values });

  it('sizes itself, says what to, and has nothing to warn about', () => {
    const d = draw();
    expect(d.warnings).toEqual([]);
    expect(d.notes!.map((n) => n.param).sort()).toEqual(['baffle_gap', 'h', 'x', 'y']);
  });

  it('with one size set, picks the others so the box still works', () => {
    const cases: ParamValues[] = [{ y: 150 }, { y: 240, assembly: 'wedges' }, { h: 130 }, { x: 140 }, { y: 120, baffles: 2 }];
    for (const fixed of cases) {
      expect(draw(fixed).warnings, JSON.stringify(fixed)).toEqual([]);
    }
  });
});
