/**
 * Hexagonally packed hole grids, ported from boxes.py `boxes/__init__.py`
 * (`HexHolesSettings` and `Boxes.hexHolesRectangle`).
 *
 * A staggered grid fits more holes into the same panel than a square one and
 * leaves an even web of material between them, which is why boxes.py reaches
 * for it whenever a panel is being lightened or used as a rack.
 *
 * The settings live here rather than in `edges/` because this is not an edge
 * family — nothing draws a side of a part with it.
 */
import { Settings } from './edges/settings';

export class HexHolesSettings extends Settings {
  static override absoluteParams = {
    diameter: 10.0,
    distance: 3.0,
    style: ['circle'] as const,
  };
  // Both sizes are real millimetres: a hole grid is sized by what goes through
  // it, not by the material it is cut from.
  static override relativeParams = {};

  get diameter(): number { return this.getNum('diameter'); }
  get distance(): number { return this.getNum('distance'); }
  get style(): string { return this.getStr('style'); }
}

/** Return false to leave a hole out of the grid. */
export type HexHoleSkip = (
  x: number,
  y: number,
  r: number,
  b: number,
  px: number,
  py: number,
) => boolean;
