/**
 * The preview payload and the code that produces it.
 *
 * Only what the preview actually paints crosses the worker boundary: one merged
 * path string per layer, plus a bounding box per part for hover. Merging is the
 * point — a complex tray is thousands of separate paths, and binding them as
 * five strings means a parameter change is five `setAttribute` calls instead of
 * rebuilding thousands of DOM nodes.
 */
import { LAYERS, type Layer } from './geom/colors';
import { toBoxesConfig } from './params/common';
import { defaultsFor, getGenerator, paramsFor } from './generators/registry';
import { bestCopies, packDrawing, type CopiesSuggestion, type PackOptions } from './layout/pack';
import { renderBox, type BBox, type Drawing, type DrawingStats, type Sheet } from './render';
import type { ParamValues } from './params/schema';

export interface PreviewPart {
  name: string;
  bbox: BBox;
}

/** Plain data only — this crosses a worker boundary, so no class instances. */
export interface PreviewText {
  text: string;
  layer: Layer;
  /** SVG `matrix(...)` values. */
  matrix: [number, number, number, number, number, number];
  size: number;
  anchor: 'start' | 'middle' | 'end';
}

export interface PreviewData {
  layers: Record<Layer, string>;
  parts: PreviewPart[];
  texts: PreviewText[];
  bbox: BBox;
  stats: DrawingStats;
  warnings: { param?: string; message: string }[];
  sheets?: Sheet[];
}

/**
 * Build a drawing from a generator id and a set of form values, packed onto
 * sheets when that is asked for, so the preview and every export agree.
 */
export function buildDrawing(generator: string, values: ParamValues): Drawing {
  const full = { ...defaultsFor(generator), ...values };
  const drawing = renderBox(getGenerator(generator).create(full, toBoxesConfig(full)));
  return full['pack'] === true ? packDrawing(drawing, packOptions(full)) : drawing;
}

function packOptions(full: ParamValues): PackOptions {
  const num = (k: string) => Number(full[k]);
  return {
    sheetWidth: num('sheet_width'),
    sheetHeight: num('sheet_height'),
    margin: num('sheet_margin'),
    gap: num('pack_gap'),
    rotate: full['pack_rotate'] !== false,
    copies: num('pack_copies'),
  };
}

/**
 * The copy count that wastes the least stock, when it beats the one asked
 * for; null otherwise, and whenever packing is off. Searches as far as the
 * Copies control goes.
 */
export function suggestCopies(generator: string, values: ParamValues): CopiesSuggestion | null {
  const full = { ...defaultsFor(generator), ...values };
  if (full['pack'] !== true) return null;
  const spec = paramsFor(generator).find((s) => s.key === 'pack_copies');
  const max = spec && 'max' in spec ? spec.max : 1;
  const drawing = renderBox(getGenerator(generator).create(full, toBoxesConfig(full)));
  return bestCopies(drawing, packOptions(full), max);
}

export function toPreview(drawing: Drawing): PreviewData {
  const layers = Object.fromEntries(
    LAYERS.map((l) => [l, drawing.layers[l]]),
  ) as Record<Layer, string>;

  const texts: PreviewText[] = drawing.parts.flatMap((p) =>
    p.texts.map((t) => ({
      text: t.text,
      layer: t.layer,
      matrix: t.matrix.toSVGMatrix(),
      size: t.params.fs,
      anchor:
        t.params.align === 'middle' ? ('middle' as const)
        : t.params.align === 'end' ? ('end' as const)
        : ('start' as const),
    })),
  );

  return {
    layers,
    parts: drawing.parts.map((p) => ({ name: p.name, bbox: p.bbox })),
    texts,
    bbox: drawing.bbox,
    stats: drawing.stats,
    warnings: drawing.warnings,
    ...(drawing.sheets ? { sheets: drawing.sheets } : {}),
  };
}

export function renderPreview(generator: string, values: ParamValues): PreviewData {
  return toPreview(buildDrawing(generator, values));
}
