/**
 * Bayonet twist-lock geometry, ported from boxes.py
 * `boxes/generators/bayonetbox.py` (class `BayonetBox`).
 *
 * The lock is built from flat layers rather than a moulded thread. Two rings
 * carry interlocking lugs — a set of arcs that sweep round the circumference
 * with a step in and out at each end — so that dropping the top on and twisting
 * it pulls the two together. Three alignment pin holes at 120 degrees keep the
 * glued-up stack concentric.
 *
 * boxes.py puts this on a base class that RegularBox inherits, but it inherits
 * the *methods* only — `diameter` and `lugs` are plain attributes both
 * generators assign. So this is a helper object, like `topedge.ts` and
 * `hexholes.ts`, rather than a base class.
 */
import type { Boxes } from './boxes';

export class Bayonet {
  constructor(
    private boxes: Boxes,
    /** Reassigned mid-render by RegularBox, which sizes the lock per end. */
    public diameter: number,
    public lugs: number,
    public alignmentPins: number,
  ) {}

  /** Three pin holes at 120 degrees, on the outer ring, the inner ring, or both. */
  alignmentHoles(opts: { inner?: boolean; outer?: boolean } = {}): void {
    const { inner = false, outer = false } = opts;
    const b = this.boxes;
    const d = this.diameter;
    const r = d / 2;
    const t = b.thickness;
    const p = 0.05 * t;

    b.savedContext(() => {
      for (let i = 0; i < 3; i++) {
        if (outer) b.hole(r - t / 2, 0, 0, this.alignmentPins);
        if (inner) b.hole(r - 2 * t - p, 0, 0, this.alignmentPins);
        b.moveTo(0, 0, 360 / 3);
      }
    });
  }

  /** The ring of lugs that the upper layer twists down onto. */
  lowerLayer(opts: { asPart?: boolean; move?: string | null } = {}): void {
    const { asPart = false, move } = opts;
    const b = this.boxes;
    const d = this.diameter;
    const r = d / 2;
    const t = b.thickness;
    const l = this.lugs;
    const a = 180 / l;

    if (asPart) {
      if (b.move(d, d, move, true)) return;
      b.moveTo(d / 2, d / 2);
    }

    this.alignmentHoles({ inner: true });
    b.hole(0, 0, d / 2 - 2.5 * t);
    b.moveTo(d / 2 - 1.5 * t, 0, -90);

    for (let i = 0; i < l; i++) {
      b.polyline(
        0, [(-4 / 3) * a, r - 1.5 * t], 0, 90, 0.5 * t, -90,
        0, [(-2 / 3) * a, r - t], 0, -90, 0.5 * t, 90,
      );
    }

    if (asPart) b.move(d, d, move);
  }

  /** Callback for the lower disc: pin holes, the lug ring, and its clearance cut. */
  lowerCB(): void {
    const b = this.boxes;
    const d = this.diameter;
    const r = d / 2;
    const t = b.thickness;
    const p = 0.05 * t;
    const l = this.lugs;
    const a = 180 / l;

    this.alignmentHoles({ outer: true });
    b.savedContext(() => this.lowerLayer());

    b.moveTo(d / 2 - 1.5 * t + p, 0, -90);
    for (let i = 0; i < l; i++) {
      b.polyline(
        0, [(-2 / 3) * a, r - 1.5 * t + p], 0, 90, 0.5 * t, -90,
        0, [(-4 / 3) * a, r - t + p], 0, -90, 0.5 * t, 90,
      );
    }
  }

  /** Callback for the upper disc: the matching lugs, cut with the play `p`. */
  upperCB(): void {
    const b = this.boxes;
    const d = this.diameter;
    const r = d / 2;
    const t = b.thickness;
    const p = 0.05 * t;
    const l = this.lugs;
    const a = 180 / l;

    b.hole(0, 0, d / 2 - 2.5 * t);
    b.hole(0, 0, d / 2 - 1.5 * t);
    this.alignmentHoles({ inner: true, outer: true });
    b.moveTo(d / 2 - 1.5 * t, 0, -90);

    for (let i = 0; i < l; i++) {
      b.polyline(
        0, [-1.3 * a, r - 1.5 * t + p], 0, 90, 0.5 * t, -90,
        0, [-0.7 * a, r - t + p], 0, -90, 0.5 * t, 90,
      );
    }
  }
}
