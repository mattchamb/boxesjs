/**
 * Helpers for comparing our output against SVGs rendered by the original
 * boxes.py. Regenerate the reference files with `scripts/gen-golden.sh`.
 *
 * We compare geometry, not text: boxes.py writes fixed 3-decimal numbers while
 * we trim trailing zeros, so the files differ byte-for-byte while describing
 * exactly the same cut. Tokenising both sides removes that difference and
 * leaves a comparison that actually means something.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface GoldenSVG {
  width: number;
  height: number;
  /** Path `d` strings in document order. */
  paths: string[];
}

export function loadGolden(name: string): GoldenSVG {
  const path = fileURLToPath(new URL(`../golden/${name}.svg`, import.meta.url));
  const svg = readFileSync(path, 'utf8');

  const viewBox = /viewBox="([^"]*)"/.exec(svg);
  if (!viewBox) throw new Error(`No viewBox in golden file ${name}`);
  const [, , w, h] = viewBox[1]!.trim().split(/\s+/).map(Number) as [number, number, number, number];

  const paths: string[] = [];
  const re = /<path\s+d="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) paths.push(m[1]!);

  return { width: w, height: h, paths };
}

export type Token = string | number;

/** Split path data into commands and numbers. */
export function tokenize(d: string): Token[] {
  const out: Token[] = [];
  for (const raw of d.trim().split(/[\s,]+/)) {
    if (!raw) continue;
    if (/^[A-Za-z]$/.test(raw)) out.push(raw);
    else {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Bad token in path data: ${raw}`);
      out.push(n);
    }
  }
  return out;
}

export interface Mismatch {
  index: number;
  expected: Token;
  actual: Token;
}

/** Compare two path data strings, allowing `tol` mm of numeric drift. */
export function comparePaths(expected: string, actual: string, tol = 0.01): Mismatch | null {
  const a = tokenize(expected);
  const b = tokenize(actual);

  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined || y === undefined) {
      return { index: i, expected: x ?? '<end>', actual: y ?? '<end>' };
    }
    if (typeof x === 'string' || typeof y === 'string') {
      if (x !== y) return { index: i, expected: x, actual: y };
    } else if (Math.abs(x - y) > tol) {
      return { index: i, expected: x, actual: y };
    }
  }
  return null;
}

/** Total length of the straight and curved segments in a path. */
export function pathDataLength(d: string): number {
  const t = tokenize(d);
  let total = 0;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;

  const num = () => t[i++] as number;

  while (i < t.length) {
    const c = t[i++] as string;
    switch (c) {
      case 'M': {
        x = num(); y = num(); sx = x; sy = y;
        break;
      }
      case 'L': {
        const nx = num(); const ny = num();
        total += Math.hypot(nx - x, ny - y); x = nx; y = ny;
        break;
      }
      case 'H': { const nx = num(); total += Math.abs(nx - x); x = nx; break; }
      case 'V': { const ny = num(); total += Math.abs(ny - y); y = ny; break; }
      case 'C': {
        const x1 = num(); const y1 = num();
        const x2 = num(); const y2 = num();
        const nx = num(); const ny = num();
        const chord = Math.hypot(nx - x, ny - y);
        const poly =
          Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(nx - x2, ny - y2);
        total += (chord + poly) / 2;
        x = nx; y = ny;
        break;
      }
      case 'Z': {
        total += Math.hypot(sx - x, sy - y); x = sx; y = sy;
        break;
      }
      default:
        throw new Error(`Unsupported path command in golden data: ${c}`);
    }
  }
  return total;
}
