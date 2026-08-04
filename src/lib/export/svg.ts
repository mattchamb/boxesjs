/**
 * SVG output.
 *
 * Written for import rather than for viewing: real millimetre dimensions with a
 * 1:1 viewBox so nothing rescales on the way in, one group per layer with a
 * stable id, and hairline strokes in the layer colours LightBurn maps to its
 * own. The Inkscape RDF metadata boxes.py emits is dropped — it is noise for
 * this purpose.
 */
import { LAYERS, LAYER_INFO, rgbToCSS, type Layer } from '../geom/colors';
import type { Drawing } from '../render';

export interface SVGOptions {
  /** Layers to include; defaults to everything with geometry. */
  layers?: Layer[];
  /** Link back to the configuration that produced this file. */
  permalink?: string;
  title?: string;
  /** Stroke width in mm. Hairline keeps it unambiguous that this is a cut. */
  strokeWidth?: number;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

export function toSVG(drawing: Drawing, options: SVGOptions = {}): string {
  const { permalink, title = 'boxesjs', strokeWidth = 0.1 } = options;
  const active = options.layers ?? LAYERS.filter((l) => drawing.layers[l].length > 0);

  const w = fmt(drawing.bbox.width);
  const h = fmt(drawing.bbox.height);

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');

  const notes = [`${title} — created with boxesjs`, permalink ? `Settings: ${permalink}` : null]
    .filter(Boolean)
    .join('\n');
  // Angle brackets are stripped rather than escaped: entities are not expanded
  // inside a comment, and "--" would end it early.
  out.push(`<!--\n${notes.replace(/[<>]/g, '').replace(/--/g, '- -')}\n-->`);

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ` +
      `width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`,
  );
  out.push(`<title>${esc(title)}</title>`);

  for (const layer of active) {
    const info = LAYER_INFO[layer];
    const d = drawing.layers[layer];
    const texts = drawing.parts.flatMap((p) => p.texts.filter((t) => t.layer === layer));
    if (!d && texts.length === 0) continue;

    out.push(
      `<g id="${info.id}" inkscape:label="${esc(info.name)}" ` +
        `fill="none" stroke="${rgbToCSS(info.rgb)}" stroke-width="${strokeWidth}" ` +
        `stroke-linecap="round" stroke-linejoin="round">`,
    );
    if (d) out.push(`<path d="${d}"/>`);

    for (const t of texts) {
      const m = t.matrix.toSVGMatrix().map(fmt).join(' ');
      const anchor = t.params.align === 'middle' ? 'middle' : t.params.align === 'end' ? 'end' : 'start';
      out.push(
        `<text transform="matrix(${m})" font-size="${fmt(t.params.fs)}" ` +
          `font-family="${esc(t.params.font ?? 'sans-serif')}" ` +
          `text-anchor="${anchor}" dominant-baseline="hanging" ` +
          `fill="${rgbToCSS(info.rgb)}" stroke="none">${esc(t.text)}</text>`,
      );
    }
    out.push('</g>');
  }

  out.push('</svg>');
  return out.join('\n');
}
