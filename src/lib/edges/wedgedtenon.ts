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
