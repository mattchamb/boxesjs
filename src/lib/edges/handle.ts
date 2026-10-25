/**
 * Handle edge, ported from boxes.py `boxes/edges.py` (`HandleEdgeSettings`,
 * `HandleEdge`, `HandleHoleEdge`). A rounded bump above the wall with one or
 * more finger holes cut through it — a pull for a drawer or a tray.
 */
import type { Boxes } from '../boxes';
import { parseSections } from '../params/sections';
import { Edge } from './base';
import { Settings } from './settings';

export class HandleEdgeSettings extends Settings {
  static override absoluteParams = {
    height: 20.0,
    radius: 10.0,
    hole_width: '40:40',
    hole_height: 75.0,
    on_sides: true,
  };

  static override relativeParams = {
    outset: 1.0,
  };

  get height(): number { return this.getNum('height'); }
  get radius(): number { return this.getNum('radius'); }
  get hole_width(): string { return this.getStr('hole_width'); }
  get hole_height(): number { return this.getNum('hole_height'); }
  get outset(): number { return this.getNum('outset'); }

  edgeObjects(boxes: Boxes, chars = 'yY', add = true): Edge[] {
    const edges = [new HandleEdge(boxes, this), new HandleHoleEdge(boxes, this)];
    edges.forEach((e, i) => {
      if (i < chars.length) e.char = chars[i]!;
    });
    if (add) boxes.addParts(edges);
    return edges;
  }
}

export class HandleEdge extends Edge {
  override char: string | null = 'y';
  override description = 'Handle for e.g. a drawer';
  declare settings: HandleEdgeSettings;
  /** In multiples of thickness; the hole variant rises one thickness higher. */
  protected extraHeight = 0.0;

  override call(length: number): void {
    const s = this.settings;
    const t = this.thickness;
    length += 2 * s.outset;
    const extraHeight = this.extraHeight * s.thickness;

    let r = s.radius;
    if (r > length / 2) r = length / 2;
    if (r > s.height) r = s.height;

    const widths = parseSections(s.hole_width);
    const sum = widths.reduce((a, b) => a + b, 0);

    if (s.outset) this.polyline(0, -180, s.outset, 90);
    else this.corner(-90);

    if (s.hole_height && sum > 0) {
      const slotOffset =
        sum < 100 ? ((1 - sum / 100) * (length - (widths.length + 1) * t)) / (widths.length * 2) : 0;
      const slotHeight = ((s.height - 2 * t) * s.hole_height) / 100;
      let slotX = t + slotOffset;

      for (const w of widths) {
        // Above 100 % the widths are shares of the whole rather than percentages.
        const slotWidth =
          sum > 100
            ? (w / sum) * (length - (widths.length + 1) * t)
            : (w / 100) * (length - (widths.length + 1) * t);
        slotX += slotWidth / 2;
        this.boxes.savedContext(() => {
          this.moveTo(s.height / 2 + extraHeight, slotX, 0);
          this.boxes.rectangularHole(0, 0, slotHeight, slotWidth, slotHeight / 2, true, true);
        });
        slotX += slotWidth / 2 + slotOffset + t + slotOffset;
      }
    }

    this.edge(s.height - r + extraHeight, 1);
    this.corner(90, r, 1);
    this.edge(length - 2 * r, 1);
    this.corner(90, r, 1);
    this.edge(s.height - r + extraHeight, 1);

    if (s.outset) this.polyline(0, 90, s.outset, -180);
    else this.corner(-90);
  }

  override margin(): number {
    return this.settings.height;
  }
}

/** Handle on a panel that a parallel wall joins with fingers just below it. */
export class HandleHoleEdge extends HandleEdge {
  override char: string | null = 'Y';
  override description = 'Handle with holes for parallel finger joint';
  protected override extraHeight = 1.0;

  override call(length: number): void {
    this.boxes.fingerHolesAt(0, -0.5 * this.settings.thickness, length, 0);
    super.call(length);
  }

  override margin(): number {
    return this.settings.height + this.extraHeight * this.settings.thickness;
  }
}
