/**
 * The parameter sets compared against boxes.py.
 *
 * The list itself lives in `golden.cases.json` so `scripts/gen-golden.py` can
 * read it too — adding a case there is the only step needed to cover new
 * geometry on both sides.
 */
import cases from './golden.cases.json';

export interface GoldenCase {
  /** Golden file basename, and the vitest describe title. */
  name: string;
  /** Generator id in our registry. */
  generator: string;
  /** Class name in boxes.py, used by the generation script. */
  pythonClass: string;
  /** Module name, when it differs from the lowercased class name. */
  pythonModule?: string;
  params: Record<string, number | string | boolean>;
}

export const GOLDEN_CASES: GoldenCase[] = cases as unknown as GoldenCase[];
