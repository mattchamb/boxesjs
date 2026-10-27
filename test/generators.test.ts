/**
 * Invariants that must hold for every generator, at defaults and under stress.
 * These catch the kind of breakage a golden file cannot: a generator added
 * later that throws, lays parts on top of each other, or produces nothing.
 */
import { describe, expect, it } from 'vitest';
import { insideRing, polylines, ringsCross, type Pt } from '~/lib/geom/crossings';
import { defaultsFor, listGenerators, paramsFor } from '~/lib/generators/registry';
import { buildDrawing, renderPreview } from '~/lib/preview';
import type { DrawingPart } from '~/lib/render';
import { THUMB_ASPECT, renderThumbnail } from '~/lib/thumbnail';
import type { ParamValues } from '~/lib/params/schema';
import { VARIANTS } from './variants';

const generators = listGenerators();

/**
 * A part's outline as polylines. Only the cut layer counts: inner cuts and
 * engraving live inside a part and say nothing about where it sits.
 */
function outline(part: DrawingPart): Pt[][] {
  return part.paths.filter((p) => p.layer === 'cut').flatMap((p) => polylines(p.cmds));
}

function bboxesMeet(a: DrawingPart, b: DrawingPart): boolean {
  const ox = Math.min(a.bbox.x + a.bbox.width, b.bbox.x + b.bbox.width) - Math.max(a.bbox.x, b.bbox.x);
  const oy =
    Math.min(a.bbox.y + a.bbox.height, b.bbox.y + b.bbox.height) - Math.max(a.bbox.y, b.bbox.y);
  return ox > 0.5 && oy > 0.5;
}

/**
 * Parts that overlap cannot be cut. Bounding boxes are only a prefilter — the
 * finger tabs of two neighbouring parts routinely interleave, so boxes.py packs
 * layouts whose boxes touch at a corner while the outlines stay well apart.
 * What matters is whether the outlines themselves meet.
 */
function overlappingPairs(parts: DrawingPart[]) {
  const bad: string[] = [];
  const rings = parts.map(outline);
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (!bboxesMeet(parts[i]!, parts[j]!)) continue;
      const a = rings[i]!;
      const b = rings[j]!;
      let collides = a.some((ra) => b.some((rb) => ringsCross(ra, rb)));
      // No crossing still leaves one part nested inside the other.
      if (!collides && a.length && b.length) {
        collides = insideRing(a[0]![0]!, b[0]!) || insideRing(b[0]![0]!, a[0]!);
      }
      if (collides) bad.push(`${parts[i]!.name} ∩ ${parts[j]!.name}`);
    }
  }
  return bad;
}

describe.each(generators.map((g) => g.meta))('$id', (meta) => {
  const defaults = defaultsFor(meta.id);

  it('renders at its defaults', () => {
    const d = renderPreview(meta.id, defaults);
    expect(d.stats.partCount).toBeGreaterThan(0);
    expect(d.layers.cut.length).toBeGreaterThan(0);
    expect(d.bbox.width).toBeGreaterThan(0);
    expect(d.bbox.height).toBeGreaterThan(0);
  });

  it('lays out parts without overlapping them', () => {
    expect(overlappingPairs(buildDrawing(meta.id, defaults).parts)).toEqual([]);
  });

  it('names every part it produces', () => {
    for (const p of renderPreview(meta.id, defaults).parts) {
      expect(p.name).not.toBe('');
      expect(p.name).not.toBe('default');
    }
  });

  it('survives the extremes of every numeric parameter', () => {
    for (const spec of paramsFor(meta.id)) {
      if (spec.kind !== 'length' && spec.kind !== 'number') continue;
      for (const v of [spec.min, spec.max]) {
        const values: ParamValues = { ...defaults, [spec.key]: v };
        expect(
          () => renderPreview(meta.id, values),
          `${meta.id} with ${spec.key}=${v}`,
        ).not.toThrow();
      }
    }
  });

  it('accepts every edge type it offers', () => {
    for (const spec of paramsFor(meta.id)) {
      if (spec.kind !== 'edge') continue;
      for (const c of spec.choices) {
        const values: ParamValues = { ...defaults, [spec.key]: c };
        expect(
          () => renderPreview(meta.id, values),
          `${meta.id} with ${spec.key}="${c}"`,
        ).not.toThrow();
      }
    }
  });

  it('accepts every option of every enum it offers', () => {
    for (const spec of paramsFor(meta.id)) {
      if (spec.kind !== 'enum') continue;
      for (const c of spec.choices) {
        const values: ParamValues = { ...defaults, [spec.key]: c.value };
        expect(
          () => renderPreview(meta.id, values),
          `${meta.id} with ${spec.key}="${c.value}"`,
        ).not.toThrow();
      }
    }
  });
});


describe.each(VARIANTS)('$id with $name', ({ id, values }) => {
  const v = { ...defaultsFor(id), ...values };

  it('lays out parts without overlapping them', () => {
    expect(overlappingPairs(buildDrawing(id, v).parts)).toEqual([]);
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
