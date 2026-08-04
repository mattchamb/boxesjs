/**
 * Colours double as layer assignment: the engine draws in a colour, and every
 * exporter turns that colour into a layer. This is how boxes.py works and it is
 * why a plain SVG opened in LightBurn already splits into sensible layers.
 */
export type RGB = readonly [number, number, number];

export const Color = {
  BLACK: [0, 0, 0] as RGB,
  BLUE: [0, 0, 1] as RGB,
  GREEN: [0, 1, 0] as RGB,
  RED: [1, 0, 0] as RGB,
  CYAN: [0, 1, 1] as RGB,
  YELLOW: [1, 1, 0] as RGB,
  MAGENTA: [1, 0, 1] as RGB,
  WHITE: [1, 1, 1] as RGB,
} as const;

/** Semantic aliases used throughout the generators. */
export const OUTER_CUT = Color.BLACK;
export const INNER_CUT = Color.BLUE;
export const ANNOTATIONS = Color.RED;
export const ETCHING = Color.GREEN;
export const ETCHING_DEEP = Color.CYAN;

/**
 * Layers, in the order they should be run on the machine: engraving first while
 * the sheet is still held together, inner cuts next, and the outer perimeter
 * last so parts do not shift mid-job.
 */
export const LAYERS = ['engrave', 'score', 'inner', 'cut', 'annotate'] as const;
export type Layer = (typeof LAYERS)[number];

export interface LayerInfo {
  id: Layer;
  /** Shown in the UI and written as the LightBurn layer name. */
  name: string;
  /** LightBurn cut index. 0-8 are cut layers; 30 is tool layer T1. */
  lightburnIndex: number;
  /** Cut priority within the LightBurn project; lower runs first. */
  priority: number;
  /** Preview / SVG stroke colour. */
  css: string;
  rgb: RGB;
  /** True for the annotation layer, which must never be cut. */
  isTool: boolean;
  description: string;
}

export const LAYER_INFO: Record<Layer, LayerInfo> = {
  engrave: {
    id: 'engrave',
    name: 'Engrave',
    lightburnIndex: 3,
    priority: 0,
    css: 'rgb(0,160,60)',
    rgb: ETCHING,
    isTool: false,
    description: 'Surface marking, no material cut through',
  },
  score: {
    id: 'score',
    name: 'Deep Engrave',
    lightburnIndex: 6,
    priority: 1,
    css: 'rgb(0,170,190)',
    rgb: ETCHING_DEEP,
    isTool: false,
    description: 'Deeper marking, e.g. fold or alignment lines',
  },
  inner: {
    id: 'inner',
    name: 'Inner Cut',
    lightburnIndex: 1,
    priority: 2,
    css: 'rgb(20,90,255)',
    rgb: INNER_CUT,
    isTool: false,
    description: 'Holes and slots inside a part',
  },
  cut: {
    id: 'cut',
    name: 'Outer Cut',
    lightburnIndex: 0,
    priority: 3,
    css: 'rgb(20,20,25)',
    rgb: OUTER_CUT,
    isTool: false,
    description: 'Part outlines, cut last so parts stay put',
  },
  annotate: {
    id: 'annotate',
    name: 'Labels (T1)',
    lightburnIndex: 30,
    priority: 4,
    css: 'rgb(230,70,70)',
    rgb: ANNOTATIONS,
    isTool: true,
    description: 'Part names on a tool layer — never cut or engraved',
  },
};

const EPS = 1e-6;

/** Map a drawing colour onto the layer it belongs to. */
export function layerForRGB(rgb: RGB): Layer {
  for (const layer of LAYERS) {
    const c = LAYER_INFO[layer].rgb;
    if (
      Math.abs(c[0] - rgb[0]) < EPS &&
      Math.abs(c[1] - rgb[1]) < EPS &&
      Math.abs(c[2] - rgb[2]) < EPS
    ) {
      return layer;
    }
  }
  // Anything unrecognised is treated as a cut so it can never be silently lost.
  return 'cut';
}

export function rgbToCSS(rgb: RGB): string {
  return `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`;
}
