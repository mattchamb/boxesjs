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

export type ParamGroup = 'dimensions' | 'material' | 'joints' | 'top' | 'advanced';

export const GROUP_LABELS: Record<ParamGroup, string> = {
  dimensions: 'Dimensions',
  material: 'Material',
  joints: 'Joints',
  top: 'Top & Lid',
  advanced: 'Advanced',
};

/** Groups shown expanded by default; the rest start collapsed. */
export const GROUPS_OPEN_BY_DEFAULT: ParamGroup[] = ['dimensions', 'material'];

interface ParamBase {
  key: string;
  label: string;
  help?: string;
  group: ParamGroup;
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
  choices: { value: string; label: string }[];
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
  h: { name: 'Finger holes', description: 'Slots for a wall to pass through the panel' },
  s: { name: 'Stackable feet', description: 'Feet plus slots for the bottom panel' },
  S: { name: 'Stackable top', description: 'Recesses that accept the feet of the box above' },
  š: { name: 'Stackable feet only', description: 'Feet without the bottom slots' },
  Š: { name: 'Stackable top + holes', description: 'Recesses with finger slots' },
  g: { name: 'Gripping', description: 'Corrugated edge for grip' },
  t: { name: 'Triangle handle', description: 'Rounded triangular bump with a hole' },
  T: { name: 'Triangle handle + joint', description: 'Triangle handle on a joined edge' },
  G: { name: 'Mounting holes', description: 'Keyholes to hang the box on screws' },
};

export function edgeName(char: string): string {
  return EDGE_INFO[char]?.name ?? char;
}
