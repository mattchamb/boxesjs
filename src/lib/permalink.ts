/**
 * Parameters in the URL hash, so a configuration can be shared or bookmarked.
 *
 * Only values that differ from the generator's defaults are written, which keeps
 * links short and means a link stays meaningful if a default is ever revised.
 */
import { defaultsFor } from './generators/registry';
import type { ParamValue, ParamValues } from './params/schema';

function encodeValue(v: ParamValue): string {
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}

export function encodeParams(generator: string, values: ParamValues): string {
  const defaults = defaultsFor(generator);
  const parts: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (key in defaults && defaults[key] === value) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(encodeValue(value))}`);
  }
  return parts.join('&');
}

/** Merge hash parameters over the generator's defaults. */
export function decodeParams(generator: string, hash: string): ParamValues {
  const defaults = defaultsFor(generator);
  const values: ParamValues = { ...defaults };

  const clean = hash.replace(/^#/, '');
  if (!clean) return values;

  for (const pair of clean.split('&')) {
    if (!pair) continue;
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = decodeURIComponent(pair.slice(0, idx));
    const raw = decodeURIComponent(pair.slice(idx + 1));
    if (!(key in defaults)) continue;

    // The default's type tells us how to read the value back.
    const d = defaults[key];
    if (typeof d === 'boolean') values[key] = raw === '1' || raw === 'true';
    else if (typeof d === 'number') {
      const n = Number(raw);
      if (Number.isFinite(n)) values[key] = n;
    } else values[key] = raw;
  }
  return values;
}

export function permalinkFor(generator: string, values: ParamValues, origin?: string): string {
  const base =
    origin ?? (typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '');
  const q = encodeParams(generator, values);
  return q ? `${base}#${q}` : base;
}
