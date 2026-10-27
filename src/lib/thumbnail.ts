/**
 * Gallery thumbnails, rendered at build time from the real generator.
 *
 * A generator's own layout is a column or a strip of parts, which shrinks to a
 * sliver in a 4:3 card, and three box generators drawn that way are the same
 * grid of squares. So the parts are packed onto one sheet the card's shape,
 * and the page fills the outlines and colours the holes, which are what
 * mostly tell one design from another.
 */
import { defaultsFor, getGenerator } from './generators/registry';
import { planRects, realise, type PackOptions } from './layout/pack';
import { toBoxesConfig } from './params/common';
import { renderBox } from './render';

export interface Thumbnail {
  viewBox: string;
  /** Outlines, to be filled. */
  cut: string;
  /** Holes and slots inside the parts. */
  inner: string;
  /** Engraving and scoring, drawn faintly. */
  marks: string;
}

/** Width over height of a gallery card's thumbnail. */
export const THUMB_ASPECT = 4 / 3;

export function renderThumbnail(id: string): Thumbnail {
  const gen = getGenerator(id);
  const values = { ...defaultsFor(id), ...gen.meta.thumbnail };
  const drawing = renderBox(gen.create(values, toBoxesConfig(values)));

  // Start from a sheet with just room for the parts' boxes and grow it until
  // they all go on one. Rectangle packing of a handful of parts settles
  // within a few steps.
  const area = drawing.parts.reduce((s, p) => s + p.bbox.width * p.bbox.height, 0);
  const longest = Math.max(...drawing.parts.map((p) => Math.max(p.bbox.width, p.bbox.height)));
  let height = Math.max(Math.sqrt(area / THUMB_ASPECT), longest / THUMB_ASPECT);
  for (let i = 0; i < 60; i++) {
    const gap = height * 0.025;
    const o: PackOptions = { sheetWidth: height * THUMB_ASPECT, sheetHeight: height, margin: gap, gap, rotate: true };
    const plan = planRects(drawing, o);
    if (plan.sheets.length === 1 && plan.oversize.length === 0) {
      const packed = realise(drawing, o, plan);
      return {
        viewBox: `0 0 ${o.sheetWidth} ${o.sheetHeight}`,
        cut: packed.layers.cut,
        inner: packed.layers.inner,
        marks: [packed.layers.engrave, packed.layers.score].filter(Boolean).join(' '),
      };
    }
    height *= 1.06;
  }
  // Too awkward to pack: the generator's own layout still shows the parts.
  const b = drawing.bbox;
  return {
    viewBox: `${b.x} ${b.y} ${b.width} ${b.height}`,
    cut: drawing.layers.cut,
    inner: drawing.layers.inner,
    marks: [drawing.layers.engrave, drawing.layers.score].filter(Boolean).join(' '),
  };
}
