/**
 * Geometry parity with the original boxes.py.
 *
 * This is the test that matters. If a coordinate drifts here, the kerf
 * compensation or the finger arithmetic is wrong, and wrong there means parts
 * that will not press-fit — a failure you would only discover after cutting.
 */
import { describe, expect, it } from 'vitest';
import { renderBox } from '~/lib/render';
import { toBoxesConfig } from '~/lib/params/common';
import { defaultsFor, getGenerator } from '~/lib/generators/registry';
import { comparePaths, loadGolden, pathDataLength } from './helpers/golden';
import { GOLDEN_CASES } from './golden.cases';

describe.each(GOLDEN_CASES)('$name matches boxes.py', ({ name, generator, params }) => {
  // Start from the generator's own defaults, exactly as the UI does.
  const values = { ...defaultsFor(generator), reference: 0, labels: false, ...params };
  const drawing = renderBox(getGenerator(generator).create(values, toBoxesConfig(values)));
  const golden = loadGolden(name);
  const actual = drawing.parts.flatMap((p) => p.paths.map((x) => x.d));

  it('produces the same sheet size', () => {
    expect(drawing.stats.widthMm).toBeCloseTo(golden.width, 2);
    expect(drawing.stats.heightMm).toBeCloseTo(golden.height, 2);
  });

  it('produces the same number of paths', () => {
    expect(actual.length).toBe(golden.paths.length);
  });

  it('produces the same coordinates', () => {
    for (let i = 0; i < Math.min(actual.length, golden.paths.length); i++) {
      const mismatch = comparePaths(golden.paths[i]!, actual[i]!);
      expect(
        mismatch,
        mismatch
          ? `path ${i} token ${mismatch.index}: expected ${mismatch.expected}, got ${mismatch.actual}`
          : '',
      ).toBeNull();
    }
  });

  it('produces the same total cut length', () => {
    const expectedLength = golden.paths.reduce((a, d) => a + pathDataLength(d), 0);
    const actualLength = actual.reduce((a, d) => a + pathDataLength(d), 0);
    expect(actualLength).toBeCloseTo(expectedLength, 1);
  });
});
