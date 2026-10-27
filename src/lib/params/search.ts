/**
 * Finding a setting by name. A generator can show forty settings across five
 * groups and as many collapsed sections, and the name you remember ("kerf",
 * "play") rarely tells you which group it was filed under.
 */
import { EDGE_INFO, type ParamSpec } from './schema';

/**
 * Whether every word of `query` appears somewhere in what describes `spec`:
 * its label, help, key, section and group, and the names of its choices — so
 * "dovetail" finds the edge pickers that offer one.
 */
export function matchesQuery(spec: ParamSpec, query: string, groupLabel = ''): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const words = [spec.label, spec.help, spec.key, spec.section, groupLabel];
  if ('unit' in spec) words.push(spec.unit);
  if (spec.kind === 'enum') for (const c of spec.choices) words.push(c.label);
  if (spec.kind === 'edge') for (const c of spec.choices) words.push(EDGE_INFO[c]?.name);
  const haystack = words.filter(Boolean).join(' ').toLowerCase();

  return terms.every((t) => haystack.includes(t));
}
