/**
 * Slim Light Trap Vent — not from boxes.py. The Light Trap Vent with its
 * baffles laid flat, so the box sticks out from the case by little more than
 * two baffle gaps.
 *
 * The case opening is in the back, in the top chamber; the room-side opening
 * is low on the front, or in the bottom. Between them the baffles are shelves
 * across the box, fixed to the back and the front in turn, each leaving a gap
 * at its free edge, so the air goes forward, down, back, down, and so on: an
 * S. A straight line from the back to the front only ever moves one way front
 * to back, so it cannot pass a gap at the front and then one at the back below
 * it unless the two overlap: with two baffles or more, the depth only has to
 * be a little over twice the gap, and the angles the openings allow usually
 * let it be less. It grows taller instead.
 *
 * Coordinates as the Light Trap Vent's: x across from the left wall's inner
 * face, y out from the back's inner face, z up from the bottom's inner face.
 */
import type { BoxesConfig } from '../boxes';
import { checkBolts, boltPositions, shelfBolts } from '../edges/bolts';
import type { FingerJointSettings } from '../edges/fingerjoint';
import { tenonFootprints, wedgeClearance } from '../edges/wedgedtenon';
import { ETCHING } from '../geom/colors';
import type { ParamSpec, ParamValues } from '../params/schema';
import {
  ASSEMBLY_PARAMS,
  BAFFLE_PARAMS,
  LIGHT_MARGIN,
  MARGIN_PARAM,
  MOUNT_PARAMS,
  PanelBox,
  ROOM_OPENING_PARAMS,
  SIZE_PARAMS,
  SMALLEST,
  adapt,
  cutHalf,
  mm,
  openArea,
  openingNeeds,
  perimeter,
  portOffsetParams,
  readAssembly,
  readPort,
  readPortSide,
  readVent,
  roundUp,
  sightWindow,
  span,
  ventParams,
  type BaffleBoxOptions,
  type Item,
  type Opening,
  type VentShape,
  type Window,
} from './bafflebox';
import { b, n, type GeneratorDef } from './types';

/** Wall screws are kept no further apart than this along the flange. */
const SCREW_PITCH = 200;

export interface SlimTrapOptions
  extends Pick<
    BaffleBoxOptions,
    | 'x'
    | 'y'
    | 'h'
    | 'outside'
    | 'thickness'
    | 'vent'
    | 'port'
    | 'portSide'
    | 'flange'
    | 'screw'
    | 'baffles'
    | 'gap'
    | 'assembly'
    | 'recess'
    | 'mountInset'
    | 'minPitch'
    | 'boltReach'
    | 'minBolted'
    | 'openingMargin'
  > {
  /**
   * In the bottom, how far the opening keeps from the back's and front's
   * inner faces: past their wedges when wedged.
   */
  floorClear: number;
  /** The openings' centres right of the middle, seen from the front. Their heights are set by their chambers. */
  ventDx: number;
  portDx: number;
}

export interface ShelfLayout {
  /** Centre plane, up from the bottom's inner face. */
  z: number;
  /** Fixed to the back, its gap at the front; otherwise the other way round. */
  back: boolean;
}

export interface SlimTrapLayout {
  t: number;
  xi: number;
  hi: number;
  yi: number;
  vent: VentShape;
  /** The vent's centre on the back, in its inner coordinates (x, z). */
  ventAt: [number, number];
  /**
   * The room-side opening as cut, and its centre: in the front's inner
   * coordinates (x, z), or in the bottom's (x, y from the back).
   */
  portShape: Opening;
  port: [number, number];
  /** Each chamber's height, top to bottom. */
  chambers: number[];
  baffles: ShelfLayout[];
  gap: number;
  /** Front to back, the depth less the gap. */
  baffleLength: number;
  /** As the Light Trap Vent's, seen from the side, across the depth. */
  sight: number;
  plate: { w: number; h: number; screws: [number, number][] };
  recess: number;
  depth: number;
  sized: { param: string; message: string }[];
  warnings: { message: string; param: string }[];
}

/**
 * The layout. A width, height or depth of 0 is the smallest that works, and
 * a gap of 0 the least the airflow allows, each with a note of what set it.
 */
export function slimTrapLayout(o: SlimTrapOptions): SlimTrapLayout {
  const t = o.thickness;
  const e = o.assembly === 'wedges' ? o.recess : 0;
  const shell = o.outside ? [2 * t, 2 * t + 2 * e, 2 * t + 2 * e] : [0, 0, 0];
  const given = [o.x, o.h, o.y].map((v, k) => (v > 0 ? v - shell[k]! : 0));
  if (given.every((v) => v > 0) && o.gap > 0) return layoutAt(o, given as [number, number, number], shell);
  return sizeToFit(o, given, shell);
}

/**
 * Splits `avail` between chambers that each want at least so much: those
 * that want more than an even share get what they want, and the rest share
 * what is left alike. Short of what they want, each gets its share of it.
 */
function share(avail: number, wants: number[]): number[] {
  const total = wants.reduce((a, w) => a + w, 0);
  if (total >= avail) return wants.map((w) => (total > 0 ? (w * avail) / total : avail / wants.length));
  const fixed = new Set<number>();
  for (;;) {
    const free = wants.map((_, i) => i).filter((i) => !fixed.has(i));
    if (!free.length) return wants.map((w) => w + (avail - total) / wants.length);
    const even = (avail - [...fixed].reduce((a, i) => a + wants[i]!, 0)) / free.length;
    const over = free.filter((i) => wants[i]! > even);
    if (!over.length) return wants.map((w, i) => (fixed.has(i) ? w : even));
    for (const i of over) fixed.add(i);
  }
}

/** The height each opening's chamber wants: its cut and margins, a fan's frame, or the ring of air under a hole in the bottom. */
function chamberWants(o: SlimTrapOptions, count: number, port: Opening, vent: Opening): number[] {
  const margin = o.openingMargin * o.thickness;
  const wants = Array.from({ length: count + 1 }, () => 0);
  wants[0] = openingNeeds(vent, margin, o.boltReach)[1];
  const last =
    o.portSide === 'bottom' ? Math.min(openArea(port), openArea(vent)) / perimeter(port) : openingNeeds(port, margin, o.boltReach)[1];
  wants[count] = Math.max(wants[count]!, last);
  return wants;
}

interface Fit {
  xi: number;
  hi: number;
  yi: number;
  gap: number;
  why: [string, string, string];
}

const most = (needs: [number, string][]): [number, string] => needs.reduce((m, k) => (k[0] > m[0] ? k : m));

/**
 * Sizes left at 0, as the Light Trap Vent sizes them: a free width is the
 * one at which the box works, and then the smallest outside; the height and
 * depth follow from it.
 */
function sizeToFit(o: SlimTrapOptions, given: number[], shell: number[]): SlimTrapLayout {
  const margin = o.openingMargin * o.thickness;
  const [pw] = openingNeeds(o.port, margin, o.boltReach);
  const [vw] = openingNeeds(o.vent, margin, o.boltReach);
  const [xNeed, xWhy] = most([
    [Math.max(20, o.minBolted), o.minBolted > 20 ? 'the bolts' : 'the walls'],
    [pw + 2 * Math.abs(o.portDx), 'the opening'],
    [vw + 2 * Math.abs(o.ventDx), 'the case opening'],
  ]);

  let best: Fit;
  if (given[0]! > 0) best = fitAt(o, given, shell, given[0]!, xWhy);
  else {
    const volume = (f: Fit) => (f.xi + shell[0]!) * (f.hi + shell[1]!) * (f.yi + shell[2]!);
    // Probing leaves out the light warning, so light getting through is asked after itself.
    const works = (f: Fit) => {
      const l = layoutAt({ ...o, gap: f.gap }, [f.xi, f.hi, f.yi], shell, true);
      return l.warnings.length === 0 && !(o.baffles > 0 && l.sight > -LIGHT_MARGIN);
    };
    const better = (f: Fit, g: Fit) => {
      const [wf, wg] = [works(f), works(g)];
      return wf !== wg ? wf : volume(f) < volume(g) - 1e-6;
    };
    const lo = roundUp(xNeed, shell[0]!);
    const hiX = lo + 2 * Math.max(pw, vw) + 100;
    const step = Math.max(1, Math.ceil((hiX - lo) / 40));
    const at = (x: number) => fitAt(o, given, shell, x, xWhy);
    best = at(lo);
    for (let x = lo + step; x <= hiX; x += step) {
      const f = at(x);
      if (better(f, best)) best = f;
    }
    const near = best.xi;
    for (let x = Math.max(lo, near - step + 1); x < near + step; x++) {
      const f = at(x);
      if (better(f, best)) best = f;
    }
    if (best.xi > lo) {
      best.why[0] =
        given[1]! > 0 || given[2]! > 0
          ? 'the smallest box that works at the size you set'
          : 'making the box smallest overall: narrower, it would need deeper gaps and taller chambers';
    }
  }

  const lay = layoutAt({ ...o, gap: best.gap }, [best.xi, best.hi, best.yi], shell);
  const where = o.outside ? 'outside' : 'inside';
  const say = (k: number, inner: number) => `Smallest that works: ${Math.round((inner + shell[k]!) * 10) / 10} mm ${where}, set by ${best.why[k]}.`;
  if (given[0]! <= 0) lay.sized.push({ param: 'x', message: say(0, best.xi) });
  if (given[1]! <= 0) lay.sized.push({ param: 'h', message: say(1, best.hi) });
  if (given[2]! <= 0) lay.sized.push({ param: 'y', message: say(2, best.yi) });
  if (o.gap <= 0 && o.baffles > 0) lay.sized.push({ param: 'baffle_gap', message: `The least the airflow allows: ${best.gap} mm.` });
  return lay;
}

/** The gap, height and depth that work at inside width `xi`, each as given where it was. */
function fitAt(o: SlimTrapOptions, given: number[], shell: number[], xi: number, xWhy: string): Fit {
  const t = o.thickness;
  const count = o.baffles;
  const bottom = o.portSide === 'bottom';
  const area = Math.min(openArea(o.port), openArea(o.vent));
  const gap = o.gap > 0 ? o.gap : Math.max(1, Math.ceil(area / xi));

  // Every chamber passes the air, and is deep enough between wedges; the end
  // ones hold the openings too.
  const air = Math.max(area / xi, o.minPitch, t);
  const chambers = chamberWants(o, count, o.port, o.vent).map((w) => Math.max(w, air));
  const [hNeed, hWhy] = most([
    [20, 'the walls'],
    [chambers.reduce((a, c) => a + c, 0) + count * t, count ? 'the openings and the airflow between the baffles' : 'the openings'],
    [o.minBolted, 'the bolts'],
  ]);
  let hi = given[1]! > 0 ? given[1]! : roundUp(hNeed, shell[1]!);
  let hReason = hWhy;

  const [yNeed, yWhy] = most([
    [20, 'the walls'],
    // The ring of air between each opening and the panel facing it.
    [area / perimeter(o.vent), 'the airflow'],
    ...(bottom
      ? [[Math.max(o.port.shape === 'fan' ? o.port.size : 0, 2 * cutHalf(o.port)[1] + 2 * o.floorClear), 'the opening in the bottom'] as [number, string]]
      : [[area / perimeter(o.port), 'the airflow'] as [number, string]]),
    ...(count ? [[gap + 2 * t, 'the baffle gap'] as [number, string]] : []),
    [o.minBolted, 'the bolts'],
    ...(count && o.minBolted ? [[gap + o.minBolted, 'the bolts in the baffles'] as [number, string]] : []),
  ]);
  let yi = given[2]! > 0 ? given[2]! : roundUp(yNeed, shell[2]!);
  let yReason = yWhy;

  const probe = (h: number, y: number) => layoutAt({ ...o, gap }, [xi, h, y], shell, true);
  // Deeper, the baffles overlap more; the first depth that stops light is
  // found by halving, if any depth does.
  if (given[2]! <= 0 && count > 0 && probe(hi, yi).sight > -LIGHT_MARGIN) {
    const far = yi + 3000;
    if (probe(hi, far).sight <= -LIGHT_MARGIN) {
      let [lo, up] = [yi, far];
      while (up - lo > 1) {
        const mid = Math.floor((lo + up) / 2);
        if (probe(hi, mid).sight <= -LIGHT_MARGIN) up = mid;
        else lo = mid;
      }
      yi = roundUp(up, shell[2]!);
      if (probe(hi, yi).sight > -LIGHT_MARGIN) yi += 1;
      yReason = 'stopping light';
    }
  }

  // Knocked down, the back's corner screws must miss the vent and the
  // baffles' slots; grow the height, if it was left to us, until they do.
  const crowded = (h: number) => probe(h, yi).warnings.some((w) => /screws in the back/.test(w.message));
  for (let i = 0; i < 1000 && given[1]! <= 0 && crowded(hi); i++) [hi, hReason] = [hi + 1, 'the screws in the back'];

  return { xi, hi, yi, gap, why: [xWhy, hReason, yReason] };
}

/**
 * The layout at given inside sizes. Probing, it skips working out what gap
 * would stop light, which only the warning needs.
 */
function layoutAt(o: SlimTrapOptions, [xi, hi, yi]: [number, number, number], shell: number[], probe = false): SlimTrapLayout {
  const t = o.thickness;
  const warnings: { message: string; param: string }[] = [];
  const warn = (message: string, param: string) => warnings.push({ message, param });
  const e = o.assembly === 'wedges' ? o.recess : 0;
  const margin = o.openingMargin * t;
  const bottom = o.portSide === 'bottom';

  // Every chamber at least a thickness tall, or the slots for neighbouring
  // baffles run into each other.
  const maxBaffles = Math.max(0, Math.floor((hi - t) / (2 * t)));
  let count = o.baffles;
  if (count > maxBaffles) {
    warn(`Only ${maxBaffles} baffle${maxBaffles === 1 ? '' : 's'} fit in this height.`, 'baffles');
    count = maxBaffles;
  }

  const wants = chamberWants(o, count, o.port, o.vent);
  const least = wants.reduce((a, w) => a + w, 0) + count * t;
  if (least > hi + 1e-9) {
    warn(`The box is too short for its openings and baffles: make it at least ${mm(least + shell[1]!)} tall.`, 'h');
  }
  const chambers = share(hi - count * t, wants);
  const baffles: ShelfLayout[] = [];
  let z = hi;
  for (let i = 0; i < count; i++) {
    z -= chambers[i]!;
    // The first is fixed to the back under the vent, so light from it heads
    // for the front, and the next gap is at the back.
    baffles.push({ z: z - t / 2, back: i % 2 === 0 });
    z -= t;
  }

  let gap = o.gap;
  const minBaffle = Math.min(yi / 2, 2 * t);
  if (count > 0 && gap > yi - minBaffle) {
    warn('The gap is deeper than the box, which leaves no baffle.', 'baffle_gap');
    gap = yi - minBaffle;
  }

  // Each opening is cut to fit its chamber, or in the bottom between the back
  // and front, if it does not.
  const fitTo = (op: Opening, roomW: number, roomH: number, what: string, where: string, grow: string, keys: [string, string, string]): Opening => {
    const fit = Math.max(1, Math.min(roomW, roomH));
    if (op.shape === 'round' && op.d > fit) {
      warn(`The ${what} does not fit ${where}, so it is cut at ${mm(fit)}. Make the box ${grow}.`, keys[0]);
      return { shape: 'round', d: fit };
    }
    if (op.shape === 'rect' && (op.w > roomW || op.h > roomH)) {
      warn(`The ${what} does not fit ${where}, so it is cut to fit. Make the box ${grow}.`, op.w > roomW ? keys[1] : keys[2]);
      return { shape: 'rect', w: Math.max(1, Math.min(op.w, roomW)), h: Math.max(1, Math.min(op.h, roomH)) };
    }
    if (op.shape === 'fan' && op.size > fit + 2) {
      const d = Math.min(span(op)[0], fit);
      warn(`A ${op.size} mm fan does not fit ${where}, so only a ${mm(d)} hole is cut. Make the box ${grow}.`, 'fan_size');
      return { shape: 'round', d };
    }
    return op;
  };
  const vent = fitTo(o.vent, xi - 2, chambers[0]! - 2, 'case opening', 'the top chamber', 'wider or taller', ['vent_d', 'vent_w', 'vent_h']) as VentShape;
  const portShape = bottom
    ? fitTo(o.port, xi - 2, yi - 2 * o.floorClear, 'opening', 'the bottom', 'wider or deeper', ['duct_d', 'port_w', 'port_h'])
    : fitTo(o.port, xi - 2, chambers[count]! - 2, 'opening', 'the bottom chamber', 'wider or taller', ['duct_d', 'port_w', 'port_h']);

  // Off centre, an opening stays a millimetre inside the walls; a fan's frame does too.
  const across = (want: number, extent: number, what: string, key: string): [number, boolean] => {
    const reach = Math.max(0, (xi - extent) / 2 - 1);
    const got = Math.max(-reach, Math.min(reach, want));
    const moved = Math.abs(got - want) > 1e-9;
    if (moved) warn(`The ${what} cannot sit that far off centre and stay inside the walls: it is moved ${mm(Math.abs(got))} ${want > 0 ? 'right' : 'left'} instead.`, key);
    return [xi / 2 + got, moved];
  };
  const [vx, ventMoved] = across(o.ventDx, span(vent)[0], 'case opening', 'vent_dx');
  const [px, portMoved] = across(o.portDx, portShape.shape === 'fan' ? portShape.size - 2 : span(portShape)[0], 'opening', 'port_dx');
  const ventAt: [number, number] = [vx, hi - chambers[0]! / 2];
  // In the bottom, at the far end from the last baffle's gap, so the air
  // turns once more and light coming up meets the baffle.
  const [, hy] = cutHalf(portShape);
  const last = baffles[count - 1];
  const py = !last ? yi / 2 : last.back ? o.floorClear + hy : yi - o.floorClear - hy;
  const port: [number, number] = bottom ? [px, py] : [px, chambers[count]! / 2];

  // Anything an opening cuts nearer the joints round it than the margin
  // leaves a thin strip there: a baffle's slots below or above it, too.
  const clear = (sides: number[]) => Math.min(...sides) >= margin - 1e-6;
  const sizeKey = (op: Opening, round: string, rect: string) => (op.shape === 'round' ? round : op.shape === 'rect' ? rect : 'fan_size');
  const strip = `which leaves less than ${Math.round(margin * 10) / 10} mm between it and the joints round it. Make the box bigger, or leave a size at 0 to have it sized.`;
  {
    const [hx, hz] = cutHalf(vent);
    const below = count ? baffles[0]!.z + t / 2 : 0;
    if (vent === o.vent && !ventMoved && !clear([vx - hx, xi - vx - hx, hi - ventAt[1] - hz, ventAt[1] - hz - below])) {
      warn(`The case opening comes too near the walls, ${strip}`, sizeKey(vent, 'vent_d', 'vent_w'));
    }
  }
  {
    const [hx, hz] = cutHalf(portShape);
    const above = last ? last.z - t / 2 : hi;
    const sides = bottom ? [px - hx, xi - px - hx, py - hz, yi - py - hz] : [px - hx, xi - px - hx, port[1] - hz, above - port[1] - hz];
    if (portShape === o.port && !portMoved && !clear(sides)) {
      warn(`The opening comes too near the walls, ${strip}`, sizeKey(portShape, 'duct_d', 'port_w'));
    }
  }

  // The air has to pass each gap, each chamber, and the ring between each
  // opening and the panel facing it, at no less area than the openings.
  const area = Math.min(openArea(portShape), openArea(vent));
  if (count > 0 && gap * xi < area) {
    warn(`The gaps at the baffles' free edges are smaller than the openings and will choke the airflow: make the gap at least ${mm(area / xi)}.`, 'baffle_gap');
  }
  const lowest = Math.min(...chambers);
  if (lowest < area / xi - 1e-9) {
    warn(
      count > 0
        ? `The chambers between the baffles (${mm(lowest)}) are lower than the airflow needs (${mm(area / xi)}): use fewer baffles or make the box taller.`
        : `The box is lower than the airflow needs (${mm(area / xi)} inside) and will choke it.`,
      count > 0 ? 'baffles' : 'h',
    );
  }
  const ring = Math.max(area / perimeter(vent), bottom ? 0 : area / perimeter(portShape));
  if (yi < ring - 1e-9) warn(`The box is shallower than the airflow needs (${mm(ring)} inside) and will choke it.`, 'y');

  // Seen from the side, a line y = a + b·z: every baffle's gap is a window
  // lying flat at its two faces, and the openings in the back and front are
  // windows standing up, which a line passes moving forward or back as it
  // falls; each case is two one-sided limits at the opening's top and bottom.
  // A hole in the bottom lies flat like the gaps.
  const windowSets = (g: number): Window[][] => {
    const at = (z0: number, z1: number, lo: number, up: number) => [
      { y: z0, lo, hi: up },
      { y: z1, lo, hi: up },
    ];
    const inside = baffles.flatMap((bf) => at(bf.z - t / 2, bf.z + t / 2, bf.back ? yi - g : 0, bf.back ? yi : g));
    const standing = (z0: number, z1: number, inner: number, outer: number): Window[][] => {
      const [nearLo, nearHi] = inner < outer ? [-Infinity, inner] : [inner, Infinity];
      const [farLo, farHi] = inner < outer ? [outer, Infinity] : [-Infinity, outer];
      return [
        [{ y: z0, lo: nearLo, hi: nearHi }, { y: z1, lo: farLo, hi: farHi }],
        [{ y: z0, lo: farLo, hi: farHi }, { y: z1, lo: nearLo, hi: nearHi }],
      ];
    };
    const vh = span(vent)[1] / 2;
    const ph = span(portShape)[1] / 2;
    const backs = standing(ventAt[1] - vh, ventAt[1] + vh, 0, -t);
    const fronts = bottom ? [at(-t, 0, port[1] - ph, port[1] + ph)] : standing(port[1] - ph, port[1] + ph, yi, yi + t);
    return backs.flatMap((v) => fronts.map((p) => [...inside, ...v, ...p]));
  };
  const sightAt = (g: number) => Math.max(...windowSets(g).map(sightWindow));
  // With no baffle the openings share one chamber, face to face, and the
  // level lines between them have no slope in y = a + b·z; nothing inside a
  // plain box stops them anyway.
  const sight = count > 0 ? sightAt(gap) : Infinity;

  if (!probe && sight > -LIGHT_MARGIN) {
    const gapMax = yi - minBaffle;
    // The window only widens as the gap opens, so halve towards the widest tight one.
    let tight = -1;
    if (count > 0 && sightAt(0) <= -LIGHT_MARGIN) {
      let [lo, up] = [0, gapMax];
      if (sightAt(up) <= -LIGHT_MARGIN) tight = up;
      else {
        for (let i = 0; i < 40; i++) {
          const mid = (lo + up) / 2;
          if (sightAt(mid) <= -LIGHT_MARGIN) lo = mid;
          else up = mid;
        }
        tight = lo;
      }
    }
    const air = area / xi;
    if (tight < 0) {
      warn('Light can pass straight through: add a baffle.', 'baffles');
    } else if (tight < air) {
      // One baffle stops light only by its angle to the openings; two or more
      // by their overlap, which only depth gives.
      warn(
        `No gap both stops light (at most ${Math.floor(tight)} mm) and lets enough air through (at least ${mm(air)}): ` +
          (count < 2 ? 'add a baffle.' : 'make the box deeper, or wider.'),
        count < 2 ? 'baffles' : 'y',
      );
    } else {
      warn(`Light can pass straight through the gaps: make the gap at most ${Math.floor(tight)} mm.`, 'baffle_gap');
    }
  }

  const glued = o.assembly === 'glue';
  const pw = glued ? xi + 2 * t + 2 * o.flange : xi;
  const ph = glued ? hi + 2 * t + 2 * o.flange : hi;
  const screws: [number, number][] = [];
  const run = (len: number) => {
    const k = Math.max(1, Math.ceil(len / SCREW_PITCH));
    return Array.from({ length: k + 1 }, (_, i) => (i * len) / k);
  };
  if (glued) {
    const f2 = o.flange / 2;
    const along = run(pw - o.flange);
    const up = run(ph - o.flange);
    for (const u of along) screws.push([f2 + u, f2], [f2 + u, ph - f2]);
    for (const v of up.slice(1, -1)) screws.push([f2, f2 + v], [pw - f2, f2 + v]);
  } else {
    // Knocked down, the back goes up on its own first, screwed through its
    // corners, and the box is built round it.
    const c = o.mountInset;
    screws.push([c, c], [pw - c, c], [pw - c, ph - c], [c, ph - c]);
    const room = o.screw / 2 + 2;
    const [vw, vh] = span(vent);
    const clearOfVent = ([sx, sy]: [number, number]) => {
      const [dx, dy] = [Math.abs(sx - ventAt[0]), Math.abs(sy - ventAt[1])];
      return vent.shape === 'round' ? Math.hypot(dx, dy) > vw / 2 + room : dx > vw / 2 + room || dy > vh / 2 + room;
    };
    const clearOfSlots = ([, sy]: [number, number]) => baffles.every((bf) => !bf.back || Math.abs(sy - bf.z) > t / 2 + room);
    if (c + o.screw / 2 + 1 > Math.min(pw, ph) / 2 || !screws.every(clearOfVent)) {
      warn('The case opening leaves no room for the screws in the back\'s corners: make the box bigger or the opening smaller.', vent.shape === 'round' ? 'vent_d' : 'vent_w');
    } else if (!screws.every(clearOfSlots)) {
      warn('A baffle\'s slots leave no room for the screws in the back\'s corners: make the box taller.', 'h');
    }
  }

  return {
    t,
    xi,
    hi,
    yi,
    vent,
    ventAt,
    portShape,
    port,
    chambers,
    baffles,
    gap,
    baffleLength: yi - gap,
    sight,
    plate: { w: pw, h: ph, screws },
    recess: e,
    depth: yi + 2 * t + 2 * e,
    sized: [],
    warnings,
  };
}

class SlimLightTrap extends PanelBox {
  constructor(
    private o: SlimTrapOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const o = this.o;
    const t = this.thickness;
    const ws = this.wedgedTenonSettings;
    const wedged = o.assembly === 'wedges';
    const bolted = o.assembly === 'bolts';
    // As the Light Trap Vent's: the back's corner screws past its T-slots, an
    // opening in the bottom past the back's and front's wedges, and
    // neighbouring baffles' wedges apart.
    const slotReach = bolted ? this.bedBoltSettings[3]! + this.bedBoltSettings[1]! : 0;
    const floorClear = Math.max(o.openingMargin * t, wedged ? ws.wedge_length / 2 - t / 2 + 1 : 0, bolted ? this.bedBoltSettings[3]! + 1 : 0);
    const minPitch = wedged ? ws.wedge_length - t + 1 : t;
    const boltReach = bolted ? this.bedBoltSettings[3]! + 1 : 0;
    let minBolted = 0;
    if (bolted) {
      const fj = this.getEdge('f').settings as FingerJointSettings;
      for (minBolted = 2 * t; minBolted < 2000 && !boltPositions(fj, minBolted, shelfBolts(this, minBolted)).length; minBolted++);
    }
    const lay = slimTrapLayout({ ...o, thickness: t, recess: ws.holeInset(), mountInset: Math.max(slotReach, o.screw + 6), floorClear, minPitch, boltReach, minBolted });
    for (const w of lay.warnings) this.warn(w.message, w.param);
    for (const n of lay.sized) this.note(n.message, n.param);
    const { xi, hi, chambers } = lay;
    const count = lay.baffles.length;
    const inFloor = o.portSide === 'bottom';

    // Etched, which way up or round a panel goes where its outline and slots
    // do not show it, centred at (x, y) in the frame being drawn.
    const mark = (x: number, y: number, room: number, text: string) => {
      const fs = 6;
      if (room >= fs + 4) this.text(`↑ ${text}`, x, y, 0, 'middle center', fs, ETCHING);
    };
    // The back's holes, from its inner corner at (dx, dy). Off centre, the
    // vent would go to the other side with the back turned round; the mark
    // goes in the bottom chamber, where nothing else is.
    const back = (dx: number, dy: number) => {
      const v = lay.vent;
      const [cx, cy] = [dx + lay.ventAt[0], dy + lay.ventAt[1]];
      if (v.shape === 'round') this.hole(cx, cy, v.d / 2);
      else this.rectangularHole(cx, cy, v.w, v.h);
      for (const bf of lay.baffles) if (bf.back) this.fingerHolesAt(dx, dy + bf.z, xi, 0);
      if (o.ventDx !== 0 && count > 0) mark(dx + xi / 2, dy + chambers[count]! / 2, chambers[count]!, 'top, seen from the front');
    };
    const screws = (dx = 0, dy = 0) => {
      for (const [x, y] of lay.plate.screws) this.hole(x + dx, y + dy, o.screw / 2);
    };
    // With one baffle the front has no slots to show which way up it goes,
    // and upside down its opening would be at the top: it is always marked,
    // in the top chamber.
    const front = () => {
      for (const bf of lay.baffles) if (!bf.back) this.fingerHolesAt(0, bf.z, xi, 0);
      if (inFloor) return;
      this.cutOpening(lay.portShape, lay.port[0], lay.port[1]);
      if (count > 0) mark(xi / 2, hi - chambers[0]! / 2, chambers[0]!, o.portDx ? 'top, seen from the front' : 'top');
    };
    // The bottom's opening, at `dy` from its frame to the back's inner face.
    // Pushed to one end, turned round it would be at the other: marked with
    // which way is the front, read from inside, at the free end, or beside
    // it where the end is too short.
    const floor = (dy: number) => {
      if (!inFloor) return;
      const [x, y] = lay.port;
      this.cutOpening(lay.portShape, x, y + dy);
      const half = lay.portShape.shape === 'fan' ? lay.portShape.size / 2 : span(lay.portShape)[1] / 2;
      const [before, after] = [y - half, lay.yi - (y + half)];
      if (o.portDx === 0 && Math.abs(before - after) < 1) return;
      const fs = 6;
      if (Math.max(before, after) >= fs + 4) {
        const [mid, room] = after >= before ? [(y + half + lay.yi) / 2, after] : [(y - half) / 2, before];
        mark(xi / 2, mid + dy, room, 'front');
        return;
      }
      const wide = lay.portShape.shape === 'fan' ? lay.portShape.size / 2 : span(lay.portShape)[0] / 2;
      const [left, right] = [x - wide, xi - (x + wide)];
      if (Math.max(left, right) >= 4 * fs) mark(left >= right ? left / 2 : xi - right / 2, y + dy, fs + 4, 'front');
    };
    const label = (i: number) => `baffle ${i + 1}`;
    // Along the sides, from the back, or from the gap behind it.
    const along = (bf: (typeof lay.baffles)[number]) => (bf.back ? 0 : lay.gap);
    const L = lay.baffleLength;

    let items: Item[];
    if (wedged) items = this.wedgedParts(lay, back, screws, front, floor, label, along);
    else if (bolted) items = this.boltedParts(lay, back, screws, front, floor, label, along);
    else {
      const fl = o.flange;
      const yi = lay.yi;
      const plate = () => {
        this.fingerHolesAt(fl + t, fl + t / 2, xi, 0);
        this.fingerHolesAt(fl + t, fl + t + hi + t / 2, xi, 0);
        this.fingerHolesAt(fl + t / 2, fl + t, hi, 90);
        this.fingerHolesAt(fl + t + xi + t / 2, fl + t, hi, 90);
        back(fl + t, fl + t);
        screws();
      };
      const sideHoles = () => {
        for (const bf of lay.baffles) this.fingerHolesAt(bf.z, along(bf), L, 90);
      };
      items = [
        this.wall(lay.plate.w, lay.plate.h, 'eeee', 'back', [plate]),
        this.wall(xi, hi, 'ffff', 'front', [front]),
        this.wall(xi, yi, 'fFFF', 'top'),
        this.wall(xi, yi, 'fFFF', 'bottom', [() => floor(0)]),
        this.wall(hi, yi, 'ffFf', 'left side', [sideHoles]),
        this.wall(hi, yi, 'ffFf', 'right side', [sideHoles]),
        ...lay.baffles.map((_, i) => this.wall(xi, L, 'ffef', label(i))),
      ];
    }
    this.layOut(items);
    if (wedged) this.wedges(this.wedgeCount, 'up');
  }

  private wedgeCount = 0;

  /**
   * Bolted, as the Light Trap Vent: ClosedBox's bolted box, with the baffles
   * bolted to the sides and standing in the back or front dry. The corner
   * bolts up the back and front keep clear of the baffles' slots there.
   */
  private boltedParts(
    lay: SlimTrapLayout,
    back: (x: number, y: number) => void,
    screws: () => void,
    front: () => void,
    floor: (dy: number) => void,
    label: (i: number) => string,
    along: (bf: ShelfLayout) => number,
  ): Item[] {
    const { xi, hi, yi } = lay;
    const L = lay.baffleLength;
    const backX = shelfBolts(this, xi);
    const backH = shelfBolts(this, hi, lay.baffles.filter((bf) => bf.back).map((bf) => bf.z));
    const frontH = shelfBolts(this, hi, lay.baffles.filter((bf) => !bf.back).map((bf) => bf.z));
    const corner = shelfBolts(this, yi);
    const baffle = shelfBolts(this, L);
    const sideHoles = () => {
      for (const bf of lay.baffles) this.fingerHolesAt(bf.z, along(bf), L, 90, baffle);
    };
    const joints = [
      { label: 'the back', length: Math.min(xi, hi), policy: xi < hi ? backX : backH },
      { label: 'the front', length: Math.min(xi, hi), policy: xi < hi ? backX : frontH },
      { label: 'the corners', length: yi, policy: corner },
    ];
    if (lay.baffles.length) joints.push({ label: 'the baffles', length: L, policy: baffle });
    checkBolts(this, this.getEdge('f').settings as FingerJointSettings, joints);
    return [
      this.wall(xi, hi, 'ffff', 'back', [() => { back(0, 0); screws(); }], [backX, backH, backX, backH]),
      this.wall(xi, hi, 'ffff', 'front', [front], [backX, frontH, backX, frontH]),
      this.wall(xi, yi, 'FFFF', 'top', undefined, [backX, corner, backX, corner]),
      this.wall(xi, yi, 'FFFF', 'bottom', [() => floor(0)], [backX, corner, backX, corner]),
      this.wall(hi, yi, 'FfFf', 'left side', [sideHoles], [backH, corner, frontH, corner]),
      this.wall(hi, yi, 'FfFf', 'right side', [sideHoles], [backH, corner, frontH, corner]),
      ...lay.baffles.map((_, i) => this.wall(xi, L, 'ffef', label(i), undefined, [null, baffle, null, baffle])),
    ];
  }

  /**
   * Wedged, as the Light Trap Vent: the back, front, top, bottom and baffles
   * tenon through the walls round them, every wedge on a wall's outer face.
   * The baffles stand in the back or front dry, and are wedged to the sides.
   */
  private wedgedParts(
    lay: SlimTrapLayout,
    back: (x: number, y: number) => void,
    screws: () => void,
    front: () => void,
    floor: (dy: number) => void,
    label: (i: number) => string,
    along: (bf: ShelfLayout) => number,
  ): Item[] {
    const t = this.thickness;
    const s = this.wedgedTenonSettings;
    const { xi, hi, recess: e, depth: D } = lay;
    const L = lay.baffleLength;
    const hs = hi + 2 * t + 2 * e;
    const backLine = e + t / 2;
    const frontLine = D - e - t / 2;

    // Each hole line as [x, y, length, angle], once for the holes and once for the clearance check.
    type Line = [number, number, number, number];
    const sideLines: Line[] = [
      [e + t / 2, 0, D, 90],
      [e + t + hi + t / 2, 0, D, 90],
      [e + t, backLine, hi, 0],
      [e + t, frontLine, hi, 0],
      ...lay.baffles.map((bf): Line => [e + t + bf.z, e + t + along(bf), L, 90]),
    ];
    const capLines: Line[] = [
      [0, backLine, xi, 0],
      [0, frontLine, xi, 0],
    ];
    const check = (lines: Line[], w: number, h: number) => {
      const { clash, overhang } = wedgeClearance(
        lines.flatMap(([x, y, l, a]) => tenonFootprints(s, x, y, l, a)),
        [[0, 0], [w, 0], [w, h], [0, h]],
      );
      if (clash) this.warn('Two wedges meet outside the walls. Space the tenons further apart, or the baffles.', 'wt_pitch');
      if (overhang) this.warn('Some wedges hang off the walls. Shorten the wedges.', 'wt_wedge_length');
    };
    check(sideLines, hs, D);
    check(capLines, xi, D);

    const cap = (top: boolean) => () => {
      for (const [x, y, l, a] of capLines) this.tenonHolesAt(x, y, l, a);
      if (!top) floor(e + t);
    };
    const side = () => {
      for (const [x, y, l, a] of sideLines) this.tenonHolesAt(x, y, l, a);
    };

    const n = (l: number) => this.tenonCount(l);
    this.wedgeCount = 4 * n(xi) + 4 * n(hi) + 4 * n(D) + 2 * lay.baffles.length * n(L);
    return [
      this.wall(xi, hi, 'wwww', 'back', [() => { back(0, 0); screws(); }]),
      this.wall(xi, hi, 'wwww', 'front', [front]),
      this.wall(xi, D, 'ewew', 'top', [cap(true)]),
      this.wall(xi, D, 'ewew', 'bottom', [cap(false)]),
      this.wall(hs, D, 'eeee', 'left side', [side]),
      this.wall(hs, D, 'eeee', 'right side', [side]),
      ...lay.baffles.map((_, i) => this.wall(xi, L, 'fwew', label(i))),
    ];
  }
}

const only = (specs: ParamSpec[], keys: string[]) => specs.filter((p) => keys.includes(p.key));

export const slimLightTrapVent: GeneratorDef = {
  meta: {
    id: 'slimlighttrap',
    name: 'Slim Light Trap Vent',
    group: 'Misc',
    summary: 'Light trap vent that stands out from the case half as far, its air path an S',
    description: [
      'The Light Trap Vent with its baffles laid flat, so it sticks out from the laser cutter\'s case much less and ' +
        'is taller instead. The opening in the case goes in the top chamber of the back, and the room-side opening ' +
        'low on the front, or in the bottom. The baffles are shelves fixed to the back and the front in turn, so the ' +
        'air zig-zags down between them in an S.',
      '',
      'A straight line from the back to the front cannot pass a gap at the front and then one at the back below ' +
        'it, unless the gaps overlap. So with two baffles or more, the box never needs to be much deeper than ' +
        `twice the gap, and usually less, since a line through both gaps would have to be steeper than the openings let it be. The baffles are checked to overlap every straight line by at least ${LIGHT_MARGIN} mm, and ` +
        'it warns when they do not. One baffle stops light only at a steep angle, and needs a much deeper box.',
      '',
      'Its width, height, depth and baffle gap start at 0, which sizes the box to fit its openings. Set the ' +
        'depth to how far it may stick out, and the rest are sized round it: a shallower box needs smaller gaps, ' +
        'so it comes out wider to let the same air through.',
      '',
      '- Baffle 1 is under the case opening, fixed to the back; the next is fixed to the front, and so on. Their ' +
        'slots in the back, front and sides already alternate.',
      '- Wedged or bolted, the back has no flange. Screw it to the case on its own, then build the box round it.',
      '',
      'Paint the inside matt black, caulk the seams, and check it in a dark room with a torch inside before ' +
        'trusting it.',
    ].join('\n'),
  },
  params: [
    ...adapt(SIZE_PARAMS, { x: { default: 0 }, h: { default: 0 }, y: { default: 0, help: `Out from the case. ${SMALLEST}` } }),
    ...adapt(only(ventParams('Case opening'), ['vent_shape', 'vent_d', 'vent_w', 'vent_h', 'vent_dx']), {
      vent_dx: { help: 'From the box\'s centre, seen from the front; negative is left. Its height is the top chamber\'s. Off centre, the back is etched with which way up it goes.' },
    }),
    ...ROOM_OPENING_PARAMS.map((p) =>
      p.key === 'port_side' && p.kind === 'enum'
        ? {
            ...p,
            choices: [
              { value: 'front', label: 'Front', help: 'Low on the front, in the bottom chamber.' },
              { value: 'bottom', label: 'Bottom', help: 'Faces the floor, so light that does get out goes down. The box is made deep enough for it.' },
            ],
          }
        : p,
    ),
    ...only(portOffsetParams('Opening'), ['port_dx']),
    ...adapt(BAFFLE_PARAMS, {
      baffles: { default: 2, help: 'Two or more make the S, which stops light with the shallowest box.' },
      baffle_gap: { default: 0, help: 'Between each baffle\'s free edge and the front or back it faces. 0 for the least the airflow allows.' },
    }),
    ...MOUNT_PARAMS,
    MARGIN_PARAM,
    ...ASSEMBLY_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new SlimLightTrap(
      {
        x: n(v, 'x', 0),
        y: n(v, 'y', 0),
        h: n(v, 'h', 0),
        outside: b(v, 'outside', true),
        thickness: 0,
        vent: readVent(v),
        port: readPort(v),
        portSide: readPortSide(v),
        ventDx: n(v, 'vent_dx', 0),
        portDx: n(v, 'port_dx', 0),
        flange: n(v, 'flange', 25),
        screw: n(v, 'screw_d', 5),
        baffles: Math.max(0, Math.round(n(v, 'baffles', 2))),
        gap: n(v, 'baffle_gap', 0),
        assembly: readAssembly(v),
        // These are measured off the joints once the box is built.
        recess: 0,
        mountInset: 0,
        floorClear: 0,
        minPitch: 0,
        boltReach: 0,
        minBolted: 0,
        openingMargin: n(v, 'opening_margin', 2),
      },
      config,
    ),
};
