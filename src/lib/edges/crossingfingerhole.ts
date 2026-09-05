/**
 * Crossing finger holes, ported from boxes.py `boxes/edges.py`.
 *
 * A straight edge that also cuts a finger slot at right angles to itself,
 * halfway along, so a second wall can pass through this one where the two
 * cross. TrayLayout is the only user in the whole library: it binds the edge to
 * the characters `C` and `D` while it renders and retunes `height` per row.
 *
 * It is deliberately absent from `EDGE_INFO` and `Boxes.buildObjects()`. The
 * crossing wall's height is a constructor argument with no sensible default, so
 * there is nothing a user could pick from the edge menu — the same reason
 * `FingerHoleEdge` next door is not offered either.
 */
import type { Boxes } from '../boxes';
import { Edge } from './base';

export class CrossingFingerHoleEdge extends Edge {
  override char: string | null = '|';
  override description = 'Edge (orthogonal Finger Joint Holes)';

  /** Height of the wall crossing here — i.e. the length of the slot. */
  height: number;
  private readonly outset: number;

  constructor(boxes: Boxes, height: number, outset = 0.0) {
    super(boxes, null);
    this.height = height;
    this.outset = outset;
  }

  override call(length: number): void {
    this.boxes.fingerHolesAt(length / 2.0, this.outset + this.burn, this.height);
    super.call(length);
  }

  override startWidth(): number {
    return this.outset;
  }
}
