/**
 * Top-edge handling, ported from `_TopEdge` in boxes.py `boxes/lids.py`.
 *
 * The single "top edge" choice on a box actually implies four different edges —
 * left, back, right, front — plus which extra lid parts to draw. This keeps
 * that mapping in one place.
 *
 * Only the edge families this build ports appear here. Hinges, click-lids and
 * slide-on lids are absent rather than silently degraded, and the UI's choice
 * list is derived from `TOP_EDGE_CHOICES` so it can only offer what works.
 */
import type { Boxes, EdgeSpec } from './boxes';
import { MOUNTING_SIDE, type MountingSettings } from './edges/mounting';

/** Top edges this build supports, in menu order. */
export const TOP_EDGE_CHOICES = 'efFhStG';

/** Bottom edges this build supports, in menu order. */
export const BOTTOM_EDGE_CHOICES = 'Fhse';

/**
 * Expand a top-edge choice into the four edges of a wall, in
 * [left, back, right, front] order.
 */
export function topEdges(box: Boxes, topEdge: string): [EdgeSpec, EdgeSpec, EdgeSpec, EdgeSpec] {
  const base = box.edges[topEdge] ? topEdge : 'e';
  let tl: EdgeSpec = base;
  let tb: EdgeSpec = base;
  let tr: EdgeSpec = base;
  let tf: EdgeSpec = base;

  if (base === 't') {
    // The handle triangle only makes sense on the two long sides.
    tf = 'e';
    tb = 'e';
  } else if (base === 'G') {
    // Mounting holes go on exactly one side.
    tl = tb = tr = tf = 'e';
    const side = (box.edges['G']!.settings as MountingSettings).side;
    if (side === MOUNTING_SIDE.LEFT) tl = 'G';
    else if (side === MOUNTING_SIDE.RIGHT) tr = 'G';
    else if (side === MOUNTING_SIDE.FRONT) tf = 'G';
    else tb = 'G';
  }

  return [tl, tb, tr, tf];
}

/** True when the chosen top edge means the box gets a solid top panel. */
export function isClosedTop(topEdge: string): boolean {
  return 'fFhŠ'.includes(topEdge);
}

/**
 * Draw the lid parts implied by the top edge.
 * Returns false when the top edge needs no extra parts.
 */
export function drawLid(box: Boxes, x: number, y: number, topEdge: string): boolean {
  if (topEdge === 'f') {
    box.rectangularWall(x, y, 'FFFF', { move: 'up', label: 'Top' });
  } else if ('FhŠ'.includes(topEdge)) {
    box.rectangularWall(x, y, 'ffff', { move: 'up', label: 'Top' });
  } else if (topEdge === 'E') {
    box.rectangularWall(x, y, 'EEEE', { move: 'up', label: 'Lid top' });
    box.rectangularWall(x, y, 'eeee', { move: 'up', label: 'Lid bottom' });
  } else {
    return false;
  }
  return true;
}
