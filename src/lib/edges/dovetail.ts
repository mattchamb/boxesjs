/**
 * Dovetail joint, ported from boxes.py `boxes/edges.py` (`DoveTailSettings`,
 * `DoveTailJoint`, `DoveTailJointCounterPart`).
 *
 * Flared tails along the edge that lock into matching sockets on the other
 * part, joining two panels edge to edge in the same plane — for a part bigger
 * than the laser bed, or a puzzle-like join that needs no glue.
 */
import type { Boxes } from '../boxes';
import { BaseEdge } from './base';
import { Settings } from './settings';

export class DoveTailSettings extends Settings {
  static override absoluteParams = {
    /** How far the tails flare, in degrees. boxes.py declares it an int. */
    angle: 50,
  };

  static override relativeParams = {
    size: 3,
    depth: 1.5,
    radius: 0.2,
  };

  get angle(): number { return this.getNum('angle'); }
  get size(): number { return this.getNum('size'); }
  get depth(): number { return this.getNum('depth'); }
  get radius(): number { return this.getNum('radius'); }

  edgeObjects(boxes: Boxes, chars = 'dD', add = true): BaseEdge[] {
    const edges = [new DoveTailJoint(boxes, this), new DoveTailJointCounterPart(boxes, this)];
    edges.forEach((e, i) => {
      if (i < chars.length) e.char = chars[i]!;
    });
    if (add) boxes.addParts(edges);
    return edges;
  }
}

export class DoveTailJoint extends BaseEdge {
  override char: string | null = 'd';
  override description = 'Dove Tail Joint';
  declare settings: DoveTailSettings;
  protected positive = true;

  call(length: number): void {
    const s = this.settings;
    // A radius under the kerf would be eaten by it; boxes.py clamps the same way.
    const radius = Math.max(s.radius, this.burn);
    const a = s.angle + 90;
    const alpha = 0.5 * Math.PI - (Math.PI * s.angle) / 180.0;

    const l1 = radius / Math.tan(alpha / 2.0);
    const diffx = (0.5 * s.depth) / Math.tan(alpha);
    const l2 = (0.5 * s.depth) / Math.sin(alpha);

    const sections = Math.floor(length / (s.size * 2));
    const leftover = length - sections * s.size * 2;

    if (sections === 0) {
      this.edge(length);
      return;
    }

    const p = this.positive ? 1 : -1;

    this.edge((s.size + leftover) / 2.0 + diffx - l1, 1);

    for (let i = 0; i < sections; i++) {
      this.corner(-1 * p * a, radius);
      this.edge(2 * (l2 - l1));
      this.corner(p * a, radius);
      this.edge(2 * (diffx - l1) + s.size);
      this.corner(p * a, radius);
      this.edge(2 * (l2 - l1));
      this.corner(-1 * p * a, radius);

      if (i < sections - 1) this.edge(2 * (diffx - l1) + s.size);
    }

    this.edge((s.size + leftover) / 2.0 + diffx - l1, 1);
  }

  override margin(): number {
    return this.settings.depth;
  }
}

/** The sockets: the same profile mirrored into the panel. */
export class DoveTailJointCounterPart extends DoveTailJoint {
  override char: string | null = 'D';
  override description = 'Dove Tail Joint (opposing side)';
  protected override positive = false;

  override margin(): number {
    return 0.0;
  }
}
