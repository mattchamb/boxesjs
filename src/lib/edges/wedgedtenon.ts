/**
 * Wedged through-tenons — a knock-down joint of this port's own; boxes.py has
 * no equivalent, so there is no golden reference for it (see PORTING.md).
 *
 * A panel's edge carries tenons (`w`) that pass right through slots in the
 * mating panel and stick out the far side. Each tenon has a slot cut through
 * it, just outside the mating panel, and a tapered wedge driven through that
 * slot pulls the joint tight. Knock the wedges out and it comes apart again.
 *
 * Measured along a tenon from the shoulder (the inner face of the mating
 * panel), with t the material thickness:
 *
 *   0 ……… t                       the mating panel
 *   t - draw ……… t + gap           the wedge slot
 *   t + gap ……… t + gap + endMargin   material left to take the wedge's push
 *
 * The slot starts `draw` *inside* the mating panel, so the wedge bears on the
 * panel's outer face and never on the slot's near side; otherwise it could
 * bottom out against the tenon before it tightened anything. Across the
 * tenon the slot is the wedge's thickness (t) plus `slack`.
 *
 * The wedge is a flat strip, square on the edge that bears on the panel and
 * tapered on the other, exactly `gap` wide at its middle. It locks half-way
 * in, leaving travel either side to take up variation in the material.
 */
import type { Boxes } from '../boxes';
import { BaseEdge } from './base';
import { Settings } from './settings';

export class WedgedTenonSettings extends Settings {
  static override absoluteParams = {
    /** Clearance in every hole and slot, in mm: wedges are driven, not forced. */
    slack: 0.2,
    /** How far the wedge slot starts inside the mating panel, in mm. */
    draw: 0.5,
    /** Wedge taper as 1:N (one side), so higher is gentler and holds better. */
    taper: 7,
  };

  static override relativeParams = {
    /** Tenon width along the edge. */
    width: 4.0,
    /** Target distance between tenons; the count is derived from the edge. */
    pitch: 25.0,
    /** Width of the wedge where it locks, i.e. the slot's working length. */
    gap: 1.5,
    /** Material beyond the slot at the tip of the tenon. */
    end_margin: 1.5,
    /** Length of the wedge. */
    wedge_length: 8.0,
    /**
     * Minimum material between a `W` edge and its holes, as for finger holes.
     * The holes usually sit further in, to keep the wedges inside the edge.
     */
    edge_width: 1.0,
  };

  get slack(): number { return this.getNum('slack'); }
  get draw(): number { return this.getNum('draw'); }
  get taper(): number { return this.getNum('taper'); }
  get width(): number { return this.getNum('width'); }
  get pitch(): number { return this.getNum('pitch'); }
  get gap(): number { return this.getNum('gap'); }
  get end_margin(): number { return this.getNum('end_margin'); }
  get wedge_length(): number { return this.getNum('wedge_length'); }
  get edge_width(): number { return this.getNum('edge_width'); }

  override checkValues(): void {
    if (this.wedgeNarrow() < 0.2 * this.thickness) {
      throw new Error(
        'Wedged tenon: the wedge is too short or too steep for its gap — its narrow end vanishes. ' +
          'Lengthen the gap, shorten the wedge or make the taper gentler.',
      );
    }
    if (this.width < this.thickness + this.slack + 2 * 0.5 * this.thickness) {
      throw new Error('Wedged tenon: tenons must be wider than the wedge slot with material either side.');
    }
  }

  /** How far a tenon stands out from its edge. */
  protrusion(): number {
    return this.thickness + this.gap + this.end_margin;
  }

  /** Distance from a `W` edge to the centre line of its holes. */
  holeInset(): number {
    return Math.max(this.edge_width + this.thickness / 2, this.wedge_length / 2);
  }

  wedgeNarrow(): number {
    return this.gap - this.wedge_length / 2 / this.taper;
  }

  wedgeWide(): number {
    return this.gap + this.wedge_length / 2 / this.taper;
  }

  /**
   * Centres of the tenons along an edge of `length`. Symmetric about the
   * middle, so the holes match whichever way round the mating panel is drawn.
   * Empty when there is no room for even one tenon with a thickness of
   * material either side.
   */
  centres(length: number): number[] {
    const t = this.thickness;
    let n = Math.max(1, Math.round(length / this.pitch));
    while (n > 0 && n * this.width + (n + 1) * t > length) n--;
    return Array.from({ length: n }, (_, i) => ((i + 0.5) * length) / n);
  }

  edgeObjects(boxes: Boxes, chars = 'wW', add = true): BaseEdge[] {
    const edges = [new WedgedTenonEdge(boxes, this), new WedgedTenonHoleEdge(boxes, this)];
    edges.forEach((e, i) => {
      if (i < chars.length) e.char = chars[i]!;
    });
    if (add) boxes.addParts(edges);
    return edges;
  }
}

/** The tenons. Takes the place of an `f` edge. */
export class WedgedTenonEdge extends BaseEdge {
  override char: string | null = 'w';
  override description = 'Wedged tenons';
  declare settings: WedgedTenonSettings;

  call(length: number): void {
    const s = this.settings;
    const t = this.thickness;
    const p = s.protrusion();
    const half = s.width / 2;
    const centres = s.centres(length);

    // Wedge slots first, from the edge's start, so the outline is unbroken.
    // Outward is to the right of travel, so the slots sit at negative y. The
    // turtle runs on the kerf-offset line; the shoulder itself is `burn`
    // further in, as FingerHoleEdge also allows for.
    const slotDepth = s.gap + s.draw;
    const slotMid = t - s.draw + slotDepth / 2;
    for (const c of centres) {
      this.boxes.rectangularHole(c, this.burn - slotMid, t + s.slack, slotDepth);
    }

    let pos = 0;
    for (const c of centres) {
      this.edge(c - half - pos, 1);
      this.corner(-90);
      this.edge(p);
      this.corner(90);
      this.edge(s.width);
      this.corner(90);
      this.edge(p);
      this.corner(-90);
      pos = c + half;
    }
    this.edge(length - pos, 1);
  }

  override margin(): number {
    return this.settings.protrusion();
  }
}

/**
 * A straight edge with tenon holes running alongside it, for a panel whose
 * edge a tenoned panel meets at right angles. Takes the place of `h`.
 *
 * Here the wedges run parallel to this panel, across the hole line, half a
 * wedge length either side of it. So the holes are set in at least that far:
 * otherwise the wedges would stick out past this edge, and a cabinet with a
 * wedged back could not stand flush against a wall.
 */
export class WedgedTenonHoleEdge extends BaseEdge {
  override char: string | null = 'W';
  override description = 'Holes for wedged tenons';
  declare settings: WedgedTenonSettings;

  call(length: number): void {
    const s = this.settings;
    this.boxes.savedContext(() => {
      tenonHoles(this.boxes, s, 0, this.burn + s.holeInset(), length, 0);
    });
    this.edge(length, 2);
  }

  override startWidth(): number {
    return this.settings.holeInset() + this.thickness / 2;
  }
}

/**
 * Holes for a `w` edge of `length`, centred on the line from (x, y) at
 * `angle` — the same placement as `fingerHolesAt`, so a generator can swap
 * one for the other.
 */
export function tenonHoles(
  boxes: Boxes,
  s: WedgedTenonSettings,
  x: number,
  y: number,
  length: number,
  angle = 90,
): void {
  const t = boxes.thickness;
  boxes.savedContext(() => {
    boxes.moveTo(x, y, angle);
    for (const c of s.centres(length)) {
      boxes.rectangularHole(c, 0, s.width + s.slack, t + s.slack);
    }
  });
}

/** One wedge, as a part. Square on its bottom edge, tapered on its top. */
export function drawWedge(boxes: Boxes, s: WedgedTenonSettings, move: string): void {
  const l = s.wedge_length;
  const narrow = s.wedgeNarrow();
  const wide = s.wedgeWide();
  const phi = Math.atan((wide - narrow) / l) * (180 / Math.PI);

  if (boxes.move(l, wide, move, true)) return;

  boxes.edge(l);
  boxes.corner(90);
  boxes.edge(narrow);
  boxes.corner(90 - phi);
  boxes.edge(Math.hypot(l, wide - narrow));
  boxes.corner(90 + phi);
  boxes.edge(wide);
  boxes.corner(90);

  boxes.move(l, wide, move, false, 'wedge');
}

/**
 * Something on a panel's outer face: a rectangle `along` long in the
 * direction `angle` (degrees) and `across` wide, centred at (cx, cy).
 */
export interface FaceRect {
  cx: number;
  cy: number;
  angle: number;
  along: number;
  across: number;
}

/**
 * What each tenon of a hole line puts on the mating panel's outer face, in
 * the frame the holes were drawn in: the tenon end standing out of its hole,
 * and the wedge through it. The wedge runs square to the tenoned panel, so
 * across the hole line, half its length either side.
 */
export function tenonFootprints(
  s: WedgedTenonSettings,
  x: number,
  y: number,
  length: number,
  angle = 90,
): FaceRect[][] {
  const t = s.thickness;
  const a = (angle * Math.PI) / 180;
  return s.centres(length).map((c) => {
    const cx = x + c * Math.cos(a);
    const cy = y + c * Math.sin(a);
    return [
      { cx, cy, angle, along: s.width + s.slack, across: t + s.slack },
      { cx, cy, angle, along: t, across: s.wedge_length },
    ];
  });
}

function corners(r: FaceRect): [number, number][] {
  const a = (r.angle * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a);
  const hx = r.along / 2, hy = r.across / 2;
  return [
    [-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy],
  ].map(([p, q]) => [r.cx + p! * ux - q! * uy, r.cy + p! * uy + q! * ux]);
}

/** Separating-axis test; rectangles that only touch do not overlap. */
function overlaps(a: FaceRect, b: FaceRect): boolean {
  const ca = corners(a);
  const cb = corners(b);
  for (const r of [a, b]) {
    const ang = (r.angle * Math.PI) / 180;
    for (const [ax, ay] of [[Math.cos(ang), Math.sin(ang)], [-Math.sin(ang), Math.cos(ang)]]) {
      const pa = ca.map(([x, y]) => x * ax! + y * ay!);
      const pb = cb.map(([x, y]) => x * ax! + y * ay!);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false;
    }
  }
  return true;
}

/** Distance from (x, y) to the segment from a to b. */
function segmentDistance(x: number, y: number, [ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const u = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
  return Math.hypot(x - (ax + u * dx), y - (ay + u * dy));
}

/** Inside or on the outline; ray casting, so the outline need not be convex. */
function insideOutline(x: number, y: number, outline: [number, number][]): boolean {
  let inside = false;
  for (let k = 0; k < outline.length; k++) {
    const a = outline[k]!;
    const b = outline[(k + 1) % outline.length]!;
    if (segmentDistance(x, y, a, b) < 1e-6) return true;
    if (a[1] > y !== b[1] > y && x < a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) inside = !inside;
  }
  return inside;
}

/**
 * Checks the tenons and wedges on one panel's outer face: whether any two
 * tenons' footprints meet, and whether any wedge hangs off the panel, where it
 * would bear on one side of its tenon only. `outline` is the panel's outline
 * as a polygon in the same frame as the footprints. Only the footprints'
 * corners are tested against it, which is exact for a convex outline and
 * close enough for the shallow notches the generators have.
 */
export function wedgeClearance(
  tenons: FaceRect[][],
  outline: [number, number][],
): { clash: boolean; overhang: boolean } {
  let clash = false;
  for (let i = 0; i < tenons.length && !clash; i++) {
    for (let j = i + 1; j < tenons.length && !clash; j++) {
      clash = tenons[i]!.some((a) => tenons[j]!.some((b) => overlaps(a, b)));
    }
  }
  const overhang = tenons.some((fs) => fs.some((r) => !corners(r).every(([x, y]) => insideOutline(x, y, outline))));
  return { clash, overhang };
}

/** Where a polygonWall leg starts, and which way it runs, in degrees. */
export interface LegFrame {
  x: number;
  y: number;
  angle: number;
}

/**
 * Walks `polygonWall` borders as the turtle does, without drawing: the frame
 * each leg starts in (where its callback runs, less the kerf), and the outline,
 * with rounded corners as short chords. Legs run counter-clockwise from the
 * origin, so a leg's inside is to its left.
 */
export function walkBorders(borders: Array<number | [number, number]>): { legs: LegFrame[]; outline: [number, number][] } {
  const legs: LegFrame[] = [];
  const outline: [number, number][] = [];
  let x = 0, y = 0, heading = 0;
  for (let i = 0; i < borders.length; i += 2) {
    const l = borders[i] as number;
    legs.push({ x, y, angle: heading });
    outline.push([x, y]);
    x += l * Math.cos((heading * Math.PI) / 180);
    y += l * Math.sin((heading * Math.PI) / 180);
    const turn = borders[i + 1] ?? 0;
    const [a, r] = Array.isArray(turn) ? turn : [turn, 0];
    if (r > 0) {
      // The arc's centre is r to the side it turns towards; step round it.
      const steps = 8;
      const sg = Math.sign(a);
      const cx = x - sg * r * Math.sin((heading * Math.PI) / 180);
      const cy = y + sg * r * Math.cos((heading * Math.PI) / 180);
      for (let k = 1; k <= steps; k++) {
        const h = heading + (a * k) / steps;
        outline.push([x, y]);
        x = cx + sg * r * Math.sin((h * Math.PI) / 180);
        y = cy - sg * r * Math.cos((h * Math.PI) / 180);
      }
    }
    heading += a;
  }
  return { legs, outline };
}

/**
 * The footprints of a line of tenon holes drawn by a leg's callback at
 * `holeInset` in from the leg, as `W` would draw them.
 */
export function legTenonFootprints(s: WedgedTenonSettings, leg: LegFrame, length: number): FaceRect[][] {
  const a = (leg.angle * Math.PI) / 180;
  const d = s.holeInset();
  return tenonFootprints(s, leg.x - d * Math.sin(a), leg.y + d * Math.cos(a), length, leg.angle);
}
