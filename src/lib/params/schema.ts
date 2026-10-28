/**
 * Declarative parameter schema.
 *
 * boxes.py derives its web form from argparse, which only knows a name, a type
 * and a help string — so every knob renders as an identical text box and the
 * ten finger-joint tuning values sit at the same visual level as "width".
 *
 * Here each parameter also declares what kind of thing it is and which group it
 * belongs to, which is what lets the UI pick a real control and hide the fiddly
 * settings until they are wanted.
 */

export type ParamGroup = 'dimensions' | 'material' | 'joints' | 'top' | 'layout' | 'advanced';

export const GROUP_LABELS: Record<ParamGroup, string> = {
  dimensions: 'Dimensions',
  material: 'Material',
  joints: 'Joints',
  top: 'Top & Lid',
  // Shown in the sheet bar above the preview rather than the panel.
  layout: 'Sheet layout',
  advanced: 'Advanced',
};

/**
 * Groups shown expanded by default; the rest start collapsed. Joints is open
 * because how the piece is held together is a first decision, not tuning; the
 * tuning inside it sits in collapsed sections.
 */
export const GROUPS_OPEN_BY_DEFAULT: ParamGroup[] = ['dimensions', 'material', 'joints'];

interface ParamBase {
  key: string;
  label: string;
  help?: string;
  group: ParamGroup;
  /**
   * A collapsed sub-section of the group, for tuning that belongs to one kind
   * of joint ("Finger joints", "Wedged tenons"). Unsectioned parameters come
   * first, so the decisions sit above the fine print.
   */
  section?: string;
  /**
   * Whether the control applies to the current values. Hidden parameters keep
   * their value, so switching back restores it; this only declutters.
   */
  showIf?: (values: ParamValues) => boolean;
}

export interface LengthParam extends ParamBase {
  kind: 'length';
  default: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

export interface NumberParam extends ParamBase {
  kind: 'number';
  default: number;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  unit?: string;
}

export interface BoolParam extends ParamBase {
  kind: 'bool';
  default: boolean;
}

export interface SectionsParam extends ParamBase {
  kind: 'sections';
  default: string;
  /** Label for one entry, e.g. "compartment". */
  itemLabel?: string;
}

export interface EdgeParam extends ParamBase {
  kind: 'edge';
  /** Allowed edge characters, in menu order. */
  choices: string;
  default: string;
}

export interface EnumParam extends ParamBase {
  kind: 'enum';
  /** `help` on a choice is shown while that choice is selected. */
  choices: { value: string; label: string; help?: string }[];
  default: string;
}

export interface TextParam extends ParamBase {
  kind: 'text';
  default: string;
  multiline?: boolean;
  placeholder?: string;
}

export type ParamSpec =
  | LengthParam
  | NumberParam
  | BoolParam
  | SectionsParam
  | EdgeParam
  | EnumParam
  | TextParam;

export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

/** The parameters that apply to `values`, in their declared order. */
export function visibleParams(specs: ParamSpec[], values: ParamValues): ParamSpec[] {
  return specs.filter((s) => !s.showIf || s.showIf(values));
}

/**
 * Whether any edge choice in `values` is one of `chars`. A generator with no
 * edge choices at all always uses whatever these settings tune, so that counts
 * as yes.
 */
export function anyEdgeIn(values: ParamValues, chars: string): boolean {
  const edges = Object.entries(values).filter(([k, v]) => k.endsWith('_edge') && typeof v === 'string');
  return edges.length === 0 || edges.some(([, v]) => chars.includes(v as string));
}

export function defaultValues(specs: ParamSpec[]): ParamValues {
  const out: ParamValues = {};
  for (const s of specs) out[s.key] = s.default;
  return out;
}

/**
 * Human-facing names for edge characters. boxes.py makes you choose between
 * "F", "f" and "h" in a dropdown; these are what the picker shows instead.
 */
export const EDGE_INFO: Record<string, { name: string; description: string }> = {
  e: { name: 'Straight', description: 'Plain edge, nothing added' },
  E: { name: 'Straight, outset', description: 'Straight, offset outward by one thickness' },
  f: { name: 'Finger joint', description: 'Protruding fingers' },
  F: { name: 'Finger joint (opposite)', description: 'Matching gaps for an `f` edge' },
  d: { name: 'Dovetail', description: 'Flared tails joining two panels edge to edge' },
  D: { name: 'Dovetail (opposite)', description: 'Sockets for a `d` edge' },
  w: { name: 'Wedged tenons', description: 'Through-tenons locked by wedges; comes apart again' },
  W: { name: 'Wedged tenon holes', description: 'Slots for a `w` edge to pass through' },
  h: { name: 'Finger holes', description: 'Slots for a wall to pass through the panel' },
  s: { name: 'Stackable feet', description: 'Feet plus slots for the bottom panel' },
  S: { name: 'Stackable top', description: 'Recesses that accept the feet of the box above' },
  š: { name: 'Stackable feet only', description: 'Feet without the bottom slots' },
  Š: { name: 'Stackable top + holes', description: 'Recesses with finger slots' },
  g: { name: 'Gripping', description: 'Corrugated edge for grip' },
  z: { name: 'Grooved', description: 'Notches cut into the edge' },
  Z: { name: 'Grooved (opposite)', description: 'Bumps that nest into a `z` edge' },
  t: { name: 'Triangle handle', description: 'Rounded triangular bump with a hole' },
  T: { name: 'Triangle handle + joint', description: 'Triangle handle on a joined edge' },
  G: { name: 'Mounting holes', description: 'Keyholes to hang the box on screws' },
};

export function edgeName(char: string): string {
  return EDGE_INFO[char]?.name ?? char;
}
