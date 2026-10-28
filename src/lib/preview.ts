/**
 * The preview payload and the code that produces it.
 *
 * Only what the preview actually paints crosses the worker boundary: one merged
 * path string per layer, plus a bounding box per part for hover. Merging is the
 * point — a complex tray is thousands of separate paths, and binding them as
 * five strings means a parameter change is five `setAttribute` calls instead of
 * rebuilding thousands of DOM nodes.
 */
import type { ChartData } from './chart';
import { LAYERS, type Layer } from './geom/colors';
import { toBoxesConfig } from './params/common';
import { defaultsFor, getGenerator, paramsFor } from './generators/registry';
import { bestLayout, packDrawing, realise, type LayoutSuggestion, type PackOptions } from './layout/pack';
import { layoutKey, nest, type NestOptions, type NestResult } from './layout/nest';
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
  charts?: ChartData[];
  sheets?: Sheet[];
  /** The sheets are laid out by an optimised layout, not MaxRects. */
  optimised?: boolean;
}

/**
 * Build a drawing from a generator id and a set of form values, packed onto
 * sheets when that is asked for, so the preview and every export agree.
 *
 * An optimised layout is used while it still fits: made for this geometry and
 * these sheet settings. Otherwise MaxRects lays the parts out as usual.
 */
export function buildDrawing(generator: string, values: ParamValues, nested?: NestResult | null): Drawing {
  const full = { ...defaultsFor(generator), ...values };
  const drawing = renderBox(getGenerator(generator).create(full, toBoxesConfig(full)));
  if (full['pack'] !== true) return drawing;
  const o = packOptions(full);
  if (nested && nested.key === layoutKey(drawing, o)) return { ...realise(drawing, o, nested.arrangement), optimised: true };
  return packDrawing(drawing, o);
}

/** Nest the parts by their outlines; null when packing is off. Slow: see `nest`. */
export function optimiseLayout(generator: string, values: ParamValues, opts: NestOptions): NestResult | null {
  const full = { ...defaultsFor(generator), ...values };
  if (full['pack'] !== true) return null;
  const drawing = renderBox(getGenerator(generator).create(full, toBoxesConfig(full)));
  return nest(drawing, packOptions(full), opts);
}

function packOptions(full: ParamValues): PackOptions {
  const num = (k: string) => Number(full[k]);
  return {
    sheetWidth: num('sheet_width'),
    sheetHeight: num('sheet_height'),
    margin: num('sheet_margin'),
    gap: num('pack_gap'),
    rotate: full['pack_rotate'] !== false,
    angleStep: Number(full['pack_angle_step'] ?? 90),
    copies: num('pack_copies'),
  };
}

/**
 * The sheet size and copy count that waste the least stock, when they beat
 * what was asked for; null otherwise, and whenever packing is off. Searches as
 * far as the Copies control goes.
 */
export function suggestLayout(generator: string, values: ParamValues): LayoutSuggestion | null {
  const full = { ...defaultsFor(generator), ...values };
  if (full['pack'] !== true) return null;
  const spec = paramsFor(generator).find((s) => s.key === 'pack_copies');
  const max = spec && 'max' in spec ? spec.max : 1;
  const num = (k: string) => Number(full[k]);
  const drawing = renderBox(getGenerator(generator).create(full, toBoxesConfig(full)));
  const panels = full['use_panels'] === true;
  return bestLayout(drawing, packOptions(full), {
    panel: panels ? { width: num('panel_width'), height: num('panel_height') } : undefined,
    bed: panels ? { width: num('bed_width'), height: num('bed_height') } : undefined,
    max,
  });
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
    ...(drawing.charts ? { charts: drawing.charts } : {}),
    ...(drawing.sheets ? { sheets: drawing.sheets } : {}),
    ...(drawing.optimised ? { optimised: true } : {}),
  };
}

export function renderPreview(generator: string, values: ParamValues): PreviewData {
  return toPreview(buildDrawing(generator, values));
}
