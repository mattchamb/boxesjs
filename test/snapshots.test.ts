/**
 * The port's own geometry, pinned against itself.
 *
 * Wedged tenons and chosen bolts have no boxes.py output to compare against,
 * so the golden test never sees them and the invariant tests only check that
 * they hang together. When a generator is re-translated after an upstream
 * change, that leaves its wedged and bolted parts free to move with every test
 * green. These snapshots make such a move show up as a diff to review.
 *
 * Each snapshot is an SVG, one group per part and one path per line, so it
 * opens in a browser and diffs part by part. After a deliberate change, run
 * `npx vitest run test/snapshots.test.ts -u` and review the diff before
 * committing it.
 */
import { describe, expect, it } from 'vitest';
import { LAYER_INFO, rgbToCSS } from '~/lib/geom/colors';
import { buildDrawing } from '~/lib/preview';
import type { Drawing } from '~/lib/render';
import { VARIANTS } from './variants';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

function snapshotSVG(drawing: Drawing): string {
  const [x, y, width, height] = [drawing.bbox.x, drawing.bbox.y, drawing.bbox.width, drawing.bbox.height].map(fmt);
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" ` +
      `width="${width}mm" height="${height}mm" fill="none" stroke-width="0.2">`,
  ];
  // Warnings are part of the behaviour: a variant that starts warning has changed.
  for (const w of drawing.warnings) out.push(`<!-- warning ${w.param ?? ''}: ${esc(w.message)} -->`);
  for (const part of drawing.parts) {
    out.push(`<g id="${esc(part.name)}">`);
    for (const p of part.paths) {
      out.push(`<path stroke="${rgbToCSS(LAYER_INFO[p.layer].rgb)}" d="${p.d}"/>`);
    }
    out.push('</g>');
  }
  out.push('</svg>', '');
  return out.join('\n');
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

describe.each(VARIANTS)('$id with $name', ({ id, name, values }) => {
  it('draws what it drew before', async () => {
    const drawing = buildDrawing(id, { ...values, labels: false, reference: 0 });
    await expect(snapshotSVG(drawing)).toMatchFileSnapshot(`snapshots/${id}-${slug(name)}.svg`);
  });
});
