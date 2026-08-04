/**
 * The single entry point: parameters in, a `Drawing` out.
 *
 * The preview, the SVG writer and the LightBurn writer all consume this one
 * structure, so geometry is computed exactly once per parameter change.
 */
import type { Boxes, BoxesConfig } from './boxes';
import { LAYERS, layerForRGB, type Layer } from './geom/colors';
import { EPS, pointsEqual, type PathCmd, type TextParams } from './geom/context';
import { Affine } from './geom/affine';

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawingText {
  text: string;
  layer: Layer;
  /** Transform placing the text, already flipped into SVG coordinates. */
  matrix: Affine;
  params: TextParams;
}

export interface DrawingPath {
  layer: Layer;
  /** SVG path data. */
  d: string;
  /** Raw commands, kept so the LightBurn writer can emit native primitives. */
  cmds: PathCmd[];
  closed: boolean;
}

export interface DrawingPart {
  name: string;
  bbox: BBox;
  paths: DrawingPath[];
  texts: DrawingText[];
}

export interface DrawingStats {
  partCount: number;
  widthMm: number;
  heightMm: number;
  /** Total travel of every cutting layer, in mm. */
  cutLengthMm: number;
  /** Per-layer cut length, for time estimates. */
  lengthByLayer: Record<Layer, number>;
}

export interface Drawing {
  parts: DrawingPart[];
  /** Merged path data per layer — the preview binds these straight to <path d>. */
  layers: Record<Layer, string>;
  bbox: BBox;
  stats: DrawingStats;
  warnings: { param?: string; message: string }[];
}

const emptyLayerRecord = <T>(v: () => T): Record<Layer, T> =>
  Object.fromEntries(LAYERS.map((l) => [l, v()])) as Record<Layer, T>;

function fmt(n: number): string {
  // 3 decimals is ~1 micron; beyond that is noise and just inflates the file.
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/** Serialise commands to SVG path data, matching boxes.py's output shape. */
function toPathData(cmds: PathCmd[]): { d: string; closed: boolean } {
  const out: string[] = [];
  let x = 0;
  let y = 0;
  let start: PathCmd | null = null;
  let last: PathCmd | null = null;
  let closed = false;

  for (const c of cmds) {
    const x0 = x;
    const y0 = y;
    x = c.x;
    y = c.y;

    if (c.c === 'M') {
      if (start && last && pointsEqual(start.x, start.y, last.x, last.y)) {
        out.push('Z');
      }
      start = c;
      out.push(`M ${fmt(x)} ${fmt(y)}`);
    } else if (c.c === 'L') {
      if (Math.abs(x - x0) < EPS) out.push(`V ${fmt(y)}`);
      else if (Math.abs(y - y0) < EPS) out.push(`H ${fmt(x)}`);
      else out.push(`L ${fmt(x)} ${fmt(y)}`);
    } else if (c.c === 'C') {
      out.push(`C ${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x2)} ${fmt(c.y2)} ${fmt(x)} ${fmt(y)}`);
    }
    last = c;
  }

  if (start && last && start !== last && pointsEqual(start.x, start.y, last.x, last.y)) {
    out.push('Z');
    closed = true;
  }
  // A trailing move-to draws nothing.
  if (out.length && out[out.length - 1]!.startsWith('M')) out.pop();

  return { d: out.join(' '), closed };
}

/** Cheap but stable cubic length estimate: mean of chord and control polygon. */
function cubicLength(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
): number {
  const chord = Math.hypot(x3 - x0, y3 - y0);
  const poly =
    Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
  return (chord + poly) / 2;
}

function pathLength(cmds: PathCmd[]): number {
  let total = 0;
  let x = 0;
  let y = 0;
  for (const c of cmds) {
    if (c.c === 'L') total += Math.hypot(c.x - x, c.y - y);
    else if (c.c === 'C') total += cubicLength(x, y, c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    x = c.x;
    y = c.y;
  }
  return total;
}

/**
 * Run a generator and collect its output.
 * `box` must already be constructed with its parameters applied.
 */
export function renderBox(box: Boxes): Drawing {
  box.open();
  box.render();
  const surface = box.close();

  // SVG and LightBurn both want y pointing down.
  surface.invertY = true;
  const page = surface.adjustCoordinates();

  const parts: DrawingPart[] = [];
  const layerChunks = emptyLayerRecord<string[]>(() => []);
  const lengthByLayer = emptyLayerRecord<number>(() => 0);

  for (const part of surface.parts) {
    if (part.pathes.length === 0) continue;

    const paths: DrawingPath[] = [];
    const texts: DrawingText[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of part.pathes) {
      p.fasterEdges(box.innerCorners);
      const layer = layerForRGB(p.params.rgb);

      const geometry = p.path.filter((c) => c.c !== 'T');
      for (const c of p.path) {
        if (c.c === 'T') {
          texts.push({ text: c.text, layer: layerForRGB(c.params.rgb), matrix: c.m, params: c.params });
        }
      }

      // The box covers what is drawn, not the label. boxes.py folds the text
      // extents in when it sizes the sheet, and we match that for the page, but
      // a part's own box is used to hover and to detect collisions — letting a
      // name that overhangs its part count as area would report neighbouring
      // parts as overlapping when only their labels do.
      // A trailing move-to draws nothing, so it does not count either.
      const drawn =
        geometry.length && geometry[geometry.length - 1]!.c === 'M'
          ? geometry.slice(0, -1)
          : geometry;
      for (const c of drawn) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x);
        maxY = Math.max(maxY, c.y);
      }

      if (geometry.length === 0) continue;

      const { d, closed } = toPathData(geometry);
      if (!d) continue;

      paths.push({ layer, d, cmds: geometry, closed });
      layerChunks[layer].push(d);
      lengthByLayer[layer] += pathLength(geometry);
    }

    if (paths.length === 0 && texts.length === 0) continue;

    parts.push({
      name: part.name,
      bbox: {
        x: Number.isFinite(minX) ? minX : 0,
        y: Number.isFinite(minY) ? minY : 0,
        width: Number.isFinite(minX) ? maxX - minX : 0,
        height: Number.isFinite(minY) ? maxY - minY : 0,
      },
      paths,
      texts,
    });
  }

  const layers = emptyLayerRecord<string>(() => '');
  for (const l of LAYERS) layers[l] = layerChunks[l].join(' ');

  const cutLengthMm = lengthByLayer.cut + lengthByLayer.inner;

  return {
    parts,
    layers,
    bbox: { x: 0, y: 0, width: page.width, height: page.height },
    stats: {
      partCount: parts.length,
      widthMm: page.width,
      heightMm: page.height,
      cutLengthMm,
      lengthByLayer,
    },
    warnings: box.warnings,
  };
}

export type { BoxesConfig };
