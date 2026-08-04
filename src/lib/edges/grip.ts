/**
 * Gripping edge, ported from boxes.py `boxes/edges.py`.
 * A corrugated edge that gives fingers something to hold onto.
 */
import type { Boxes } from '../boxes';
import { BaseEdge } from './base';
import { Settings } from './settings';

export class GripSettings extends Settings {
  static override absoluteParams = {
    style: ['wave', 'bumps'] as const,
    outset: true,
  };

  static override relativeParams = {
    depth: 0.3,
  };

  get depth(): number { return this.getNum('depth'); }
  get outset(): boolean { return this.getBool('outset'); }
  get style(): 'wave' | 'bumps' { return this.getStr('style') as 'wave' | 'bumps'; }

  edgeObjects(boxes: Boxes, chars = 'g', add = true): BaseEdge[] {
    const edges: BaseEdge[] = [new GrippingEdge(boxes, this)];
    edges.forEach((e, i) => {
      if (i < chars.length) e.char = chars[i]!;
    });
    if (add) boxes.addParts(edges);
    return edges;
  }
}

export class GrippingEdge extends BaseEdge {
  override char: string | null = 'g';
  override description = 'Corrugated edge useful as a gripping area';
  declare settings: GripSettings;

  private wave(length: number): void {
    const grooves = Math.floor(length / (this.settings.depth * 2.0)) + 1;
    const depth = length / grooves / 4.0;
    const o = this.settings.outset ? 1 : -1;
    for (let i = 0; i < grooves; i++) {
      this.corner(o * -90, depth);
      this.corner(o * 180, depth);
      this.corner(o * -90, depth);
    }
  }

  private bumps(length: number): void {
    const grooves = Math.floor(length / (this.settings.depth * 2.0)) + 1;
    const depth = length / grooves / 2.0;

    if (this.settings.outset) {
      this.corner(-90);
    } else {
      this.corner(90);
      this.edge(depth);
      this.corner(-180);
    }

    for (let i = 0; i < grooves; i++) {
      this.corner(180, depth);
      this.corner(-180, 0);
    }

    if (this.settings.outset) {
      this.corner(90);
    } else {
      this.edge(depth);
      this.corner(90);
    }
  }

  override margin(): number {
    return this.settings.outset ? this.settings.depth : 0.0;
  }

  call(length: number): void {
    if (length === 0.0) return;
    if (this.settings.style === 'bumps') this.bumps(length);
    else this.wave(length);
  }
}
