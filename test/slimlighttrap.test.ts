/**
 * The slim light trap is this port's own, so there is no boxes.py golden to
 * compare against. These tests pin what it must do instead: its chambers hold
 * its openings, the air has a path at least as large as them, the light
 * check agrees with rays traced through the parts, and it stands out from the
 * case less than the Light Trap Vent.
 */
import { describe, expect, it } from 'vitest';
import { LIGHT_MARGIN, type Opening } from '~/lib/generators/bafflebox';
import { slimTrapLayout, type SlimTrapLayout, type SlimTrapOptions } from '~/lib/generators/slimlighttrap';
import { defaultsFor } from '~/lib/generators/registry';
import { buildDrawing } from '~/lib/preview';
import { toSVG } from '~/lib/export/svg';
import type { ParamValues } from '~/lib/params/schema';

function opts(over: Partial<SlimTrapOptions> = {}): SlimTrapOptions {
  return {
    x: 150,
    y: 120,
    h: 320,
    outside: true,
    thickness: 3,
    vent: { shape: 'round', d: 100 },
    port: { shape: 'round', d: 100 },
    portSide: 'front',
    ventDx: 0,
    portDx: 0,
    floorClear: 6,
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
    gap: 55,
    ...over,
  };
}

const draw = (values: ParamValues = {}, id = 'slimlighttrap') => buildDrawing(id, { ...defaultsFor(id), ...values });
const half = (o: Opening): [number, number] =>
  o.shape === 'round' ? [o.d / 2, o.d / 2] : o.shape === 'rect' ? [o.w / 2, o.h / 2] : [NaN, NaN];

/**
 * Whether any of a grid of straight rays from the back of the case opening
 * to the outer face of the room-side opening gets past every baffle, traced
 * through the parts rather than the windows the layout uses. `widen` opens
 * every gap by that much.
 */
function rayGetsThrough(lay: SlimTrapLayout, inFloor: boolean, widen = 0): boolean {
  const t = lay.t;
  const [, vr] = half(lay.vent);
  const [, pr] = half(lay.portShape);
  const g = lay.gap + widen;
  const N = 300;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      // As (y, z): from the vent's back face to the opening's outer face.
      const [ay, az] = [-t, lay.ventAt[1] - vr + (2 * vr * i) / N];
      const [by, bz] = inFloor ? [lay.port[1] - pr + (2 * pr * j) / N, -t] : [lay.yi + t, lay.port[1] - pr + (2 * pr * j) / N];
      const zAt = (y: number) => az + ((bz - az) * (y - ay)) / (by - ay);
      const yAt = (z: number) => ay + ((by - ay) * (z - az)) / (bz - az);
      if (Math.abs(zAt(0) - lay.ventAt[1]) > vr) continue;
      if (inFloor ? Math.abs(yAt(0) - lay.port[1]) > pr : Math.abs(zAt(lay.yi) - lay.port[1]) > pr) continue;
      const blocked = lay.baffles.some((bf) =>
        [bf.z - t / 2, bf.z + t / 2].some((z) => {
          const y = yAt(z);
          return bf.back ? y < lay.yi - g : y > g;
        }),
      );
      if (!blocked) return true;
    }
  }
  return false;
}

describe('slimTrapLayout', () => {
  it('stacks the chambers up the box, the openings in the end ones, the baffles fixed back and front in turn', () => {
    for (const baffles of [0, 1, 2, 3, 4]) {
      const lay = slimTrapLayout(opts({ baffles }));
      const t = lay.t;
      expect(lay.chambers).toHaveLength(baffles + 1);
      expect(lay.chambers.reduce((a, c) => a + c, 0) + baffles * t).toBeCloseTo(lay.hi, 9);
      expect(lay.baffles.map((b) => b.back)).toEqual([true, false, true, false].slice(0, baffles));
      // Each baffle between the chambers above and below it.
      let z = lay.hi;
      lay.baffles.forEach((bf, i) => {
        z -= lay.chambers[i]!;
        expect(bf.z + t / 2).toBeCloseTo(z, 9);
        z -= t;
      });
      expect(lay.ventAt[1]).toBeCloseTo(lay.hi - lay.chambers[0]! / 2, 9);
      expect(lay.port[1]).toBeCloseTo(lay.chambers[baffles]! / 2, 9);
    }
  });

  it('gives the end chambers what their openings need, and the others share the rest alike', () => {
    const lay = slimTrapLayout(opts({ baffles: 3, h: 400 }));
    const [top, a, b, bottom] = lay.chambers;
    expect(a).toBeCloseTo(b!, 9);
    expect(top).toBeGreaterThanOrEqual(100 + 12 - 1e-9);
    expect(bottom).toBeGreaterThanOrEqual(100 + 12 - 1e-9);
  });

  it('gives the air no passage smaller than the openings, and stops light, at the defaults', () => {
    const lay = slimTrapLayout(opts());
    const area = Math.PI * 50 ** 2;
    expect(lay.gap * lay.xi).toBeGreaterThanOrEqual(area);
    for (const c of lay.chambers) expect(c * lay.xi).toBeGreaterThanOrEqual(area);
    expect(lay.sight).toBeLessThanOrEqual(-LIGHT_MARGIN);
    expect(lay.warnings).toEqual([]);
  });

  it('says when it is too short for its openings and baffles', () => {
    const lay = slimTrapLayout(opts({ h: 200 }));
    expect(lay.warnings.map((w) => w.param)).toContain('h');
  });
});

describe('the light check', () => {
  const cases: [string, Partial<SlimTrapOptions>][] = [
    ['two baffles', {}],
    ['three baffles', { baffles: 3, h: 400, y: 90, gap: 35, x: 260 }],
    ['opening in the bottom', { portSide: 'bottom', h: 280 }],
    ['opening in the bottom, three baffles', { portSide: 'bottom', baffles: 3, h: 360 }],
    ['rectangular openings', { vent: { shape: 'rect', w: 120, h: 50 }, port: { shape: 'rect', w: 120, h: 50 }, h: 220, y: 100, gap: 50 }],
  ];
  for (const [name, c] of cases) {
    it(`${name}: agrees with rays traced through the parts, shut by its margin`, () => {
      const lay = slimTrapLayout(opts(c));
      const inFloor = c.portSide === 'bottom';
      expect(lay.sight).toBeLessThanOrEqual(-LIGHT_MARGIN);
      expect(rayGetsThrough(lay, inFloor)).toBe(false);
      expect(rayGetsThrough(lay, inFloor, LIGHT_MARGIN - 1)).toBe(false);
      const open = slimTrapLayout(opts({ ...c, baffles: 0 }));
      expect(open.sight).toBeGreaterThan(0);
      expect(rayGetsThrough(open, inFloor)).toBe(true);
    });
  }

  it('warns once a ray gets through, and names a gap that stops it', () => {
    for (const c of [{ y: 100, gap: 70 }, { portSide: 'bottom' as const, h: 280, gap: 80 }]) {
      const leaky = slimTrapLayout(opts(c));
      const inFloor = c.portSide === 'bottom';
      expect(rayGetsThrough(leaky, inFloor)).toBe(true);
      const msg = leaky.warnings.find((w) => /Light/.test(w.message))!.message;
      const most = Number(/at most (\d+) mm/.exec(msg)![1]);
      expect(rayGetsThrough(slimTrapLayout(opts({ ...c, gap: most })), inFloor)).toBe(false);
      expect(slimTrapLayout(opts({ ...c, gap: most + 2 })).sight).toBeGreaterThan(-LIGHT_MARGIN);
    }
  });

  it('with one baffle, sees light at an angle that two would stop', () => {
    expect(rayGetsThrough(slimTrapLayout(opts({ baffles: 1 })), false)).toBe(true);
    expect(slimTrapLayout(opts({ baffles: 1 })).warnings.some((w) => /Light|light/.test(w.message))).toBe(true);
  });
});

describe('the opening in the bottom', () => {
  it('goes to the end away from the last gap', () => {
    for (const baffles of [1, 2]) {
      const lay = slimTrapLayout(opts({ portSide: 'bottom', baffles, h: 300 }));
      const r = half(lay.portShape)[1];
      const last = lay.baffles[baffles - 1]!;
      // Fixed to the back, its gap is at the front, and the hole at the back.
      if (last.back) expect(lay.port[1] - r).toBeCloseTo(6, 9);
      else expect(lay.yi - lay.port[1] - r).toBeCloseTo(6, 9);
    }
  });

  it('is etched with which way is the front once it is not centred', () => {
    const count = (svg: string) => svg.split('↑ front').length - 1;
    expect(count(toSVG(draw({ port_side: 'bottom', port_dx: 20 })))).toBe(1);
    expect(count(toSVG(draw({ port_side: 'bottom', baffles: 1, y: 400 })))).toBe(1);
  });
});

describe('sizes left at 0', () => {
  const cases: ParamValues[] = [
    {},
    { baffles: 3 },
    { port_side: 'bottom' },
    { port_shape: 'fan' },
    { port_shape: 'rect', vent_shape: 'rect' },
    { vent_dx: 20, port_dx: -15 },
    { assembly: 'wedges' },
    { assembly: 'bolts', thickness: 6 },
    { port_side: 'bottom', assembly: 'wedges' },
  ];
  const size = (d: ReturnType<typeof draw>, key: string) => Number(/: ([\d.]+) mm/.exec(d.notes!.find((n) => n.param === key)!.message)![1]);

  for (const extra of cases) {
    it(`${JSON.stringify(extra)}: work, say what they came to, and are the least that works`, () => {
      const d = draw(extra);
      expect(d.warnings).toEqual([]);
      expect(d.notes!.map((n) => n.param).sort()).toEqual(['baffle_gap', 'h', 'x', 'y']);
      const [x, h, y] = ['x', 'h', 'y'].map((k) => size(d, k));
      const fixed = { ...extra, x, h, y, baffle_gap: size(d, 'baffle_gap') };
      expect(draw(fixed).warnings).toEqual([]);
      expect(draw(fixed).notes ?? []).toEqual([]);
      if (extra.assembly === 'bolts') return;
      expect(draw({ ...fixed, h: h - 1 }).warnings).not.toEqual([]);
      expect(draw({ ...fixed, y: y - 1 }).warnings).not.toEqual([]);
      expect(draw({ ...fixed, baffle_gap: fixed.baffle_gap - 1 }).warnings).not.toEqual([]);
    });
  }

  it('stands out from the case less than the Light Trap Vent, for the same openings', () => {
    const depth = (id: string) => size(draw({}, id), 'y');
    expect(depth('slimlighttrap')).toBeLessThan(0.6 * depth('lighttrap'));
  });

  it('with the depth set, sizes the rest round it so the box still works', () => {
    for (const y of [70, 90, 130]) {
      const d = draw({ y });
      expect(d.warnings, `y ${y}`).toEqual([]);
      expect(d.notes!.map((n) => n.param).sort()).toEqual(['baffle_gap', 'h', 'x']);
    }
  });
});

describe('the opening margin', () => {
  it('sized to fit, leaves at least the margin between every cut and the joints and slots round it', () => {
    const cases: Partial<SlimTrapOptions>[] = [{}, { port: { shape: 'fan', size: 120 } }, { portSide: 'bottom' }, { vent: { shape: 'rect', w: 150, h: 75 }, ventDx: 20 }];
    for (const c of cases) {
      for (const m of [1, 2, 4]) {
        const lay = slimTrapLayout(opts({ ...c, x: 0, h: 0, y: 0, gap: 0, openingMargin: m, floorClear: 3 * m }));
        expect(lay.warnings).toEqual([]);
        const t = lay.t;
        const [vx, vz] = lay.ventAt;
        const [vhx, vhz] = half(lay.vent);
        const vent = [vx - vhx, lay.xi - vx - vhx, lay.hi - vz - vhz, vz - vhz - (lay.baffles[0]!.z + t / 2)];
        expect(Math.min(...vent)).toBeGreaterThanOrEqual(3 * m - 1e-6);
        if (lay.portShape.shape === 'fan') continue;
        const [px, pz] = lay.port;
        const [phx, phz] = half(lay.portShape);
        const last = lay.baffles[lay.baffles.length - 1]!;
        const port =
          c.portSide === 'bottom'
            ? [px - phx, lay.xi - px - phx, pz - phz, lay.yi - pz - phz]
            : [px - phx, lay.xi - px - phx, pz - phz, last.z - t / 2 - pz - phz];
        expect(Math.min(...port)).toBeGreaterThanOrEqual(3 * m - 1e-6);
      }
    }
  });
});

describe('knocked down', () => {
  it('screws the back up through its corners, clear of the vent and the baffles\' slots', () => {
    for (const assembly of ['wedges', 'bolts'] as const) {
      const lay = slimTrapLayout(opts({ assembly, h: 360, y: 150 }));
      expect([lay.plate.w, lay.plate.h]).toEqual([lay.xi, lay.hi]);
      expect(lay.plate.screws).toHaveLength(4);
      for (const [x, z] of lay.plate.screws) {
        expect(Math.hypot(x - lay.ventAt[0], z - lay.ventAt[1])).toBeGreaterThan(50 + 2.5);
        for (const bf of lay.baffles) if (bf.back) expect(Math.abs(z - bf.z)).toBeGreaterThan(1.5 + 2.5);
      }
    }
  });
});
