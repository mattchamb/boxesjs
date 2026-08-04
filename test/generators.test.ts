/**
 * Invariants that must hold for every generator, at defaults and under stress.
 * These catch the kind of breakage a golden file cannot: a generator added
 * later that throws, lays parts on top of each other, or produces nothing.
 */
import { describe, expect, it } from 'vitest';
import { defaultsFor, listGenerators, paramsFor } from '~/lib/generators/registry';
import { buildDrawing, renderPreview } from '~/lib/preview';
import type { DrawingPart } from '~/lib/render';
import type { ParamValues } from '~/lib/params/schema';

const generators = listGenerators();

type Pt = [number, number];

/**
 * Flatten a part's outline into polylines. Only the cut layer counts: inner
 * cuts and engraving live inside a part and say nothing about where it sits.
 */
function outline(part: DrawingPart): Pt[][] {
  const rings: Pt[][] = [];
  for (const path of part.paths) {
    if (path.layer !== 'cut') continue;
    let ring: Pt[] = [];
    let x = 0;
    let y = 0;
    for (const c of path.cmds) {
      if (c.c === 'M') {
        if (ring.length > 1) rings.push(ring);
        ring = [[c.x, c.y]];
      } else if (c.c === 'L') {
        ring.push([c.x, c.y]);
      } else if (c.c === 'C') {
        // Sampling the curve is enough: the question is only whether two
        // outlines meet, and boxes.py's arcs are shallow at this scale.
        for (let i = 1; i <= 8; i++) {
          const t = i / 8;
          const u = 1 - t;
          ring.push([
            u * u * u * x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
            u * u * u * y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
          ]);
        }
      }
      x = c.x;
      y = c.y;
    }
    if (ring.length > 1) rings.push(ring);
  }
  return rings;
}

const cross = (o: Pt, p: Pt, q: Pt) =>
  (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
}

function inside(p: Pt, ring: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
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
      let collides = false;
      for (const ra of a) {
        for (let k = 1; k < ra.length && !collides; k++) {
          for (const rb of b) {
            for (let l = 1; l < rb.length; l++) {
              if (segmentsCross(ra[k - 1]!, ra[k]!, rb[l - 1]!, rb[l]!)) {
                collides = true;
                break;
              }
            }
            if (collides) break;
          }
        }
        if (collides) break;
      }
      // No crossing still leaves one part nested inside the other.
      if (!collides && a.length && b.length) {
        collides = inside(a[0]![0]!, b[0]!) || inside(b[0]![0]!, a[0]!);
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
