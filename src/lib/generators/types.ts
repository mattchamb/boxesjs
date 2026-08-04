import type { Boxes, BoxesConfig } from '../boxes';
import type { ParamSpec, ParamValue, ParamValues } from '../params/schema';

export interface GeneratorMeta {
  id: string;
  name: string;
  /** Gallery grouping: Box, Tray, Shelf, Part. */
  group: string;
  /** One line, shown on the gallery card. */
  summary: string;
  /** Longer explanation shown on the generator page. */
  description?: string;
}

export interface GeneratorDef {
  meta: GeneratorMeta;
  /** Generator-specific parameters; the common ones are appended by the registry. */
  params: ParamSpec[];
  /**
   * New defaults for shared parameters. Some designs only work with different
   * joint proportions — a tray with many short divider walls needs a smaller
   * edge margin than a big box, or the walls end up with no fingers at all.
   * The user can still change these; only the starting value moves.
   */
  paramDefaults?: Record<string, ParamValue>;
  create(values: ParamValues, config: BoxesConfig): Boxes;
}

/** Small typed readers so generators stay free of casts. */
export function n(values: ParamValues, key: string, fallback = 0): number {
  const v = values[key];
  return typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;
}

export function b(values: ParamValues, key: string, fallback = false): boolean {
  const v = values[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function s(values: ParamValues, key: string, fallback = ''): string {
  const v = values[key];
  return typeof v === 'string' ? v : fallback;
}
