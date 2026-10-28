/**
 * Cam — not from boxes.py, which has no cam generator.
 *
 * A plate cam for a translating follower, designed from a displacement
 * diagram: a list of rises, dwells and returns around one turn, each with a
 * motion law. The profile is the follower's path seen from the turning cam,
 * computed in closed form rather than with the turtle, because the turtle's
 * kerf compensation rounds every vertex with an arc of radius `burn`, and on
 * a curve made of hundreds of short chords those arcs add up to a scalloped
 * edge. Here the kerf is a true normal offset of the whole curve instead.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { ETCHING } from '../geom/colors';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

export type MotionLaw = 'cycloidal' | 'harmonic' | 'polynomial' | 'uniform';
export type FollowerKind = 'knife' | 'roller' | 'flat';

export interface MotionSegment {
  /** Angle the segment spans, degrees. */
  span: number;
  /** Displacement change over the segment, mm. Zero for a dwell. */
  lift: number;
  law: MotionLaw;
}

/**
 * Normalised motion laws: displacement f(u) and its first two derivatives
 * over u ∈ [0, 1], with f(0) = 0 and f(1) = 1. Cycloidal and 3-4-5 polynomial
 * start and stop with zero acceleration, so they suit faster cams; harmonic
 * jumps in acceleration at the ends, and uniform velocity jumps in velocity,
 * which cuts a visible corner into the profile.
 */
const LAWS: Record<MotionLaw, (u: number) => [number, number, number]> = {
  cycloidal: (u) => [
    u - Math.sin(2 * Math.PI * u) / (2 * Math.PI),
    1 - Math.cos(2 * Math.PI * u),
    2 * Math.PI * Math.sin(2 * Math.PI * u),
  ],
  harmonic: (u) => [
    (1 - Math.cos(Math.PI * u)) / 2,
    (Math.PI / 2) * Math.sin(Math.PI * u),
    ((Math.PI * Math.PI) / 2) * Math.cos(Math.PI * u),
  ],
  polynomial: (u) => [
    u * u * u * (10 - 15 * u + 6 * u * u),
    30 * u * u * (1 - u) * (1 - u),
    60 * u * (1 - u) * (1 - 2 * u),
  ],
  uniform: (u) => [u, 1, 0],
};

const LAW_NAMES: Record<string, MotionLaw> = {
  cycloidal: 'cycloidal',
  cycloid: 'cycloidal',
  harmonic: 'harmonic',
  sine: 'harmonic',
  polynomial: 'polynomial',
  poly: 'polynomial',
  '345': 'polynomial',
  '3-4-5': 'polynomial',
  uniform: 'uniform',
  linear: 'uniform',
};

export interface ParsedMotion {
  segments: MotionSegment[];
  errors: string[];
}

/**
 * Reads the motion profile, one segment per line (or separated by `;`):
 *
 *   rise <mm> <degrees> [law]
 *   fall <mm> <degrees> [law]
 *   return <degrees> [law]     back down to the base circle
 *   dwell <degrees>
 *
 * Angles short of a full turn are made up with a final dwell; angles over it
 * are scaled down to fit, with a warning, so a typo still draws something.
 */
export function parseMotion(text: string, defaultLaw: MotionLaw = 'cycloidal'): ParsedMotion {
  const segments: MotionSegment[] = [];
  const errors: string[] = [];
  let level = 0;

  const lines = text.split(/[\n;]/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
  for (const line of lines) {
    const [verb = '', ...args] = line.toLowerCase().split(/[\s,]+/);
    const nums = args.map(Number);
    const lawArg = (i: number): MotionLaw | null => {
      if (args[i] === undefined) return defaultLaw;
      const law = LAW_NAMES[args[i]!];
      if (!law) errors.push(`Unknown motion law "${args[i]}" in "${line}".`);
      return law ?? null;
    };
    const valid = (count: number) => {
      if (args.length < count || nums.slice(0, count).some((x) => !Number.isFinite(x))) {
        errors.push(`Could not read "${line}".`);
        return false;
      }
      return true;
    };

    let seg: MotionSegment | null = null;
    if (verb === 'rise' || verb === 'fall') {
      if (!valid(2)) continue;
      const law = lawArg(2);
      if (!law) continue;
      seg = { span: nums[1]!, lift: verb === 'rise' ? nums[0]! : -nums[0]!, law };
    } else if (verb === 'return') {
      if (!valid(1)) continue;
      const law = lawArg(1);
      if (!law) continue;
      seg = { span: nums[0]!, lift: -level, law };
    } else if (verb === 'dwell') {
      if (!valid(1)) continue;
      seg = { span: nums[0]!, lift: 0, law: 'uniform' };
    } else {
      errors.push(`Unknown segment "${verb}": use rise, fall, return or dwell.`);
      continue;
    }
    if (seg.span <= 0) {
      errors.push(`"${line}" needs a positive angle.`);
      continue;
    }
    segments.push(seg);
    level += seg.lift;
  }

  const total = segments.reduce((a, g) => a + g.span, 0);
  if (total > 360 + 1e-9) {
    errors.push(`The segments add up to ${+total.toFixed(2)}°, more than a full turn; they are scaled to fit.`);
    for (const g of segments) g.span *= 360 / total;
  } else if (total < 360 - 1e-9) {
    segments.push({ span: 360 - total, lift: 0, law: 'uniform' });
  }
  return { segments, errors };
}

export interface CamOptions {
  segments: MotionSegment[];
  baseRadius: number;
  follower: FollowerKind;
  rollerRadius: number;
  /** Follower axis offset to the right of the cam centre; ignored for a flat face. */
  offset: number;
  /** +1 when the cam turns anticlockwise, -1 clockwise. */
  direction: 1 | -1;
  /** Outward offset applied to the cut line, i.e. the kerf. */
  burn: number;
  /** Samples per degree. */
  resolution?: number;
}

export interface CamSample {
  /** Cam angle, degrees. */
  theta: number;
  s: number;
  ds: number;
  dds: number;
}

export interface CamProfile {
  /** Cut outline in the cam's frame, centred on the shaft. */
  outline: [number, number][];
  /** Where the follower's reference point sits at each sample (pitch curve); the cam surface for knife and flat. */
  pitch: [number, number][];
  samples: CamSample[];
  /** Largest pressure angle, degrees. Zero for a flat face, whose pressure angle never changes. */
  maxPressureAngle: number;
  /** Tightest convex radius of curvature of the pitch curve away from any sudden change of speed, mm (Infinity if none). */
  minConvexRadius: number;
  /** Smallest Rb + s + s'' for a flat face; the profile is cusped where this is not positive. */
  minFlatRadius: number;
  /** Range of contact positions across a flat face, mm either side of its axis. */
  faceReach: [number, number];
  /** Displacement left over at the end of the turn: a drop the follower falls off. */
  drop: number;
  /** Effective offset after clamping to fit inside the prime circle. */
  offset: number;
  /**
   * Cam angles, degrees, where the outline folded over itself and was trimmed:
   * places the follower cannot follow the motion exactly.
   */
  trimmed: number[];
}

/**
 * Displacement and its derivatives (per radian) at every sample, segment
 * boundaries included. Where the speed changes suddenly, as at either end of
 * a uniform move, the boundary is sampled twice, once with each speed: the
 * follower is in one place but its contact turns a corner there.
 */
export function sampleMotion(segments: MotionSegment[], resolution = 4): CamSample[] {
  const out: CamSample[] = [];
  let start = 0;
  let level = 0;
  const sample = (g: MotionSegment, from: number, base: number, u: number): CamSample => {
    const beta = g.span * DEG;
    const [f, df, ddf] = LAWS[g.law](u);
    return {
      theta: from + u * g.span,
      s: base + g.lift * f,
      ds: (g.lift * df) / beta,
      dds: (g.lift * ddf) / (beta * beta),
    };
  };
  segments.forEach((g, i) => {
    const steps = Math.max(2, Math.ceil(g.span * resolution));
    for (let k = 0; k < steps; k++) out.push(sample(g, start, level, k / steps));
    const end = sample(g, start, level, 1);
    const next = segments[i + 1];
    // Each segment owns its start; its end is kept only if the next one starts
    // at a different speed. The last segment always owns 360°.
    if (!next || Math.abs(sample(next, start + g.span, level + g.lift, 0).ds - end.ds) > 1e-9) out.push(end);
    start += g.span;
    level += g.lift;
  });
  return out;
}

/**
 * The cam outline for a translating follower whose axis points up (+y) from
 * the shaft. Each sample places the follower where the displacement diagram
 * says and turns that point back through the cam angle; the cut line is that
 * curve pushed along its normal by the kerf, less the roller's radius.
 *
 * Where the follower cannot follow the motion (a sudden slowing a roller or
 * flat face would have to pivot about a point to make, or a curve tighter than
 * the roller) that offset curve folds over itself. What can actually be cut
 * is the curve with those folds trimmed off, so that is what is returned, and
 * where it happened.
 */
export function camProfile(o: CamOptions): CamProfile {
  const d = o.direction;
  const samples = sampleMotion(o.segments, o.resolution);
  const pitch: [number, number][] = [];
  const normals: [number, number][] = [];
  let maxPressureAngle = 0;
  let minFlatRadius = Infinity;
  let faceReach: [number, number] = [0, 0];

  const rr = o.follower === 'roller' ? o.rollerRadius : 0;
  const prime = o.baseRadius + rr;
  const offset = o.follower === 'flat' ? 0 : Math.max(-0.95 * prime, Math.min(0.95 * prime, o.offset));
  const s0 = Math.sqrt(prime * prime - offset * offset);

  for (const { theta, s, ds, dds } of samples) {
    // Follower frame: where the follower is, and the cam surface's normal there.
    let px: number, py: number, nx: number, ny: number;
    if (o.follower === 'flat') {
      // The face is the line y = Rb + s; it touches the envelope where the
      // contact has slid along the face by s' (towards the side the cam
      // surface is moving to).
      px = d * ds;
      py = o.baseRadius + s;
      nx = 0;
      ny = 1;
      minFlatRadius = Math.min(minFlatRadius, o.baseRadius + s + dds);
      faceReach = [Math.min(faceReach[0], px), Math.max(faceReach[1], px)];
    } else {
      px = offset;
      py = s0 + s;
      // Perpendicular to the pitch curve's tangent (d(s0+s), s' - d·e).
      const len = Math.hypot(offset - d * ds, s0 + s);
      nx = (offset - d * ds) / len;
      ny = (s0 + s) / len;
      maxPressureAngle = Math.max(maxPressureAngle, Math.abs(Math.atan2(nx, ny)) / DEG);
    }
    const a = -d * theta * DEG;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    pitch.push([c * px - sn * py, sn * px + c * py]);
    normals.push([c * nx - sn * ny, sn * nx + c * ny]);
  }

  // Seam at 0°/360°: with no drop and no change of speed the two ends
  // coincide, so drop the duplicate.
  const last = samples[samples.length - 1]!;
  const drop = last.s - samples[0]!.s;
  if (Math.abs(drop) < 1e-9 && Math.abs(last.ds - samples[0]!.ds) < 1e-9) {
    pitch.pop();
    normals.pop();
  }

  const count = pitch.length;
  // A sudden change of speed: two samples with the follower in one place.
  const corner = (i: number) => {
    const j = (i + 1) % count;
    return Math.abs(samples[i]!.s - samples[j]!.s) < 1e-9 && Math.abs((samples[j]!.theta - samples[i]!.theta) % 360) < 1e-9;
  };

  const k = o.burn - rr;
  const outline: [number, number][] = [];
  const thetas: number[] = [];
  for (let i = 0; i < count; i++) {
    const [px, py] = pitch[i]!;
    const [nx, ny] = normals[i]!;
    outline.push([px + k * nx, py + k * ny]);
    thetas.push(samples[i]!.theta);
    // At a corner the offset swings round it on an arc: the roller (or the
    // kerf) pivoting about the point. Where the corner points inward that arc
    // folds back on itself and is trimmed below.
    if (Math.abs(k) > 1e-12 && corner(i)) {
      const [mx, my] = normals[(i + 1) % count]!;
      const from = Math.atan2(ny, nx);
      const turn = Math.atan2(nx * my - ny * mx, nx * mx + ny * my);
      const steps = Math.ceil(Math.abs(turn) / DEG);
      for (let q = 1; q < steps; q++) {
        const ang = from + (turn * q) / steps;
        outline.push([px + k * Math.cos(ang), py + k * Math.sin(ang)]);
        thetas.push(samples[i]!.theta);
      }
    }
  }

  const trimmed = trimLoops(outline, thetas);

  return {
    outline,
    pitch,
    samples,
    maxPressureAngle,
    minConvexRadius: minConvexRadius(pitch),
    minFlatRadius,
    faceReach,
    drop,
    offset,
    trimmed,
  };
}

/** Where segments ab and cd cross, strictly inside both. */
function crossing(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  e: [number, number],
): [number, number] | null {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = e[0] - c[0];
  const sy = e[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-15) return null;
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den;
  const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den;
  if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
  return [a[0] + t * rx, a[1] + t * ry];
}

/**
 * Cuts the loops out of a closed outline that folds over itself, in place,
 * and returns the cam angles of those that were more than a hundredth of a
 * millimetre across. Folds are local, so each segment is only checked against
 * the next quarter of the outline; the outline is then turned half way round
 * and checked again, to catch a fold that straddles the start.
 */
function trimLoops(pts: [number, number][], thetas: number[]): number[] {
  const found: number[] = [];
  const pass = () => {
    const window = Math.max(8, Math.floor(pts.length / 4));
    for (let i = 0; i < pts.length - 3; i++) {
      let hit = -1;
      let at: [number, number] | null = null;
      const end = Math.min(pts.length - 2, i + window);
      for (let j = i + 2; j <= end; j++) {
        const x = crossing(pts[i]!, pts[i + 1]!, pts[j]!, pts[j + 1]!);
        if (x) {
          hit = j;
          at = x;
        }
      }
      if (hit < 0 || !at) continue;
      const loop = pts.slice(i + 1, hit + 1);
      const xs = loop.map((p) => p[0]);
      const ys = loop.map((p) => p[1]);
      if (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) > 0.01) {
        found.push(thetas[Math.floor((i + 1 + hit) / 2)]!);
      }
      pts.splice(i + 1, hit - i, at);
      thetas.splice(i + 1, hit - i, thetas[i + 1]!);
      i--;
    }
  };
  const rotate = (by: number) => {
    pts.push(...pts.splice(0, by));
    thetas.push(...thetas.splice(0, by));
  };
  pass();
  const first = pts[0];
  rotate(Math.floor(pts.length / 2));
  pass();
  const back = pts.indexOf(first!);
  if (back > 0) rotate(back);
  return found.sort((a, b) => a - b);
}

/**
 * Tightest radius among the convex stretches of a closed curve, from the
 * circle through each three consecutive points. Concave stretches cannot
 * undercut a roller, so they are skipped, and so are the corners left by a
 * sudden change of speed, which have no radius at all and are reported as
 * trimmed instead.
 */
function minConvexRadius(pts: [number, number][]): number {
  const count = pts.length;
  let area = 0;
  for (let i = 0; i < count; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[(i + 1) % count]!;
    area += x0 * y1 - x1 * y0;
  }
  const orient = Math.sign(area);
  let min = Infinity;
  for (let i = 0; i < count; i++) {
    const [ax, ay] = pts[(i + count - 1) % count]!;
    const [bx, by] = pts[i]!;
    const [cx, cy] = pts[(i + 1) % count]!;
    const ab = Math.hypot(bx - ax, by - ay);
    const bc = Math.hypot(cx - bx, cy - by);
    if (ab < 1e-9 || bc < 1e-9) continue;
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (cross * orient <= 1e-12) continue;
    min = Math.min(min, (ab * bc * Math.hypot(cx - ax, cy - ay)) / (2 * Math.abs(cross)));
  }
  return min;
}

export interface CamCheckOptions {
  follower: FollowerKind;
  rollerDiameter: number;
  /** The offset asked for, before `camProfile` clamped it. */
  offset: number;
  law: MotionLaw;
  /** The motion text, to tell whether any line asks for uniform motion. */
  motion: string;
  shaft: number;
  shaftFlat: number;
}

export type CamParamKey = 'motion' | 'offset' | 'base_radius' | 'law' | 'roller_diameter' | 'shaft' | 'shaft_flat';

/**
 * What can go wrong with a cam, warned on the field that would fix it. Shared
 * with the Automaton, whose fields have other names, hence `keys`.
 */
export function camWarnings(
  p: CamProfile,
  errors: string[],
  o: CamCheckOptions,
  warn: (message: string, param: string) => void,
  keys: Partial<Record<CamParamKey, string>> = {},
): void {
  const key = (k: CamParamKey) => keys[k] ?? k;
  for (const e of errors) warn(e, key('motion'));

  if (Math.abs(p.drop) > 1e-6) {
    warn(
      `The profile ends ${Math.abs(p.drop).toFixed(1)} mm ${p.drop > 0 ? 'above' : 'below'} where it starts, so it is cut ` +
        'as a sudden step at 0°. Only a knife edge can ride a step, and only one way round; add a "return" to close it.',
      key('motion'),
    );
  }
  const minS = Math.min(...p.samples.map((x) => x.s));
  if (minS < -1e-6) {
    warn(`The profile dips ${(-minS).toFixed(1)} mm inside the base circle.`, key('motion'));
  }
  if (o.follower !== 'flat' && Math.abs(p.offset) < Math.abs(o.offset)) {
    warn('The follower offset is larger than the base circle; it is reduced to fit.', key('offset'));
  }
  if (o.follower !== 'flat' && p.maxPressureAngle > 30) {
    warn(
      `The pressure angle reaches ${p.maxPressureAngle.toFixed(0)}°. Above about 30° a translating follower tends to ` +
        'jam in its guide; a larger base circle, a slower rise or an offset lowers it.',
      key('base_radius'),
    );
  }
  const undercut = o.follower === 'roller' && p.minConvexRadius < o.rollerDiameter / 2 + 0.5;
  const cusped = o.follower === 'flat' && p.minFlatRadius <= 0.5;
  if (!undercut && !cusped && p.trimmed.length) {
    // Left over once the smooth stretches are accounted for: the corners a
    // sudden change of speed leaves, which only a knife edge can ride.
    const where = [...new Set(p.trimmed.map((t) => Math.round(t) % 360))].map((t) => `${t}°`).join(', ');
    const uniform = o.law === 'uniform' || /uniform|linear/i.test(o.motion);
    warn(
      `At ${where} the speed changes suddenly, which a ${o.follower === 'roller' ? 'roller' : 'flat face'} cannot ` +
        'follow. The cam is cut so it still fits, and the follower rounds that corner off instead of following ' +
        'the motion exactly. ' +
        (uniform ? 'Uniform motion does this at the end of each move; cycloidal or 3-4-5 polynomial does not.' : ''),
      o.law === 'uniform' ? key('law') : key('motion'),
    );
  }
  if (undercut) {
    warn(
      `The tightest curve of the follower's path has a ${p.minConvexRadius.toFixed(1)} mm radius, too tight for a ` +
        `${o.rollerDiameter} mm roller: the profile would be undercut and the follower would not follow it. ` +
        'Use a smaller roller, a larger base circle or a gentler motion.',
      key('roller_diameter'),
    );
  }
  if (cusped) {
    warn(
      'The profile turns back on itself where a flat face would ride it: it rises too fast for this base circle. ' +
        'Use a larger base circle or a gentler motion.',
      key('base_radius'),
    );
  }
  const minR = Math.min(...p.outline.map(([x, y]) => Math.hypot(x, y)));
  const shaftR = o.shaft / 2;
  if (o.shaft > 0 && minR - shaftR < 2) {
    warn(`The shaft hole leaves only ${(minR - shaftR).toFixed(1)} mm of material at the cam's narrowest point.`, key('shaft'));
  }
  if (o.shaftFlat >= o.shaft && o.shaft > 0) {
    warn('The flat is as deep as the shaft is wide; the hole is cut round.', key('shaft_flat'));
  }
}

interface CamGenOptions {
  motion: string;
  law: MotionLaw;
  baseRadius: number;
  follower: FollowerKind;
  rollerDiameter: number;
  rollerHole: number;
  rollerPart: boolean;
  offset: number;
  direction: 1 | -1;
  shaft: number;
  shaftFlat: number;
  marks: boolean;
}

export interface CamPlateOptions {
  shaft: number;
  shaftFlat: number;
  /** The etched mark: its angle in the plate's frame and the way the arrow sweeps from it. */
  mark: { angle: number; direction: 1 | -1; inner?: number } | null;
  /** Extra round holes, in the plate's frame. */
  holes?: { x: number; y: number; d: number }[];
  label: string;
}

/**
 * Draws cam plates. A base class rather than a helper because the hole colour
 * is the box's protected state; the Automaton cuts its cams with it too.
 */
export abstract class CamPlates extends Boxes {
  /**
   * One plate, sized on the nominal outline (`move` already leaves a kerf's
   * room either side) and cut on the kerf-offset one, centred on the shaft.
   */
  protected camPlate(nominal: [number, number][], cut: [number, number][], o: CamPlateOptions, move = 'right'): void {
    const xs = nominal.map((q) => q[0]);
    const ys = nominal.map((q) => q[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = Math.max(...xs) - minX;
    const h = Math.max(...ys) - minY;

    if (this.move(w, h, move, true, o.label)) return;
    this.moveTo(-minX, -minY);
    cut.forEach(([x, y], i) => (i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y)));
    this.ctx.lineTo(cut[0]![0], cut[0]![1]);
    this.ctx.stroke();
    this.shaftHole(o.shaft, o.shaftFlat);
    for (const hl of o.holes ?? []) this.hole(hl.x, hl.y, hl.d / 2);
    if (o.mark) this.markings(nominal, o.shaft, o.mark);
    this.move(w, h, move, false, o.label);
  }

  private shaftHole(shaft: number, shaftFlat: number): void {
    if (shaft <= 0) return;
    if (shaftFlat <= 0 || shaftFlat >= shaft) {
      this.hole(0, 0, shaft / 2);
      return;
    }
    // A D hole, flat side up along the follower axis, so the flat lines up
    // with the 0° mark. Inset by the kerf so the shaft fits tight.
    const r = Math.max(shaft / 2 - this.burn, 0.01);
    const yf = shaft / 2 - shaftFlat - this.burn;
    const a = Math.acos(Math.max(-1, Math.min(1, yf / r)));
    this.withHoleColor(undefined, () => {
      const start = Math.PI / 2 - a;
      const sweep = 2 * Math.PI - 2 * a;
      const steps = Math.max(12, Math.ceil(sweep / (5 * DEG)));
      for (let i = 0; i <= steps; i++) {
        const t = start - (sweep * i) / steps;
        if (i === 0) this.ctx.moveTo(r * Math.cos(t), r * Math.sin(t));
        else this.ctx.lineTo(r * Math.cos(t), r * Math.sin(t));
      }
      this.ctx.lineTo(r * Math.cos(start), r * Math.sin(start));
    });
  }

  /** A line out to where the follower starts, and an arrow the way the cam turns. */
  private markings(outline: [number, number][], shaft: number, mark: NonNullable<CamPlateOptions['mark']>): void {
    const minR = Math.min(...outline.map(([x, y]) => Math.hypot(x, y)));
    const inner = mark.inner ?? shaft / 2 + 1.5;
    const outer = minR - 2;
    if (outer - inner < 4) return;
    const ang = mark.angle;
    const rm = (inner + outer) / 2;
    this.ctx.stroke();
    this.savedContext(() => {
      this.setSourceColor(ETCHING);
      this.ctx.moveTo(inner * Math.cos(ang), inner * Math.sin(ang));
      this.ctx.lineTo(outer * Math.cos(ang), outer * Math.sin(ang));
      this.ctx.stroke();

      // The arrow sweeps away from the mark in the direction of rotation.
      const d = mark.direction;
      const sweep = 40 * DEG;
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const t = ang + d * (10 * DEG + (sweep * i) / steps);
        if (i === 0) this.ctx.moveTo(rm * Math.cos(t), rm * Math.sin(t));
        else this.ctx.lineTo(rm * Math.cos(t), rm * Math.sin(t));
      }
      const tip = ang + d * (10 * DEG + sweep);
      const head = Math.min(2, (outer - inner) / 3);
      // Tangent at the tip, pointing on round the circle.
      const tx = -Math.sin(tip) * d;
      const ty = Math.cos(tip) * d;
      const [hx, hy] = [rm * Math.cos(tip), rm * Math.sin(tip)];
      for (const side of [1, -1]) {
        this.ctx.moveTo(hx, hy);
        this.ctx.lineTo(
          hx - head * tx + side * head * 0.6 * Math.cos(tip),
          hy - head * ty + side * head * 0.6 * Math.sin(tip),
        );
      }
      this.ctx.stroke();
    });
  }

}

class Cam extends CamPlates {
  constructor(
    private o: CamGenOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private profile(burn: number): CamProfile {
    const { segments } = parseMotion(this.o.motion, this.o.law);
    return camProfile({
      segments,
      baseRadius: this.o.baseRadius,
      follower: this.o.follower,
      rollerRadius: this.o.rollerDiameter / 2,
      offset: this.o.offset,
      direction: this.o.direction,
      burn,
    });
  }

  /** Displacement and velocity diagrams, for the panel under the motion profile. */
  private diagram(p: CamProfile, segments: MotionSegment[]): void {
    // A point a degree is plenty for a chart a panel wide. Both samples of a
    // sudden change of speed are kept, so it shows as the step it is.
    const stride = Math.max(1, Math.floor(p.samples.length / 360));
    const sameAngle = (i: number, j: number) => p.samples[j] !== undefined && p.samples[j]!.theta === p.samples[i]!.theta;
    const pts = p.samples.filter(
      (_, i) => i % stride === 0 || i === p.samples.length - 1 || sameAngle(i, i - 1) || sameAngle(i, i + 1),
    );
    let start = 0;
    const spans = segments.map((g) => {
      const span = { from: start, to: start + g.span, label: segmentLabel(g) };
      start += g.span;
      return span;
    });
    this.charts.push({
      param: 'motion',
      title: 'Follower displacement',
      xLabel: 'Cam angle',
      yLabel: 'Lift',
      xUnit: '°',
      yUnit: 'mm',
      points: pts.map((x) => [x.theta, x.s]),
      spans,
      xTicks: [0, 90, 180, 270, 360],
    });
    // Per degree of cam rotation rather than per second, so it holds at any
    // speed; it is what sets the pressure angle.
    this.charts.push({
      param: 'motion',
      title: 'Follower velocity',
      xLabel: 'Cam angle',
      yLabel: 'Velocity',
      xUnit: '°',
      yUnit: 'mm/°',
      points: pts.map((x) => [x.theta, x.ds * DEG]),
      spans,
      xTicks: [0, 90, 180, 270, 360],
    });
  }

  render(): void {
    const { segments, errors } = parseMotion(this.o.motion, this.o.law);
    const nominal = this.profile(0);
    const cut = this.profile(this.burn);
    const o = this.o;
    camWarnings(nominal, errors, o, (m, k) => this.warn(m, k));
    this.diagram(nominal, segments);

    // Along the follower's axis: a flat face's pitch point is where it
    // touches, which slides off the axis as the cam turns.
    const [sx, sy] = o.follower === 'flat' ? [0, 1] : nominal.pitch[0]!;
    this.camPlate(nominal.outline, cut.outline, {
      shaft: o.shaft,
      shaftFlat: o.shaftFlat,
      mark: o.marks ? { angle: Math.atan2(sy, sx), direction: o.direction } : null,
      label: 'cam',
    });

    if (this.o.follower === 'roller' && this.o.rollerPart) {
      this.parts.disc(this.o.rollerDiameter, {
        hole: this.o.rollerHole > 0 && this.o.rollerHole < this.o.rollerDiameter - 1 ? this.o.rollerHole : 0,
        move: 'right',
        label: 'roller',
      });
      if (this.o.rollerHole >= this.o.rollerDiameter - 1) {
        this.warn('The axle hole leaves less than half a millimetre of roller; it is left out.', 'roller_hole');
      }
    }
  }
}

function segmentLabel(g: MotionSegment): string {
  const law = g.law === 'polynomial' ? '3-4-5 polynomial' : g.law;
  if (g.lift === 0) return 'dwell';
  return `${g.lift > 0 ? 'rise' : 'fall'} ${+Math.abs(g.lift).toFixed(2)} mm, ${law}`;
}

const DEFAULT_MOTION = 'rise 20 120\ndwell 60\nreturn 120\ndwell 60';

export const cam: GeneratorDef = {
  meta: {
    id: 'cam',
    name: 'Cam',
    group: 'Misc',
    summary: 'Plate cam cut to a motion profile you describe',
    description:
      'A disc cam for a follower that slides up and down: describe one turn as rises, dwells and returns, ' +
      'and the profile is worked out for a knife-edge, roller or flat-faced follower. One segment per line: ' +
      '"rise 20 120" lifts 20 mm over 120°, "fall 5 30" drops 5 mm, "return 90" drops back to the base ' +
      'circle, "dwell 60" holds still. Add a motion law to any rise, fall or return (cycloidal, harmonic, ' +
      'polynomial or uniform). Angles short of a full turn finish with a dwell. The 0° mark points to where ' +
      'the follower sits at the start of the first segment, and the arrow shows which way the cam turns.',
  },
  params: [
    {
      key: 'motion',
      kind: 'text',
      multiline: true,
      label: 'Motion profile',
      default: DEFAULT_MOTION,
      placeholder: 'rise 20 120\ndwell 60\nreturn 120',
      group: 'dimensions',
      help: 'One segment per line: rise <mm> <°>, fall <mm> <°>, return <°>, dwell <°>, each optionally followed by a motion law.',
    },
    {
      key: 'law',
      kind: 'enum',
      label: 'Motion law',
      group: 'dimensions',
      default: 'cycloidal',
      help: 'Used where a line names none.',
      choices: [
        { value: 'cycloidal', label: 'Cycloidal', help: 'Smooth start and stop; the usual choice for anything fast.' },
        { value: 'polynomial', label: '3-4-5 polynomial', help: 'Smooth start and stop, a little gentler on the follower than cycloidal at peak speed.' },
        { value: 'harmonic', label: 'Harmonic', help: 'Gentlest peak speed, but the acceleration jumps at the ends of each move.' },
        { value: 'uniform', label: 'Uniform', help: 'Constant speed; the follower is jolted at the start and end of each move.' },
      ],
    },
    { key: 'base_radius', kind: 'length', label: 'Base circle radius', unit: 'mm', default: 30, min: 5, max: 300, step: 0.5, group: 'dimensions', help: "The cam's radius where the follower sits lowest." },
    {
      key: 'follower',
      kind: 'enum',
      label: 'Follower',
      group: 'dimensions',
      default: 'roller',
      choices: [
        { value: 'roller', label: 'Roller', help: 'A wheel on an axle rides the cam: low friction and wear.' },
        { value: 'knife', label: 'Knife edge', help: 'A point rides the cam. Follows any profile, but wears fast.' },
        { value: 'flat', label: 'Flat face', help: 'A flat foot rides the cam. Compact, but needs a convex profile.' },
      ],
    },
    { key: 'roller_diameter', kind: 'length', label: 'Roller diameter', unit: 'mm', default: 16, min: 2, max: 200, step: 0.5, group: 'dimensions', showIf: (v) => v.follower === 'roller' },
    { key: 'offset', kind: 'length', label: 'Follower offset', unit: 'mm', default: 0, min: -100, max: 100, step: 0.5, group: 'dimensions', showIf: (v) => v.follower !== 'flat', help: "How far the follower's line of travel sits to the right of the shaft." },
    {
      key: 'direction',
      kind: 'enum',
      label: 'Cam turns',
      group: 'dimensions',
      default: 'ccw',
      help: 'Seen from the marked face.',
      choices: [
        { value: 'ccw', label: 'Anticlockwise' },
        { value: 'cw', label: 'Clockwise' },
      ],
    },
    { key: 'shaft', kind: 'length', label: 'Shaft diameter', unit: 'mm', default: 8, min: 0, max: 100, step: 0.1, group: 'dimensions', help: '0 for no hole.' },
    { key: 'shaft_flat', kind: 'length', label: 'Shaft flat depth', unit: 'mm', default: 0, min: 0, max: 20, step: 0.1, group: 'dimensions', showIf: (v) => Number(v.shaft) > 0, help: 'For a D-shaft; 0 for a round hole.' },
    { key: 'marks', kind: 'bool', label: 'Etch 0° mark and direction', default: true, group: 'dimensions' },
    { key: 'roller_part', kind: 'bool', label: 'Cut a roller', default: true, group: 'dimensions', showIf: (v) => v.follower === 'roller' },
    { key: 'roller_hole', kind: 'length', label: 'Roller axle hole', unit: 'mm', default: 3, min: 0, max: 50, step: 0.1, group: 'dimensions', showIf: (v) => v.follower === 'roller' && v.roller_part !== false },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Cam(
      {
        motion: s(v, 'motion', DEFAULT_MOTION),
        law: (s(v, 'law', 'cycloidal') as MotionLaw) in LAWS ? (s(v, 'law', 'cycloidal') as MotionLaw) : 'cycloidal',
        baseRadius: n(v, 'base_radius', 30),
        follower: (['knife', 'roller', 'flat'].includes(s(v, 'follower')) ? s(v, 'follower') : 'roller') as FollowerKind,
        rollerDiameter: n(v, 'roller_diameter', 16),
        rollerHole: n(v, 'roller_hole', 3),
        rollerPart: b(v, 'roller_part', true),
        offset: n(v, 'offset', 0),
        direction: s(v, 'direction', 'ccw') === 'cw' ? -1 : 1,
        shaft: n(v, 'shaft', 8),
        shaftFlat: n(v, 'shaft_flat', 0),
        marks: b(v, 'marks', true),
      },
      config,
    ),
};
