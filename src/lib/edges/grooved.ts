/**
 * Grooved edge, ported from boxes.py `boxes/edges.py`.
 * A run of decorative or finger-grip notches; `z` and `Z` cut opposite ways,
 * so a `z` edge and a `Z` edge nest when the parts are stacked or mated.
 */
import type { Boxes } from '../boxes';
import { BaseEdge } from './base';
import { Settings } from './settings';

const DEG = Math.PI / 180;

export type GrooveStyle = 'arc' | 'flat' | 'triangle' | 'softarc';

export class GroovedSettings extends Settings {
  static override absoluteParams = {
    style: ['arc', 'flat', 'triangle', 'softarc'] as const,
    tri_angle: 30,
    arc_angle: 120,
    // Fractions of the edge length, not of the thickness.
    width: 0.2,
    gap: 0.1,
    margin: 0.3,
    inverse: false,
    interleave: false,
  };

  get style(): GrooveStyle { return this.getStr('style') as GrooveStyle; }
  get triAngle(): number { return this.getNum('tri_angle'); }
  get arcAngle(): number { return this.getNum('arc_angle'); }
  get width(): number { return this.getNum('width'); }
  get gap(): number { return this.getNum('gap'); }
  get margin(): number { return this.getNum('margin'); }
  get inverse(): boolean { return this.getBool('inverse'); }
  get interleave(): boolean { return this.getBool('interleave'); }

  edgeObjects(boxes: Boxes, chars = 'zZ', add = true): BaseEdge[] {
    const edges: BaseEdge[] = [new GroovedEdge(boxes, this), new GroovedEdgeCounterPart(boxes, this)];
    edges.forEach((e, i) => {
      if (i < chars.length) e.char = chars[i]!;
    });
    if (add) boxes.addParts(edges);
    return edges;
  }
}

abstract class GroovedEdgeBase extends BaseEdge {
  declare settings: GroovedSettings;
  protected abstract readonly inverse: boolean;

  private isInverse(): boolean {
    return this.settings.inverse !== this.inverse;
  }

  private grooveArc(width: number, angle = 90.0, inv = -1.0): void {
    const sideLength = width / Math.sin(angle * DEG) / 2;
    this.corner(inv * -angle);
    this.corner(inv * angle, sideLength);
    this.corner(inv * angle, sideLength);
    this.corner(inv * -angle);
  }

  private grooveSoftArc(width: number, angle = 60.0, inv = -1.0): void {
    const sideLength = width / Math.sin(angle * DEG) / 4;
    this.corner(inv * -angle, sideLength);
    this.corner(inv * angle, sideLength);
    this.corner(inv * angle, sideLength);
    this.corner(inv * -angle, sideLength);
  }

  private grooveTriangle(width: number, angle = 45.0, inv = -1.0): void {
    const sideLength = width / Math.cos(angle * DEG) / 2;
    this.corner(inv * -angle);
    this.edge(sideLength);
    this.corner(inv * 2 * angle);
    this.edge(sideLength);
    this.corner(inv * -angle);
  }

  call(length: number): void {
    if (length === 0.0) return;

    const checkBounds = (val: number, mn: number, mx: number, name: string): void => {
      if (!(mn <= val && val <= mx)) throw new Error(`${name} needs to be in [${mn}, ${mx}] but is ${val}`);
    };

    const { style, interleave } = this.settings;
    let { width, margin, gap } = this.settings;

    checkBounds(width, 0, 1, 'width');
    checkBounds(margin, 0, 0.5, 'margin');
    checkBounds(gap, 0, 1, 'gap');

    // boxes.py raises ZeroDivisionError here; JavaScript would get Infinity
    // grooves and never return.
    if (width + gap === 0) throw new Error('width and gap cannot both be 0');
    const count = Math.max(0, Math.floor((1 - 2 * margin + gap) / (width + gap)));
    const insideWidth = Math.max(0, count * (width + gap) - gap);
    margin = (1 - insideWidth) / 2;

    margin = length * margin;
    gap = length * gap;
    width = length * width;

    let inv = this.isInverse() ? 1 : -1;
    if (interleave && this.inverse && count % 2 === 0) inv = -inv;

    this.edge(margin, 1);

    for (let i = 0; i < count; i++) {
      if (i > 0) {
        this.edge(gap);
        if (interleave) inv = -inv;
      }
      if (style === 'flat') {
        this.edge(width);
      } else if (style === 'arc') {
        this.grooveArc(width, this.settings.arcAngle / 2, inv);
      } else if (style === 'softarc') {
        this.grooveSoftArc(width, this.settings.arcAngle / 2, inv);
      } else if (style === 'triangle') {
        this.grooveTriangle(width, this.settings.triAngle, inv);
      } else {
        throw new Error(`Unknown GroovedEdge style: ${style as string})`);
      }
    }

    this.edge(margin, 1);
  }
}

export class GroovedEdge extends GroovedEdgeBase {
  override char: string | null = 'z';
  override description = 'Edge with grooves';
  protected readonly inverse = false;
}

export class GroovedEdgeCounterPart extends GroovedEdgeBase {
  override char: string | null = 'Z';
  override description = 'Edge with grooves (opposing side)';
  protected readonly inverse = true;
}
