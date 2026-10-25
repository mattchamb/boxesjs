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
import type { ParamValues } from '~/lib/params/schema';

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

/**
 * Options that change the part list but are off at defaults, so the checks
 * above never see them. Add a variant when a generator gains such an option,
 * especially one with no boxes.py golden behind it.
 */
const VARIANTS: { id: string; name: string; values: ParamValues }[] = [
  { id: 'storageshelf', name: 'wedged tenons', values: { assembly: 'wedges', x: 200, sh: '120*3', sy: '150*2' } },
  { id: 'rectangularwall', name: 'wedged tenons', values: { bottom_edge: 'w', right_edge: 'W', top_edge: 'w', left_edge: 'W' } },
  { id: 'displayshelf', name: 'wedged tenons', values: { assembly: 'wedges', include_back: true, include_front: true, include_bottom: true } },
  { id: 'displayshelf', name: 'wedged tenons, sloped', values: { assembly: 'wedges', slope_top: true, include_back: true, include_front: true, include_bottom: true } },
  { id: 'storagerack', name: 'wedged tenons', values: { assembly: 'wedges' } },
  { id: 'storagerack', name: 'wedged tenons, open bottom, stackable top', values: { assembly: 'wedges', bottom_edge: 'e', top_edge: 'S' } },
  { id: 'paintstorage', name: 'wedged tenons', values: { assembly: 'wedges', canheight: 100, additional_bottom: true, additional_top: true } },
  { id: 'wallhopper', name: 'wedged tenons', values: { assembly: 'wedges', sx: '60*2', walltype: 'french cleat' } },
  { id: 'wallhopper', name: 'wedged tenons, no label', values: { assembly: 'wedges', sx: '60*3', label: false } },
  { id: 'closedbox', name: 'bolted', values: { assembly: 'bolts' } },
  { id: 'closedbox', name: 'bolted, M5', values: { assembly: 'bolts', bolt_size: 'M5', bolt_length: 25, x: 200, y: 160, h: 120 } },
  { id: 'universalbox', name: 'bolted', values: { assembly: 'bolts' } },
  { id: 'universalbox', name: 'bolted, finger-jointed bottom', values: { assembly: 'bolts', bottom_edge: 'F', vertical_edges: 'finger holes' } },
  { id: 'rectangularwall', name: 'bolted', values: { bolts: 2, bottom_edge: 'f', right_edge: 'F', top_edge: 'h', left_edge: 'f' } },
  { id: 'storageshelf', name: 'bolted', values: { assembly: 'bolts', thickness: 6, x: 200, sh: '150*3', sy: '150*2', top_edge: 'f' } },
  { id: 'storagerack', name: 'bolted', values: { assembly: 'bolts', thickness: 6, bottom_edge: 'F' } },
  { id: 'storagerack', name: 'bolted, open bottom', values: { assembly: 'bolts', thickness: 6, bottom_edge: 'e' } },
  { id: 'displayshelf', name: 'bolted', values: { assembly: 'bolts', thickness: 6, include_back: true, include_front: true, include_bottom: true } },
  { id: 'displayshelf', name: 'bolted, sloped', values: { assembly: 'bolts', thickness: 6, slope_top: true, include_back: true, include_bottom: true } },
];

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
