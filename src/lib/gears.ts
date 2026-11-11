/**
 * Involute spur and ring gears, ported from boxes.py `boxes/gears.py`, itself
 * the Inkscape "gears" extension adapted to draw through a `Boxes` instance.
 *
 * boxes.py drives this through an argparse `OptionParser`, turning keyword
 * arguments into `--name=value` strings and back; here the options are a
 * typed object with the same defaults. Like `Parts`, it hangs off the box as
 * `gears`, so generator code translates line for line.
 *
 * Not ported, because no generator reaches them: the rack (`drawrack`),
 * whose `sizes()` branch upstream reads names it never defines; the text
 * annotation and the undercut warnings that only feed it; the centre cross
 * and pitch-circle guides; and the CP/DP unit systems' annotation text.
 */
import type { Boxes, Callback } from './boxes';
import { vdiff, vlength, type Vec } from './geom/vectors';

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;

export interface GearOptions {
  teeth?: number;
  /** 'CP' circular pitch (in), 'DP' diametral pitch (1/in), 'MM' module. */
  system?: 'CP' | 'DP' | 'MM';
  /** Tooth size in the chosen system: the module, for 'MM'. */
  dimension?: number;
  /** Pressure angle, degrees. */
  angle?: number;
  /** Percent of the module. */
  profile_shift?: number;
  /** Points on each involute; 0 picks by tooth count. */
  accuracy?: number;
  clearance?: number;
  internal_ring?: boolean;
  mount_hole?: number;
  mount_diameter?: number;
  spoke_count?: number;
  spoke_width?: number;
}

type ResolvedOptions = Required<GearOptions>;

const DEFAULTS: ResolvedOptions = {
  teeth: 24,
  system: 'MM',
  dimension: 1.0,
  angle: 20.0,
  profile_shift: 20.0,
  accuracy: 0,
  clearance: 0.0,
  internal_ring: false,
  mount_hole: 0,
  mount_diameter: 15,
  spoke_count: 3,
  spoke_width: 5,
};

/**
 * boxes.py round-trips every option through argparse, so `teeth` and
 * `spoke_count` are `int()`ed and an int-typed option given 12.5 is an
 * error. Generators only pass whole numbers; truncating matches `int()`.
 */
function resolve(kw: GearOptions): ResolvedOptions {
  const o = { ...DEFAULTS, ...kw };
  o.teeth = Math.trunc(o.teeth);
  o.spoke_count = Math.trunc(o.spoke_count);
  o.accuracy = Math.trunc(o.accuracy);
  return o;
}

/** `n` evenly spaced values from a to b, both included. */
function linspace(a: number, b: number, n: number): number[] {
  return Array.from({ length: n }, (_, x) => a + (x * (b - a)) / (n - 1));
}

function involuteIntersectAngle(Rb: number, R: number): number {
  return Math.sqrt(R ** 2 - Rb ** 2) / Rb - Math.acos(Rb / R);
}

function pointOnCircle(radius: number, angle: number): Vec {
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

interface GearCalc {
  pitchRadius: number;
  baseRadius: number;
  addendum: number;
  dedendum: number;
  outerRadius: number;
  rootRadius: number;
  toothThickness: number;
}

/**
 * The basic spur/ring gear dimensions. A positive profile shift moves the
 * tooth outwards: deeper root, shorter tip.
 */
function gearCalculations(
  numTeeth: number,
  circularPitch: number,
  pressureAngle: number,
  clearance = 0,
  ringGear = false,
  profileShift = 0,
): GearCalc {
  const diametralPitch = Math.PI / circularPitch;
  const pitchDiameter = numTeeth / diametralPitch;
  const pitchRadius = pitchDiameter / 2.0;
  let addendum = 1 / diametralPitch;
  let dedendum = addendum;
  dedendum *= 1 + profileShift;
  addendum *= 1 - profileShift;

  if (ringGear) addendum = addendum + clearance;
  else dedendum = dedendum + clearance;

  const baseRadius = (pitchDiameter * Math.cos(pressureAngle * DEG)) / 2.0;
  const outerRadius = pitchRadius + addendum;
  const rootRadius = pitchRadius - dedendum;
  const toothThickness = (Math.PI * pitchDiameter) / (2.0 * numTeeth);

  return { pitchRadius, baseRadius, addendum, dedendum, outerRadius, rootRadius, toothThickness };
}

/** The closed outline of a spur gear, tooth by tooth, as points. */
function generateSpurPoints(
  teeth: number,
  baseRadius: number,
  pitchRadius: number,
  outerRadius: number,
  rootRadius: number,
  accuracyInvolute: number,
  accuracyCircular: number,
): Vec[] {
  const halfThickAngle = TWO_PI / (4.0 * teeth);
  const pitchToBaseAngle = involuteIntersectAngle(baseRadius, pitchRadius);

  const startInvoluteRadius = Math.max(baseRadius, rootRadius);
  const radii = linspace(startInvoluteRadius, outerRadius, accuracyInvolute);
  const angles = radii.map((r) => involuteIntersectAngle(baseRadius, r));

  const points: Vec[] = [];

  for (let t = 0; t < teeth; t++) {
    const c = (t * TWO_PI) / teeth;

    const pitch1 = c - halfThickAngle;
    const base1 = pitch1 - pitchToBaseAngle;
    const offsetangles1 = angles.map((x) => base1 + x);
    const points1 = radii.map((r, i) => pointOnCircle(r, offsetangles1[i]!));

    const pitch2 = c + halfThickAngle;
    const base2 = pitch2 + pitchToBaseAngle;
    const offsetangles2 = angles.map((x) => base2 - x);
    const points2 = radii.map((r, i) => pointOnCircle(r, offsetangles2[i]!));

    const pointsOnOuterRadius = linspace(
      offsetangles1[offsetangles1.length - 1]!,
      offsetangles2[offsetangles2.length - 1]!,
      accuracyCircular,
    ).map((x) => pointOnCircle(outerRadius, x));

    // Python's `[1:-1]` drops the ends, which the flanks already supply.
    const tip = pointsOnOuterRadius.slice(1, -1);
    const back = [...points2].reverse();

    if (rootRadius > baseRadius) {
      const pitchToRootAngle = pitchToBaseAngle - involuteIntersectAngle(baseRadius, rootRadius);
      const root1 = pitch1 - pitchToRootAngle;
      const root2 = pitch2 + pitchToRootAngle;
      const pointsOnRoot = linspace(root2, root1 + TWO_PI / teeth, accuracyCircular).map((x) =>
        pointOnCircle(rootRadius, x),
      );
      points.push(...points1, ...tip, ...back, ...pointsOnRoot.slice(1, -1));
    } else {
      // The flank starts at the base circle, above the root, so the root
      // arc keeps its end points: they are the radial drop to the root.
      const pointsOnRoot = linspace(base2, base1 + TWO_PI / teeth, accuracyCircular).map((x) =>
        pointOnCircle(rootRadius, x),
      );
      points.push(...points1, ...tip, ...back, ...pointsOnRoot);
    }
  }

  return points;
}

export class Gears {
  constructor(private boxes: Boxes) {}

  /** Circular pitch in mm: the arc from one tooth to the next on the pitch circle. */
  private calcCircularPitch(o: ResolvedOptions): number {
    const dimension = o.dimension;
    if (o.system === 'CP') return dimension * 25.4;
    if (o.system === 'DP') return (Math.PI * 25.4) / dimension;
    if (o.system === 'MM') return Math.PI * dimension;
    throw new Error(`unknown system '${String(o.system)}', try CP, DP, MM`);
  }

  /**
   * Spokes between the mount and the root circle, given as a count or as a
   * list of angles in degrees. Returns the adjustment messages boxes.py
   * collects for its annotation.
   */
  private generateSpokes(
    rootRadius: number,
    spokeWidth: number,
    spokes: number | number[],
    mountRadius: number,
    mountHole: number,
  ): string[] {
    const b = this.boxes;
    if (typeof spokes === 'number' ? !spokes : !spokes.length) return [];

    let collision = false;
    const messages: string[] = [];
    const rOuter = rootRadius - spokeWidth;

    let spokeCount: number;
    let angles: number[];
    if (typeof spokes === 'number') {
      spokeCount = spokes;
      angles = Array.from({ length: spokeCount }, (_, i) => (i * 2 * Math.PI) / spokes);
    } else {
      spokeCount = spokes.length;
      angles = spokes.map((a) => a * DEG);
    }
    angles.push(angles[0]! + TWO_PI);

    if (mountRadius <= mountHole / 2) {
      const adjFactor = (rOuter - mountHole / 2) / 5;
      if (adjFactor < 0.1) {
        collision = true;
      } else {
        mountRadius = mountHole / 2 + adjFactor;
        messages.push(`Mount support too small. Auto increased to ${((mountRadius * 2)).toFixed(2)}.`);
      }
    }

    for (let i = 0; i < spokeCount; i++) {
      // Python's `spokes[i-1]` at i = 0 is the closing angle appended above,
      // so the first difference is -2π and this always fires once: boxes.py
      // grows every mount support by 1.2 mm. Reproduced for parity.
      const angle = angles[i]! - angles[(i - 1 + angles.length) % angles.length]!;
      if (spokeWidth >= angle * mountRadius) {
        const adjFactor = 1.2;
        mountRadius += adjFactor;
        messages.push(`Too many spokes. Increased Mount support by ${adjFactor.toFixed(3)}`);
      }
    }

    if (rOuter <= mountRadius) collision = true;
    if (collision) {
      messages.push('Not enough room for Spokes. Decrease Spoke width.');
    } else {
      for (let i = 0; i < spokeCount; i++) {
        b.savedContext(() => {
          const startA = angles[i]!;
          const endA = angles[i + 1]!;
          const a = Math.asin(Math.max(-1.0, Math.min(1.0, spokeWidth / mountRadius / 2)));
          const a2 = Math.asin(Math.max(-1.0, Math.min(1.0, spokeWidth / rOuter / 2)));
          const l = vlength(
            vdiff(pointOnCircle(mountRadius, startA + a), pointOnCircle(rOuter, startA + a2)),
          );
          const [mx, my] = pointOnCircle(mountRadius, startA + a);
          b.moveTo(mx, my, startA / DEG);
          b.polyline(
            l,
            +90 + a2 / DEG, 0,
            [(endA - startA - 2 * a2) / DEG, rOuter], 0,
            +90 + a2 / DEG,
            l, 90 - a / DEG, 0,
            [-(endA - startA - 2 * a) / DEG, mountRadius],
            0, 90 + a2 / DEG, 0,
          );
        });
      }
    }

    return messages;
  }

  /**
   * `[pitch radius, width, height]` of the gear `draw()` would make. A ring
   * gear's size includes its rim.
   */
  sizes(kw: GearOptions): [number, number, number] {
    const o = resolve(kw);
    const pitch = this.calcCircularPitch(o);
    const g = gearCalculations(o.teeth, pitch, o.angle, o.clearance, o.internal_ring, o.profile_shift * 0.01);
    let outerRadius = g.outerRadius;
    if (o.internal_ring) outerRadius += o.spoke_width;
    return [g.pitchRadius, 2 * outerRadius, 2 * outerRadius];
  }

  /**
   * Round plate carrying gears on pins at radius `r`: a hub with spokes out
   * to a rim, a hole at each of `positions` (a count, spread evenly, or
   * angles in degrees), and one in the centre.
   */
  gearCarrier(
    r: number,
    spokeWidth: number,
    positions: number | number[],
    mountRadius: number,
    mountHole: number,
    opts: { centerHole?: number | null; callback?: Callback; move?: string | null; label?: string } = {},
  ): void {
    const b = this.boxes;
    const { callback, move, label = '' } = opts;
    const width = 2 * r + spokeWidth;
    const centerHole = opts.centerHole || mountHole;

    if (b.move(width, width, move, true, label)) return;

    const angles =
      typeof positions === 'number'
        ? Array.from({ length: positions }, (_, i) => (i * 360) / positions)
        : positions;

    b.savedContext(() => {
      b.moveTo(width / 2.0, width / 2.0);
      if (callback) b.cc(callback, 0);
      this.generateSpokes(r + 0.5 * spokeWidth, spokeWidth, angles, mountRadius, mountHole);
      b.hole(0, 0, centerHole);

      for (const angle of angles) {
        b.savedContext(() => {
          b.moveTo(0, 0, angle);
          b.hole(r, 0, mountHole);
        });
      }

      b.moveTo(r + 0.5 * spokeWidth + b.burn, 0, 90);
      b.corner(360, r + 0.5 * spokeWidth);
    });
    b.move(width, width, move, false, label);
  }

  /**
   * Draw a gear: boxes.py's `Gears.__call__`. A spur gear gets spokes and a
   * mount hole; a ring gear gets a rim `spoke_width` wide round its teeth.
   * `teethOnly` draws just the tooth outline at the current origin, with no
   * part placement.
   */
  draw(
    kw: GearOptions & { teethOnly?: boolean; move?: string | null; callback?: Callback; label?: string },
  ): void {
    const { teethOnly = false, move = '', callback, label = '', ...rest } = kw;
    const o = resolve(rest);
    const b = this.boxes;

    const teeth = o.teeth;
    const angle = o.angle;
    const clearance = o.clearance;
    const mountHole = o.mount_hole;
    const mountRadius = o.mount_diameter * 0.5;
    const spokeCount = o.spoke_count;
    const spokeWidth = o.spoke_width;

    // boxes.py's option default is 0, never None, so the automatic branch
    // always runs: coarse involutes on big gears, fine ones on small.
    let accuracyInvolute: number;
    if (o.accuracy === 0) {
      if (teeth < 10) accuracyInvolute = 20;
      else if (teeth < 30) accuracyInvolute = 12;
      else accuracyInvolute = 6;
    } else {
      accuracyInvolute = o.accuracy;
    }
    // `int(accuracy_involute/2)` truncates.
    const accuracyCircular = Math.max(3, Math.trunc(accuracyInvolute / 2) - 1);

    const pitch = this.calcCircularPitch(o);
    const g = gearCalculations(teeth, pitch, angle, clearance, o.internal_ring, o.profile_shift * 0.01);

    let width = 2 * g.outerRadius;
    let height = width;
    if (o.internal_ring) {
      width = height = width + 2 * o.spoke_width;
    }

    if (!teethOnly && b.move(width, height, move, true, label)) return;

    const points = generateSpurPoints(
      teeth,
      g.baseRadius,
      g.pitchRadius,
      g.outerRadius,
      g.rootRadius,
      accuracyInvolute,
      accuracyCircular,
    );

    if (!teethOnly) b.moveTo(width / 2, height / 2);
    b.cc(callback, 0, 0, 0);
    b.drawPoints(points);

    if (!teethOnly && !o.internal_ring) {
      this.generateSpokes(g.rootRadius, spokeWidth, spokeCount, mountRadius, mountHole);
      b.hole(0, 0, mountHole / 2);
    } else if (!teethOnly) {
      const r = g.outerRadius + spokeWidth;
      b.savedContext(() => {
        b.moveTo(r + b.burn, 0, 90);
        b.corner(360, r);
      });
    }

    if (!teethOnly) b.move(width, height, move, false, label);
  }
}
