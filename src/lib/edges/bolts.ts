/**
 * Captive-nut bolted joints ("bed bolts"), boxes.py's own mechanism.
 *
 * boxes.py can put a bolt through some of a finger joint's gaps: the panel
 * with fingers (`f`) gets a T-shaped slot from its edge, with a pocket a nut
 * drops into, and the panel it meets (`F`, or `h`) gets a hole for the bolt.
 * The bolt runs through that hole into the slot and threads into the nut, so
 * the joint pulls tight and comes apart again with a screwdriver.
 *
 * The geometry is boxes.py's `bedBoltHole` and its `Bolts` policy, ported in
 * `boxes.ts` and `fingerjoint.ts`. boxes.py wires them into several
 * generators and then switches them off (`d2 = d3 = None`), and offers no way
 * to choose the bolt; what this file adds is the choosing. The five numbers
 * boxes.py takes — bolt diameter, nut width across flats, nut thickness, slot
 * depth and nut position — are derived here from a metric size and the bolt's
 * length, so the user picks "M3 × 20" rather than five dimensions.
 */
import type { BoltPolicy } from './base';
import { calcFingers, type FingerJointSettings } from './fingerjoint';

/** ISO 4032 hex nuts: [bolt diameter, nut width across flats, nut thickness], in mm. */
export const BOLT_SIZES: Record<string, readonly [number, number, number]> = {
  'M2.5': [2.5, 5.0, 2.0],
  M3: [3.0, 5.5, 2.4],
  M4: [4.0, 7.0, 3.2],
  M5: [5.0, 8.0, 4.7],
  M6: [6.0, 10.0, 5.2],
};

export interface BoltChoice {
  /** A key of BOLT_SIZES, or 'custom'. */
  size: string;
  /** Length under the head, in mm. */
  length: number;
  /** Added to the bolt hole, the nut pocket's width and its depth, in mm. */
  clearance: number;
  /** Used when `size` is 'custom'. */
  custom: readonly [number, number, number];
}

/**
 * boxes.py's `bedBoltSettings`, `[d, d_nut, h_nut, l, l1]`, for a bolt through
 * a panel `thickness` thick. `l` is how deep the slot runs in from the edge and
 * `l1` where the nut pocket starts. The bolt crosses the other panel first, so
 * its tip reaches `length - thickness` into the slot; the slot runs a
 * millimetre further, and the nut sits with two millimetres of thread beyond it.
 */
export function bedBoltSettingsFor(c: BoltChoice, thickness: number): [number, number, number, number, number] {
  const [d, nut, nutHeight] = BOLT_SIZES[c.size] ?? c.custom;
  const reach = c.length - thickness;
  const h = nutHeight + c.clearance;
  return [d + c.clearance, nut + c.clearance, h, reach + 1, reach - h - 2];
}

/**
 * Where along a finger-jointed edge of `length` the policy puts its bolts:
 * the centres of the gaps between fingers that `drawBolt` picks, as the edge
 * and its finger holes draw them.
 */
export function boltPositions(s: FingerJointSettings, length: number, policy: BoltPolicy): number[] {
  const [fingers, leftover] = calcFingers(s, length, policy);
  // Too short for proper fingers: the edge falls back to one small finger and
  // drops the bolts.
  if (fingers === 0) return [];
  const out: number[] = [];
  for (let i = 1; i < fingers; i++) {
    if (policy.drawBolt(i)) out.push(leftover / 2 + i * (s.space + s.finger) - s.space / 2);
  }
  return out;
}

/**
 * Whether the T-slots cut into a `w` × `h` panel from its edges run into each
 * other: at a corner, where slots from neighbouring edges cross, or across a
 * narrow panel, where slots from opposite edges meet. `slots[i]` lists the
 * bolt positions along edge i (bottom, right, top, left, counter-clockwise,
 * as rectangularWall draws them); the slot is the nut pocket's width all the
 * way down, which is the conservative reading.
 */
export function slotsClash(w: number, h: number, slots: number[][], settings: readonly number[]): boolean {
  const [, nut, , l] = settings as [number, number, number, number, number];
  const r = nut / 2;
  type Rect = [number, number, number, number];
  const rects: Rect[] = [];
  (slots[0] ?? []).forEach((p) => rects.push([p - r, 0, p + r, l]));
  (slots[1] ?? []).forEach((p) => rects.push([w - l, p - r, w, p + r]));
  (slots[2] ?? []).forEach((p) => rects.push([w - p - r, h - l, w - p + r, h]));
  (slots[3] ?? []).forEach((p) => rects.push([0, h - p - r, l, h - p + r]));
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const [a, b] = [rects[i]!, rects[j]!];
      if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) return true;
    }
  }
  return false;
}

/** A panel with T-slots cut from some of its edges, for `checkBolts`. */
export interface SlottedPanel {
  label: string;
  w: number;
  h: number;
  /** The bolt policy of each slotted (`f`) edge, bottom, right, top, left; null for none. */
  edges: (BoltPolicy | null)[];
}

/** A joint meant to be bolted, for `checkBolts`. */
export interface BoltedJoint {
  label: string;
  length: number;
  policy: BoltPolicy;
}

/**
 * Warns where the bolts cannot work as drawn. On `bolt_length`: a bolt too
 * short to reach through its nut, or T-slots in a panel running into each
 * other; both depend on the bolt as much as the box. On `jointParam`: a joint
 * that gets no bolts at all. boxes.py's policy never bolts the end gaps, nor
 * the middle one for an even count, so a short edge, or thick material with
 * its wide fingers, can leave a panel held by nothing.
 */
export function checkBolts(
  box: { bedBoltSettings: readonly number[]; thickness: number; warn(m: string, p?: string): void },
  fingers: FingerJointSettings,
  panels: SlottedPanel[],
  joints: BoltedJoint[] = [],
  jointParam = 'assembly',
): void {
  const unbolted = joints.filter((j) => boltPositions(fingers, j.length, j.policy).length === 0);
  if (unbolted.length) {
    box.warn(
      `Too short for any bolts at these finger sizes: ${unbolted.map((j) => j.label).join(', ')}. ` +
        'Make it bigger, or the fingers narrower.',
      jointParam,
    );
  }
  const [, , , , l1] = box.bedBoltSettings as [number, number, number, number, number];
  if (l1 < box.thickness / 2) {
    box.warn(
      'These bolts are too short to reach through the nut with material left between it and the edge. ' +
        'Use longer bolts.',
      'bolt_length',
    );
  }
  const clashing = panels.filter((p) =>
    slotsClash(
      p.w,
      p.h,
      p.edges.map((policy, i) => (policy ? boltPositions(fingers, i % 2 ? p.h : p.w, policy) : [])),
      box.bedBoltSettings,
    ),
  );
  if (clashing.length) {
    box.warn(
      `The bolt slots run into each other in ${clashing.map((p) => p.label).join(', ')}. ` +
        'Use shorter bolts, or make the box bigger.',
      'bolt_length',
    );
  }
}
