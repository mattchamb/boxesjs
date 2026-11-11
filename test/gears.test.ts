/**
 * The gear generators' mesh warning: a gear whose mate's tips reach below
 * the start of its involute binds, and the fixes the warning suggests have to
 * actually clear it.
 */
import { describe, expect, it } from 'vitest';
import { digsInto, teethToClear } from '~/lib/gears';
import { defaultsFor } from '~/lib/generators/registry';
import { buildDrawing } from '~/lib/preview';
import type { ParamValues } from '~/lib/params/schema';

const STD = { dimension: 2, angle: 20, profile_shift: 20 };

function warnings(id: string, values: ParamValues = {}) {
  return buildDrawing(id, { ...defaultsFor(id), ...values }).warnings;
}

describe('digsInto', () => {
  it('flags a small gear against a large one, not the other way round', () => {
    expect(digsInto(8, 20, STD)).toBe(true);
    expect(digsInto(20, 8, STD)).toBe(false);
  });

  it('clears with more teeth, a larger pressure angle or more profile shift', () => {
    expect(digsInto(8, 20, { ...STD, angle: 30 })).toBe(false);
    expect(digsInto(8, 20, { ...STD, profile_shift: 50 })).toBe(false);
    const n = teethToClear(8, 20, STD)!;
    expect(digsInto(n, 20, STD)).toBe(false);
    expect(digsInto(n - 1, 20, STD)).toBe(true);
  });

  it('does not depend on the module', () => {
    for (const dimension of [0.5, 1, 3, 10]) {
      expect(digsInto(8, 20, { ...STD, dimension })).toBe(true);
      expect(digsInto(14, 20, { ...STD, dimension })).toBe(digsInto(14, 20, STD));
    }
  });
});

describe('Gears', () => {
  it('meshes cleanly at the defaults', () => {
    expect(warnings('gears')).toEqual([]);
  });

  it('warns on the gear that binds, and each suggested fix clears it', () => {
    const w = warnings('gears', { teeth1: 8 });
    expect(w.map((x) => x.param)).toEqual(['teeth1']);
    const msg = w[0]!.message;
    const teeth = Number(/at least (\d+) teeth/.exec(msg)![1]);
    const shift = Number(/profile shift to (\d+)%/.exec(msg)![1]);
    const angle = Number(/pressure angle to ([\d.]+)°/.exec(msg)![1]);
    expect(warnings('gears', { teeth1: teeth })).toEqual([]);
    expect(warnings('gears', { teeth1: 8, profile_shift: shift })).toEqual([]);
    expect(warnings('gears', { teeth1: 8, pressure_angle: angle })).toEqual([]);
    expect(warnings('gears', { teeth1: teeth - 1 })).not.toEqual([]);
  });

  it('warns on gear 2 when it is the small one', () => {
    expect(warnings('gears', { teeth1: 40, teeth2: 8 }).map((x) => x.param)).toEqual(['teeth2']);
  });
});

describe('Gearbox', () => {
  it('meshes cleanly at the defaults', () => {
    expect(warnings('gearbox')).toEqual([]);
  });

  it('warns on small gears that bind, offering only a tooth count', () => {
    const w = warnings('gearbox', { teeth1: 8 });
    expect(w.map((x) => x.param)).toEqual(['teeth1']);
    expect(w[0]!.message).not.toMatch(/pressure angle|profile shift/);
    const teeth = Number(/at least (\d+) teeth/.exec(w[0]!.message)![1]);
    expect(warnings('gearbox', { teeth1: teeth })).toEqual([]);
  });

  it('puts the warning on whichever field holds the smaller count', () => {
    expect(warnings('gearbox', { teeth1: 20, teeth2: 8 }).map((x) => x.param)).toEqual(['teeth2']);
  });
});

describe('Planetary', () => {
  it('meshes cleanly at the defaults', () => {
    expect(warnings('planetary')).toEqual([]);
  });

  it('warns on a sun that binds, and the suggested count clears it', () => {
    const w = warnings('planetary', { sunteeth: 8 });
    expect(w.map((x) => x.param)).toEqual(['sunteeth']);
    const teeth = Number(/at least (\d+) teeth/.exec(w[0]!.message)![1]);
    expect(warnings('planetary', { sunteeth: teeth })).toEqual([]);
  });

  it('warns on the planets when they are the small gears', () => {
    expect(warnings('planetary', { sunteeth: 30, planetteeth: 8 }).map((x) => x.param)).toEqual(['planetteeth']);
  });
});
