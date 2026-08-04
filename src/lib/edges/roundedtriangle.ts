/**
 * Rounded triangle edge, ported from boxes.py `boxes/edges.py`.
 * A triangular bump above the wall, usually with a hole — a carry handle.
 */
import type { Boxes } from '../boxes';
import { Edge } from './base';
import { Settings } from './settings';

const DEG = Math.PI / 180;

export class RoundedTriangleEdgeSettings extends Settings {
  static override absoluteParams = {
    height: 50.0,
    radius: 30.0,
    r_hole: 2.0,
  };

  static override relativeParams = {
    outset: 0.0,
  };

  get height(): number { return this.getNum('height'); }
  get radius(): number { return this.getNum('radius'); }
  get r_hole(): number { return this.getNum('r_hole'); }
  get outset(): number { return this.getNum('outset'); }

  edgeObjects(boxes: Boxes, chars = 't', add = true): Edge[] {
    const edges = [
      new RoundedTriangleEdge(boxes, this),
      new RoundedTriangleFingerHolesEdge(boxes, this),
    ];
    edges.forEach((e, i) => {
      if (i < chars.length) e.char = chars[i]!;
    });
    if (add) boxes.addParts(edges);
    return edges;
  }
}

export class RoundedTriangleEdge extends Edge {
  override char: string | null = 't';
  override description = 'Triangle for handle';
  declare settings: RoundedTriangleEdgeSettings;

  override call(length: number): void {
    const s = this.settings;
    length += 2 * s.outset;
    let r = s.radius;
    if (r > length / 2) r = length / 2;

    let angle: number;
    let l: number;
    if (length - 2 * r < s.height) {
      // Steep triangle — measure from the height to avoid dividing by zero.
      angle = 90 - Math.atan((length - 2 * r) / (2 * s.height)) / DEG;
      l = s.height / Math.cos((90 - angle) * DEG);
    } else {
      angle = Math.atan((2 * s.height) / (length - 2 * r)) / DEG;
      l = (0.5 * (length - 2 * r)) / Math.cos(angle * DEG);
    }

    if (s.outset) this.polyline(0, -180, s.outset, 90);
    else this.corner(-90);

    if (s.r_hole) this.hole(s.height, length / 2.0, s.r_hole);

    this.corner(90 - angle, r, 1);
    this.edge(l, 1);
    this.corner(2 * angle, r, 1);
    this.edge(l, 1);
    this.corner(90 - angle, r, 1);

    if (s.outset) this.polyline(0, 90, s.outset, -180);
    else this.corner(-90);
  }

  override margin(): number {
    return this.settings.height + this.settings.radius;
  }
}

export class RoundedTriangleFingerHolesEdge extends RoundedTriangleEdge {
  override char: string | null = 'T';

  override startWidth(): number {
    return this.settings.thickness;
  }
}
