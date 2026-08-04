/**
 * Mounting edge, ported from boxes.py `boxes/edges.py`.
 * Adds keyhole slots so the finished box can be hung on screws in a wall.
 */
import type { Boxes } from '../boxes';
import { BaseEdge } from './base';
import { Settings } from './settings';

export const MOUNTING_STYLE = {
  IN: 'straight edge, within',
  EXT: 'straight edge, extended',
  TAB: 'mounting tab',
} as const;

export const MOUNTING_SIDE = {
  BACK: 'back',
  LEFT: 'left',
  RIGHT: 'right',
  FRONT: 'front',
} as const;

export class MountingSettings extends Settings {
  static override absoluteParams = {
    style: [MOUNTING_STYLE.IN, MOUNTING_STYLE.EXT, MOUNTING_STYLE.TAB] as const,
    side: [
      MOUNTING_SIDE.BACK,
      MOUNTING_SIDE.LEFT,
      MOUNTING_SIDE.RIGHT,
      MOUNTING_SIDE.FRONT,
    ] as const,
    num: 2,
    /** Fraction of the edge left clear at each end. */
    margin: 0.125,
    d_shaft: 3.0,
    d_head: 6.5,
  };

  static override relativeParams = {};

  get style(): string { return this.getStr('style'); }
  get side(): string { return this.getStr('side'); }
  get num(): number { return this.getNum('num'); }
  get margin(): number { return this.getNum('margin'); }
  get d_shaft(): number { return this.getNum('d_shaft'); }
  get d_head(): number { return this.getNum('d_head'); }

  edgeObjects(boxes: Boxes, chars = 'G', add = true): BaseEdge[] {
    const edges: BaseEdge[] = [new MountingEdge(boxes, this)];
    edges.forEach((e, i) => {
      if (i < chars.length) e.char = chars[i]!;
    });
    if (add) boxes.addParts(edges);
    return edges;
  }
}

export class MountingEdge extends BaseEdge {
  override char: string | null = 'G';
  override description = 'Edge with pear shaped mounting holes';
  declare settings: MountingSettings;

  override margin(): number {
    if (this.settings.style === MOUNTING_STYLE.TAB) {
      return 2.75 * this.boxes.thickness + this.settings.d_head;
    }
    return 0.0;
  }

  override startWidth(): number {
    if (this.settings.style === MOUNTING_STYLE.EXT) {
      return 2.5 * this.boxes.thickness + this.settings.d_head;
    }
    return 0.0;
  }

  call(length: number): void {
    if (length === 0.0) return;

    const s = this.settings;
    const { style, margin, d_shaft: ds, d_head: dh } = s;
    const num = s.num;
    const t = this.thickness;
    const width = dh > 0 ? 3 * t + dh : ds;

    if (num !== Math.trunc(num)) throw new Error('MountingEdge: num needs to be an integer');
    if (!(margin >= 0 && margin <= 0.5)) {
      throw new Error(`MountingEdge: margin needs to be in [0, 0.5] but is ${margin}`);
    }
    if (dh !== 0 && !(dh > ds)) {
      throw new Error(`MountingEdge: d_head needs to be 0 or > ${ds}, but is ${dh}`);
    }

    let count = Math.max(1, Math.trunc(num));
    let margin_: number;
    let gap: number;

    if (count > 1) {
      margin_ = length * margin;
      gap = (length - 2 * margin_ - width * count) / (count - 1);
      if (gap < width) {
        // Not enough room: drop holes until they fit.
        count = Math.trunc((length - 2 * margin + width) / (2 * width) - 0.5);
        if (count < 1) {
          this.edge(length);
          return;
        }
        if (count < 2) {
          margin_ = (length - width) / 2;
          gap = 0;
        } else {
          gap = (length - 2 * margin_ - width * count) / (count - 1);
        }
      }
    } else {
      margin_ = (length - width) / 2;
      gap = 0;
    }

    if (style === MOUNTING_STYLE.TAB) {
      this.edge(margin_, 1);
      for (let i = 0; i < count; i++) {
        if (i > 0) this.edge(gap);
        this.corner(-90, t / 2);
        this.edge(dh + 1.5 * ds - t / 4 - dh / 2);
        this.corner(90, t + dh / 2);
        this.corner(-90);
        this.corner(90);
        this.boxes.mountingHole(0, t * 1.25 + ds / 2, ds, dh, -90);
        this.corner(90, t + dh / 2);
        this.edge(dh + 1.5 * ds - t / 4 - dh / 2);
        this.corner(-90, t / 2);
      }
      this.edge(margin_, 1);
    } else {
      let x = margin_;
      for (let i = 0; i < count; i++) {
        x += width / 2;
        this.boxes.mountingHole(x, ds / 2 + t * 1.5, ds, dh, -90);
        x += width / 2;
        x += gap;
      }
      this.edge(length);
    }
  }
}
