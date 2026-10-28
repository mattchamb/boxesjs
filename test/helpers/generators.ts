import { describe, expect, it } from 'vitest';
import { insideRing, polylines, ringsCross, type Pt } from '~/lib/geom/crossings';
import { defaultsFor, listGenerators, paramsFor } from '~/lib/generators/registry';
import { buildDrawing, renderPreview } from '~/lib/preview';
import type { DrawingPart } from '~/lib/render';
import type { ParamValues } from '~/lib/params/schema';

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
 * Pairs boxes.py lays out on one shared cut line. UnevenHeightBox's lid walls
 * are the complement of its walls — together they make the box's full
 * height — so each sits on its wall's sloped top edge, and a `z` there nests
 * into the lid's `Z`. Each outline is kerf-compensated on its own, so the two
 * lines cross by the kerf; at `burn` 0 they coincide.
 */
const SHARED_SEAMS: Record<string, string[]> = {
  unevenheightbox: ['front ∩ lid front', 'right ∩ lid right', 'back ∩ lid back', 'left ∩ lid left'],
};

/**
 * Parts that overlap cannot be cut. Bounding boxes are only a prefilter — the
 * finger tabs of two neighbouring parts routinely interleave, so boxes.py packs
 * layouts whose boxes touch at a corner while the outlines stay well apart.
 * What matters is whether the outlines themselves meet.
 */
export function overlappingPairs(parts: DrawingPart[], id: string) {
  const bad: string[] = [];
  const shared = SHARED_SEAMS[id] ?? [];
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
      const pair = `${parts[i]!.name} ∩ ${parts[j]!.name}`;
      if (collides && !shared.includes(pair)) bad.push(pair);
    }
  }
  return bad;
}

/**
 * The per-generator invariants. Vitest runs files, not tests, in parallel, and
 * rendering every parameter's extremes is slow, so the generators are dealt
 * round-robin across the generators.*.test.ts files: `shard` of `shards`.
 */
export function describeGenerators(shard: number, shards: number) {
  const metas = listGenerators()
    .map((g) => g.meta)
    .filter((_, i) => i % shards === shard);
  describe.each(metas)('$id', (meta) => {
    const defaults = defaultsFor(meta.id);

    it('renders at its defaults', () => {
      const d = renderPreview(meta.id, defaults);
      expect(d.stats.partCount).toBeGreaterThan(0);
      expect(d.layers.cut.length).toBeGreaterThan(0);
      expect(d.bbox.width).toBeGreaterThan(0);
      expect(d.bbox.height).toBeGreaterThan(0);
    });

    it('lays out parts without overlapping them', () => {
      expect(overlappingPairs(buildDrawing(meta.id, defaults).parts, meta.id)).toEqual([]);
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
}
