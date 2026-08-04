/**
 * Finger joints, ported from boxes.py `boxes/edges.py`.
 *
 * These are the workhorse joint of the whole library: interlocking rectangular
 * fingers that give a 90-degree corner real glue area and self-alignment. The
 * `f` edge cuts protruding fingers, `F` cuts the matching gaps, and `h` cuts
 * slots in the middle of a panel for a wall to pass through.
 *
 * Finger *width* scales with material thickness so joints look right across
 * materials, and `play` opens the gaps up when a press fit is too tight.
 */
import type { Boxes } from '../boxes';
import { BaseEdge, type BoltPolicy, type EdgeCallOptions } from './base';
import { Settings } from './settings';

export class BoltsPolicy implements BoltPolicy {
  bolts: number;
  private fingers = 0;

  constructor(bolts = 1) {
    this.bolts = bolts;
  }

  numFingers(numFingers: number): number {
    this.fingers = this.bolts % 2 ? Math.floor(numFingers / 2) * 2 : numFingers;
    return this.fingers;
  }

  drawBolt(pos: number): boolean {
    if (pos > Math.floor(this.fingers / 2)) pos = this.fingers - pos;
    if (pos === 0) return false;
    if (pos === Math.floor(this.fingers / 2) && this.bolts % 2 === 0) return false;
    return (
      Math.floor((pos * (this.bolts + 1)) / this.fingers - 0.01) !==
      Math.floor(((pos + 1) * (this.bolts + 1)) / this.fingers - 0.01)
    );
  }
}

export type FingerStyle = 'rectangular' | 'springs' | 'barbs' | 'snap';

export class FingerJointSettings extends Settings {
  static override absoluteParams = {
    style: ['rectangular', 'springs', 'barbs', 'snap'] as const,
    surroundingspaces: 2.0,
  };

  static override relativeParams = {
    space: 2.0,
    finger: 2.0,
    width: 1.0,
    edge_width: 1.0,
    play: 0.0,
    extra_length: 0.0,
    bottom_lip: 0.0,
  };

  /** Angle at which the two joined walls meet. */
  angle = 90;

  get space(): number { return this.getNum('space'); }
  get finger(): number { return this.getNum('finger'); }
  get width(): number { return this.getNum('width'); }
  get edge_width(): number { return this.getNum('edge_width'); }
  get play(): number { return this.getNum('play'); }
  get extra_length(): number { return this.getNum('extra_length'); }
  get bottom_lip(): number { return this.getNum('bottom_lip'); }
  get surroundingspaces(): number { return this.getNum('surroundingspaces'); }
  get style(): FingerStyle { return this.getStr('style') as FingerStyle; }

  override checkValues(): void {
    if (Math.abs(this.space + this.finger) < 0.1) {
      throw new Error('FingerJointSettings: space + finger must not be close to zero');
    }
  }

  edgeObjects(boxes: Boxes, chars = 'fFh', add = true): BaseEdge[] {
    const edges: BaseEdge[] = [
      new FingerJointEdge(boxes, this),
      new FingerJointEdgeCounterPart(boxes, this),
      new FingerHoleEdge(boxes, this),
    ];
    edges.forEach((e, i) => {
      if (i < chars.length) e.char = chars[i]!;
    });
    if (add) boxes.addParts(edges);
    return edges;
  }
}

/** Shared finger arithmetic used by both the edges and the matching slots. */
function calcFingers(
  s: FingerJointSettings,
  length: number,
  bedBolts: BoltPolicy | null | undefined,
): [number, number] {
  const { space, finger } = s;
  let fingers = Math.floor(
    (length - (s.surroundingspaces - 1) * space) / (space + finger),
  );

  // Squeeze in a single finger rather than leaving a corner unjoined.
  if (fingers === 0 && length > finger + 1.0 * s.thickness) fingers = 1;
  if (!finger) fingers = 0;
  if (bedBolts) fingers = bedBolts.numFingers(fingers);

  let leftover = length - fingers * (space + finger) + space;
  if (fingers <= 0) {
    fingers = 0;
    leftover = length;
  }
  return [fingers, leftover];
}

/**
 * How far a finger must stick out, and how much the space recesses, for walls
 * meeting at `angle`. At 90 degrees this is simply the material thickness.
 */
function fingerLength(s: FingerJointSettings, angle: number): [number, number] {
  if (angle >= 90 || angle <= -90) {
    return [s.thickness + s.extra_length, 0.0];
  }
  if (angle < 0) {
    return [
      Math.sin((-angle * Math.PI) / 180) * s.thickness + s.extra_length,
      0,
    ];
  }
  const a = 90 - (180 - angle) / 2.0;
  const fl = s.thickness * Math.tan((a * Math.PI) / 180);
  const b = 90 - 2 * a;
  const spacerecess = -Math.sin((b * Math.PI) / 180) * fl;
  return [fl + s.extra_length, spacerecess];
}

export { calcFingers, fingerLength };

export class FingerJointEdge extends BaseEdge {
  override char: string | null = 'f';
  override description = 'Finger Joint';
  positive = true;
  declare settings: FingerJointSettings;

  constructor(boxes: Boxes, settings: FingerJointSettings) {
    super(boxes, settings);
  }

  drawFinger(f: number, h: number, style: FingerStyle, positive = true, firsthalf = true): void {
    const t = this.settings.thickness;

    if (!positive) {
      this.polyline(0, 90, h, -90, f, -90, h, 90);
      return;
    }

    switch (style) {
      case 'springs':
        this.polyline(
          0, -90, 0.8 * h, [90, 0.2 * h],
          0.1 * h, 90, 0.9 * h, -180, 0.9 * h, 90,
          f - 0.6 * h,
          90, 0.9 * h, -180, 0.9 * h, 90, 0.1 * h,
          [90, 0.2 * h], 0.8 * h, -90,
        );
        break;
      case 'barbs': {
        const n = Math.floor((h - 0.1 * t) / (0.3 * t));
        const a = (Math.atan(0.5) * 180) / Math.PI;
        const l = Math.sqrt(5);
        const poly: Array<number | [number, number]> = [h - n * 0.3 * t];
        for (let i = 0; i < n; i++) {
          poly.push(-45, 0.1 * Math.SQRT2 * t, 45 + a, l * 0.1 * t, -a, 0);
        }
        this.polyline(0, -90, ...poly, 90, f, 90, ...[...poly].reverse(), -90);
        break;
      }
      case 'snap': {
        if (f <= 1.9 * t) {
          this.polyline(0, -90, h, 90, f, 90, h, -90);
          break;
        }
        const a12 = (Math.atan(0.5) * 180) / Math.PI;
        const l12 = t / Math.cos((a12 * Math.PI) / 180);
        const d = 4 * t;
        const d2 = d + 1 * t;
        const a = (Math.atan((0.5 * t) / (h + d2)) * 180) / Math.PI;
        const l = (h + d2) / Math.cos((a * Math.PI) / 180);
        const poly: Array<number | [number, number]> = [
          0, 90, d, -180, d + h, -90, 0.5 * t, 90 + a12, l12, 90 - a12,
          0.5 * t, 90 - a, l, +a, 0, [-180, 0.1 * t], h + d2, 90,
          f - 1.7 * t, 90 - a12, l12, a12, h, -90, 0,
        ];
        this.polyline(...(firsthalf ? [...poly].reverse() : poly));
        break;
      }
      default:
        this.polyline(0, -90, h, 90, f, 90, h, -90);
    }
  }

  call(length: number, opts: EdgeCallOptions = {}): void {
    const s = this.settings;
    const positive = this.positive;
    const thickness = s.thickness;

    let space = s.space;
    let f = s.finger;
    let style = s.style;
    const play = s.play;
    let bedBolts = opts.bedBolts ?? null;

    let [fingers, leftover] = calcFingers(s, length, bedBolts);

    // Too short for proper fingers: fall back to one small rectangular finger
    // rather than leaving the corner completely unjoined.
    if (fingers === 0 && f && leftover > 0.75 * thickness && leftover > 4 * play) {
      fingers = 1;
      f = leftover = leftover / 2.0;
      bedBolts = null;
      style = 'rectangular';
    }

    if (!positive) {
      f += play;
      space -= play;
      leftover -= play;
    }

    this.edge(leftover / 2.0, 1);

    const [l1, l2] = fingerLength(s, s.angle);
    const h = l1 - l2;
    const d = (opts.bedBoltSettings ?? this.boxes.bedBoltSettings)[0]!;

    for (let i = 0; i < fingers; i++) {
      if (i !== 0) {
        if (!positive && bedBolts && bedBolts.drawBolt(i)) {
          this.hole(0.5 * space, 0.5 * thickness, 0.5 * d);
        }
        if (positive && bedBolts && bedBolts.drawBolt(i)) {
          this.boxes.bedBoltHole(space, opts.bedBoltSettings ?? null);
        } else {
          this.edge(space);
        }
      }
      this.drawFinger(f, h, style, positive, i < Math.floor(fingers / 2));
    }

    this.edge(leftover / 2.0, 1);
  }

  override margin(): number {
    const w = fingerLength(this.settings, this.settings.angle);
    if (this.positive) {
      if (this.settings.style === 'snap') {
        return w[0] - w[1] + this.settings.thickness;
      }
      return w[0] - w[1];
    }
    return 0.0;
  }

  override startWidth(): number {
    const w = fingerLength(this.settings, this.settings.angle);
    return this.positive ? w[1] : w[0];
  }
}

/** The other half of a finger joint: gaps where the `f` edge has fingers. */
export class FingerJointEdgeCounterPart extends FingerJointEdge {
  override char: string | null = 'F';
  override description = 'Finger Joint (opposing side)';
  override positive = false;
}

/**
 * Slots cut through the middle of a panel so a wall can pass through it —
 * this is how shelves and dividers attach without an exposed corner.
 */
export class FingerHoles {
  boxes: Boxes;
  settings: FingerJointSettings;

  constructor(boxes: Boxes, settings: FingerJointSettings) {
    this.boxes = boxes;
    this.settings = settings;
  }

  call(
    x: number,
    y: number,
    length: number,
    angle = 90,
    bedBolts: BoltPolicy | null = null,
    bedBoltSettings: readonly number[] | null = null,
  ): void {
    const b = this.boxes;
    b.savedContext(() => {
      b.moveTo(x, y, angle);
      const s = this.settings;
      const space = s.space;
      const p = s.play;

      let [fingers, leftover] = calcFingers(s, length, bedBolts);
      let f = s.finger;

      if (fingers === 0 && f && leftover > 0.75 * s.thickness && leftover > 4 * p) {
        fingers = 1;
        f = leftover = leftover / 2.0;
        bedBolts = null;
      }

      for (let i = 0; i < fingers; i++) {
        const pos = leftover / 2.0 + i * (space + f);
        if (bedBolts && bedBolts.drawBolt(i)) {
          const d = (bedBoltSettings ?? b.bedBoltSettings)[0]!;
          b.hole(pos - 0.5 * space, 0, d * 0.5);
        }
        b.rectangularHole(pos + 0.5 * f, 0, f + p, s.width + p);
      }
    });
  }
}

/** An edge that is straight, but cuts finger slots parallel to itself. */
export class FingerHoleEdge extends BaseEdge {
  override char: string | null = 'h';
  override description = 'Edge (parallel Finger Joint Holes)';
  declare settings: FingerJointSettings;
  fingerHoles: FingerHoles;

  constructor(boxes: Boxes, settings: FingerJointSettings, fingerHoles?: FingerHoles) {
    super(boxes, settings);
    this.fingerHoles = fingerHoles ?? new FingerHoles(boxes, settings);
  }

  call(length: number, opts: EdgeCallOptions = {}): void {
    const dist = this.fingerHoles.settings.edge_width;
    const b = this.boxes;
    b.savedContext(() => {
      this.fingerHoles.call(
        0,
        this.burn + dist + this.settings.thickness / 2,
        length,
        0,
        opts.bedBolts ?? null,
        opts.bedBoltSettings ?? null,
      );
      if (this.settings.bottom_lip) {
        const h = this.settings.bottom_lip + this.fingerHoles.settings.edge_width;
        const sp = b.spacing;
        b.moveTo(-sp / 2, -h - sp);
        b.rectangularWall(length - 1.05 * b.thickness, h);
      }
    });
    this.edge(length, 2);
  }

  override startWidth(): number {
    return this.fingerHoles.settings.edge_width + this.settings.thickness;
  }

  override margin(): number {
    if (this.settings.bottom_lip) {
      return (
        this.settings.bottom_lip + this.fingerHoles.settings.edge_width + this.boxes.spacing
      );
    }
    return 0.0;
  }
}
