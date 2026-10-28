import { describe, expect, it } from 'vitest';
import { Affine } from '~/lib/geom/affine';
import { insideRing, segmentsCross, type Pt } from '~/lib/geom/crossings';
import { flatten } from '~/lib/layout/footprint';
import { piecesOf } from '~/lib/layout/pack';
import { buildDrawing, optimiseLayout } from '~/lib/preview';
import { defaultsFor, getGenerator, listGenerators } from '~/lib/generators/registry';
import { toBoxesConfig } from '~/lib/params/common';
import { renderBox, type Drawing, type DrawingPart } from '~/lib/render';
import type { ParamValues } from '~/lib/params/schema';

/** Every subpath of a part that is cut or marked, flattened. */
const linesOf = (p: DrawingPart) =>
  p.paths.filter((x) => x.layer !== 'annotate').flatMap((x) => flatten(x.cmds, Affine.identity(), 0.01));

function toSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Closest approach of two sets of polylines; segments in a grid of buckets so big parts stay quick. */
function clearance(a: Pt[][], b: Pt[][], within: number): number {
  const size = Math.max(within, 5);
  const buckets = new Map<string, [Pt, Pt][]>();
  for (const l of b) {
    for (let i = 1; i < l.length; i++) {
      const s: [Pt, Pt] = [l[i - 1]!, l[i]!];
      const x0 = Math.floor(Math.min(s[0][0], s[1][0]) / size);
      const x1 = Math.floor(Math.max(s[0][0], s[1][0]) / size);
      const y0 = Math.floor(Math.min(s[0][1], s[1][1]) / size);
      const y1 = Math.floor(Math.max(s[0][1], s[1][1]) / size);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const k = `${x},${y}`;
        const bucket = buckets.get(k);
        if (bucket) bucket.push(s);
        else buckets.set(k, [s]);
      }
    }
  }
  let best = Infinity;
  for (const l of a) {
    for (let i = 1; i < l.length; i++) {
      const p = l[i - 1]!;
      const q = l[i]!;
      const x0 = Math.floor((Math.min(p[0], q[0]) - within) / size);
      const x1 = Math.floor((Math.max(p[0], q[0]) + within) / size);
      const y0 = Math.floor((Math.min(p[1], q[1]) - within) / size);
      const y1 = Math.floor((Math.max(p[1], q[1]) + within) / size);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        for (const [c, d] of buckets.get(`${x},${y}`) ?? []) {
          const dist = segmentsCross(p, q, c, d)
            ? 0
            : Math.min(toSegment(p, c, d), toSegment(q, c, d), toSegment(c, p, q), toSegment(d, p, q));
          best = Math.min(best, dist);
        }
      }
    }
  }
  return best;
}

const closedRings = (lines: Pt[][]) =>
  lines.filter((r) => r.length > 3 && Math.hypot(r[0]![0] - r[r.length - 1]![0], r[0]![1] - r[r.length - 1]![1]) < 1e-3);

/**
 * Pieces on each sheet, as polylines: parts drawn as a move of their own
 * (loose holes) are counted with the part they are cut in.
 */
function piecesBySheet(plain: Drawing, packed: Drawing): Pt[][][][] {
  const n = plain.parts.length;
  const owner = new Map<number, number>();
  piecesOf(plain.parts).forEach((p, k) => p.parts.forEach((i) => owner.set(i, k)));
  return packed.sheets!.map((s) => {
    const byPiece = new Map<string, Pt[][]>();
    for (const i of s.parts) {
      const key = `${Math.floor(i / n)}:${owner.get(i % n)}`;
      byPiece.set(key, [...(byPiece.get(key) ?? []), ...linesOf(packed.parts[i]!)]);
    }
    return [...byPiece.values()].filter((l) => l.length > 0);
  });
}

/** Pairs of pieces closer than `gap`, or one inside the other. */
export function clashes(plain: Drawing, packed: Drawing, gap: number): string[] {
  const out: string[] = [];
  piecesBySheet(plain, packed).forEach((pieces, s) => {
    for (let a = 0; a < pieces.length; a++) {
      for (let b = a + 1; b < pieces.length; b++) {
        const pa = pieces[a]!;
        const pb = pieces[b]!;
        const d = clearance(pa, pb, gap);
        if (d < gap - 1e-6) out.push(`sheet ${s + 1}: pieces ${a} and ${b} are ${d.toFixed(3)} mm apart`);
        const inside = (x: Pt[][], y: Pt[][]) => x.some((l) => closedRings(y).some((r) => insideRing(l[0]!, r)));
        if (inside(pa, pb) || inside(pb, pa)) out.push(`sheet ${s + 1}: pieces ${a} and ${b} overlap`);
      }
    }
  });
  return out;
}

const SETTINGS = [
  { edge: 5, gap: 2, copies: 1, step: '90' },
  { edge: 12, gap: 7.5, copies: 2, step: '45' },
];

/**
 * Every generator nested under each of SETTINGS. Vitest runs files, not
 * tests, in parallel, and nesting every generator twice is the slowest thing
 * in the suite, so the cases are dealt round-robin across the
 * nest.generators.*.test.ts files: `shard` of `shards`.
 */
export function describeNestedGenerators(shard: number, shards: number) {
  const cases = listGenerators()
    .flatMap((g) => SETTINGS.map((s) => ({ id: g.meta.id, ...s })))
    .filter((_, i) => i % shards === shard);
  describe.each(cases)('$id × $copies nested onto 300 × 400, $edge mm from the edge, $gap mm apart, turns of $step°', ({ id, edge, gap, copies, step }) => {
    const values: ParamValues = {
      ...defaultsFor(id),
      labels: true,
      reference: 0,
      pack: true,
      sheet_margin: edge,
      pack_gap: gap,
      pack_copies: copies,
      pack_angle_step: step,
    };
    const full = { ...values };
    const plain = renderBox(getGenerator(id).create(full, toBoxesConfig(full)));
    const result = optimiseLayout(id, values, { iterations: 8, seed: 3 })!;
    const packed = buildDrawing(id, values, result);
    const quick = buildDrawing(id, values);
    const n = plain.parts.length;

    it('places every part on exactly one sheet', () => {
      expect(packed.optimised).toBe(true);
      expect(packed.parts).toHaveLength(n * copies);
      const all = packed.sheets!.flatMap((s) => s.parts).sort((a, b) => a - b);
      expect(all).toEqual(packed.parts.map((_, i) => i));
    });

    it('moves parts without changing them', () => {
      packed.parts.forEach((p, i) => {
        const q = plain.parts[i % n]!;
        expect(p.name).toBe(q.name);
        expect(p.paths.map((x) => x.layer)).toEqual(q.paths.map((x) => x.layer));
        expect(p.texts.map((t) => t.text)).toEqual(q.texts.map((t) => t.text));
      });
      // Only the drawing's extent may change: the sheets fill differently.
      expect({ ...packed.stats, widthMm: 0, heightMm: 0 }).toEqual({ ...quick.stats, widthMm: 0, heightMm: 0 });
    });

    it('keeps every cut the gap clear of other parts, and nothing inside another', () => {
      expect(clashes(plain, packed, gap)).toEqual([]);
    });

    it('keeps parts inside their sheet', () => {
      const oversize = new Set(result.arrangement.oversize);
      // One expect per point costs more than the nesting itself; collect strays instead.
      const strays: string[] = [];
      let k = 0;
      for (const [si, s] of packed.sheets!.entries()) {
        const placed = result.arrangement.sheets[si]!;
        k += placed.length;
        if (placed.some((p) => oversize.has(p.piece))) continue;
        for (const i of s.parts) {
          for (const l of linesOf(packed.parts[i]!)) {
            for (const [x, y] of l) {
              if (
                x < s.x + edge - 1e-6 ||
                y < s.y + edge - 1e-6 ||
                x > s.x + s.width - edge + 1e-6 ||
                y > s.y + s.height - edge + 1e-6
              ) {
                strays.push(`sheet ${si + 1}: ${packed.parts[i]!.name} at (${x}, ${y})`);
              }
            }
          }
        }
      }
      expect(strays.slice(0, 5)).toEqual([]);
      expect(k).toBeGreaterThan(0);
    });

    it('never needs more sheets than packing by box', () => {
      expect(packed.sheets!.length).toBeLessThanOrEqual(quick.sheets!.length);
    });

    it('is deterministic for a seed and a count', () => {
      expect(optimiseLayout(id, values, { iterations: 8, seed: 3 })).toEqual(result);
    });
  });
}
