/**
 * Slotted edges, ported from boxes.py `boxes/edges.py`.
 *
 * A slotted edge runs along a series of sections and drops a notch between each
 * one. This is how tray dividers interlock: two panels each cut half-depth
 * slots and slide together into an egg-crate grid.
 */
import type { Boxes, EdgeSpec } from '../boxes';
import { BaseEdge } from './base';
import { Settings } from './settings';

/** A single notch cut into an otherwise straight edge. */
export class Slot extends BaseEdge {
  override description = 'Slot';
  private depth: number;

  constructor(boxes: Boxes, depth: number) {
    super(boxes, null);
    this.depth = depth;
  }

  call(length: number): void {
    if (this.depth) {
      this.boxes.corner(90);
      this.boxes.edge(this.depth);
      this.boxes.corner(-90);
      this.boxes.edge(length);
      this.boxes.corner(-90);
      this.boxes.edge(this.depth);
      this.boxes.corner(90);
    } else {
      this.boxes.edge(length);
    }
  }
}

export class SlottedEdge extends BaseEdge {
  override description = 'Straight edge with slots';
  private sectionEdge: BaseEdge;
  private sections: number[];
  private slots: number;

  constructor(boxes: Boxes, sections: number[], edge: EdgeSpec = 'e', slots = 0) {
    super(boxes, new Settings(boxes.thickness));
    this.sectionEdge = boxes.getEdge(edge);
    this.sections = sections;
    this.slots = slots;
  }

  override startWidth(): number {
    return this.sectionEdge.startWidth();
  }

  override endWidth(): number {
    return this.sectionEdge.endWidth();
  }

  override margin(): number {
    return this.sectionEdge.margin();
  }

  call(): void {
    const t = this.boxes.thickness;
    for (const l of this.sections.slice(0, -1)) {
      this.sectionEdge.call(l);
      if (this.slots) new Slot(this.boxes, this.slots).call(t);
      else this.boxes.edge(t);
    }
    this.sectionEdge.call(this.sections[this.sections.length - 1]!);
  }
}
