/**
 * Which controls the panel shows, and how links read back. The panel only
 * offers what applies to the current choices; these pin that a joint's tuning
 * appears with the joint, and that nothing the engine warns about is hidden.
 */
import { describe, expect, it } from 'vitest';
import { BoltsPolicy, FingerJointSettings } from '~/lib/edges/fingerjoint';
import { bedBoltSettingsFor, boltPositions } from '~/lib/edges/bolts';
import { defaultsFor, paramsFor } from '~/lib/generators/registry';
import { decodeParams, encodeParams } from '~/lib/permalink';
import { buildDrawing, renderPreview } from '~/lib/preview';
import { visibleParams, type ParamValues } from '~/lib/params/schema';

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
    ['closedbox', { assembly: 'bolts', bolt_length: 8 }],
    ['closedbox', { assembly: 'bolts', bolt_size: 'M6', bolt_length: 30 }],
    ['universalbox', { assembly: 'bolts', bottom_edge: 's' }],
    ['closedbox', { assembly: 'bolts', thickness: 7 }],
    ['rectangularwall', { bolts: 2, bottom_edge: 'f', x: 30 }],
    ['rectangularwall', { bolts: 2 }],
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

  it('fit the default boxes without a warning', () => {
    for (const id of ['closedbox', 'universalbox']) {
      expect(renderPreview(id, { ...defaultsFor(id), assembly: 'bolts' }).warnings, id).toEqual([]);
    }
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
