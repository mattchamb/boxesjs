import { describe, expect, it } from 'vitest';
import { renderBox } from '~/lib/render';
import { closedBox } from '~/lib/generators/closedbox';
import { toBoxesConfig } from '~/lib/params/common';
import { parseSections, formatSections } from '~/lib/params/sections';
import { Affine } from '~/lib/geom/affine';

function render(values: Record<string, number | string | boolean>) {
  const v = { thickness: 3, burn: 0.1, ...values };
  return renderBox(closedBox.create(v, toBoxesConfig(v)));
}

describe('affine', () => {
  it('composes translation and rotation like the python affine package', () => {
    const m = Affine.translation(10, 5).mul(Affine.rotation(90));
    const [x, y] = m.apply(1, 0);
    expect(x).toBeCloseTo(10, 9);
    expect(y).toBeCloseTo(6, 9);
  });

  it('round-trips a point through scale and inverse scale', () => {
    const m = Affine.scale(2, -2);
    expect(m.apply(3, 4)).toEqual([6, -8]);
  });
});

describe('sections parser', () => {
  it('parses the three forms', () => {
    expect(parseSections('40:40:40')).toEqual([40, 40, 40]);
    expect(parseSections('50*3')).toEqual([50, 50, 50]);
    expect(parseSections('120/3')).toEqual([40, 40, 40]);
  });

  it('mixes forms and separators', () => {
    expect(parseSections('30 60*2 120/3')).toEqual([30, 60, 60, 40, 40, 40]);
  });

  it('round-trips through the compact form', () => {
    expect(formatSections([50, 50, 50])).toBe('50*3');
    expect(formatSections([30, 40, 40])).toBe('30:40*2');
    expect(parseSections(formatSections([25, 25, 60]))).toEqual([25, 25, 60]);
  });
});

describe('ClosedBox', () => {
  it('produces six parts', () => {
    const d = render({ x: 100, y: 80, h: 60, outside: false });
    expect(d.stats.partCount).toBe(6);
    expect(d.parts.map((p) => p.name).sort()).toEqual(
      ['Bottom', 'Top', 'Wall 1', 'Wall 2', 'Wall 3', 'Wall 4'].sort(),
    );
  });

  it('emits geometry only on the cut layer plus labels', () => {
    const d = render({ x: 100, y: 80, h: 60, outside: false });
    expect(d.layers.cut.length).toBeGreaterThan(100);
    // No holes in a plain closed box.
    expect(d.layers.inner).toBe('');
  });

  it('sizes the sheet to hold all six parts with spacing', () => {
    const d = render({ x: 100, y: 80, h: 60, outside: false });
    // Two columns of walls plus padding; comfortably larger than one part.
    expect(d.stats.widthMm).toBeGreaterThan(180);
    expect(d.stats.heightMm).toBeGreaterThan(140);
  });

  it('treats outside measurements as the finished exterior', () => {
    const inner = render({ x: 100, y: 80, h: 60, outside: false });
    const outer = render({ x: 100, y: 80, h: 60, outside: true });
    // Outside mode subtracts two wall thicknesses, so the sheet is smaller.
    expect(outer.stats.widthMm).toBeLessThan(inner.stats.widthMm);
  });

  it('reports a cut length proportional to the box size', () => {
    const small = render({ x: 50, y: 50, h: 50, outside: false });
    const large = render({ x: 100, y: 100, h: 100, outside: false });
    expect(large.stats.cutLengthMm).toBeGreaterThan(small.stats.cutLengthMm);
  });

  it('scales joints with material thickness', () => {
    const thin = render({ x: 100, y: 80, h: 60, outside: false, thickness: 3 });
    const thick = render({ x: 100, y: 80, h: 60, outside: false, thickness: 6 });
    // Thicker material means wider fingers, so fewer of them and less cutting.
    expect(thick.stats.cutLengthMm).toBeLessThan(thin.stats.cutLengthMm);
  });
});
