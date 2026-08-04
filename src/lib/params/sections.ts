/**
 * The section mini-language from boxes.py (`argparseSections`).
 *
 *   "40:40:40"  three compartments of 40 mm
 *   "50*3"      three compartments of 50 mm
 *   "120/3"     120 mm split into three equal compartments
 *
 * Separators are whitespace or ":", and the forms can be mixed:
 * "30 60*2 120/3" is 30, 60, 60, 40, 40, 40.
 */

export function parseSections(s: string): number[] {
  const result: number[] = [];

  for (const part of s.split(/[\s:]+/).filter(Boolean)) {
    let m = /^(\d+(?:\.\d+)?)\/(\d+)$/.exec(part);
    if (m) {
      const n = parseInt(m[2]!, 10);
      if (n > 0) {
        const each = parseFloat(m[1]!) / n;
        for (let i = 0; i < n; i++) result.push(each);
      }
      continue;
    }

    m = /^(\d+(?:\.\d+)?)\*(\d+)$/.exec(part);
    if (m) {
      const n = parseInt(m[2]!, 10);
      const each = parseFloat(m[1]!);
      for (let i = 0; i < n; i++) result.push(each);
      continue;
    }

    const v = Number(part);
    if (!Number.isFinite(v)) {
      throw new Error(`Cannot understand section "${part}" in "${s}"`);
    }
    result.push(v);
  }

  if (result.length === 0) result.push(0.0);
  return result;
}

/** Render a section list back to the compact form, collapsing equal runs. */
export function formatSections(values: number[]): string {
  if (values.length === 0) return '0';

  const parts: string[] = [];
  let i = 0;
  while (i < values.length) {
    let j = i;
    while (j < values.length && Math.abs(values[j]! - values[i]!) < 1e-9) j++;
    const count = j - i;
    const v = round(values[i]!);
    parts.push(count > 1 ? `${v}*${count}` : `${v}`);
    i = j;
  }
  return parts.join(':');
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
