import { describe, expect, it } from 'vitest';
import { renderBox } from '~/lib/render';
import { toBoxesConfig } from '~/lib/params/common';
import { defaultsFor, getGenerator } from '~/lib/generators/registry';
import { toSVG } from '~/lib/export/svg';
import { toLBRN2 } from '~/lib/export/lbrn2';
import { BUILTIN_MATERIALS, estimateSeconds, formatDuration } from '~/lib/materials';

function render(id: string, overrides: Record<string, number | string | boolean> = {}) {
  const v = { ...defaultsFor(id), reference: 0, ...overrides };
  return renderBox(getGenerator(id).create(v, toBoxesConfig(v)));
}

const material = BUILTIN_MATERIALS[0]!;

describe('SVG export', () => {
  const drawing = render('closedbox', { x: 100, y: 80, h: 60, outside: false });
  const svg = toSVG(drawing, { title: 'Test box', permalink: 'https://example.test/#abc' });

  it('declares real millimetre dimensions', () => {
    expect(svg).toContain(`width="${Math.round(drawing.bbox.width * 1000) / 1000}mm"`);
    expect(svg).toContain(`height="${Math.round(drawing.bbox.height * 1000) / 1000}mm"`);
  });

  it('uses a 1:1 viewBox so importers do not rescale', () => {
    const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(drawing.bbox.width, 3);
    expect(Number(m![2])).toBeCloseTo(drawing.bbox.height, 3);
  });

  it('puts each layer in its own group', () => {
    expect(svg).toContain('<g id="cut"');
    expect(svg).not.toContain('<g id="inner"'); // a plain closed box has no holes
  });

  it('records the permalink so the file can be traced back', () => {
    expect(svg).toContain('https://example.test/#abc');
  });

  it('escapes markup in the title', () => {
    const nasty = toSVG(drawing, { title: '<script>&"' });
    expect(nasty).toContain('&lt;script&gt;&amp;&quot;');
    expect(nasty).not.toContain('<script>');
  });
});

describe('LightBurn export', () => {
  const drawing = render('typetray', { sx: '50*2', sy: '50*2', h: 60 });
  const lbrn = toLBRN2(drawing, { material, title: 'Tray' });

  it('is a LightBurn project', () => {
    expect(lbrn).toContain('<LightBurnProject');
    expect(lbrn.trimEnd().endsWith('</LightBurnProject>')).toBe(true);
  });

  it('names its layers and orders them so the perimeter is cut last', () => {
    expect(lbrn).toContain('<name Value="Outer Cut"/>');
    expect(lbrn).toContain('<name Value="Inner Cut"/>');

    const inner = lbrn.indexOf('<name Value="Inner Cut"/>');
    const outer = lbrn.indexOf('<name Value="Outer Cut"/>');
    expect(inner).toBeLessThan(outer);
  });

  it('carries speed and power from the material preset', () => {
    expect(lbrn).toContain(`<speed Value="${material.layers.cut.speed}"/>`);
    expect(lbrn).toContain(`<maxPower Value="${material.layers.cut.power}"/>`);
  });

  it('groups shapes per part', () => {
    const groups = lbrn.match(/<Shape Type="Group">/g) ?? [];
    expect(groups.length).toBe(drawing.parts.length);
  });

  it('emits vertex and primitive lists for every path', () => {
    const shapes = lbrn.match(/<Shape Type="Path"/g) ?? [];
    const verts = lbrn.match(/<VertList>/g) ?? [];
    const prims = lbrn.match(/<PrimList>/g) ?? [];
    expect(shapes.length).toBeGreaterThan(0);
    expect(verts.length).toBe(shapes.length);
    expect(prims.length).toBe(shapes.length);
  });

  it('closes curved outlines back to the first vertex', () => {
    // Kerf compensation rounds every corner, so real outlines end on a bézier
    // that has to wrap around to vertex 0 rather than being left open.
    const closing = lbrn.match(/<PrimList>[^<]*B\d+ 0<\/PrimList>/g) ?? [];
    expect(closing.length).toBeGreaterThan(0);
  });

  it('uses the compact LineClosed form when there are no corner arcs', () => {
    // With no kerf compensation the corners are true right angles, so the
    // outline is a plain polygon.
    const sharp = render('closedbox', { x: 60, y: 60, h: 60, outside: false, burn: 0 });
    const out = toLBRN2(sharp, { material });
    expect(out).toContain('<PrimList>LineClosed</PrimList>');
  });

  it('flips into LightBurn y-up space, keeping everything on the bed', () => {
    const ys: number[] = [];
    for (const m of lbrn.matchAll(/V(-?[\d.]+) (-?[\d.]+)c/g)) ys.push(Number(m[2]));
    expect(ys.length).toBeGreaterThan(0);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.01);
    expect(Math.max(...ys)).toBeLessThanOrEqual(drawing.bbox.height + 0.01);
  });

  it('keeps labels on a tool layer that is never cut', () => {
    const labelled = render('closedbox', { labels: true });
    const out = toLBRN2(labelled, { material, title: 'Labelled' });
    expect(out).toContain('<CutSetting Type="Tool">');
    expect(out).toContain('<index Value="30"/>');
    expect(out).toContain('<Shape Type="Text"');
  });

  it('omits layers the preset has disabled', () => {
    const off = structuredClone(material);
    off.layers.inner = { ...off.layers.inner, enabled: false };
    const out = toLBRN2(drawing, { material: off, layers: ['cut'] });
    expect(out).not.toContain('<name Value="Inner Cut"/>');
    expect(out).toContain('<name Value="Outer Cut"/>');
  });
});

describe('time estimate', () => {
  it('scales with cut length and reports a readable duration', () => {
    const small = render('closedbox', { x: 50, y: 50, h: 50, outside: false });
    const large = render('closedbox', { x: 200, y: 200, h: 200, outside: false });
    const ts = estimateSeconds(small.stats.lengthByLayer, material);
    const tl = estimateSeconds(large.stats.lengthByLayer, material);
    expect(tl).toBeGreaterThan(ts);
    expect(formatDuration(tl)).toMatch(/\d/);
    expect(formatDuration(0)).toBe('—');
  });
});
