/**
 * Which controls the panel shows, and how links read back. The panel only
 * offers what applies to the current choices; these pin that a joint's tuning
 * appears with the joint, and that nothing the engine warns about is hidden.
 */
import { describe, expect, it } from 'vitest';
import { BoltsPolicy, FingerJointSettings } from '~/lib/edges/fingerjoint';
import { bedBoltSettingsFor, boltPositions, boltsClearOf } from '~/lib/edges/bolts';
import { defaultsFor, getGenerator, paramsFor } from '~/lib/generators/registry';
import { toBoxesConfig } from '~/lib/params/common';
import { decodeParams, encodeParams } from '~/lib/permalink';
import { buildDrawing, renderPreview } from '~/lib/preview';
import { visibleParams, type ParamValues } from '~/lib/params/schema';
import { matchesQuery } from '~/lib/params/search';

const shown = (id: string, values: ParamValues = {}) =>
  new Set(visibleParams(paramsFor(id), { ...defaultsFor(id), ...values }).map((s) => s.key));
const has = (keys: Set<string>, prefix: string) => [...keys].some((k) => k.startsWith(prefix));

describe('the panel shows a joint’s tuning only with that joint', () => {
  it('wedges, on a generator that offers them', () => {
    expect(has(shown('storageshelf'), 'wt_')).toBe(false);
    expect(has(shown('storageshelf', { assembly: 'wedges' }), 'wt_')).toBe(true);
  });

  it('bolts, and their custom dimensions only for a custom bolt', () => {
    expect(has(shown('closedbox'), 'bolt_')).toBe(false);
    const bolted = shown('closedbox', { assembly: 'bolts' });
    expect(bolted.has('bolt_size')).toBe(true);
    expect(bolted.has('bolt_length')).toBe(true);
    expect(bolted.has('bolt_d')).toBe(false);
    expect(shown('closedbox', { assembly: 'bolts', bolt_size: 'custom' }).has('bolt_d')).toBe(true);
  });

  it('on a single panel, whatever its edges use', () => {
    const plain = shown('rectangularwall');
    expect(has(plain, 'wt_') || has(plain, 'dt_') || has(plain, 'bolt_')).toBe(false);
    expect(has(shown('rectangularwall', { left_edge: 'W' }), 'wt_')).toBe(true);
    expect(has(shown('rectangularwall', { top_edge: 'd' }), 'dt_')).toBe(true);
    expect(has(shown('rectangularwall', { bolts: 2 }), 'bolt_')).toBe(true);
  });

  it('the chosen wall system only', () => {
    const plain = shown('wallhopper');
    expect(['slatwall_', 'dinrail_', 'frenchcleat_', 'skadis_'].some((p) => has(plain, p))).toBe(false);
    const cleat = shown('wallhopper', { walltype: 'french cleat' });
    expect(has(cleat, 'frenchcleat_')).toBe(true);
    expect(has(cleat, 'slatwall_')).toBe(false);
  });

  it('stackable edges when one is chosen, and always where the generator is built on them', () => {
    expect(has(shown('storagerack'), 'st_')).toBe(false);
    expect(has(shown('storagerack', { top_edge: 'S' }), 'st_')).toBe(true);
    expect(has(shown('paintstorage'), 'st_')).toBe(true);
  });

  it('puts every joint family’s tuning in its own section, and finger joints everywhere', () => {
    for (const s of paramsFor('rectangularwall')) {
      if (/^(fj|wt|dt|bolt)_/.test(s.key)) expect(s.section, s.key).toBeTruthy();
    }
    expect(shown('closedbox').has('fj_finger')).toBe(true);
  });
});

describe('warnings land on fields the panel shows', () => {
  const cases: Array<[string, ParamValues]> = [
    ['storageshelf', { assembly: 'wedges', x: 35 }],
    ['displayshelf', { assembly: 'wedges', angle: 0, include_bottom: true }],
    ['displayshelf', { assembly: 'wedges', angle: 0 }],
    ['storagerack', { assembly: 'wedges', sh: '15*5' }],
    ['paintstorage', { assembly: 'wedges' }],
    ['paintstorage', { assembly: 'wedges', drawer: true }],
    ['closedbox', { assembly: 'bolts', thickness: 5, bolt_length: 8 }],
    ['closedbox', { assembly: 'bolts', x: 200, y: 60, h: 200, thickness: 8, bolt_size: 'M6', bolt_length: 40 }],
    ['universalbox', { assembly: 'bolts', bottom_edge: 's' }],
    ['closedbox', { assembly: 'bolts', thickness: 7 }],
    ['rectangularwall', { bolts: 2, bottom_edge: 'f', x: 30 }],
    ['rectangularwall', { bolts: 2 }],
    // M4 by default here, which is too fat for the shared 3 mm default.
    ['typetray', { assembly: 'bolts' }],
    ['bafflebox', { assembly: 'wedges' }],
    ['bafflebox', { assembly: 'bolts', thickness: 6, vent_shape: 'rect', vent_w: 180, vent_h: 230 }],
    ['lighttrap', { baffles: 1 }],
    ['lighttrap', { port_shape: 'fan', fan_size: '140', x: 120 }],
    ['lighttrap', { port_side: 'bottom' }],
    ['lighttrap', { vent_dz: 300 }],
    ['lighttrap', { port_dz: 300 }],
    ['lighttrap', { port_side: 'bottom', port_dx: -300 }],
    ['bafflebox', { port_dz: 60 }],
    ['bafflebox', { port_dx: 30 }],
    ['lighttrap', { baffles: 1, vent_dz: -40 }],
    ['lighttrap', { port_side: 'bottom', port_shape: 'rect', port_h: 300 }],
    // The bottom's one bolt on a 108 mm edge lands on the middle divider.
    ['typetray', { assembly: 'bolts', thickness: 6, sx: '40*5', sy: '30*4', h: 70 }],
    ['typetray', { assembly: 'bolts', thickness: 6, h: 60, bottom_edge: 's' }],
    ['automaton', { h: 30, y: 30, pitch: 3 }],
    ['automaton', { cams: 'output rocker 5\nrise 30 60\nreturn 60', pivot_height: 2, figure_hole: 10 }],
    ['automaton', { cams: 'output spin 3 3', peg_spacing: 4, front: 'window', window_margin: 100 }],
    ['automaton', { assembly: 'bolts' }],
    ['automaton', { assembly: 'wedges', thickness: 6, wt_wedge_length: 12 }],
    ['automaton', { guides: 'below' }],
    ['automaton', { cams: 'output spin 3 12', peg_pin: 1, peg_spacing: 12, pitch: 80 }],
    ['automaton', { cams: 'output spin 12 3', peg_length: 3, peg_spacing: 12, pitch: 80 }],
    ['automaton', { cams: 'output rocker 25\nrise 40 120\nreturn 120', base_radius: 40 }],
  ];
  for (const [id, values] of cases) {
    it(`${id} ${JSON.stringify(values)}`, () => {
      const warnings = renderPreview(id, { ...defaultsFor(id), ...values }).warnings;
      expect(warnings.length).toBeGreaterThan(0);
      const keys = shown(id, values);
      for (const w of warnings) if (w.param) expect(keys.has(w.param), w.param).toBe(true);
    });
  }
});

describe('bolts', () => {
  it('are sized from the metric bolt, with clearance', () => {
    const [d, nut, h, l, l1] = bedBoltSettingsFor({ size: 'M3', length: 20, clearance: 0.2, custom: [0, 0, 0] }, 3);
    expect([d, nut, h, l]).toEqual([3.2, 5.7, expect.closeTo(2.6, 9), 18]);
    expect(l1).toBeCloseTo(12.4, 9);
  });

  it('reproduce boxes.py’s own bolt as a custom size', () => {
    const settings = bedBoltSettingsFor({ size: 'custom', length: 22, clearance: 0, custom: [3, 5.5, 2] }, 3);
    expect(settings).toEqual([3, 5.5, 2, 20, 15]);
  });

  it('sit where the edges draw them: one hole per bolt in the walls they pass through', () => {
    const v = { ...defaultsFor('closedbox'), assembly: 'bolts', burn: 0, labels: false, outside: false };
    const d = buildDrawing('closedbox', v);
    const fj = new FingerJointSettings(3, true, {});
    const count = (l: number, n: number) => boltPositions(fj, l, new BoltsPolicy(n)).length;
    // Wall 1 is FFFF with two bolts on each edge: its only inner paths are bolt holes.
    const wall1 = d.parts.find((p) => p.name === 'Wall 1')!;
    expect(wall1.paths.filter((p) => p.layer === 'inner')).toHaveLength(2 * count(100, 2) + 2 * count(100, 2));
    // Walls 2 and 4 are FfFf: holes on the y edges, three bolts each.
    const wall2 = d.parts.find((p) => p.name === 'Wall 2')!;
    expect(wall2.paths.filter((p) => p.layer === 'inner')).toHaveLength(2 * count(100, 3));
  });

  it('fit the default boxes in 5 mm material without a warning', () => {
    for (const id of ['closedbox', 'universalbox']) {
      expect(renderPreview(id, { ...defaultsFor(id), assembly: 'bolts', thickness: 5 }).warnings, id).toEqual([]);
    }
  });

  it('say when the bolt is too fat for the material, rather than that cuts meet', () => {
    const w = renderPreview('closedbox', { ...defaultsFor('closedbox'), assembly: 'bolts' }).warnings;
    expect(w.map((x) => x.param)).toEqual(['bolt_size']);
  });

  it('find a T-slot that runs into another cut once the parts are drawn', () => {
    // M6 × 40 in 8 mm material: 33 mm slots from both upright edges of a
    // wall only 60 mm deep, so they meet in the middle.
    const w = renderPreview('closedbox', {
      ...defaultsFor('closedbox'),
      x: 200,
      y: 60,
      h: 200,
      assembly: 'bolts',
      thickness: 8,
      bolt_size: 'M6',
      bolt_length: 40,
    }).warnings;
    expect(w.map((x) => x.param)).toContain('bolt_length');
  });

  it('keep off the dividers’ slots on a shelf’s back joints', () => {
    // Three bolts on the 300 mm back joints would put the middle one on the
    // divider at 150 mm, whose slots run in from that same edge.
    const v = { ...defaultsFor('storageshelf'), assembly: 'bolts', thickness: 6, x: 200, sh: '150*3', sy: '150*2', top_edge: 'f' };
    expect(renderPreview('storageshelf', v).warnings).toEqual([]);
    const fj = new FingerJointSettings(6, true, {});
    const y = 2 * 150 + 6;
    const at = boltPositions(fj, y, boltsClearOf(fj, y, [153], (5.7 + 6) / 2 + 1));
    expect(at.length).toBeGreaterThan(0);
    for (const p of at) expect(Math.abs(p - 153)).toBeGreaterThan(6);
  });

  it.each([
    ['storageshelf', { x: 200, sh: '150*3', sy: '150*2', top_edge: 'f' }],
    ['storagerack', { bottom_edge: 'F' }],
    ['storagerack', { bottom_edge: 'e', sh: '80*4' }],
    ['displayshelf', { y: 150, include_back: true, include_front: true, include_bottom: true }],
    ['displayshelf', { y: 150, slope_top: true, include_back: true, include_bottom: true }],
    ['typetray', {}],
    ['typetray', { hi: 130 }],
    ['typetray', { hi: 60, bottom_edge: 'F', fj_finger: 1, fj_space: 1 }],
    ['typetray', { bottom_edge: 's' }],
    ['typetray', { sx: '200', sy: '200', top_edge: 'f' }],
    ['bafflebox', {}],
    ['bafflebox', { baffles: 0, gate: false }],
    ['lighttrap', {}],
  ] as const)('on %s %o, put a hole opposite every T-slot, clear of the other cuts', (id, extra) => {
    const v = { ...defaultsFor(id), assembly: 'bolts', thickness: 6, ...extra };
    expect(renderPreview(id, v).warnings).toEqual([]);
    const box = getGenerator(id).create(v, toBoxesConfig(v));
    box.open();
    box.render();
    const cuts = box.close().parts.flatMap((p) => p.boltCuts);
    // A hole's mark is as wide as the bolt; a T-slot's, as the nut.
    const d = box.bedBoltSettings[0]!;
    const holes = cuts.filter(([a, b]) => Math.abs(Math.hypot(b![0] - a![0], b![1] - a![1]) - d) < 1e-6).length;
    expect(holes).toBeGreaterThan(0);
    expect(cuts.length - holes).toBe(holes);
  });

  it('take two to each of a type tray’s corners and divider ends where the fingers leave room', () => {
    const cornerSlots = (extra: ParamValues) => {
      const v = { ...defaultsFor('typetray'), assembly: 'bolts', thickness: 6, bottom_edge: 's', ...extra };
      const box = getGenerator('typetray').create(v, toBoxesConfig(v));
      box.open();
      box.render();
      // With a stackable bottom, a side's only bolt cuts are its corners' T-slots.
      return box.close().parts.find((p) => p.name === 'Left side')!.boltCuts.length / 2;
    };
    expect(cornerSlots({ h: 100 })).toBe(2);
    const dividerSlots = (extra: ParamValues) => {
      const v = { ...defaultsFor('typetray'), assembly: 'bolts', thickness: 6, ...extra };
      const box = getGenerator('typetray').create(v, toBoxesConfig(v));
      box.open();
      box.render();
      return box.close().parts.find((p) => p.name === 'Divider along 1')!.boltCuts.length / 2;
    };
    expect(dividerSlots({})).toBe(2);
    expect(dividerSlots({ hi: 130 })).toBe(2);
    expect(dividerSlots({ hi: 60 })).toBe(1);
    expect(cornerSlots({ h: 70, fj_finger: 1, fj_space: 1 })).toBe(2);
    // Too low for two at the default fingers: one, with a warning.
    expect(cornerSlots({ h: 60 })).toBe(1);
  });

  it('do not take the blame for crossings away from them', () => {
    // At 8 mm a 120 mm-deep side's stackable foot overlaps itself, as in
    // boxes.py; the bolts are nowhere near it.
    const v = { ...defaultsFor('storageshelf'), assembly: 'bolts', thickness: 8, x: 120, bottom_edge: 's' };
    expect(renderPreview('storageshelf', v).warnings).toEqual([]);
  });

  it('say which joints get no bolts, where thick fingers leave too few gaps', () => {
    // At 7 mm a 100 mm box has two fingers to a width edge, and the two-bolt
    // policy bolts neither end gap nor the middle one: those walls hang free.
    const w = renderPreview('closedbox', { ...defaultsFor('closedbox'), assembly: 'bolts', thickness: 7 }).warnings;
    expect(w.map((x) => x.param)).toContain('assembly');
    expect(w.find((x) => x.param === 'assembly')!.message).toMatch(/width edges/);
  });

  it('leave a stackable bottom unbolted rather than slot it with nothing to meet', () => {
    const v = { ...defaultsFor('universalbox'), assembly: 'bolts', bottom_edge: 's', burn: 0 };
    const bottom = buildDrawing('universalbox', v).parts.find((p) => p.name === 'Bottom')!;
    const plain = buildDrawing('universalbox', { ...v, assembly: 'glue' }).parts.find((p) => p.name === 'Bottom')!;
    expect(bottom.paths.map((p) => p.d)).toEqual(plain.paths.map((p) => p.d));
  });

  it('on a panel, slot finger edges and hole the others', () => {
    const v = { ...defaultsFor('rectangularwall'), burn: 0, labels: false, bottom_edge: 'f', right_edge: 'F', top_edge: 'h', left_edge: 'e' };
    const inner = (values: ParamValues) =>
      buildDrawing('rectangularwall', values).parts.find((p) => p.name === 'Panel')!.paths.filter((p) => p.layer === 'inner').length;
    const fj = new FingerJointSettings(3, true, {});
    const n = (l: number) => boltPositions(fj, l, new BoltsPolicy(2)).length;
    // The F edge and the h edge's slots get a hole per bolt; so do the matching
    // slots drawn beside the f edge. The f edge's own bolts are T-slots in its outline.
    expect(inner({ ...v, bolts: 2 }) - inner(v)).toBe(n(100) * 3);
  });
});

describe('links', () => {
  it('read the old wedged-tenon switch into the choice that replaced it', () => {
    expect(decodeParams('storageshelf', '#wedged=1')['assembly']).toBe('wedges');
    expect(decodeParams('storageshelf', '#wedged=0')['assembly']).toBe('glue');
  });

  it('round-trip the new choices', () => {
    const v = { ...defaultsFor('closedbox'), assembly: 'bolts', bolt_size: 'M4', bolt_length: 25 };
    expect(decodeParams('closedbox', encodeParams('closedbox', v))).toEqual(v);
  });
});

describe('finding a setting', () => {
  const spec = (key: string) => paramsFor('dividertray').find((s) => s.key === key)!;

  it('by label, help or section, ignoring case', () => {
    expect(matchesQuery(spec('burn'), 'KERF')).toBe(true);
    expect(matchesQuery(spec('burn'), 'press fit')).toBe(true);
    expect(matchesQuery(spec('fj_play'), 'finger')).toBe(true);
  });

  it('by the group it is filed under', () => {
    expect(matchesQuery(spec('burn'), 'material', 'Material')).toBe(true);
  });

  it('only when every word matches', () => {
    expect(matchesQuery(spec('fj_play'), 'finger play')).toBe(true);
    expect(matchesQuery(spec('fj_play'), 'finger kerf')).toBe(false);
  });

  it('by the name of a choice it offers', () => {
    const edge = paramsFor('rectangularwall').find((s) => s.kind === 'edge')!;
    expect(matchesQuery(edge, 'dovetail')).toBe(true);
  });

  it('everything for an empty query', () => {
    expect(matchesQuery(spec('burn'), '  ')).toBe(true);
  });
});
