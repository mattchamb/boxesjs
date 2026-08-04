/**
 * Finger access cut-out, ported from the local `FingerHoleEdge` in boxes.py
 * `boxes/generators/typetray.py`.
 *
 * A shallow scoop in the top of a divider so you can get a fingertip under
 * whatever is sitting in the compartment.
 */
import type { Boxes } from '../boxes';
import { BaseEdge } from './base';
import { Settings } from './settings';

export class FingerHoleEdgeSettings extends Settings {
  static override absoluteParams = {
    /** Largest corner radius of the scoop, in mm. */
    radius: 10.0,
    absolute_depth: 0.0,
    relative_depth: 0.9,
    absolute_width: 0.0,
    relative_width: 0.3,
  };

  static override relativeParams = {};

  /** Height of the wall the scoop is cut into; set by the generator. */
  wallheight = 0.0;

  get radius(): number { return this.getNum('radius'); }
  get absolute_depth(): number { return this.getNum('absolute_depth'); }
  get relative_depth(): number { return this.getNum('relative_depth'); }
  get absolute_width(): number { return this.getNum('absolute_width'); }
  get relative_width(): number { return this.getNum('relative_width'); }
}

export class FingerHoleEdge extends BaseEdge {
  override char: string | null = 'A';
  override description = 'Edge with a finger access scoop';
  declare settings: FingerHoleEdgeSettings;

  constructor(boxes: Boxes, settings: FingerHoleEdgeSettings) {
    super(boxes, settings);
  }

  call(length: number): void {
    const s = this.settings;
    const width = Math.min(s.absolute_width + length * s.relative_width, length);
    const depth = Math.min(s.absolute_depth + s.wallheight * s.relative_depth, s.wallheight);
    const r = Math.min(width / 2, depth, s.radius);

    if (depth < 1e-9 || width < 1e-9) {
      this.boxes.edge(length, 2);
      return;
    }

    const poly: Array<number | [number, number]> = [
      [(length - width) / 2, 1],
      90,
      depth - r,
      [-90, r],
    ];
    this.polyline(...poly, [width - 2 * r, 1], ...[...poly].reverse());
  }
}
