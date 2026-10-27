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
import { BoltsPolicy, calcFingers, type FingerJointSettings } from './fingerjoint';

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
 * The bolts for a shelf's joint of `length`: about one per 100 mm, and at
 * least one. Both halves of a joint ask with the same length, so they agree.
 * boxes.py's own boxes use a fixed two or three; a shelf's joints run from a
 * short rail to a long floor, so the count follows the length instead.
 * A joint that carries more load can ask for a higher `min`.
 */
export function boltsAlong(length: number, min = 1): BoltsPolicy {
  return new BoltsPolicy(Math.max(min, Math.round(length / 100)));
}

/** Where along an edge another cut comes near it: a point, or a stretch. */
export type Span = number | readonly [number, number];

/**
 * Bolts in the gaps between fingers that are named, counted as `drawBolt`
 * counts them. The finger count is left as it is.
 */
export class GapBolts implements BoltPolicy {
  constructor(private readonly gaps: ReadonlySet<number>) {}

  get bolts(): number {
    return this.gaps.size;
  }

  numFingers(numFingers: number): number {
    return numFingers;
  }

  drawBolt(pos: number): boolean {
    return this.gaps.has(pos);
  }
}

/**
 * `boltsAlong`, for a joint whose edge other parts' slots run in from, at
 * `across` along it: a bolt landing on one would cut into it. Where the usual
 * bolts all stay `clear` of them, they are kept; otherwise the gaps that are
 * clear are bolted, as near as they come to where the usual bolts would be.
 * With no gap clear it keeps the usual bolts, and the check on the drawn
 * parts says where they meet.
 */
export function boltsClearOf(
  s: FingerJointSettings,
  length: number,
  across: Span[],
  clear: number,
  min = 1,
): BoltPolicy {
  const usual = boltsAlong(length, min);
  if (!across.length) return usual;
  // The edges on either side of a joint run in opposite directions: keep
  // clear of both readings of each position.
  const avoid = across.flatMap((a): [number, number][] => {
    const [lo, hi] = typeof a === 'number' ? [a, a] : a;
    return [[lo, hi], [length - hi, length - lo]];
  });
  const isClear = (p: number) => avoid.every(([lo, hi]) => p <= lo - clear || p >= hi + clear);
  const at = boltPositions(s, length, usual);
  if (at.length && at.every(isClear)) return usual;

  const [fingers, leftover] = calcFingers(s, length, null);
  const gapAt = (i: number) => leftover / 2 + i * (s.space + s.finger) - s.space / 2;
  // For the same reason, a gap is only bolted along with its mirror image.
  const free: number[] = [];
  for (let i = 1; i <= fingers / 2; i++) if (isClear(gapAt(i)) && isClear(gapAt(fingers - i))) free.push(i);
  if (!free.length) return usual;
  const gaps = new Set<number>();
  for (let k = 1; k <= Math.ceil(usual.bolts / 2); k++) {
    const want = (length * k) / (usual.bolts + 1);
    const left = free.filter((i) => !gaps.has(i));
    if (!left.length) break;
    const i = left.reduce((a, b) => (Math.abs(gapAt(b) - want) < Math.abs(gapAt(a) - want) ? b : a));
    gaps.add(i).add(fingers - i);
  }
  return new GapBolts(gaps);
}

/**
 * `boltsClearOf` with `box`'s own fingers and bolt, for slots across the edge
 * as thick as the material: a shelf's or divider's.
 */
export function shelfBolts(
  box: { thickness: number; bedBoltSettings: readonly number[]; getEdge(c: string): { settings: unknown } },
  length: number,
  across: Span[] = [],
  min = 1,
): BoltPolicy {
  // Half the nut's pocket one side, half the slot the other, and a margin.
  const clear = (box.bedBoltSettings[1]! + box.thickness) / 2 + 1;
  return boltsClearOf(box.getEdge('f').settings as FingerJointSettings, length, across, clear, min);
}

/** The centres of the walls between `sizes`, in `thickness` material, measured along them. */
export function wallsBetween(sizes: number[], thickness: number): number[] {
  let pos = -0.5 * thickness;
  return sizes.slice(0, -1).map((s) => (pos += s + thickness));
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

/** A joint meant to be bolted, for `checkBolts`. */
export interface BoltedJoint {
  label: string;
  length: number;
  policy: BoltPolicy;
}

/**
 * Warns where the bolts cannot work as drawn. On `bolt_length`: a bolt too
 * short to reach through its nut, and — once the parts are drawn — a T-slot
 * that runs into another cut in its part, whether another slot, a hole, or
 * the far side of a narrow part. On `jointParam`: a joint that gets no bolts
 * at all. boxes.py's policy never bolts the end gaps, nor the middle one for
 * an even count, so a short edge, or thick material with its wide fingers,
 * can leave a panel held by nothing.
 */
export function checkBolts(
  box: {
    bedBoltSettings: readonly number[];
    thickness: number;
    warn(m: string, p?: string): void;
    partCutsCheck: { param: string; message: (parts: string[]) => string } | null;
  },
  fingers: FingerJointSettings,
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
  const [d, , , , l1] = box.bedBoltSettings as [number, number, number, number, number];
  // The bolt runs down the middle of the slotted panel's thickness, so the
  // hole for it sits half a thickness in from the other panel's corner.
  if (d > box.thickness - 1) {
    box.warn(
      `A ${d.toFixed(1)} mm bolt hole leaves less than half a millimetre either side in ` +
        `${box.thickness} mm material, and breaks out at the corners. Use smaller bolts or thicker material.`,
      'bolt_size',
    );
    // Every part with a bolt hole would also report its cuts meeting; this
    // says why, once.
    return;
  }
  if (l1 < box.thickness / 2) {
    box.warn(
      'These bolts are too short to reach through the nut with material left between it and the edge. ' +
        'Use longer bolts.',
      'bolt_length',
    );
  }
  box.partCutsCheck = {
    param: 'bolt_length',
    message: (parts) =>
      `The bolt slots run into other cuts in ${parts.join(', ')}. Use shorter bolts, or change the sizes so the bolts land clear of other cuts.`,
  };
}
