/**
 * Vent Baffle Box — not from boxes.py, which has nothing like it.
 *
 * A box screwed to a wall over a vent hole, with an exhaust hose coming into
 * its front: the usual way to take a laser cutter's fumes outside. Baffles
 * across the inside make the air snake round them, which stops wind, light
 * and noise coming straight back through the wall. A blast gate on the front
 * shuts the hose off when the machine is not running, so cold air does not
 * come in through it.
 *
 * Coordinates for the assembly: x across from the left wall's inner face, z up
 * from the bottom wall's inner face, y out from the back plate's front face.
 *
 * The back plate is larger than the box and the walls stand in finger holes on
 * it, as BasedBox's do on its base, so the margin round them is a flange for
 * the wall screws. The walls and front panel join as ClosedBox's do.
 *
 * The baffles are full-width plates parallel to the wall, hung from the top and
 * stood on the bottom in turn, each leaving a gap at its free edge. They are
 * all the same part; only the holes for them in the walls alternate.
 *
 * The blast gate is three layers on the front panel's outer face: a U-shaped
 * spacer whose channel runs up past the box's top, a slider in the channel,
 * and a cover plate, bolted through the front panel. The bolts are symmetric
 * about the port, so the front panel works either way up.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { BoltPolicy } from '../edges/base';
import { checkBolts, shelfBolts } from '../edges/bolts';
import type { FingerJointSettings } from '../edges/fingerjoint';
import { tenonFootprints, wedgeClearance } from '../edges/wedgedtenon';
import { ETCHING } from '../geom/colors';
import { BOLT_PARAMS, WEDGED_TENON_PARAMS, assemblyParam } from '../params/common';
import type { ParamSpec, ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

/** How far the slider covers past the port all round, so play cannot open a crack. */
const OVERLAP = 8;
/** Slider above the box's top when shut: something to pull on. */
const HANDLE = 35;
/** The shortest length of slider that should stay in the channel when open. */
const MIN_HOLD = 20;
/** Wall screws are kept no further apart than this along the flange. */
const SCREW_PITCH = 200;
/**
 * How far a light trap's baffles must overlap the straightest line through
 * it, so a warped baffle or a sloppy joint cannot open a sliver.
 */
export const LIGHT_MARGIN = 5;

export type VentShape = { shape: 'round'; d: number } | { shape: 'rect'; w: number; h: number };
export type Opening = VentShape | { shape: 'fan'; size: number };

/** Standard case fans: the hole cut for the blades, and the square screw pattern. */
export const FANS: Record<number, { hole: number; pitch: number }> = {
  80: { hole: 76, pitch: 71.5 },
  92: { hole: 88, pitch: 82.5 },
  120: { hole: 116, pitch: 105 },
  140: { hole: 136, pitch: 124.5 },
};
const FAN_SCREW = 4.4;

/** Width and height of the hole an opening cuts. */
function span(o: Opening): [number, number] {
  if (o.shape === 'round') return [o.d, o.d];
  if (o.shape === 'rect') return [o.w, o.h];
  const d = FANS[o.size]!.hole;
  return [d, d];
}

function openArea(o: Opening): number {
  const [w, h] = span(o);
  return o.shape === 'rect' ? w * h : (Math.PI * w * h) / 4;
}

function perimeter(o: Opening): number {
  const [w, h] = span(o);
  return o.shape === 'rect' ? 2 * (w + h) : Math.PI * w;
}

export interface BaffleBoxOptions {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  thickness: number;
  vent: VentShape;
  /**
   * The vent's centre from the back's centre, right and up as seen from the
   * front. The back is etched to show which way round it goes when it is not
   * centred.
   */
  ventOffset: [number, number];
  /** The room-side opening: the duct port, or a light trap's intake. */
  port: Opening;
  /**
   * Which panel it is in. In the bottom, it sits in the front chamber, which
   * is made deep enough for it, and the first baffle stands up behind it.
   */
  portSide: 'front' | 'bottom';
  /**
   * In the bottom, how far it keeps from the front panel's inner face: past
   * the front's wedges when wedged.
   */
  frontClear: number;
  /**
   * The room-side opening's centre from the panel's centre, right and up as
   * seen from the front. In the bottom only the first applies: the front
   * chamber sets where it is front to back.
   */
  portOffset: [number, number];
  flange: number;
  screw: number;
  baffles: number;
  gap: number;
  gate: boolean;
  rail: number;
  play: number;
  bolt: number;
  /** Check that no straight line of light passes through. */
  lightTrap: boolean;
  assembly: Assembly;
  /**
   * Wedged, how far the back and front sit in from the walls' edges: the
   * tenons' hole inset, so the wedges stay on the walls.
   */
  recess: number;
  /** Knocked down, how far the back's screws sit in from its corners, clear of any T-slots. */
  mountInset: number;
}

export type Assembly = 'glue' | 'wedges' | 'bolts';

export interface GateLayout {
  /** Plate's bottom-left corner on the front panel, in the panel's inner coordinates. */
  x0: number;
  z0: number;
  w: number;
  h: number;
  /** Channel width, and its bottom above the plate's. */
  channel: number;
  channelBottom: number;
  /** Its length includes the top wall it passes through when wedged. */
  slider: { w: number; length: number; travel: number };
  /** Bolt centres on the plate, from its bottom-left corner. */
  bolts: [number, number][];
}

export interface BaffleLayout {
  /** Centre plane, from the back plate's front face. */
  y: number;
  /** Hung from the top wall, rather than standing on the bottom. */
  top: boolean;
}

export interface BaffleBoxLayout {
  t: number;
  xi: number;
  hi: number;
  yi: number;
  /**
   * The room-side opening as cut, and its centre: in the front panel's inner
   * coordinates (x, z), or in the bottom wall's (x, y from the back).
   */
  portShape: Opening;
  port: [number, number];
  vent: VentShape;
  /** The vent's centre on the back, in its inner coordinates (x, z). */
  ventAt: [number, number];
  /** Depth of each chamber between baffles, and of the front one, deeper for an opening in the bottom. */
  pitch: number;
  frontChamber: number;
  baffles: BaffleLayout[];
  baffleHeight: number;
  /**
   * Widest straight window through the openings and gaps, seen from the
   * side; negative is how far every straight line is blocked.
   */
  sight: number;
  /**
   * Glued, the flanged back plate; knocked down, the back panel between the
   * walls. Its size, and its screws from its bottom-left corner.
   */
  plate: { w: number; h: number; screws: [number, number][] };
  /** Wedged, the back's and front's recess, and the walls' depth front to back. */
  recess: number;
  depth: number;
  gate: GateLayout | null;
  warnings: { message: string; param: string }[];
}

const mm = (v: number) => `${Math.ceil(v)} mm`;

/** Where a ray seen from the side must pass: between `lo` and `hi` at depth `y`. */
export interface Window {
  y: number;
  lo: number;
  hi: number;
}

/**
 * The widest a band of straight lines z = a + b·y through every window can
 * be, measured up z; negative when none passes, by how far the nearest misses.
 *
 * For a slope b, the band runs from the highest `lo − b·y` to the lowest
 * `hi − b·y`. Its width is concave and piecewise linear in b, so it peaks
 * where two of those lines cross, and checking every crossing finds it exactly.
 */
export function sightWindow(ws: Window[]): number {
  const width = (b: number) => Math.min(...ws.map((w) => w.hi - b * w.y)) - Math.max(...ws.map((w) => w.lo - b * w.y));
  const edges = ws.flatMap((w) => [
    [w.y, w.lo],
    [w.y, w.hi],
  ]);
  let best = width(0);
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [yi, zi] = edges[i]!;
      const [yj, zj] = edges[j]!;
      // A one-sided limit has no edge on its open side.
      if (yi !== yj && Number.isFinite(zi) && Number.isFinite(zj)) best = Math.max(best, width((zi - zj) / (yi - yj)));
    }
  }
  return best;
}

export function baffleBoxLayout(o: BaffleBoxOptions): BaffleBoxLayout {
  const t = o.thickness;
  const warnings: { message: string; param: string }[] = [];
  const warn = (message: string, param: string) => warnings.push({ message, param });

  // Outside, the back plate and front panel are one thickness each on the
  // depth; the gate's layers stand proud of it, as the flange does round it.
  // Wedged, the recesses add to the depth, and the sides stand past the top
  // and bottom by as much to carry their wedges.
  const e = o.assembly === 'wedges' ? o.recess : 0;
  const [xi, hi, yIn] = o.outside ? [o.x - 2 * t, o.h - 2 * t - 2 * e, o.y - 2 * t - 2 * e] : [o.x, o.h, o.y];
  const fit = Math.max(1, Math.min(xi, hi) - 2);

  // The room-side opening's room across the panel and along it: up the
  // front, or front to back in the bottom, short of the front and of a
  // thickness for the first baffle to stand behind it.
  const bottom = o.portSide === 'bottom';
  const panel = bottom ? 'bottom' : 'front panel';
  const roomW = Math.max(1, xi - 2);
  const roomH = Math.max(1, bottom ? yIn - o.frontClear - t : hi - 2);
  const pfit = Math.min(roomW, roomH);
  const grow = bottom ? 'wide and deep' : 'wide and tall';
  let portShape = o.port;
  if (portShape.shape === 'round' && portShape.d > pfit) {
    warn(`The opening is wider than the ${panel}'s inside allows, so it is cut at ${mm(pfit)}. Make the box ${grow}er.`, 'duct_d');
    portShape = { shape: 'round', d: pfit };
  } else if (portShape.shape === 'rect' && (portShape.w > roomW || portShape.h > roomH)) {
    warn(`The opening is larger than the ${panel}'s inside allows, so it is cut to fit.`, portShape.w > roomW ? 'port_w' : 'port_h');
    portShape = { shape: 'rect', w: Math.min(portShape.w, roomW), h: Math.min(portShape.h, roomH) };
  } else if (portShape.shape === 'fan' && portShape.size > Math.min(roomW, roomH) + 2) {
    const d = Math.min(FANS[portShape.size]!.hole, pfit);
    warn(`A ${portShape.size} mm fan does not fit inside the ${panel}, so only a ${mm(d)} hole is cut. Make the box ${grow}er.`, 'fan_size');
    portShape = { shape: 'round', d };
  }

  let vent = o.vent;
  if (vent.shape === 'round' && vent.d > fit) {
    warn(`The vent is wider than the box's inside, so its opening is cut at ${mm(fit)}.`, 'vent_d');
    vent = { shape: 'round', d: fit };
  } else if (vent.shape === 'rect' && (vent.w > xi - 2 || vent.h > hi - 2)) {
    warn('The vent is larger than the box\'s inside, so its opening is cut to fit.', vent.w > xi - 2 ? 'vent_w' : 'vent_h');
    vent = { shape: 'rect', w: Math.max(1, Math.min(vent.w, xi - 2)), h: Math.max(1, Math.min(vent.h, hi - 2)) };
  }
  // Off centre, the vent stays a millimetre inside the walls.
  const [vw, vh] = span(vent);
  const reach = [Math.max(0, (xi - vw) / 2 - 1), Math.max(0, (hi - vh) / 2 - 1)];
  const ventAt: [number, number] = [0, 1].map((k) => {
    const want = o.ventOffset[k]!;
    const got = Math.max(-reach[k]!, Math.min(reach[k]!, want));
    if (Math.abs(got - want) > 1e-9) {
      warn(`The vent cannot sit that far off centre and stay inside the box: it is moved ${mm(Math.abs(got))} ${k ? (want > 0 ? 'up' : 'down') : want > 0 ? 'right' : 'left'} instead.`, k ? 'vent_dz' : 'vent_dx');
    }
    return (k ? hi : xi) / 2 + got;
  }) as [number, number];
  // The passages need be no larger than the smaller of the two openings.
  const area = Math.min(openArea(portShape), openArea(vent));

  // An opening in the bottom needs the front chamber at least as deep as it,
  // with its clearances; the other chambers share what is left.
  const portDepth = bottom ? span(portShape)[1] + o.frontClear + t : 0;
  // Every chamber at least a thickness deep, or the walls' holes for
  // neighbouring baffles run into each other.
  const maxBaffles = Math.max(0, Math.floor((yIn - Math.max(t, portDepth)) / (2 * t)));
  let count = o.baffles;
  if (count > maxBaffles) {
    warn(`Only ${maxBaffles} baffle${maxBaffles === 1 ? '' : 's'} fit in this depth.`, 'baffles');
    count = maxBaffles;
  }
  const even = (yIn - count * t) / (count + 1);
  const frontChamber = Math.max(even, portDepth);
  const pitch = count > 0 ? (yIn - count * t - frontChamber) / count : frontChamber;

  let gap = o.gap;
  const minBaffle = Math.min(hi / 2, 2 * t);
  if (count > 0 && gap > hi - minBaffle) {
    warn('The gap is taller than the box, which leaves no baffle.', 'baffle_gap');
    gap = hi - minBaffle;
  }

  // The air has to pass each gap, each chamber, and the ring between each
  // opening's rim and the baffle facing it, at no less area than the openings.
  if (count > 0 && gap * xi < area) {
    warn(`The gaps at the baffles' free edges are smaller than the openings and will choke the airflow: make the gap at least ${mm(area / xi)}.`, 'baffle_gap');
  }
  const needPitch = Math.max(area / xi, area / perimeter(portShape), area / perimeter(vent));
  if (Math.min(pitch, frontChamber) < needPitch) {
    warn(
      count > 0
        ? `The spaces between the baffles (${mm(Math.min(pitch, frontChamber))}) are narrower than the airflow needs (${mm(needPitch)}): use fewer baffles or make the box deeper.`
        : `The box is shallower than the airflow needs (${mm(needPitch)} inside) and will choke it.`,
      count > 0 ? 'baffles' : 'y',
    );
  }

  // Facing the front opening, the first baffle hangs from the top and the
  // air goes down under it. Behind a bottom one it stands up instead, so
  // light coming up through the floor would have to climb over it and drop
  // under the next, which no straight line does.
  const baffles: BaffleLayout[] = [];
  for (let i = 0; i < count; i++) {
    baffles.push({ y: yIn - (frontChamber + i * (pitch + t) + t / 2), top: (i % 2 === 0) !== bottom });
  }

  // Off centre, it stays a millimetre inside the walls; a fan's frame does too.
  const [pw0, ph0] = portShape.shape === 'fan' ? [portShape.size - 2, portShape.size - 2] : span(portShape);
  const shift = (k: 0 | 1, room: number, extent: number) => {
    const want = k === 1 && bottom ? 0 : o.portOffset[k];
    const most = Math.max(0, (room - extent) / 2 - 1);
    const got = Math.max(-most, Math.min(most, want));
    if (Math.abs(got - want) > 1e-9) {
      warn(`The opening cannot sit that far off centre and stay inside the ${panel}: it is moved ${mm(Math.abs(got))} ${k ? (want > 0 ? 'up' : 'down') : want > 0 ? 'right' : 'left'} instead.`, k ? 'port_dz' : 'port_dx');
    }
    return got;
  };
  const px = xi / 2 + shift(0, xi, pw0);
  const port: [number, number] = bottom ? [px, yIn - o.frontClear - span(portShape)[1] / 2] : [px, hi / 2 + shift(1, hi, ph0)];

  // Seen from the side, every opening and gap is a window a straight ray has
  // to pass; the baffles span the width, so nothing gets round them sideways.
  //
  // A hole in the bottom is a window lying flat, which a line z = a + b·y
  // passes falling or rising; either way it is two one-sided limits, at the
  // hole's back and front edges, above the floor's top and below its
  // underside. The sight is the wider of the two cases.
  const windowSets = (g: number): Window[][] => {
    const at = (y0: number, y1: number, lo: number, up: number) => [
      { y: y0, lo, hi: up },
      { y: y1, lo, hi: up },
    ];
    const around = (o: Opening) => span(o)[1] / 2;
    const zv = ventAt[1];
    const inside = [
      ...at(-t, 0, zv - around(vent), zv + around(vent)),
      ...baffles.flatMap((bf) => at(bf.y - t / 2, bf.y + t / 2, bf.top ? 0 : hi - g, bf.top ? g : hi)),
    ];
    if (!bottom) return [[...inside, ...at(yIn, yIn + t, port[1] - around(portShape), port[1] + around(portShape))]];
    const [y0, y1] = [port[1] - around(portShape), port[1] + around(portShape)];
    return [
      [...inside, { y: y0, lo: 0, hi: Infinity }, { y: y1, lo: -Infinity, hi: -t }],
      [...inside, { y: y0, lo: -Infinity, hi: -t }, { y: y1, lo: 0, hi: Infinity }],
    ];
  };
  const sightAt = (g: number) => Math.max(...windowSets(g).map(sightWindow));
  const sight = sightAt(count > 0 ? gap : 0);

  if (o.lightTrap) {
    const gapMax = hi - minBaffle;
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
    if (sight > -LIGHT_MARGIN) {
      const air = area / xi;
      if (tight < 0) {
        warn('Light can pass straight through: add a baffle.', 'baffles');
      } else if (tight < air) {
        warn(`No gap both stops light (at most ${Math.floor(tight)} mm) and lets enough air through (at least ${mm(air)}): add a baffle, or make the box wider.`, 'baffles');
      } else {
        warn(`Light can pass straight through the gaps: make the gap at most ${Math.floor(tight)} mm.`, 'baffle_gap');
      }
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
    // face, and the box is built round it.
    const c = o.mountInset;
    screws.push([c, c], [pw - c, c], [pw - c, ph - c], [c, ph - c]);
    const clear = ([sx, sy]: [number, number]) => {
      const [dx, dy] = [Math.abs(sx - ventAt[0]), Math.abs(sy - ventAt[1])];
      const room = o.screw / 2 + 2;
      return vent.shape === 'round' ? Math.hypot(dx, dy) > vw / 2 + room : dx > vw / 2 + room || dy > vh / 2 + room;
    };
    if (c + o.screw / 2 + 1 > Math.min(pw, ph) / 2 || !screws.every(clear)) {
      warn('The vent leaves no room for the screws in the back\'s corners: make the box bigger or the vent smaller.', vent.shape === 'round' ? 'vent_d' : 'vent_w');
    }
  }

  let gate: GateLayout | null = null;
  // A gate needs the port in the front, so the slider can rise out of the top.
  if (o.gate && !bottom) {
    const r = o.rail;
    // Only a round duct takes the gate; the other openings are the light trap's.
    const duct = span(portShape)[0];
    const channel = duct + 2 * OVERLAP;
    const w = channel + 2 * r;
    // Bolts in the rails' corners beside and below the port, mirrored above.
    const bx = channel / 2 + r / 2;
    const a = duct / 2 + OVERLAP + r / 2;
    const z0 = port[1] - a - r / 2;
    // Flush with the box's top, or past it where the upper bolts need the
    // room. Wedged, the front is recessed and the top wall's rim overhangs
    // the gate, so it stops under the rim and its slider runs up through it.
    const lift = o.assembly === 'wedges' ? 0 : t;
    const top = Math.max(hi + lift, port[1] + a + r / 2);
    const h = top - z0;
    const channelBottom = r;
    const travel = duct + OVERLAP;
    const bolts: [number, number][] = [
      [w / 2 - bx, r / 2],
      [w / 2 + bx, r / 2],
      [w / 2 - bx, r / 2 + 2 * a],
      [w / 2 + bx, r / 2 + 2 * a],
    ];
    gate = {
      x0: port[0] - w / 2,
      z0,
      w,
      h,
      channel,
      channelBottom,
      slider: { w: channel - 2 * o.play, length: h - channelBottom + t - lift + HANDLE, travel },
      bolts,
    };

    // A nut needs about a bolt's diameter of panel round the hole, clear of
    // the walls. Off centre, the box grows by twice the offset to give it that.
    const [dx, dz] = [port[0] - xi / 2, port[1] - hi / 2];
    const needX = 2 * (bx + o.bolt) + 2 * Math.abs(dx);
    if (xi < needX - 1e-9) {
      warn(`The blast gate's bolts land in the side walls: make the box at least ${mm(needX + (o.outside ? 2 * t : 0))} wide, or the rails narrower${dx ? ', or the duct nearer the middle' : ''}.`, 'gate_rail');
    }
    const hold = top - (port[1] + duct / 2);
    const needZ = Math.max(2 * (a + o.bolt) + 2 * Math.abs(dz), duct + 2 * (MIN_HOLD - lift) + 2 * dz);
    if (hi < needZ - 1e-9 || hold < MIN_HOLD) {
      warn(`The blast gate needs a taller box, for its bolts to clear the top and bottom and its slider to stay in when open: make it at least ${mm(needZ + (o.outside ? 2 * t + 2 * e : 0))} tall${dz ? ', or the duct nearer the middle' : ''}.`, 'h');
    }
  }

  return {
    t,
    xi,
    hi,
    yi: yIn,
    portShape,
    port,
    vent,
    ventAt,
    pitch,
    frontChamber,
    baffles,
    baffleHeight: hi - gap,
    sight,
    plate: { w: pw, h: ph, screws },
    recess: e,
    depth: yIn + 2 * t + 2 * e,
    gate,
    warnings,
  };
}

interface Item {
  w: number;
  h: number;
  draw: (move: string) => void;
}

class BaffleBox extends Boxes {
  constructor(
    private o: BaffleBoxOptions,
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

  private boltHoles(at: [number, number][], dx = 0, dy = 0): void {
    for (const [x, y] of at) this.hole(x + dx, y + dy, this.o.bolt / 2);
  }

  /** The gate's spacer: its channel is open at the top, for the slider. */
  private spacer(g: GateLayout): Item {
    const r = (g.w - g.channel) / 2;
    const label = 'gate spacer';
    return {
      w: g.w,
      h: g.h,
      draw: (move) => {
        if (this.move(g.w, g.h, move, true, label)) return;
        this.polyline(g.w, 90, g.h, 90, r, 90, g.h - g.channelBottom, -90, g.channel, -90, g.h - g.channelBottom, 90, r, 90);
        this.boltHoles(g.bolts, 0, this.burn);
        this.move(g.w, g.h, move, false, label);
      },
    };
  }

  render(): void {
    const o = this.o;
    const t = this.thickness;
    const ws = this.wedgedTenonSettings;
    const wedged = o.assembly === 'wedges';
    const bolted = o.assembly === 'bolts';
    // Bolted, the back's corner screws stay past the reach of its T-slots.
    const slotReach = bolted ? this.bedBoltSettings[3]! + this.bedBoltSettings[1]! : 0;
    // An opening in the bottom keeps a thickness from the front panel, or,
    // wedged, clears the front's wedges lying across the bottom's underside.
    const frontClear = wedged ? Math.max(t, ws.wedge_length / 2 - t / 2 + 1) : t;
    const lay = baffleBoxLayout({ ...o, thickness: t, recess: ws.holeInset(), mountInset: Math.max(slotReach, o.screw + 6), frontClear });
    for (const w of lay.warnings) this.warn(w.message, w.param);
    const { xi, hi, yi, gate } = lay;
    const bh = lay.baffleHeight;

    // An off-centre opening leaves a panel's outline symmetric and its holes
    // not: an etched arrow says which way round it goes. Above what is taken
    // up between `lo` and `up` or below it, whichever has more room; it reads
    // the right way up from the side it names either way.
    const mark = (dx: number, dy: number, w: number, h: number, lo: number, up: number, text: string) => {
      const fs = 6;
      const above = h - up;
      const below = lo;
      if (Math.max(above, below) < fs + 4) return;
      const z = above >= below ? h - Math.max(t, (above - fs) / 2) - fs / 2 : Math.max(t, (below - fs) / 2) + fs / 2;
      this.text(`\u2191 ${text}`, dx + w / 2, dy + z, 0, 'middle center', fs, ETCHING);
    };
    const portMoved = o.portOffset[0] !== 0 || (o.portSide === 'front' && o.portOffset[1] !== 0);
    // The opening's extent up its panel, a fan's frame and a gate's plates with it.
    const portExtent = (): [number, number] => {
      const ps = lay.portShape;
      const half = ps.shape === 'fan' ? ps.size / 2 : span(ps)[1] / 2;
      const lo = gate ? gate.z0 : lay.port[1] - half;
      const up = gate ? gate.z0 + gate.h : lay.port[1] + half;
      return [lo, up];
    };

    // The vent and, off centre, the mark for which way round the back goes,
    // from the back's inner corner at (dx, dy) in the frame being drawn.
    const vent = (dx: number, dy: number) => {
      const v = lay.vent;
      const [cx, cy] = [dx + lay.ventAt[0], dy + lay.ventAt[1]];
      if (v.shape === 'round') this.hole(cx, cy, v.d / 2);
      else this.rectangularHole(cx, cy, v.w, v.h);
      if (o.ventOffset[0] === 0 && o.ventOffset[1] === 0) return;
      const vh = span(v)[1];
      mark(dx, dy, xi, hi, lay.ventAt[1] - vh / 2, lay.ventAt[1] + vh / 2, 'top, seen from the front');
    };
    const screws = (dx = 0, dy = 0) => {
      for (const [x, y] of lay.plate.screws) this.hole(x + dx, y + dy, o.screw / 2);
    };
    const opening = (px: number, pz: number) => {
      const ps = lay.portShape;
      if (ps.shape === 'rect') this.rectangularHole(px, pz, ps.w, ps.h);
      else this.hole(px, pz, span(ps)[0] / 2);
      if (ps.shape === 'fan') {
        const q = FANS[ps.size]!.pitch / 2;
        for (const [dx, dz] of [[-q, -q], [q, -q], [q, q], [-q, q]] as const) this.hole(px + dx, pz + dz, FAN_SCREW / 2);
      }
    };
    const inFloor = o.portSide === 'bottom';
    const front = () => {
      if (!inFloor) opening(lay.port[0], lay.port[1]);
      if (gate) this.boltHoles(gate.bolts, gate.x0, gate.z0);
      if (!inFloor && portMoved) mark(0, 0, xi, hi, ...portExtent(), 'top, seen from the front');
    };
    // The bottom's opening, at `dy` from the frame its holes are drawn in to
    // the back's inner face. Its mark points to the front, read from inside.
    this.floorOpening = (dy) => {
      if (!inFloor) return;
      opening(lay.port[0], lay.port[1] + dy);
      if (portMoved) {
        // Behind it are the first baffle's slots, so the mark goes beside
        // it, on the side the offset leaves room.
        const ps = lay.portShape;
        const half = ps.shape === 'fan' ? ps.size / 2 : span(ps)[0] / 2;
        const left = lay.port[0] - half;
        const right = xi - (lay.port[0] + half);
        const fs = 6;
        if (Math.max(left, right) >= 4 * fs) {
          const x = left >= right ? left / 2 : xi - right / 2;
          this.text('\u2191 front', x, lay.port[1] + dy, 0, 'middle center', fs, ETCHING);
        }
      }
    };
    const baffleLabel = (i: number) => `baffle ${i + 1}`;

    let items: Item[];
    if (wedged) items = this.wedgedParts(lay, vent, screws, front, baffleLabel);
    else if (bolted) items = this.boltedParts(lay, vent, screws, front, baffleLabel);
    else {
      const fl = o.flange;
      const back = () => {
        this.fingerHolesAt(fl + t, fl + t / 2, xi, 0);
        this.fingerHolesAt(fl + t, fl + t + hi + t / 2, xi, 0);
        this.fingerHolesAt(fl + t / 2, fl + t, hi, 90);
        this.fingerHolesAt(fl + t + xi + t / 2, fl + t, hi, 90);
        vent(fl + t, fl + t);
        screws();
      };
      const holesFor = (top: boolean) => () => {
        for (const bf of lay.baffles) if (bf.top === top) this.fingerHolesAt(0, bf.y, xi, 0);
        if (!top) this.floorOpening(0);
      };
      const sideHoles = () => {
        for (const bf of lay.baffles) this.fingerHolesAt(bf.top ? hi - bh : 0, bf.y, bh, 0);
      };
      items = [
        this.wall(lay.plate.w, lay.plate.h, 'eeee', 'back', [back]),
        this.wall(xi, hi, 'ffff', 'front', [front]),
        this.wall(xi, yi, 'fFFF', 'top', [holesFor(true)]),
        this.wall(xi, yi, 'fFFF', 'bottom', [holesFor(false)]),
        this.wall(hi, yi, 'ffFf', 'left side', [sideHoles]),
        this.wall(hi, yi, 'ffFf', 'right side', [sideHoles]),
        ...lay.baffles.map((_, i) => this.wall(xi, bh, 'ffef', baffleLabel(i))),
      ];
    }

    if (gate) {
      const [px, pz] = [lay.port[0] - gate.x0, lay.port[1] - gate.z0];
      const sl = gate.slider;
      // A finger hole in the handle; on a narrow slider, as wide as leaves it strong.
      const grip = Math.min(20, sl.w - 10);
      items.push(
        this.wall(gate.w, gate.h, 'eeee', 'gate cover', [
          () => {
            this.hole(px, pz, span(lay.portShape)[0] / 2);
            this.boltHoles(gate.bolts);
          },
        ]),
        this.spacer(gate),
        this.wall(sl.w, sl.length, 'eeee', 'gate slider', [() => { if (grip > 2) this.hole(sl.w / 2, sl.length - HANDLE / 2, grip / 2); }]),
      );
    }

    // Rows about as wide as a square of the parts would be, so the sheet is
    // not one long strip.
    const area = items.reduce((a, it) => a + (it.w + this.spacing) * (it.h + this.spacing), 0);
    this.rows(items, Math.max(...items.map((it) => it.w + this.spacing), 1.2 * Math.sqrt(area)));
    if (wedged) this.wedges(this.wedgeCount, 'up');
  }

  private wedgeCount = 0;
  private floorOpening: (dy: number) => void = () => {};

  /**
   * Bolted, it is ClosedBox's bolted box with baffles: the back and front sit
   * between the walls on fingers with T-slots, and every bolt runs through a
   * wall's face, so no head is on the back against the wall or on the front
   * under the gate. The baffles are bolted to the sides and stand in the top
   * and bottom dry.
   */
  private boltedParts(lay: BaffleBoxLayout, vent: (x: number, y: number) => void, screws: () => void, front: () => void, label: (i: number) => string): Item[] {
    const { xi, hi, yi, gate } = lay;
    const bh = lay.baffleHeight;
    // The corner joints' bolts keep clear of the baffles' slots, which run
    // in from the same edges; the front's of the gate's bolt holes.
    const backX = shelfBolts(this, xi);
    const backH = shelfBolts(this, hi);
    const frontX = shelfBolts(this, xi, gate ? gate.bolts.map(([x]) => x + gate.x0) : []);
    const frontH = shelfBolts(this, hi, gate ? gate.bolts.map(([, z]) => z + gate.z0) : []);
    const corner = shelfBolts(this, yi, lay.baffles.map((bf) => bf.y));
    const baffle = shelfBolts(this, bh);
    const holesFor = (top: boolean) => () => {
      for (const bf of lay.baffles) if (bf.top === top) this.fingerHolesAt(0, bf.y, xi, 0);
      if (!top) this.floorOpening(0);
    };
    const sideHoles = () => {
      for (const bf of lay.baffles) this.fingerHolesAt(bf.top ? hi - bh : 0, bf.y, bh, 0, baffle);
    };
    const joints = [
      { label: 'the back', length: Math.min(xi, hi), policy: xi < hi ? backX : backH },
      { label: 'the front', length: Math.min(xi, hi), policy: xi < hi ? frontX : frontH },
      { label: 'the corners', length: yi, policy: corner },
    ];
    if (lay.baffles.length) joints.push({ label: 'the baffles', length: bh, policy: baffle });
    checkBolts(this, this.getEdge('f').settings as FingerJointSettings, joints);
    return [
      this.wall(xi, hi, 'ffff', 'back', [() => { vent(0, 0); screws(); }], [backX, backH, backX, backH]),
      this.wall(xi, hi, 'ffff', 'front', [front], [frontX, frontH, frontX, frontH]),
      this.wall(xi, yi, 'FFFF', 'top', [holesFor(true)], [backX, corner, frontX, corner]),
      this.wall(xi, yi, 'FFFF', 'bottom', [holesFor(false)], [backX, corner, frontX, corner]),
      this.wall(hi, yi, 'FfFf', 'left side', [sideHoles], [backH, corner, frontH, corner]),
      this.wall(hi, yi, 'FfFf', 'right side', [sideHoles], [backH, corner, frontH, corner]),
      ...lay.baffles.map((_, i) => this.wall(xi, bh, 'ffef', label(i), undefined, [null, baffle, null, baffle])),
    ];
  }

  /**
   * Wedged, the back, the front, the top and bottom and the baffles all carry
   * tenons through the walls round them, so every wedge is on a wall's outer
   * face. The back and front are recessed by the tenons' hole inset, which
   * leaves a rim at the back to caulk against the wall; the sides stand past
   * the top and bottom by as much. With a gate, the front's top edge is plain
   * and caulked, since the slider runs up through the top wall just in front
   * of it, where that edge's wedges would be.
   */
  private wedgedParts(lay: BaffleBoxLayout, vent: (x: number, y: number) => void, screws: () => void, front: () => void, label: (i: number) => string): Item[] {
    const t = this.thickness;
    const s = this.wedgedTenonSettings;
    const { xi, hi, gate, recess: e, depth: D } = lay;
    const bh = lay.baffleHeight;
    const hs = hi + 2 * t + 2 * e;
    const wy = (y: number) => y + e + t;
    const backLine = e + t / 2;
    const frontLine = D - e - t / 2;

    // Each hole line as [x, y, length, angle], once for the holes and once for the clearance check.
    const sideLines: [number, number, number, number][] = [
      [e + t / 2, 0, D, 90],
      [e + t + hi + t / 2, 0, D, 90],
      [e + t, backLine, hi, 0],
      [e + t, frontLine, hi, 0],
      ...lay.baffles.map((bf): [number, number, number, number] => [e + t + (bf.top ? hi - bh : 0), wy(bf.y), bh, 0]),
    ];
    const capLines = (top: boolean): [number, number, number, number][] => [
      [0, backLine, xi, 0],
      ...(top && gate ? [] : [[0, frontLine, xi, 0] as [number, number, number, number]]),
    ];
    const check = (lines: [number, number, number, number][], w: number, h: number) => {
      const { clash, overhang } = wedgeClearance(
        lines.flatMap(([x, y, l, a]) => tenonFootprints(s, x, y, l, a)),
        [[0, 0], [w, 0], [w, h], [0, h]],
      );
      if (clash) this.warn('Two wedges meet outside the walls. Space the tenons further apart, or the baffles.', 'wt_pitch');
      if (overhang) this.warn('Some wedges hang off the walls. Shorten the wedges.', 'wt_wedge_length');
    };
    check(sideLines, hs, D);
    check(capLines(false), xi, D);

    const cap = (top: boolean) => () => {
      for (const [x, y, l, a] of capLines(top)) this.tenonHolesAt(x, y, l, a);
      for (const bf of lay.baffles) if (bf.top === top) this.fingerHolesAt(0, wy(bf.y), xi, 0);
      if (!top) this.floorOpening(e + t);
      if (top && gate) {
        // The slider's slot, over the gate's spacer on the front's outer face.
        const play = this.o.play;
        const y0 = D - e;
        const y1 = Math.min(D - 1, y0 + t + 2 * play);
        this.rectangularHole(lay.port[0], (y0 + y1) / 2, gate.slider.w + 2 * play, y1 - y0);
      }
    };
    const side = () => {
      for (const [x, y, l, a] of sideLines) this.tenonHolesAt(x, y, l, a);
    };

    const n = (l: number) => this.tenonCount(l);
    this.wedgeCount = 2 * n(xi) + 2 * n(hi) + (gate ? 1 : 2) * n(xi) + 2 * n(hi) + 4 * n(D) + 2 * lay.baffles.length * n(bh);
    return [
      this.wall(xi, hi, 'wwww', 'back', [() => { vent(0, 0); screws(); }]),
      this.wall(xi, hi, gate ? 'wwew' : 'wwww', 'front', [front]),
      this.wall(xi, D, 'ewew', 'top', [cap(true)]),
      this.wall(xi, D, 'ewew', 'bottom', [cap(false)]),
      this.wall(hs, D, 'eeee', 'left side', [side]),
      this.wall(hs, D, 'eeee', 'right side', [side]),
      ...lay.baffles.map((_, i) => this.wall(xi, bh, 'fwew', label(i))),
    ];
  }
}

const SIZE_PARAMS: ParamSpec[] = [
  { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 200, min: 60, max: 1000, step: 1, group: 'dimensions' },
  { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 250, min: 60, max: 1000, step: 1, group: 'dimensions' },
  { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 150, min: 30, max: 600, step: 1, group: 'dimensions' },
  {
    key: 'outside',
    kind: 'bool',
    label: 'Outside measurements',
    default: true,
    group: 'dimensions',
    help: 'When on, the sizes above are the box\'s exterior, not counting the flange. When off, they are the inside.',
  },
];

/** The opening in the wall or case behind the box. */
const ventParams = (what: string): ParamSpec[] => [
  {
    key: 'vent_shape',
    kind: 'enum',
    label: what,
    default: 'round',
    group: 'dimensions',
    choices: [
      { value: 'round', label: 'Round' },
      { value: 'rect', label: 'Rectangular' },
    ],
  },
  { key: 'vent_d', kind: 'length', label: `${what} diameter`, unit: 'mm', default: 100, min: 20, max: 1000, step: 0.5, group: 'dimensions', showIf: (v) => v.vent_shape !== 'rect' },
  { key: 'vent_w', kind: 'length', label: `${what} width`, unit: 'mm', default: 150, min: 20, max: 1000, step: 0.5, group: 'dimensions', showIf: (v) => v.vent_shape === 'rect' },
  { key: 'vent_h', kind: 'length', label: `${what} height`, unit: 'mm', default: 75, min: 20, max: 1000, step: 0.5, group: 'dimensions', showIf: (v) => v.vent_shape === 'rect' },
  {
    key: 'vent_dx',
    kind: 'length',
    label: `${what} off centre, right`,
    unit: 'mm',
    default: 0,
    min: -500,
    max: 500,
    step: 0.5,
    group: 'dimensions',
    help: 'From the box\'s centre, seen from the front; negative is left. Off centre, the back is etched with which way up it goes.',
  },
  { key: 'vent_dz', kind: 'length', label: `${what} off centre, up`, unit: 'mm', default: 0, min: -500, max: 500, step: 0.5, group: 'dimensions', help: 'From the box\'s centre; negative is down.' },
];

const BAFFLE_PARAMS: ParamSpec[] = [
  { key: 'baffles', kind: 'number', label: 'Baffles', default: 2, min: 0, max: 8, step: 1, integer: true, group: 'dimensions' },
  {
    key: 'baffle_gap',
    kind: 'length',
    label: 'Baffle gap',
    unit: 'mm',
    default: 60,
    min: 10,
    max: 500,
    step: 1,
    group: 'dimensions',
    help: 'Between each baffle\'s free edge and the wall it faces.',
    showIf: (v) => Number(v.baffles) > 0,
  },
];

const MOUNT_PARAMS: ParamSpec[] = [
  {
    key: 'flange',
    kind: 'length',
    label: 'Flange',
    unit: 'mm',
    default: 25,
    min: 10,
    max: 100,
    step: 1,
    group: 'dimensions',
    help: 'How far the back plate reaches past the box, for the screws that hold it on.',
    // Knocked down, the back is screwed on through its face instead.
    showIf: (v) => (v.assembly ?? 'glue') === 'glue',
  },
  { key: 'screw_d', kind: 'length', label: 'Screw holes', unit: 'mm', default: 5, min: 2, max: 8, step: 0.1, group: 'dimensions' },
];

/** A shared parameter with this generator's own default or help. */
function adapt(specs: ParamSpec[], changes: Record<string, Partial<ParamSpec>>): ParamSpec[] {
  return specs.map((p) => (changes[p.key] ? ({ ...p, ...changes[p.key] } as ParamSpec) : p));
}

/**
 * Wedges and bolts both need room on the far side of the panel a joint passes
 * through, which on a flanged back would be against the wall. So knocked
 * down, the back sits inside the walls like the front, and goes up first.
 */
const ASSEMBLY_PARAMS: ParamSpec[] = [
  assemblyParam(['wedges', 'bolts'], {
    wedges:
      'The back, front, top, bottom and baffles are wedged through the walls round them. The back has no flange: ' +
      'screw it up on its own, build the box round it, and caulk the seams.',
    bolts:
      'The box is bolted at every corner and the baffles to the sides, the bolt heads all on the walls. The back has ' +
      'no flange: screw it up on its own, build the box round it, and caulk the seams.',
  }),
  ...WEDGED_TENON_PARAMS,
  ...BOLT_PARAMS,
];

/**
 * Where the room-side opening sits, from the middle of its panel. In the
 * bottom there is no "up": the front chamber is sized round it.
 */
function portOffsetParams(what: string, note = ''): ParamSpec[] {
  const specs: ParamSpec[] = [
    {
      key: 'port_dx',
      kind: 'length',
      label: `${what} off centre, right`,
      unit: 'mm',
      default: 0,
      min: -500,
      max: 500,
      step: 0.5,
      group: 'dimensions',
      help: 'From the middle of its panel, seen from the front; negative is left. Off centre, the panel is etched with which way round it goes.',
    },
    {
      key: 'port_dz',
      kind: 'length',
      label: `${what} off centre, up`,
      unit: 'mm',
      default: 0,
      min: -500,
      max: 500,
      step: 0.5,
      group: 'dimensions',
      help: 'Negative is down.',
      showIf: (v) => v.port_side !== 'bottom',
    },
  ];
  return specs.map((p) => ({ ...p, help: [p.help, note].filter(Boolean).join(' ') }) as ParamSpec);
}

function readAssembly(v: ParamValues): Assembly {
  const a = s(v, 'assembly', 'glue');
  return a === 'wedges' || a === 'bolts' ? a : 'glue';
}

function readVent(v: ParamValues): VentShape {
  return s(v, 'vent_shape', 'round') === 'rect'
    ? { shape: 'rect', w: n(v, 'vent_w', 150), h: n(v, 'vent_h', 75) }
    : { shape: 'round', d: n(v, 'vent_d', 100) };
}

/** Everything the two generators read alike; the thickness comes from the config once the box is built. */
function common(v: ParamValues) {
  return {
    x: n(v, 'x', 200),
    y: n(v, 'y', 150),
    h: n(v, 'h', 250),
    outside: b(v, 'outside', true),
    thickness: 0,
    vent: readVent(v),
    ventOffset: [n(v, 'vent_dx', 0), n(v, 'vent_dz', 0)] as [number, number],
    flange: n(v, 'flange', 25),
    screw: n(v, 'screw_d', 5),
    baffles: Math.max(0, Math.round(n(v, 'baffles', 2))),
    gap: n(v, 'baffle_gap', 60),
    assembly: readAssembly(v),
    portSide: 'front' as const,
    portOffset: [n(v, 'port_dx', 0), n(v, 'port_dz', 0)] as [number, number],
    // These are measured off the joints once the box is built.
    recess: 0,
    mountInset: 0,
    frontClear: 0,
  };
}

export const baffleBox: GeneratorDef = {
  meta: {
    id: 'bafflebox',
    name: 'Vent Baffle Box',
    group: 'Wall mounted',
    summary: 'Baffled box over a wall vent, with a blast gate for the exhaust hose',
    description: [
      'Screws to the wall over a vent hole, with the exhaust hose (a laser cutter\'s, say) coming into the front. ' +
        'Baffles inside make the air go round them, so wind, light and noise cannot come straight back in.',
      '',
      '- The back plate has the vent opening and a flange round the box for the wall screws. Cut its opening to ' +
        'match the hole in the wall.',
      '- The port in the front is cut to the duct\'s outside diameter, so a duct or collar can be pushed in.',
      '- Baffle 1 is nearest the front and hangs from the top; the next stands on the bottom, and so on. Their ' +
        'holes in the walls already alternate.',
      '- The blast gate bolts over the port. Its slider pulls up out of the top to open, and drops back to shut. ' +
        'It is cut from the same sheet as the spacer it runs in, so tighten the bolts only until it still slides.',
      '- Wedged or bolted, the back has no flange. Screw it to the wall on its own, build the box round it, and ' +
        'caulk the seams inside, since dry joints leak.',
      '',
      'The box warns where a gap or chamber is smaller than the duct, since that would choke the airflow. For a ' +
        'laser cutter\'s air intake, see the Light Trap Vent.',
    ].join('\n'),
  },
  params: [
    ...adapt(SIZE_PARAMS, { y: { help: 'Out from the wall, not counting the blast gate.' } }),
    { key: 'duct_d', kind: 'length', label: 'Duct diameter', unit: 'mm', default: 100, min: 30, max: 400, step: 0.5, group: 'dimensions', help: 'Outside diameter of the hose or collar; the front port is cut to it.' },
    ...portOffsetParams('Duct', 'A blast gate moves with it.'),
    ...ventParams('Wall vent'),
    ...BAFFLE_PARAMS,
    ...adapt(MOUNT_PARAMS, { screw_d: { label: 'Wall screw holes' } }),
    { key: 'gate', kind: 'bool', label: 'Blast gate', default: true, group: 'dimensions' },
    { key: 'gate_rail', kind: 'length', label: 'Gate rails', unit: 'mm', default: 15, min: 10, max: 50, step: 0.5, group: 'dimensions', help: 'Width of the gate\'s frame beside and below its channel.', showIf: (v) => v.gate === true },
    { key: 'gate_bolt_d', kind: 'length', label: 'Gate bolt holes', unit: 'mm', default: 4, min: 2, max: 6, step: 0.1, group: 'dimensions', showIf: (v) => v.gate === true },
    { key: 'gate_play', kind: 'length', label: 'Gate slider play', unit: 'mm', default: 0.5, min: 0, max: 3, step: 0.05, group: 'advanced', help: 'Clearance either side of the slider in its channel.', showIf: (v) => v.gate === true },
    ...ASSEMBLY_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new BaffleBox(
      {
        ...common(v),
        port: { shape: 'round', d: n(v, 'duct_d', 100) },
        gate: b(v, 'gate', true),
        rail: n(v, 'gate_rail', 15),
        play: n(v, 'gate_play', 0.5),
        bolt: n(v, 'gate_bolt_d', 4),
        lightTrap: false,
      },
      config,
    ),
};

const FAN_CHOICES = Object.keys(FANS).map((k) => ({ value: k, label: `${k} mm` }));

export const lightTrapVent: GeneratorDef = {
  meta: {
    id: 'lighttrap',
    name: 'Light Trap Vent',
    group: 'Misc',
    summary: 'Baffled air intake for a laser cutter that lets air in and no light out',
    description: [
      'Screws to a laser cutter\'s case over an air intake. Baffles inside make the air go round them, and are ' +
        'checked so that no straight line of light gets from the opening in the case out through the front.',
      '',
      '- The back plate goes against the case, its opening cut to match the hole there, with a flange round the ' +
        'box for the screws.',
      '- The room-side opening can be round, rectangular, or cut for a standard case fan to blow air in, in the ' +
        'front or in the bottom. In the bottom it faces the floor, so any light that does get out goes down.',
      `- The baffles overlap every straight line through the box by at least ${LIGHT_MARGIN} mm. The box warns ` +
        'when they do not, and says what gap would, or that it needs another baffle.',
      '',
      '- Wedged or bolted, the back has no flange. Screw it to the case on its own, then build the box round it.',
      '',
      'Light that is not stopped outright still has to bounce off the inside at least once on its way out, and ' +
        'each bounce off a matt black surface takes most of it. Paint the inside matt black, caulk the seams so ' +
        'the joints cannot leak, and check it in a dark room with a torch inside before trusting it.',
    ].join('\n'),
  },
  params: [
    ...adapt(SIZE_PARAMS, { h: { default: 200 }, y: { default: 200, help: 'Out from the case.' } }),
    ...ventParams('Case opening'),
    {
      key: 'port_side',
      kind: 'enum',
      label: 'Room-side opening in',
      default: 'front',
      group: 'dimensions',
      choices: [
        { value: 'front', label: 'Front' },
        { value: 'bottom', label: 'Bottom', help: 'Faces the floor, so light that does get out goes down. The front chamber is made deep enough for it.' },
      ],
    },
    {
      key: 'port_shape',
      kind: 'enum',
      label: 'Room-side opening',
      default: 'round',
      group: 'dimensions',
      choices: [
        { value: 'round', label: 'Round' },
        { value: 'rect', label: 'Rectangular' },
        { value: 'fan', label: 'Fan', help: 'A hole for the blades and the four screw holes of a standard case fan.' },
      ],
    },
    { key: 'duct_d', kind: 'length', label: 'Opening diameter', unit: 'mm', default: 100, min: 20, max: 400, step: 0.5, group: 'dimensions', showIf: (v) => (v.port_shape ?? 'round') === 'round' },
    { key: 'port_w', kind: 'length', label: 'Opening width', unit: 'mm', default: 150, min: 20, max: 1000, step: 0.5, group: 'dimensions', showIf: (v) => v.port_shape === 'rect' },
    { key: 'port_h', kind: 'length', label: 'Opening height', help: 'In the bottom, its depth front to back.', unit: 'mm', default: 60, min: 20, max: 1000, step: 0.5, group: 'dimensions', showIf: (v) => v.port_shape === 'rect' },
    { key: 'fan_size', kind: 'enum', label: 'Fan size', default: '120', group: 'dimensions', choices: FAN_CHOICES, showIf: (v) => v.port_shape === 'fan' },
    ...portOffsetParams('Opening'),
    ...adapt(BAFFLE_PARAMS, { baffles: { default: 3 }, baffle_gap: { default: 50 } }),
    ...MOUNT_PARAMS,
    ...ASSEMBLY_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) => {
    const shape = s(v, 'port_shape', 'round');
    const port: Opening =
      shape === 'rect'
        ? { shape: 'rect', w: n(v, 'port_w', 150), h: n(v, 'port_h', 60) }
        : shape === 'fan' && FANS[Number(s(v, 'fan_size', '120'))]
          ? { shape: 'fan', size: Number(s(v, 'fan_size', '120')) }
          : { shape: 'round', d: n(v, 'duct_d', 100) };
    return new BaffleBox(
      { ...common(v), port, portSide: s(v, 'port_side', 'front') === 'bottom' ? 'bottom' : 'front', gate: false, rail: 15, play: 0.5, bolt: 4, lightTrap: true },
      config,
    );
  },
};
