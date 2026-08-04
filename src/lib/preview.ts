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
import { defaultsFor, getGenerator } from './generators/registry';
import { renderBox, type BBox, type Drawing, type DrawingStats } from './render';
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
}

/** Build a drawing from a generator id and a set of form values. */
export function buildDrawing(generator: string, values: ParamValues): Drawing {
  const full = { ...defaultsFor(generator), ...values };
  return renderBox(getGenerator(generator).create(full, toBoxesConfig(full)));
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
  };
}

export function renderPreview(generator: string, values: ParamValues): PreviewData {
  return toPreview(buildDrawing(generator, values));
}
