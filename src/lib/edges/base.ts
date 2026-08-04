/**
 * Edge base classes, ported from boxes.py `boxes/edges.py`.
 *
 * An edge is a callable that draws one side of a part. The part does not need to
 * know what the edge looks like — it only asks how much room the edge needs
 * (`startWidth`/`endWidth`/`margin`) so it can lay itself out. That indirection
 * is what lets a plain rectangle become a finger-jointed wall by changing a
 * single character.
 */
import type { Boxes } from '../boxes';
import type { Settings } from './settings';

export interface BedBoltSettings {
  /** [d, d_nut, h_nut, l, l1] */
  readonly values: readonly [number, number, number, number, number];
}

/** Controls where bolts are placed along a finger joint. */
export interface BoltPolicy {
  bolts: number;
  numFingers(numFingers: number): number;
  drawBolt(pos: number): boolean;
}

export interface EdgeCallOptions {
  bedBolts?: BoltPolicy | null;
  bedBoltSettings?: readonly number[] | null;
}

export abstract class BaseEdge {
  char: string | null = null;
  description = 'Abstract Edge Class';
  boxes: Boxes;
  settings: Settings | null;

  constructor(boxes: Boxes, settings: Settings | null) {
    this.boxes = boxes;
    this.settings = settings;
  }

  abstract call(length: number, opts?: EdgeCallOptions): void;

  /** Space the start of the edge sits below the inner area of the part. */
  startWidth(): number {
    return 0.0;
  }

  endWidth(): number {
    return this.startWidth();
  }

  /** Space needed to the right of the starting point. */
  margin(): number {
    return 0.0;
  }

  /** Total space the edge needs outside the part's inner area. */
  spacing(): number {
    return this.startWidth() + this.margin();
  }

  startAngle(): number {
    return 0.0;
  }

  endAngle(): number {
    return 0.0;
  }

  // Convenience forwarders, standing in for Python's __getattr__ delegation.
  protected get thickness(): number {
    return this.boxes.thickness;
  }
  protected get burn(): number {
    return this.boxes.burn;
  }
  protected edge(length: number, tabs = 0): void {
    this.boxes.edge(length, tabs);
  }
  protected corner(degrees: number, radius = 0, tabs = 0): void {
    this.boxes.corner(degrees, radius, tabs);
  }
  protected polyline(...args: Array<number | [number, number]>): void {
    this.boxes.polyline(...args);
  }
  protected moveTo(x: number, y = 0, degrees = 0): void {
    this.boxes.moveTo(x, y, degrees);
  }
  protected hole(x: number, y: number, r = 0, d = 0, tabs = 0): void {
    this.boxes.hole(x, y, r, d, tabs);
  }
}

/** Plain straight edge. */
export class Edge extends BaseEdge {
  override char: string | null = 'e';
  override description = 'Straight Edge';
  positive = false;

  call(length: number, opts: EdgeCallOptions = {}): void {
    const bedBolts = opts.bedBolts;
    if (bedBolts) {
      const intervalLength = length / bedBolts.bolts;
      if (this.positive) {
        const d = (opts.bedBoltSettings ?? this.boxes.bedBoltSettings)[0]!;
        for (let i = 0; i < bedBolts.bolts; i++) {
          this.hole(0.5 * intervalLength, 0.5 * this.thickness, 0.5 * d);
          this.edge(intervalLength, i === 0 || i === bedBolts.bolts - 1 ? 1 : 0);
        }
      } else {
        for (let i = 0; i < bedBolts.bolts; i++) {
          this.boxes.bedBoltHole(
            intervalLength,
            opts.bedBoltSettings ?? null,
            i === 0 || i === bedBolts.bolts - 1 ? 1 : 0,
          );
        }
      }
    } else {
      this.edge(length, 2);
    }
  }
}

/** Straight edge, offset outward by one material thickness. */
export class OutSetEdge extends Edge {
  override char: string | null = 'E';
  override description = 'Straight Edge (outset by thickness)';
  override positive = true;
  /** boxes.py passes the outset distance in place of a settings object. */
  private readonly width: number | null;

  constructor(boxes: Boxes, width: number | null = null) {
    super(boxes, null);
    this.width = width;
  }

  override startWidth(): number {
    return this.width ?? this.boxes.thickness;
  }
}

/** Draws nothing and does not even turn — used to skip a side. */
export class NoopEdge extends BaseEdge {
  override char: string | null = null;
  override description = 'Does nothing';
  private _margin: number;

  constructor(boxes: Boxes, margin = 0) {
    super(boxes, null);
    this._margin = margin;
  }

  call(): void {
    // Cancel the turn the caller is about to make.
    this.corner(-90);
  }

  override margin(): number {
    return this._margin;
  }
}

/**
 * An edge assembled from several other edges laid end to end.
 * Used where one side of a part changes character partway along.
 */
export class CompoundEdge extends BaseEdge {
  override description = 'Compound Edge';
  private types: BaseEdge[];
  private lengths: number[];

  constructor(boxes: Boxes, types: BaseEdge[], lengths: number[]) {
    super(boxes, null);
    this.types = types;
    this.lengths = lengths;
    if (types.length !== lengths.length) {
      throw new Error('CompoundEdge needs one length per edge type');
    }
  }

  override startWidth(): number {
    return this.types[0]!.startWidth();
  }

  override endWidth(): number {
    return this.types[this.types.length - 1]!.endWidth();
  }

  override margin(): number {
    return Math.max(...this.types.map((e) => e.margin() + e.startWidth())) - this.startWidth();
  }

  call(length: number): void {
    const total = this.lengths.reduce((a, b) => a + b, 0);
    if (length && Math.abs(total - length) > 1e-5) {
      throw new Error(`Wrong length for CompoundEdge: ${total} vs ${length}`);
    }
    let lastWidth = this.types[0]!.startWidth();

    for (let i = 0; i < this.types.length; i++) {
      const edge = this.types[i]!;
      this.boxes.step(edge.startWidth() - lastWidth);
      edge.call(this.lengths[i]!);
      lastWidth = edge.endWidth();
    }
  }
}
