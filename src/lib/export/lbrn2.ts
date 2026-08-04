/**
 * Native LightBurn (.lbrn2) output.
 *
 * boxes.py can already emit .lbrn2, but its cut settings are hardcoded stubs
 * with no speed or power, so every file still needs the Cuts/Layers panel
 * filled in by hand. Here the layers come from the chosen material preset, so
 * the file opens ready to run.
 *
 * Parts become groups, so moving a wall in LightBurn moves it whole. Labels go
 * to tool layer T1, which LightBurn never outputs.
 */
import { LAYERS, LAYER_INFO, type Layer } from '../geom/colors';
import type { Material } from '../materials';
import type { Drawing, DrawingPath, DrawingText } from '../render';
import type { PathCmd } from '../geom/context';

export interface LBRN2Options {
  material: Material;
  layers?: Layer[];
  permalink?: string;
  title?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

interface Vertex {
  x: number;
  y: number;
  /** Outgoing bézier handle. */
  c0?: [number, number];
  /** Incoming bézier handle. */
  c1?: [number, number];
}

/**
 * Split a path into LightBurn subpaths.
 *
 * LightBurn stores bézier handles on the vertices themselves rather than as
 * separate control points, so a cubic segment sets the outgoing handle of the
 * vertex it leaves and the incoming handle of the vertex it reaches.
 */
function toSubpaths(cmds: PathCmd[], flipY: number): { verts: Vertex[]; prims: string[]; hasCurve: boolean }[] {
  const subpaths: { verts: Vertex[]; prims: string[]; hasCurve: boolean }[] = [];
  let current: { verts: Vertex[]; prims: string[]; hasCurve: boolean } | null = null;

  const y = (v: number) => flipY - v;

  for (const c of cmds) {
    if (c.c === 'M') {
      current = { verts: [{ x: c.x, y: y(c.y) }], prims: [], hasCurve: false };
      subpaths.push(current);
      continue;
    }
    if (!current) continue;

    if (c.c === 'L') {
      const i = current.verts.length;
      current.verts.push({ x: c.x, y: y(c.y) });
      current.prims.push(`L${i - 1} ${i}`);
    } else if (c.c === 'C') {
      const prev = current.verts[current.verts.length - 1];
      if (!prev) continue;
      prev.c0 = [c.x1, y(c.y1)];
      const i = current.verts.length;
      current.verts.push({ x: c.x, y: y(c.y), c1: [c.x2, y(c.y2)] });
      current.prims.push(`B${i - 1} ${i}`);
      current.hasCurve = true;
    }
  }

  return subpaths.filter((s) => s.verts.length > 1);
}

function serialiseVertex(v: Vertex): string {
  // "c0x1" with no y is LightBurn's marker for "no handle on this side".
  const c0 = v.c0 ? `c0x${fmt(v.c0[0])}c0y${fmt(v.c0[1])}` : 'c0x1';
  const c1 = v.c1 ? `c1x${fmt(v.c1[0])}c1y${fmt(v.c1[1])}` : 'c1x1';
  return `V${fmt(v.x)} ${fmt(v.y)}${c0}${c1}`;
}

const CLOSE_EPS = 1e-3;

function shapeXML(path: DrawingPath, cutIndex: number, flipY: number): string[] {
  const out: string[] = [];

  for (const sub of toSubpaths(path.cmds, flipY)) {
    const first = sub.verts[0]!;
    const last = sub.verts[sub.verts.length - 1]!;
    const closed =
      Math.abs(first.x - last.x) < CLOSE_EPS && Math.abs(first.y - last.y) < CLOSE_EPS;

    let verts = sub.verts;
    let prims: string;

    if (closed && !sub.hasCurve) {
      // A straight closed outline is the common case and has a compact form.
      verts = verts.slice(0, -1);
      prims = 'LineClosed';
    } else if (closed) {
      // Fold the duplicate end vertex back onto the first, keeping its handle.
      if (last.c1) first.c1 = last.c1;
      verts = verts.slice(0, -1);
      prims = sub.prims
        .slice(0, -1)
        .concat(sub.prims[sub.prims.length - 1]!.replace(/(\d+) (\d+)$/, `$1 0`))
        .join('');
    } else {
      prims = sub.prims.join('');
    }

    if (verts.length < 2) continue;

    out.push(`<Shape Type="Path" CutIndex="${cutIndex}">`);
    out.push(`<VertList>${verts.map(serialiseVertex).join('')}</VertList>`);
    out.push(`<PrimList>${prims}</PrimList>`);
    out.push('</Shape>');
  }

  return out;
}

function textXML(t: DrawingText, cutIndex: number, flipY: number): string[] {
  const m = t.matrix;
  // Flip the text transform back into LightBurn's y-up space.
  const a = m.a;
  const b = -m.d;
  const c = -m.b;
  const d = m.e;
  const e = m.c;
  const f = flipY - m.f;

  const align = t.params.align === 'middle' ? '1' : t.params.align === 'end' ? '2' : '0';
  const [style, bold, italic] = t.params.ff;
  const font =
    t.params.font && t.params.font !== 'Arial'
      ? t.params.font
      : style === 'serif'
        ? 'Times New Roman'
        : style === 'monospaced'
          ? 'Courier New'
          : 'Arial';

  // LightBurn's H unit is not millimetres; 1 mm is roughly 1.75 H.
  const height = t.params.fs * 1.75 * 0.6086434;

  return [
    `<Shape Type="Text" CutIndex="${cutIndex}" Font="${esc(font)}" H="${fmt(height)}" ` +
      `Str="${esc(t.text)}" Bold="${bold ? 1 : 0}" Italic="${italic ? 1 : 0}" ` +
      `Ah="${align}" Av="1" Eval="0">`,
    `<XForm>${[a, b, c, d, e, f].map(fmt).join(' ')}</XForm>`,
    '</Shape>',
  ];
}

export function toLBRN2(drawing: Drawing, options: LBRN2Options): string {
  const { material, permalink, title = 'boxesjs' } = options;

  const used = new Set<Layer>();
  for (const l of LAYERS) {
    if (drawing.layers[l].length > 0) used.add(l);
  }
  for (const p of drawing.parts) for (const t of p.texts) used.add(t.layer);

  const requested = options.layers;
  const active = LAYERS.filter(
    (l) => used.has(l) && (!requested || requested.includes(l)) && material.layers[l] !== undefined,
  );

  const flipY = drawing.bbox.height;
  const out: string[] = [];

  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    '<LightBurnProject AppVersion="1.7.00" FormatVersion="1" MaterialHeight="0" ' +
      'MirrorX="False" MirrorY="False">',
  );

  // Cut settings, in the order they should run: marking first, perimeter last.
  for (const layer of active) {
    const info = LAYER_INFO[layer];
    const m = material.layers[layer];

    if (info.isTool) {
      out.push('<CutSetting Type="Tool">');
      out.push(`<index Value="${info.lightburnIndex}"/>`);
      out.push(`<name Value="${esc(info.name)}"/>`);
      out.push(`<priority Value="${info.priority}"/>`);
      out.push('</CutSetting>');
      continue;
    }

    out.push('<CutSetting Type="Cut">');
    out.push(`<index Value="${info.lightburnIndex}"/>`);
    out.push(`<name Value="${esc(info.name)}"/>`);
    out.push(`<priority Value="${info.priority}"/>`);
    out.push(`<speed Value="${fmt(m.speed)}"/>`);
    out.push(`<maxPower Value="${fmt(m.power)}"/>`);
    out.push(`<maxPower2 Value="${fmt(m.power)}"/>`);
    out.push(`<numPasses Value="${Math.max(1, Math.round(m.passes))}"/>`);
    out.push(`<airAssist Value="${m.airAssist ? 1 : 0}"/>`);
    out.push(`<doOutput Value="${m.enabled ? 1 : 0}"/>`);
    out.push('</CutSetting>');
  }

  // One group per part, so a whole wall moves together in LightBurn.
  for (const part of drawing.parts) {
    const children: string[] = [];

    for (const path of part.paths) {
      if (!active.includes(path.layer)) continue;
      children.push(...shapeXML(path, LAYER_INFO[path.layer].lightburnIndex, flipY));
    }
    for (const t of part.texts) {
      if (!active.includes(t.layer)) continue;
      children.push(...textXML(t, LAYER_INFO[t.layer].lightburnIndex, flipY));
    }
    if (children.length === 0) continue;

    out.push('<Shape Type="Group">');
    out.push(`<XForm>1 0 0 1 0 0</XForm>`);
    out.push('<Children>');
    out.push(...children);
    out.push('</Children>');
    out.push('</Shape>');
  }

  const notes = [
    `${title} — created with boxesjs`,
    `Material: ${material.name} (${material.thickness}mm, kerf ${material.kerf}mm)`,
    permalink ? `Settings: ${permalink}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  out.push(`<Notes ShowOnLoad="0" Notes="${esc(notes)}"/>`);

  out.push('</LightBurnProject>');
  return out.join('\n');
}
