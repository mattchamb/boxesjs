/**
 * Invariants that must hold for every generator, at defaults and under stress.
 * These catch the kind of breakage a golden file cannot: a generator added
 * later that throws, lays parts on top of each other, or produces nothing.
 *
 * The checks run against every generator's defaults live in
 * helpers/generators.ts and are spread across the generators.*.test.ts files.
 */
import { describe, expect, it } from 'vitest';
import { defaultsFor, listGenerators, paramsFor } from '~/lib/generators/registry';
import { buildDrawing, renderPreview } from '~/lib/preview';
import { THUMB_ASPECT, renderThumbnail } from '~/lib/thumbnail';
import { overlappingPairs } from './helpers/generators';
import { VARIANTS } from './variants';

const generators = listGenerators();

describe.each(VARIANTS)('$id with $name', ({ id, values }) => {
  const v = { ...defaultsFor(id), ...values };

  it('lays out parts without overlapping them', () => {
    expect(overlappingPairs(buildDrawing(id, v).parts, id)).toEqual([]);
  });

  it('names every part it produces', () => {
    for (const p of renderPreview(id, v).parts) {
      expect(p.name).not.toBe('');
      expect(p.name).not.toBe('default');
    }
  });
});

describe('registry', () => {
  it('has unique generator ids', () => {
    const ids = generators.map((g) => g.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every generator a unique parameter key set', () => {
    for (const g of generators) {
      const keys = paramsFor(g.meta.id).map((s) => s.key);
      expect(new Set(keys).size, `${g.meta.id} has duplicate parameter keys`).toBe(keys.length);
    }
  });
});

describe('gallery thumbnails', () => {
  // The fallback is the generator's own layout, a strip that shrinks to a
  // sliver in the card; every generator should pack onto the card's shape.
  it.each(listGenerators().map((g) => g.meta.id))('%s packs onto one card-shaped sheet', (id) => {
    const t = renderThumbnail(id);
    const [x, y, w, h] = t.viewBox.split(' ').map(Number);
    expect([x, y]).toEqual([0, 0]);
    expect(w! / h!).toBeCloseTo(THUMB_ASPECT);
    expect(t.cut).not.toBe('');
  });
});
