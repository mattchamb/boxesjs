/**
 * Automaton — not from boxes.py, which has nothing like it.
 *
 * A hand-cranked cam box: a dowel crankshaft runs through the side walls,
 * carrying a row of stations, each a cam (or a peg wheel) that drives
 * something up through the deck to a figure. The cams are the Cam generator's
 * flat-faced profiles; everything else is plain parts.
 *
 * Every part is cut from one sheet, so a pin can only pass through a part's
 * thickness. The rods, levers, brackets, cams and figure plates all lie in
 * planes across the shaft, and every pin runs along it. That is why a figure
 * plate on two rods tilts front to back: it is the only way two flat rods can
 * carry it on pins.
 *
 * Coordinates for the assembly: x along the shaft from the left wall's inner
 * face, y from the front inner face, z up from the base's inner face. The
 * crank is on the left.
 */
import { checkBolts, shelfBolts } from '../edges/bolts';
import type { BoltPolicy } from '../edges/base';
import type { FingerJointSettings } from '../edges/fingerjoint';
import { tenonFootprints, wedgeClearance } from '../edges/wedgedtenon';
import { ETCHING } from '../geom/colors';
import type { ChartData } from '../chart';
import { BOLT_PARAMS, WEDGED_TENON_PARAMS, assemblyParam } from '../params/common';
import type { ParamValues } from '../params/schema';
import type { BoxesConfig } from '../boxes';
import {
  CamPlates,
  camProfile,
  camWarnings,
  parseMotion,
  type CamProfile,
  type CamSample,
  type MotionLaw,
  type MotionSegment,
} from './cam';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

export type StationOutput =
  | { kind: 'lift' }
  | { kind: 'rocker'; arm: number; out: number }
  | { kind: 'pair'; span: number }
  | { kind: 'spin'; drive: number; driven: number };

export interface Station {
  segments: MotionSegment[];
  /** Crank angle, degrees, by which this cam's motion lags the first's. */
  phase: number;
  output: StationOutput;
  /** The block's motion lines, for the uniform-motion check. */
  motion: string;
  errors: string[];
}

export interface ParsedCams {
  stations: Station[];
  errors: string[];
}

const MAX_STATIONS = 12;

/**
 * One block per cam, separated by a blank line or `---`. A block is the Cam
 * generator's motion lines plus, optionally:
 *
 *   phase <degrees>              lag behind the first cam
 *   output lift                  the rod carries a figure (the default)
 *   output rocker [arm] [out]    the rod tips a lever pivoted `arm` along
 *   output pair [span]           with the cam before, carries a tilting plate
 *   output spin <drive> <driven> a peg wheel turning a vertical shaft
 */
export function parseCams(text: string, law: MotionLaw = 'cycloidal'): ParsedCams {
  const errors: string[] = [];
  const blocks: string[][] = [[]];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || /^-{3,}$/.test(line)) {
      if (blocks[blocks.length - 1]!.length) blocks.push([]);
    } else {
      blocks[blocks.length - 1]!.push(...line.split(';'));
    }
  }
  const filled = blocks.filter((bl) => bl.some((l) => l.replace(/#.*/, '').trim()));
  if (filled.length > MAX_STATIONS) {
    errors.push(`Only the first ${MAX_STATIONS} cams are drawn.`);
    filled.length = MAX_STATIONS;
  }

  const stations: Station[] = [];
  filled.forEach((lines, i) => {
    const name = `Cam ${i + 1}`;
    const own: string[] = [];
    let phase = 0;
    let output: StationOutput = { kind: 'lift' };
    const motion: string[] = [];
    for (const l of lines) {
      const clean = l.replace(/#.*/, '').trim().toLowerCase();
      const [verb = '', ...args] = clean.split(/[\s,]+/);
      const nums = args.map(Number);
      if (verb === 'phase') {
        if (!Number.isFinite(nums[0])) own.push(`${name}: could not read "${clean}".`);
        else phase = ((nums[0]! % 360) + 360) % 360;
      } else if (verb === 'output') {
        const [kind = '', ...rest] = args;
        const r = rest.map(Number);
        const num = (k: number, d: number) => (rest[k] === undefined ? d : Number.isFinite(r[k]) && r[k]! > 0 ? r[k]! : NaN);
        if (kind === 'lift') output = { kind: 'lift' };
        else if (kind === 'rocker') output = { kind: 'rocker', arm: num(0, 25), out: num(1, num(0, 25)) };
        else if (kind === 'pair') output = { kind: 'pair', span: num(0, 30) };
        else if (kind === 'spin') output = { kind: 'spin', drive: num(0, 12), driven: num(1, 8) };
        else own.push(`${name}: unknown output "${kind}": use lift, rocker, pair or spin.`);
        if (Object.values(output).some((v) => typeof v === 'number' && Number.isNaN(v))) {
          own.push(`${name}: could not read "${clean}".`);
          output = { kind: 'lift' };
        }
        if (output.kind === 'spin') {
          const drive: number = output.drive;
          const driven: number = output.driven;
          if (drive < 3 || driven < 3 || !Number.isInteger(drive) || !Number.isInteger(driven)) {
            own.push(`${name}: a peg wheel needs a whole number of pegs, at least three.`);
            output = { kind: 'spin', drive: Math.max(3, Math.round(drive)), driven: Math.max(3, Math.round(driven)) };
          }
        }
      } else {
        motion.push(l);
      }
    }
    const parsed = parseMotion(motion.join('\n'), law);
    const st: Station = {
      segments: parsed.segments,
      phase,
      output,
      motion: motion.join('\n'),
      errors: [...own, ...parsed.errors.map((e) => `${name}: ${e}`)],
    };
    if (output.kind === 'spin' && parsed.segments.some((g) => g.lift !== 0)) {
      st.errors.push(`${name}: a peg wheel has no motion profile; its rise and fall lines are ignored.`);
      st.segments = [{ span: 360, lift: 0, law: 'uniform' }];
    }
    // A pair joins this cam to a plain lift cam before it; one that is
    // already the second of a pair, a lever or a peg wheel cannot carry it.
    if (output.kind === 'pair' && stations[i - 1]?.output.kind !== 'lift') {
      st.errors.push(`${name}: "output pair" joins a cam to the lift cam before it, and there is none.`);
      st.output = { kind: 'lift' };
    }
    stations.push(st);
  });
  for (const st of stations) errors.push(...st.errors);
  return { stations, errors };
}

/** Displacement at a cam angle, degrees, interpolated between samples. */
export function liftAt(samples: CamSample[], angle: number): number {
  const a = ((angle % 360) + 360) % 360;
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid]!.theta <= a) lo = mid;
    else hi = mid;
  }
  const p = samples[lo]!;
  const q = samples[hi]!;
  if (q.theta - p.theta < 1e-12) return q.s;
  return p.s + ((a - p.theta) / (q.theta - p.theta)) * (q.s - p.s);
}

/**
 * The lever's angle, radians, with its underside tangent to the rod's round
 * tip: positive is the rod end raised. In the lever's plane, `h` is how far
 * the tip circle's centre sits above the pivot, `arm` how far it sits towards
 * the rod, and `q` the tip radius plus half the lever's width. The underside
 * meets the tip where `arm·sin φ + h·cos φ = -q`; the tip slides along the
 * lever as it rises, so this is not atan(lift / arm).
 */
export function rockerAngle(arm: number, h: number, q: number): number {
  const r = Math.hypot(arm, h);
  const phi = Math.asin(Math.max(-1, Math.min(1, -q / r))) - Math.atan2(h, arm);
  return -phi;
}

/** Where the rod tip touches the lever, measured along it from the pivot (negative: towards the rod). */
export function rockerContact(arm: number, h: number, tilt: number): number {
  const phi = -tilt;
  return -arm * Math.cos(phi) + h * Math.sin(phi);
}

export type Panel = 'open' | 'solid' | 'window';
export type Assembly = 'glue' | 'wedges' | 'bolts';

export interface AutomatonOptions {
  stations: Station[];
  thickness: number;
  baseRadius: number;
  direction: 1 | -1;
  pitch: number;
  /** Inner height and depth; 0 for as small as the mechanism allows. */
  h: number;
  y: number;
  shaft: number;
  shaftFit: number;
  bearingPlay: number;
  shaftPlay: number;
  handleDiameter: number;
  crankLength: number;
  rodWidth: number;
  rodPlay: number;
  rodAbove: number;
  figureHole: number;
  footHeight: number;
  guides: 'below' | 'above';
  guideLength: number;
  guideWall: number;
  indexPin: number;
  margin: number;
  pivotPin: number;
  /** Pivot height above the deck; 0 levels the lever at mid-lift. */
  pivotHeight: number;
  pegPin: number;
  pegSpacing: number;
  pegLength: number;
  spinShaft: number;
  /**
   * How far from each wall's inner face nothing may be cut: the reach of a
   * captive nut's slot into the deck, when bolted.
   */
  wallClear?: number;
  /**
   * Spacer washers between the cams. Without them the cams are glued where
   * the layout puts them, and a collar outside the right wall keeps the
   * shaft from sliding.
   */
  washers?: boolean;
}

export interface RockerLayout {
  arm: number;
  out: number;
  /** Lever strip width, and the rounded rod tip's radius. */
  width: number;
  tipRadius: number;
  pivotY: number;
  pivotZ: number;
  /** Where along the lever, from the pivot, its straight underside starts on the rod side. */
  near: number;
  cheekWidth: number;
  /** Lever angle at each whole degree of crank, degrees. */
  tilt: number[];
}

export interface PairLayout {
  /** The station before, whose rod carries the plate's round hole. */
  partner: number;
  span: number;
  /** Pin-to-pin distance at the steepest tilt: the far end of the slot. */
  reach: number;
  width: number;
  /** Plate angle at each whole degree of crank, degrees, positive with the back rod higher. */
  tilt: number[];
}

export interface SpinLayout {
  drive: number;
  driven: number;
  /** Peg circle radii and the two discs' radii. */
  r1: number;
  r2: number;
  disc1: number;
  disc2: number;
  /** Vertical shaft, from the left wall's inner face. */
  axisX: number;
  /** Underside of the driven wheel. */
  wheelZ: number;
  /** How far the driven pegs hang below their wheel. */
  pegDrop: number;
  shaftLength: number;
}

export interface StationLayout {
  station: Station;
  /** Cam plane centre. */
  x: number;
  /** What the station puts either side of its plane, from `x`. */
  lo: number;
  hi: number;
  /** Unphased nominal cam; for a peg wheel, its disc. */
  profile: CamProfile;
  maxRadius: number;
  minRadius: number;
  /** Rod axis, and the foot's reach either side of it. */
  rodY: number;
  footMin: number;
  footMax: number;
  rodLength: number;
  /** Lift the rod's length is measured from, and its top's height there. */
  sRef: number;
  top0: number;
  /** Lift at each whole degree of crank, phase applied. */
  lift: number[];
  rocker?: RockerLayout;
  pair?: PairLayout;
  spin?: SpinLayout;
}

export interface AutomatonLayout {
  stations: StationLayout[];
  /** Washers between the wall and the first cam, between each pair of stations, and after the last. */
  washersLeft: number;
  washersBetween: number[];
  /** Centre to centre, between neighbouring cams. */
  gaps: number[];
  washersRight: number;
  washerDiameter: number;
  indexRadius: number;
  /** Inner width, depth and height. */
  W: number;
  D: number;
  H: number;
  zShaft: number;
  yAxis: number;
  deckTop: number;
  guideTop: number;
  guideBlocks: number;
  guideX: number;
  guideY: number;
  dowels: { name: string; diameter: number; length: number; count: number }[];
  warnings: { message: string; param: string }[];
}

/** The automaton's parts, placed. Pure, so the tests can hold it to the drawing. */
export function automatonLayout(o: AutomatonOptions): AutomatonLayout {
  const t = o.thickness;
  const warnings: { message: string; param: string }[] = [];
  const warn = (message: string, param: string) => {
    if (!warnings.some((w) => w.message === message)) warnings.push({ message, param });
  };

  const stacked = o.washers !== false;
  const indexRadius = o.indexPin > 0 ? o.shaft / 2 + o.indexPin / 2 + 2 : 0;
  const washerDiameter = o.indexPin > 0 ? 2 * (indexRadius + o.indexPin / 2 + 2) : o.shaft + 8;
  const guideBlocks = Math.max(0, Math.ceil((o.guideLength - t) / t - 1e-9));
  const guideX = t + o.rodPlay + 2 * o.guideWall;
  const guideY = o.rodWidth + o.rodPlay + 2 * o.guideWall;
  const cheekGap = o.rodPlay / 2;
  const pegR = o.pegPin / 2;

  // Pass 1: everything that does not depend on where the deck ends up.
  const st = o.stations.map((station, i) => {
    let profile: CamProfile;
    let spin: SpinLayout | undefined;
    if (station.output.kind === 'spin') {
      const { drive, driven } = station.output;
      const r1 = (drive * o.pegSpacing) / (2 * Math.PI);
      const r2 = (driven * o.pegSpacing) / (2 * Math.PI);
      const disc1 = r1 + pegR + 2;
      profile = camProfile({ segments: [{ span: 360, lift: 0, law: 'uniform' }], baseRadius: disc1, follower: 'flat', rollerRadius: 0, offset: 0, direction: o.direction, burn: 0 });
      spin = { drive, driven, r1, r2, disc1, disc2: r2 + pegR + 2, axisX: 0, wheelZ: 0, pegDrop: 0, shaftLength: 0 };
      if (o.pegSpacing < 2 * o.pegPin) warn(`Cam ${i + 1}: the pegs are closer than two diameters apart and will not mesh cleanly.`, 'peg_spacing');
      if (r1 - pegR - 1 < Math.max(stacked ? washerDiameter / 2 + 0.5 : 0, indexRadius + o.indexPin / 2 + 1, o.shaft / 2 + 2)) {
        warn(
          `Cam ${i + 1}: the drive wheel's pegs sit too near the shaft${stacked ? '; they would meet the washers' : ''}. Use more pegs or a wider spacing.`,
          'peg_spacing',
        );
      }
      if (r2 - pegR - 1 < o.spinShaft / 2 + 1) warn(`Cam ${i + 1}: the driven wheel's pegs meet its shaft. Use more pegs or a wider spacing.`, 'peg_spacing');
    } else {
      profile = camProfile({ segments: station.segments, baseRadius: o.baseRadius, follower: 'flat', rollerRadius: 0, offset: 0, direction: o.direction, burn: 0 });
    }
    const radii = profile.outline.map(([x, y]) => Math.hypot(x, y));
    const ss = profile.samples.map((x) => x.s);
    const lift = Array.from({ length: 361 }, (_, k) => liftAt(profile.samples, k - station.phase));
    return { station, profile, spin, maxRadius: Math.max(...radii), minRadius: Math.min(...radii), sMin: Math.min(...ss), sMax: Math.max(...ss), lift };
  });

  // Rod axes: a pair's rods stand either side of the shaft line, so their
  // guides do not meet though their planes are close.
  const rodOffset = st.map((x, i) => {
    const next = st[i + 1]?.station.output;
    if (next?.kind === 'pair') return -next.span / 2;
    if (x.station.output.kind === 'pair') return x.station.output.span / 2;
    return 0;
  });

  const feet = st.map((x, i) => {
    const e = rodOffset[i]!;
    const [a, c] = x.profile.faceReach;
    return {
      footMin: Math.min(a - e - 2, -o.rodWidth / 2 - 1),
      footMax: Math.max(c - e + 2, o.rodWidth / 2 + 1),
    };
  });

  // Extents along the shaft, for spacing the stations.
  const ext = st.map((x) => {
    let half = Math.max(t / 2, guideX / 2);
    if (x.station.output.kind === 'rocker') half = Math.max(half, t / 2 + cheekGap + t);
    if (x.spin) {
      const axis = t / 2 + o.pegLength / 2 + x.spin.r2;
      const block = (o.spinShaft + 2 * o.guideWall) / 2;
      return { lo: Math.min(-t / 2, axis - Math.max(x.spin.disc2, block)), hi: Math.max(t / 2 + o.pegLength + 1, axis + Math.max(x.spin.disc2, block)), axis };
    }
    return { lo: -half, hi: half, axis: 0 };
  });

  // The stack along the shaft. With washers it is a whole number of sheets
  // between cams; without, the cams are glued where they are asked to be.
  const washersBetween: number[] = [];
  const gaps: number[] = [];
  for (let i = 1; i < st.length; i++) {
    if (st[i]!.station.output.kind === 'pair') {
      // Rod, the plate between them, rod: three sheets' pitch leaves half a
      // sheet's clearance either side of the plate.
      washersBetween.push(stacked ? 2 : 0);
      gaps.push(3 * t);
      continue;
    }
    const need = ext[i - 1]!.hi - ext[i]!.lo + 1;
    const want = stacked ? Math.max(0, Math.round((o.pitch - t) / t)) : o.pitch;
    const min = stacked ? Math.max(0, Math.ceil((need - t) / t - 1e-9)) : need;
    const gap = (k: number) => (stacked ? (k + 1) * t : k);
    if (min > want + 1e-9) {
      warn(`Cams ${i} and ${i + 1} need ${+gap(min).toFixed(1)} mm between them, so they are spaced that far apart.`, 'pitch');
    }
    washersBetween.push(stacked ? Math.max(want, min) : 0);
    gaps.push(gap(Math.max(want, min)));
  }
  const clear = Math.max(1, o.wallClear ?? 0);
  // From each wall's inner face to the nearest cam plane, less half the end float.
  const end = (reach: number) => {
    const k = Math.max(1, Math.ceil((reach + clear - t / 2 - o.shaftPlay / 2) / t - 1e-9));
    return stacked ? { washers: k, gap: k * t + t / 2 } : { washers: 0, gap: Math.max(reach + clear, t / 2 + 1) };
  };
  const left = st.length ? end(-ext[0]!.lo) : { washers: 0, gap: 0 };
  const right = st.length ? end(ext[ext.length - 1]!.hi) : { washers: 0, gap: 0 };
  const washersLeft = left.washers;
  const washersRight = right.washers;

  const xs: number[] = [];
  let x = o.shaftPlay / 2 + left.gap;
  st.forEach((_, i) => {
    if (i > 0) x += gaps[i - 1]!;
    xs.push(x);
  });
  const W = st.length ? x + right.gap + o.shaftPlay / 2 : 40;

  // Heights.
  const maxR = Math.max(o.baseRadius, ...st.map((x) => x.maxRadius));
  const zShaft = maxR + 3;
  const guidesBelow = o.guides === 'below' ? guideBlocks * t : 0;
  let hNeeded = zShaft + maxR;
  for (const x of st) {
    if (x.spin) {
      const wheelZ = zShaft + x.spin.disc1 + 1.5;
      hNeeded = Math.max(hNeeded, wheelZ + t + 1 + (o.guides === 'below' ? guideBlocks * t : 0));
    } else {
      hNeeded = Math.max(hNeeded, zShaft + o.baseRadius + x.sMax + o.footHeight + 2 + guidesBelow);
    }
  }
  hNeeded = Math.ceil(hNeeded);
  const H = o.h > 0 ? o.h : hNeeded;
  if (o.h > 0 && o.h < hNeeded) warn(`The mechanism needs at least ${hNeeded} mm of height inside.`, 'h');
  const deckTop = H + t;
  const guideTop = deckTop + (o.guides === 'above' ? guideBlocks * t : 0);

  // Depth, about the shaft line.
  const half: number[] = [maxR + o.margin];
  st.forEach((x, i) => {
    const e = rodOffset[i]!;
    half.push(Math.abs(e + feet[i]!.footMin) + 2, Math.abs(e + feet[i]!.footMax) + 2, Math.abs(e) + guideY / 2 + 2);
    if (x.station.output.kind === 'rocker') half.push(Math.abs(e) + x.station.output.arm + (o.pivotPin + 8) / 2 + 2);
    if (x.spin) half.push(x.spin.disc2 + 2);
  });
  const dNeeded = Math.ceil(2 * Math.max(...half));
  const D = o.y > 0 ? o.y : dNeeded;
  if (o.y > 0 && o.y < dNeeded) warn(`The mechanism needs at least ${dNeeded} mm of depth inside.`, 'y');
  const yAxis = D / 2;

  // Pass 2: rods, levers, plates and wheels.
  const tipRadius = o.rodWidth / 2;
  const layouts: StationLayout[] = st.map((x, i) => ({
    station: x.station,
    x: xs[i]!,
    lo: ext[i]!.lo,
    hi: ext[i]!.hi,
    profile: x.profile,
    maxRadius: x.maxRadius,
    minRadius: x.minRadius,
    rodY: yAxis + rodOffset[i]!,
    footMin: feet[i]!.footMin,
    footMax: feet[i]!.footMax,
    rodLength: 0,
    sRef: x.sMin,
    top0: guideTop + o.rodAbove,
    lift: x.lift,
    ...(x.spin ? { spin: x.spin } : {}),
  }));

  layouts.forEach((L, i) => {
    const out = L.station.output;
    const name = `Cam ${i + 1}`;
    if (out.kind === 'rocker') {
      const width = Math.max(o.pivotPin, o.figureHole) + 6;
      const q = tipRadius + width / 2;
      const arm = Math.max(out.arm, q + 3);
      if (arm > out.arm) warn(`${name}: the lever arm is too short to rest on the rod; it is lengthened to ${+arm.toFixed(1)} mm.`, 'cams');
      const tipZ = (s: number) => L.top0 - tipRadius + (s - L.sRef);
      const mid = (Math.min(...L.lift) + Math.max(...L.lift)) / 2;
      const pivotZ = o.pivotHeight > 0 ? deckTop + o.pivotHeight : tipZ(mid) + q;
      const tilts = L.lift.map((s) => rockerAngle(arm, tipZ(s) - pivotZ, q));
      const contacts = L.lift.map((s, k) => rockerContact(arm, tipZ(s) - pivotZ, tilts[k]!));
      const near = Math.min(...contacts) - 1;
      const cheekWidth = o.pivotPin + 8;
      L.rocker = { arm, out: out.out, width, tipRadius, pivotY: L.rodY + arm, pivotZ, near, cheekWidth, tilt: tilts.map((a) => a / DEG) };

      const maxTilt = Math.max(...tilts.map(Math.abs)) / DEG;
      if (maxTilt > 45) warn(`${name}: the lever tilts ${maxTilt.toFixed(0)}°; past about 45° it can slip off the rod. Use a longer arm or less lift.`, 'cams');
      // The far end swings down as the rod end rises.
      const lowest = Math.min(...tilts.map((a) => pivotZ - out.out * Math.sin(a) - width / 2));
      if (lowest < deckTop + 1) warn(`${name}: the lever's far end reaches the deck. Raise the pivot or shorten the lever.`, 'pivot_height');
      if (pivotZ - deckTop < cheekWidth / 2 + 1) warn(`${name}: the pivot is too low for its bracket.`, 'pivot_height');
      const clear = (o.guides === 'above' ? guideY / 2 : (o.rodWidth + o.rodPlay) / 2) + 1;
      if (arm - cheekWidth / 2 < clear) warn(`${name}: the lever's bracket meets the rod's guide; use a longer arm.`, 'cams');
    }
    if (out.kind === 'pair') {
      const A = layouts[i - 1]!;
      const sRef = Math.min(A.sRef, L.sRef);
      const tilts = L.lift.map((s, k) => Math.atan2(s - A.lift[k]!, out.span));
      const steep = Math.max(...tilts.map(Math.abs));
      const reach = out.span / Math.cos(steep);
      const width = o.pivotPin + 6;
      // The plate's lowest point over the turn, from the front pin's height.
      const m = Math.min(...A.lift.map((s, k) => Math.min(s - sRef, s - sRef + reach * Math.sin(tilts[k]!))));
      const z0 = guideTop + 1 + width / 2 - m;
      const top0 = guideTop + Math.max(o.rodAbove, z0 + tipRadius - guideTop);
      A.sRef = L.sRef = sRef;
      A.top0 = L.top0 = top0;
      L.pair = { partner: i - 1, span: out.span, reach, width, tilt: tilts.map((a) => a / DEG) };
      if (steep / DEG > 45) warn(`${name}: the plate tilts ${(steep / DEG).toFixed(0)}°; widen the span or reduce the difference in lift.`, 'cams');
      if (out.span < guideY + 1) warn(`${name}: the two rods' guides meet; use a wider span.`, 'cams');
      if (o.pivotPin > o.rodWidth - 2) warn('The pins leave less than a millimetre of rod either side; use wider rods or thinner pins.', 'rod_width');
    }
    if (L.spin) {
      const sp = L.spin;
      sp.axisX = L.x + ext[i]!.axis;
      sp.wheelZ = zShaft + sp.disc1 + 1.5;
      sp.pegDrop = sp.wheelZ - (zShaft + sp.r1) + pegR;
      sp.shaftLength = Math.ceil(guideTop + t + o.rodAbove - sp.wheelZ);
    }
  });
  layouts.forEach((L, i) => {
    L.rodLength = L.top0 - (zShaft + o.baseRadius + L.sRef);
    const freeLift = L.station.output.kind === 'lift' && !layouts[i + 1]?.pair;
    if (freeLift && o.figureHole > o.rodWidth - 2) {
      warn('The figure hole leaves less than a millimetre of rod either side; it is left out.', 'figure_hole');
    }
  });

  for (const L of layouts) {
    if (L.spin) continue;
    if (o.indexPin > 0 && indexRadius + o.indexPin / 2 + 1.5 > L.minRadius) {
      warn('The index pin does not fit inside the cams; use a thinner pin or a larger base circle.', 'index_pin');
    }
  }

  const dowels: AutomatonLayout['dowels'] = [
    // Through both walls and the crank, and a collar when there are no washers.
    { name: 'Shaft', diameter: o.shaft, length: Math.ceil(W + (stacked ? 3 : 4) * t + 5), count: 1 },
    { name: 'Handle', diameter: o.handleDiameter, length: Math.ceil(t + 30), count: 1 },
  ];
  if (o.indexPin > 0) dowels.push({ name: 'Index pin', diameter: o.indexPin, length: Math.floor(W - o.shaftPlay), count: 1 });
  const rockers = layouts.filter((L) => L.rocker).length;
  if (rockers) dowels.push({ name: 'Lever pin', diameter: o.pivotPin, length: Math.ceil(3 * t + 2 * cheekGap + 2), count: rockers });
  const pairs = layouts.filter((L) => L.pair).length;
  if (pairs) dowels.push({ name: 'Plate pin', diameter: o.pivotPin, length: Math.ceil(2.5 * t + 1), count: 2 * pairs });
  for (const L of layouts) {
    if (!L.spin) continue;
    const k = layouts.indexOf(L) + 1;
    dowels.push(
      { name: `Spin shaft ${k}`, diameter: o.spinShaft, length: L.spin.shaftLength, count: 1 },
      { name: `Drive pegs ${k}`, diameter: o.pegPin, length: Math.ceil(t + o.pegLength), count: L.spin.drive },
      { name: `Driven pegs ${k}`, diameter: o.pegPin, length: Math.ceil(t + L.spin.pegDrop), count: L.spin.driven },
    );
  }

  return {
    stations: layouts,
    washersLeft,
    washersBetween,
    gaps,
    washersRight,
    washerDiameter,
    indexRadius,
    W,
    D,
    H,
    zShaft,
    yAxis,
    deckTop,
    guideTop,
    guideBlocks,
    guideX,
    guideY,
    dowels,
    warnings,
  };
}

/** A cam-frame outline turned by `a` radians about the shaft. */
function turn(pts: [number, number][], a: number): [number, number][] {
  const c = Math.cos(a);
  const sn = Math.sin(a);
  return pts.map(([x, y]) => [c * x - sn * y, sn * x + c * y]);
}

interface GenOptions extends AutomatonOptions {
  law: MotionLaw;
  cams: string;
  errors: string[];
  front: Panel;
  back: Panel;
  windowMargin: number;
  marks: boolean;
  washers: boolean;
  assembly: Assembly;
}

interface Item {
  w: number;
  h: number;
  draw: (move: string) => void;
}

class Automaton extends CamPlates {
  constructor(
    private o: GenOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /** Lays parts out left to right in rows, each row as tall as its tallest part. */
  private rows(items: Item[], maxWidth: number): void {
    let row: Item[] = [];
    let used = 0;
    const flush = () => {
      if (!row.length) return;
      const h = Math.max(...row.map((it) => it.h));
      const drawn = row;
      this.savedContext(() => {
        for (const it of drawn) it.draw('right');
      });
      this.moveTo(0, h + this.spacing);
      row = [];
      used = 0;
    };
    for (const it of items) {
      if (row.length && used + it.w > maxWidth) flush();
      row.push(it);
      used += it.w + this.spacing;
    }
    flush();
  }

  private wall(x: number, y: number, edges: string, label: string, callback?: (() => void)[], bedBolts?: (BoltPolicy | null)[]): Item {
    const e = Array.from(edges).map((c) => this.getEdge(c));
    return {
      w: x + e[3]!.spacing() + e[1]!.spacing(),
      h: y + e[0]!.spacing() + e[2]!.spacing(),
      draw: (move) => this.rectangularWall(x, y, edges, { callback, bedBolts: bedBolts ?? null, move, label }),
    };
  }

  /** A strip with round ends, `length` between their centres, holes and slots along its middle. */
  private stadium(length: number, r: number, holes: { at: number; d: number }[], slots: { from: number; to: number; d: number }[], label: string): Item {
    return {
      w: length + 2 * r,
      h: 2 * r,
      draw: (move) => {
        if (this.move(length + 2 * r, 2 * r, move, true, label)) return;
        this.moveTo(r, 0);
        this.edge(length);
        this.corner(180, r);
        this.edge(length);
        this.corner(180, r);
        for (const hl of holes) if (hl.d > 0) this.hole(hl.at, r + this.burn, hl.d / 2);
        for (const sl of slots) this.rectangularHole((sl.from + sl.to) / 2, r + this.burn, sl.to - sl.from + sl.d, sl.d, sl.d / 2);
        this.move(length + 2 * r, 2 * r, move, false, label);
      },
    };
  }

  /** A push-rod: a foot that rides the cam and a shank up through the guides. */
  private rod(L: StationLayout, label: string, hole: number, round: boolean): Item {
    const o = this.o;
    const w = o.rodWidth;
    const fw = L.footMax - L.footMin;
    const len = L.rodLength;
    const fh = o.footHeight;
    return {
      w: fw,
      h: len,
      draw: (move) => {
        if (this.move(fw, len, move, true, label)) return;
        const shank = len - fh - (round ? w / 2 : 0);
        this.edge(fw);
        this.corner(90);
        this.edge(fh);
        this.corner(90);
        this.edge(L.footMax - w / 2);
        this.corner(-90);
        this.edge(shank);
        if (round) {
          this.corner(180, w / 2);
        } else {
          this.corner(90);
          this.edge(w);
          this.corner(90);
        }
        this.edge(shank);
        this.corner(-90);
        this.edge(-w / 2 - L.footMin);
        this.corner(90);
        this.edge(fh);
        this.corner(90);
        if (hole > 0) {
          const below = round ? w / 2 : Math.max(w / 2, hole / 2 + 1.5);
          this.hole(-L.footMin, len - below + this.burn, hole / 2);
        }
        this.move(fw, len, move, false, label);
      },
    };
  }

  /** A bracket cheek: a tab into the deck, and the lever's pivot at the round top. */
  private cheek(L: StationLayout, label: string): Item {
    const t = this.thickness;
    const r = L.rocker!;
    const cw = r.cheekWidth;
    const hp = Math.max(r.pivotZ - this.layout.deckTop, cw / 2);
    const tab = cw - 4;
    return {
      w: cw,
      h: t + hp + cw / 2,
      draw: (move) => {
        if (this.move(cw, t + hp + cw / 2, move, true, label)) return;
        this.moveTo(0, t);
        this.edge((cw - tab) / 2);
        this.corner(-90);
        this.edge(t);
        this.corner(90);
        this.edge(tab);
        this.corner(90);
        this.edge(t);
        this.corner(-90);
        this.edge((cw - tab) / 2);
        this.corner(90);
        this.edge(hp);
        this.corner(180, cw / 2);
        this.edge(hp);
        this.corner(90);
        this.hole(cw / 2, hp + this.burn, this.o.pivotPin / 2);
        this.move(cw, t + hp + cw / 2, move, false, label);
      },
    };
  }

  private disc(d: number, hole: number, extra: { x: number; y: number; d: number }[], label: string): Item {
    return {
      w: d,
      h: d,
      draw: (move) =>
        this.parts.disc(d, {
          hole,
          callback: () => {
            for (const e of extra) if (e.d > 0) this.hole(e.x, e.y, e.d / 2);
          },
          move,
          label,
        }),
    };
  }

  private layout!: AutomatonLayout;

  /** The deck: a guide hole per rod, bracket slots, bearing holes for spin shafts. */
  private deckHoles(): void {
    const o = this.o;
    const t = this.thickness;
    const lay = this.layout;
    for (const L of lay.stations) {
      if (L.spin) {
        this.hole(L.spin.axisX, lay.yAxis, (o.spinShaft + o.bearingPlay) / 2);
        continue;
      }
      this.rectangularHole(L.x, L.rodY, t + o.rodPlay, o.rodWidth + o.rodPlay);
      if (L.rocker) {
        for (const side of [-1, 1]) {
          this.rectangularHole(L.x + side * (t + o.rodPlay / 2), L.rocker.pivotY, t, L.rocker.cheekWidth - 4);
        }
      }
    }
  }

  private cutList(): string {
    return this.layout.dowels
      .map((d) => `${d.count > 1 ? `${d.count} × ` : ''}${d.name}: Ø${+d.diameter.toFixed(1)} × ${d.length} mm`)
      .join('\n');
  }

  private charts_(): void {
    const lay = this.layout;
    const cams = lay.stations.filter((L) => !L.spin);
    if (!cams.length) return;
    const series = (k: number) => lay.stations.indexOf(cams[k]!) + 1;
    const chart: ChartData = {
      param: 'cams',
      title: 'Follower timing',
      xLabel: 'Crank angle',
      yLabel: 'Lift',
      xUnit: '°',
      yUnit: 'mm',
      points: [],
      series: cams.map((L, k) => ({ label: `Cam ${series(k)}`, points: L.lift.map((s, a) => [a, s] as [number, number]) })),
      xTicks: [0, 90, 180, 270, 360],
    };
    this.charts.push(chart);
    const tilting = lay.stations.filter((L) => L.rocker || L.pair);
    if (tilting.length) {
      this.charts.push({
        param: 'cams',
        title: 'Figure tilt',
        xLabel: 'Crank angle',
        yLabel: 'Tilt',
        xUnit: '°',
        yUnit: '°',
        points: [],
        series: tilting.map((L) => {
          const i = lay.stations.indexOf(L) + 1;
          return {
            label: L.rocker ? `Lever on cam ${i}` : `Plate on cams ${i - 1} & ${i}`,
            points: (L.rocker?.tilt ?? L.pair!.tilt).map((v, a) => [a, v] as [number, number]),
          };
        }),
        xTicks: [0, 90, 180, 270, 360],
      });
    }
  }

  /** Wedges on the sides' outer faces: none may meet another, hang off, or reach the bearing. */
  private checkWedges(): void {
    const lay = this.layout;
    const s = this.wedgedTenonSettings;
    const t = this.thickness;
    const bottom = s.holeInset() + t / 2;
    const tenons = [...tenonFootprints(s, 0, -t / 2, lay.D, 0), ...tenonFootprints(s, 0, lay.H + t / 2, lay.D, 0)];
    const { clash, overhang } = wedgeClearance(tenons, [
      [0, -bottom],
      [lay.D, -bottom],
      [lay.D, lay.H + bottom],
      [0, lay.H + bottom],
    ]);
    if (clash) this.warn('Two wedges meet outside the side walls. Space the tenons further apart.', 'wt_pitch');
    if (overhang) this.warn('Some wedges hang off the side walls. Shorten the wedges.', 'wt_wedge_length');
    const reach = s.wedge_length / 2;
    const r = (this.o.shaft + this.o.bearingPlay) / 2;
    if (lay.zShaft - r - 1 < -t / 2 + reach || lay.zShaft + r + 1 > lay.H + t / 2 - reach) {
      this.warn("The wedges reach the shaft's bearing hole. Shorten the wedges.", 'wt_wedge_length');
    }
  }

  render(): void {
    const o = this.o;
    const t = this.thickness;
    for (const e of o.errors) this.warn(e, 'cams');
    if (!o.stations.length) {
      this.warn('Describe at least one cam.', 'cams');
      return;
    }
    // The slot runs the bolt's length in from the joint, then a margin.
    const wallClear = o.assembly === 'bolts' ? this.bedBoltSettings[3]! + 2 : 0;
    const lay = (this.layout = automatonLayout({ ...o, wallClear }));
    for (const w of lay.warnings) this.warn(w.message, w.param);
    this.charts_();

    lay.stations.forEach((L, i) => {
      if (L.spin) return;
      camWarnings(
        L.profile,
        [],
        { follower: 'flat', rollerDiameter: 0, offset: 0, law: o.law, motion: L.station.motion, shaft: o.shaft, shaftFlat: 0 },
        (m, k) => this.warn(`Cam ${i + 1}: ${m}`, k),
        { motion: 'cams' },
      );
    });

    const { W, D, H } = lay;
    const front = o.front !== 'open';
    const back = o.back !== 'open';
    const wedged = o.assembly === 'wedges';
    const bolted = o.assembly === 'bolts';

    // Captive nuts only where the frame is held apart: the base and the deck
    // into the sides. The layout keeps the stations clear of the slots' reach
    // into the deck (`wallClear`).
    const baseBolts: BoltPolicy | null = bolted ? shelfBolts(this, D) : null;
    const deckBolts: BoltPolicy | null = bolted ? shelfBolts(this, D) : null;

    // Sides: the base and deck join along their bottom and top edges. Seen
    // from outside, the left wall has the front on its right and the right
    // wall on its left; it matters when only one of them is open.
    const joint = wedged ? 'W' : 'F';
    const sideEdges = (frontOnLeft: boolean) => {
      const f = front ? 'f' : 'e';
      const bk = back ? 'f' : 'e';
      return `${joint}${frontOnLeft ? bk : f}${joint}${frontOnLeft ? f : bk}`;
    };
    const bearing = () => this.hole(D / 2, lay.zShaft, (o.shaft + o.bearingPlay) / 2);
    const sideBolts = [baseBolts, null, deckBolts, null];
    const pe = wedged ? 'w' : 'f';
    const panelEdges = `${front ? 'f' : 'e'}${pe}${back ? 'f' : 'e'}${pe}`;
    const frame: Item[] = [
      this.wall(D, H, sideEdges(false), 'Left side', [bearing], sideBolts),
      this.wall(D, H, sideEdges(true), 'Right side', [bearing], sideBolts),
    ];
    for (const [panel, label] of [[o.front, 'Front'], [o.back, 'Back']] as const) {
      if (panel === 'open') continue;
      const m = o.windowMargin;
      const win = panel === 'window' && W - 2 * m > 5 && H - 2 * m > 5;
      if (panel === 'window' && !win) this.warn('The window margin leaves no window.', 'window_margin');
      frame.push(this.wall(W, H, 'FFFF', label, win ? [() => this.rectangularHole(W / 2, H / 2, W - 2 * m, H - 2 * m, 3)] : undefined));
    }
    const etch = () => {
      if (!o.marks) return;
      const text = this.cutList();
      const lines = text.split('\n');
      const chars = Math.max(...lines.map((l) => l.length));
      const fs = Math.min(4, (W - 6) / (chars * 0.6), (D - 6) / (lines.length * 1.4));
      if (fs < 1.5) return;
      this.text(text, W / 2, D / 2, 0, 'middle center', fs, ETCHING);
    };
    frame.push(
      this.wall(W, D, panelEdges, 'Base', [etch], [null, baseBolts, null, baseBolts]),
      this.wall(W, D, panelEdges, 'Deck', [() => this.deckHoles()], [null, deckBolts, null, deckBolts]),
    );

    // Cams, peg wheels and their rods. Every cam is turned by its phase about
    // a reference line straight down from the shaft: line those up along the
    // shaft (or put the index pin through them) and the phases are right.
    const rot = (phase: number) => -o.direction * phase * DEG;
    const ref = o.indexPin > 0 ? [{ x: 0, y: -lay.indexRadius, d: o.indexPin }] : [];
    const markInner = o.indexPin > 0 ? lay.indexRadius + o.indexPin / 2 + 1 : undefined;
    const mark = o.marks ? { angle: -Math.PI / 2, direction: o.direction, ...(markInner ? { inner: markInner } : {}) } : null;
    const cams: Item[] = [];
    const rods: Item[] = [];
    const small: Item[] = [];
    lay.stations.forEach((L, i) => {
      const k = i + 1;
      const a = rot(L.station.phase);
      const nominal = turn(L.profile.outline, a);
      const xs = nominal.map((p) => p[0]);
      const ys = nominal.map((p) => p[1]);
      const holes = [...ref];
      if (L.spin) {
        const sp = L.spin;
        for (let j = 0; j < sp.drive; j++) {
          const ang = (2 * Math.PI * j) / sp.drive;
          holes.push({ x: sp.r1 * Math.cos(ang), y: sp.r1 * Math.sin(ang), d: o.pegPin });
        }
      }
      const cut = L.spin
        ? turn(
            camProfile({ segments: [{ span: 360, lift: 0, law: 'uniform' }], baseRadius: L.spin.disc1, follower: 'flat', rollerRadius: 0, offset: 0, direction: o.direction, burn: this.burn }).outline,
            a,
          )
        : turn(
            camProfile({ segments: L.station.segments, baseRadius: o.baseRadius, follower: 'flat', rollerRadius: 0, offset: 0, direction: o.direction, burn: this.burn }).outline,
            a,
          );
      cams.push({
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
        draw: (move) =>
          this.camPlate(nominal, cut, { shaft: o.shaft - o.shaftFit, shaftFlat: 0, mark, holes, label: L.spin ? `Drive wheel ${k}` : `Cam ${k}` }, move),
      });

      if (L.spin) {
        const sp = L.spin;
        const pegs: { x: number; y: number; d: number }[] = [];
        for (let j = 0; j < sp.driven; j++) {
          const ang = (2 * Math.PI * j) / sp.driven;
          pegs.push({ x: sp.r2 * Math.cos(ang), y: sp.r2 * Math.sin(ang), d: o.pegPin });
        }
        small.push(this.disc(2 * sp.disc2, o.spinShaft - o.shaftFit, pegs, `Driven wheel ${k}`));
        small.push(this.disc(o.spinShaft + 8, o.spinShaft - o.shaftFit, [], `Collar ${k}`));
        const bs = o.spinShaft + 2 * o.guideWall;
        for (let j = 0; j < lay.guideBlocks; j++) {
          small.push(this.wall(bs, bs, 'eeee', `Bearing ${k}`, [() => this.hole(bs / 2, bs / 2, (o.spinShaft + o.bearingPlay) / 2)]));
        }
        return;
      }

      const paired = L.pair || lay.stations[i + 1]?.pair;
      const hole = paired ? o.pivotPin : L.rocker ? 0 : o.figureHole <= o.rodWidth - 2 ? o.figureHole : 0;
      rods.push(this.rod(L, `Rod ${k}`, hole, !!(paired || L.rocker)));
      for (let j = 0; j < lay.guideBlocks; j++) {
        small.push(
          this.wall(o.rodWidth + o.rodPlay + 2 * o.guideWall, t + o.rodPlay + 2 * o.guideWall, 'eeee', `Guide ${k}`, [
            () => this.rectangularHole((o.rodWidth + o.rodPlay) / 2 + o.guideWall, (t + o.rodPlay) / 2 + o.guideWall, o.rodWidth + o.rodPlay, t + o.rodPlay),
          ]),
        );
      }
      if (L.rocker) {
        const r = L.rocker;
        const fig = o.figureHole > 0 && o.figureHole <= r.width - 3 ? o.figureHole : 0;
        rods.push(
          this.stadium(r.out - r.near, r.width / 2, [
            { at: -r.near, d: o.pivotPin + o.bearingPlay },
            { at: r.out - r.near, d: fig },
          ], [], `Lever ${k}`),
        );
        small.push(this.cheek(L, `Bracket ${k}`), this.cheek(L, `Bracket ${k}`));
      }
      if (L.pair) {
        const p = L.pair;
        const d = o.pivotPin + o.bearingPlay;
        rods.push(this.stadium(p.reach, p.width / 2, [{ at: 0, d }], [{ from: p.span, to: p.reach, d }], `Plate ${k - 1}–${k}`));
      }
    });

    const washers = lay.washersLeft + lay.washersRight + lay.washersBetween.reduce((a, x) => a + x, 0);
    for (let j = 0; j < washers; j++) small.push(this.disc(lay.washerDiameter, o.shaft + o.bearingPlay, ref, 'Washer'));
    // With no washers wall to wall, the crank holds the shaft one way and this the other.
    if (!o.washers) small.push(this.disc(o.shaft + 10, o.shaft - o.shaftFit, [], 'Shaft collar'));
    const cr = Math.max(o.shaft, o.handleDiameter) / 2 + 5;
    small.push(
      this.stadium(o.crankLength, cr, [
        { at: 0, d: o.shaft - o.shaftFit },
        { at: o.crankLength, d: o.handleDiameter - o.shaftFit },
      ], [], 'Crank'),
    );

    const maxWidth = Math.max(2 * W + 2 * D, 300);
    this.rows(frame, maxWidth);
    this.rows(cams, maxWidth);
    this.rows(rods, maxWidth);
    this.rows(small, maxWidth);

    if (wedged) {
      this.checkWedges();
      this.wedges(4 * this.tenonCount(D), 'up');
    }
    if (bolted) {
      checkBolts(this, this.getEdge('f').settings as FingerJointSettings, [
        { label: 'the base', length: D, policy: baseBolts! },
        { label: 'the deck', length: D, policy: deckBolts! },
      ]);
    }
  }
}

const DEFAULT_CAMS = [
  '# A figure that bobs up and down',
  'rise 15 120',
  'dwell 60',
  'return 120',
  '---',
  '# A lever that nods',
  'phase 120',
  'output rocker 25',
  'rise 10 90 harmonic',
  'return 90 harmonic',
  '---',
  '# These two tilt a plate between them',
  'rise 12 180',
  'return 180',
  '---',
  'output pair 30',
  'phase 180',
  'rise 12 180',
  'return 180',
].join('\n');

const PANEL_CHOICES = [
  { value: 'open', label: 'Open' },
  { value: 'solid', label: 'Solid' },
  { value: 'window', label: 'Window' },
];

const panel = (v: ParamValues, key: string, d: Panel): Panel => {
  const x = s(v, key, d);
  return x === 'open' || x === 'solid' || x === 'window' ? x : d;
};

export const automaton: GeneratorDef = {
  meta: {
    id: 'automaton',
    name: 'Automaton',
    group: 'Misc',
    summary: 'Hand-cranked cam box that drives figures on its deck',
    description:
      'A box with a crankshaft through its sides, carrying a row of cams that push rods up through the deck. ' +
      'Describe each cam as in the Cam generator, one block per cam separated by a blank line or "---", and say ' +
      'what it drives: "output lift" (the default) moves a figure on the rod up and down; "output rocker 25" ' +
      'tips a lever pivoted 25 mm along, which falls back under its own weight; "output pair 30" joins a cam ' +
      'to the one before, their rods 30 mm apart front to back carrying a plate that tilts and lifts; ' +
      '"output spin 12 8" makes a peg wheel of 12 pegs instead of a cam, driving one of 8 on a vertical ' +
      'shaft through the deck, which turns 12/8 times for each turn of the crank. ' +
      'Add "phase 90" to have a cam lag 90° behind the first. The shaft, handle and pins are dowel; their ' +
      'lengths are etched inside the base. Spacer washers set where the cams sit on the shaft; without them, ' +
      'glue each cam under its rod. Line up the marks on the cams along a pencil line on the shaft, ' +
      'or push the index pin through them, and the phases are right.',
  },
  params: [
    {
      key: 'cams',
      kind: 'text',
      multiline: true,
      label: 'Cams',
      default: DEFAULT_CAMS,
      placeholder: 'rise 15 120\nreturn 120\n---\nphase 180\noutput rocker 25\nrise 10 90\nreturn 90',
      group: 'dimensions',
      help: 'One block per cam, separated by a blank line or ---. Motion lines as in the Cam generator, plus "phase <°>" and "output lift | rocker <arm> [<out>] | pair <span> | spin <drive pegs> <driven pegs>".',
    },
    {
      key: 'law',
      kind: 'enum',
      label: 'Motion law',
      group: 'dimensions',
      default: 'cycloidal',
      help: 'Used where a line names none.',
      choices: [
        { value: 'cycloidal', label: 'Cycloidal' },
        { value: 'polynomial', label: '3-4-5 polynomial' },
        { value: 'harmonic', label: 'Harmonic' },
        { value: 'uniform', label: 'Uniform' },
      ],
    },
    { key: 'base_radius', kind: 'length', label: 'Base circle radius', unit: 'mm', default: 20, min: 5, max: 150, step: 0.5, group: 'dimensions', help: "Every cam's radius where its rod sits lowest." },
    {
      key: 'direction',
      kind: 'enum',
      label: 'Crank turns',
      group: 'dimensions',
      default: 'ccw',
      help: 'Seen from the crank side.',
      choices: [
        { value: 'ccw', label: 'Anticlockwise' },
        { value: 'cw', label: 'Clockwise' },
      ],
    },
    { key: 'pitch', kind: 'length', label: 'Cam spacing', unit: 'mm', default: 30, min: 3, max: 200, step: 0.5, group: 'dimensions', help: 'Between neighbouring cams; rounded to whole washers when there are washers.' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 0, min: 0, max: 600, step: 1, group: 'dimensions', help: 'Inside, base to deck. 0 for as low as the cams allow.' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 0, min: 0, max: 600, step: 1, group: 'dimensions', help: 'Inside, front to back. 0 for as shallow as the cams allow.' },
    { key: 'front', kind: 'enum', label: 'Front', group: 'dimensions', default: 'open', choices: PANEL_CHOICES },
    { key: 'back', kind: 'enum', label: 'Back', group: 'dimensions', default: 'solid', choices: PANEL_CHOICES },
    { key: 'window_margin', kind: 'length', label: 'Window frame', unit: 'mm', default: 10, min: 2, max: 100, step: 0.5, group: 'dimensions', showIf: (v) => v.front === 'window' || v.back === 'window' },
    { key: 'shaft', kind: 'length', label: 'Shaft dowel', unit: 'mm', default: 8, min: 2, max: 30, step: 0.1, group: 'dimensions' },
    { key: 'handle_diameter', kind: 'length', label: 'Handle dowel', unit: 'mm', default: 8, min: 2, max: 30, step: 0.1, group: 'dimensions' },
    { key: 'crank_length', kind: 'length', label: 'Crank length', unit: 'mm', default: 35, min: 10, max: 200, step: 0.5, group: 'dimensions', help: 'Shaft to handle.' },
    { key: 'rod_width', kind: 'length', label: 'Rod width', unit: 'mm', default: 6, min: 1, max: 30, step: 0.1, group: 'dimensions', help: 'The rods are cut from the sheet; make this the material thickness for a square rod.' },
    { key: 'rod_above', kind: 'length', label: 'Rod above deck', unit: 'mm', default: 25, min: 0, max: 300, step: 0.5, group: 'dimensions', help: 'How far each rod stands above its guide at its lowest.' },
    { key: 'figure_hole', kind: 'length', label: 'Figure pin hole', unit: 'mm', default: 2, min: 0, max: 20, step: 0.1, group: 'dimensions', help: 'In the rod or lever tips, to pin a figure to. 0 for none.' },
    {
      key: 'guides',
      kind: 'enum',
      label: 'Rod guides',
      group: 'dimensions',
      default: 'below',
      help: 'Where the laminated guide blocks go.',
      choices: [
        { value: 'below', label: 'Under the deck' },
        { value: 'above', label: 'On the deck' },
      ],
    },
    { key: 'guide_length', kind: 'length', label: 'Guide length', unit: 'mm', default: 20, min: 0, max: 100, step: 0.5, group: 'dimensions', help: 'Bearing length each rod slides through, deck included. Longer stops the rods tipping and binding.' },
    {
      key: 'washers',
      kind: 'bool',
      label: 'Spacer washers',
      default: true,
      group: 'dimensions',
      help: 'Washers between the cams set where they sit on the shaft. Off: place each cam under its rod by eye and glue it, and a collar outside the right wall stops the shaft sliding.',
    },
    { key: 'marks', kind: 'bool', label: 'Etch cam marks and dowel list', default: true, group: 'dimensions' },
    assemblyParam(['wedges', 'bolts'], {
      wedges: 'The base and the deck pass through the sides, which stand proud of them to take the wedges. The front and back fit dry.',
      bolts: 'The base and the deck are bolted to the sides. The front and back fit dry.',
    }),
    ...WEDGED_TENON_PARAMS,
    ...BOLT_PARAMS,
    { key: 'shaft_fit', kind: 'length', label: 'Press fit on dowels', unit: 'mm', default: 0.1, min: -1, max: 1, step: 0.05, group: 'advanced', help: 'How much smaller than the dowel the holes in the cams, crank and wheels are cut.' },
    { key: 'bearing_play', kind: 'length', label: 'Bearing play', unit: 'mm', default: 0.4, min: 0, max: 3, step: 0.05, group: 'advanced', help: 'Extra in the holes a dowel turns in.' },
    { key: 'shaft_play', kind: 'length', label: 'End float', unit: 'mm', default: 0.5, min: 0, max: 5, step: 0.1, group: 'advanced', help: 'Room left along the shaft between the walls.' },
    { key: 'rod_play', kind: 'length', label: 'Rod play', unit: 'mm', default: 0.4, min: 0, max: 3, step: 0.05, group: 'advanced', help: 'Extra in the guide holes.' },
    { key: 'guide_wall', kind: 'length', label: 'Guide block rim', unit: 'mm', default: 3, min: 1, max: 20, step: 0.5, group: 'advanced' },
    { key: 'foot_height', kind: 'length', label: 'Rod foot height', unit: 'mm', default: 6, min: 2, max: 40, step: 0.5, group: 'advanced' },
    { key: 'index_pin', kind: 'length', label: 'Index pin', unit: 'mm', default: 3, min: 0, max: 10, step: 0.1, group: 'advanced', help: 'A skewer through every cam and washer that sets the phases. 0 for none.' },
    { key: 'margin', kind: 'length', label: 'Cam clearance', unit: 'mm', default: 5, min: 0, max: 50, step: 0.5, group: 'advanced', help: 'Between the cams and the front and back.' },
    { key: 'pivot_pin', kind: 'length', label: 'Pivot pin', unit: 'mm', default: 3, min: 1, max: 10, step: 0.1, group: 'advanced', help: 'For levers and tilting plates.' },
    { key: 'pivot_height', kind: 'length', label: 'Lever pivot height', unit: 'mm', default: 0, min: 0, max: 200, step: 0.5, group: 'advanced', help: 'Above the deck. 0 to level each lever at its mid-lift.' },
    { key: 'peg_pin', kind: 'length', label: 'Peg dowel', unit: 'mm', default: 3, min: 1, max: 10, step: 0.1, group: 'advanced', help: 'For peg wheels.' },
    { key: 'peg_spacing', kind: 'length', label: 'Peg spacing', unit: 'mm', default: 8, min: 2, max: 50, step: 0.5, group: 'advanced', help: 'Between neighbouring pegs, the same on both wheels.' },
    { key: 'peg_length', kind: 'length', label: 'Drive peg length', unit: 'mm', default: 8, min: 2, max: 50, step: 0.5, group: 'advanced', help: 'How far the drive pegs stand out of their wheel.' },
    { key: 'spin_shaft', kind: 'length', label: 'Spin shaft dowel', unit: 'mm', default: 5, min: 2, max: 20, step: 0.1, group: 'advanced' },
  ],
  create: (v: ParamValues, config: BoxesConfig) => {
    const lawValue = s(v, 'law', 'cycloidal');
    const law = (['cycloidal', 'harmonic', 'polynomial', 'uniform'].includes(lawValue) ? lawValue : 'cycloidal') as MotionLaw;
    const cams = s(v, 'cams', DEFAULT_CAMS);
    const { stations, errors } = parseCams(cams, law);
    const assembly = s(v, 'assembly', 'glue');
    return new Automaton(
      {
        cams,
        law,
        stations,
        errors,
        thickness: config.thickness,
        baseRadius: n(v, 'base_radius', 20),
        direction: s(v, 'direction', 'ccw') === 'cw' ? -1 : 1,
        pitch: n(v, 'pitch', 30),
        h: n(v, 'h', 0),
        y: n(v, 'y', 0),
        front: panel(v, 'front', 'open'),
        back: panel(v, 'back', 'solid'),
        windowMargin: n(v, 'window_margin', 10),
        shaft: n(v, 'shaft', 8),
        shaftFit: n(v, 'shaft_fit', 0.1),
        bearingPlay: n(v, 'bearing_play', 0.4),
        shaftPlay: n(v, 'shaft_play', 0.5),
        handleDiameter: n(v, 'handle_diameter', 8),
        crankLength: n(v, 'crank_length', 35),
        rodWidth: n(v, 'rod_width', 6),
        rodPlay: n(v, 'rod_play', 0.4),
        rodAbove: n(v, 'rod_above', 25),
        figureHole: n(v, 'figure_hole', 2),
        footHeight: n(v, 'foot_height', 6),
        guides: s(v, 'guides', 'below') === 'above' ? 'above' : 'below',
        guideLength: n(v, 'guide_length', 20),
        guideWall: n(v, 'guide_wall', 3),
        indexPin: n(v, 'index_pin', 3),
        margin: n(v, 'margin', 5),
        pivotPin: n(v, 'pivot_pin', 3),
        pivotHeight: n(v, 'pivot_height', 0),
        pegPin: n(v, 'peg_pin', 3),
        pegSpacing: n(v, 'peg_spacing', 8),
        pegLength: n(v, 'peg_length', 8),
        spinShaft: n(v, 'spin_shaft', 5),
        marks: b(v, 'marks', true),
        washers: b(v, 'washers', true),
        assembly: assembly === 'wedges' || assembly === 'bolts' ? assembly : 'glue',
      },
      config,
    );
  },
};
