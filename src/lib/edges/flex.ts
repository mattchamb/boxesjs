/**
 * Flex (living hinge) edge, ported from boxes.py `boxes/edges.py`
 * (`FlexSettings`, `FlexEdge`).
 *
 * Not an outline at all: it draws the straight edge of a panel and fills the
 * strip behind it with rows of staggered cuts, so the panel bends there. The
 * edge on the opposite side of the panel stays a plain one.
 */
import type { Boxes } from '../boxes';
import { BaseEdge, type EdgeCallOptions } from './base';
import { Settings } from './settings';

export class FlexSettings extends Settings {
  static override absoluteParams = {
    /** A hint for generators sizing a bent panel; FlexEdge itself ignores it. */
    stretch: 1.05,
  };

  static override relativeParams = {
    distance: 0.5,
    connection: 1.0,
    width: 5.0,
  };

  get stretch(): number { return this.getNum('stretch'); }
  get distance(): number { return this.getNum('distance'); }
  get connection(): number { return this.getNum('connection'); }
  get width(): number { return this.getNum('width'); }

  override checkValues(): void {
    if (this.distance < 0.01) throw new Error('Flex Settings: distance parameter must be > 0.01mm');
    if (this.width < 0.1) throw new Error('Flex Settings: width parameter must be > 0.1mm');
  }
}

export interface FlexCallOptions extends EdgeCallOptions {
  /** Depth of the cut pattern, perpendicular to the edge. */
  h?: number;
}

export class FlexEdge extends BaseEdge {
  override char: string | null = 'X';
  override description = 'Flex cut';
  declare settings: FlexSettings;

  constructor(boxes: Boxes, settings: FlexSettings) {
    super(boxes, settings);
  }

  call(x: number, opts: FlexCallOptions = {}): void {
    // boxes.py takes the depth as a second positional argument with no
    // default; an `X` used as a plain wall edge fails there too.
    if (opts.h === undefined) throw new Error('Flex edge needs the depth of its cut pattern');
    const { distance: dist, connection, width } = this.settings;
    const ctx = this.boxes.ctx;

    const h = opts.h + 2 * this.burn;
    const lines = Math.floor(x / dist);
    const leftover = x - lines * dist;
    const sections = Math.max(Math.floor((h - connection) / width), 1);
    const sheight = (h - connection) / sections - connection;

    // Drawn straight onto the context, as boxes.py does: these are open cuts,
    // not part of the outline, so they get no kerf compensation.
    ctx.stroke();
    for (let i = 1; i < lines; i++) {
      const pos = i * dist + leftover / 2;

      if (i % 2) {
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, connection + sheight);

        for (let j = 0; j < Math.floor((sections - 1) / 2); j++) {
          ctx.moveTo(pos, (2 * j + 1) * sheight + (2 * j + 2) * connection);
          ctx.lineTo(pos, (2 * j + 3) * (sheight + connection));
        }

        if (!(sections % 2)) {
          ctx.moveTo(pos, h - sheight - connection);
          ctx.lineTo(pos, h);
        }
      } else if (sections % 2) {
        ctx.moveTo(pos, h);
        ctx.lineTo(pos, h - connection - sheight);

        for (let j = 0; j < Math.floor((sections - 1) / 2); j++) {
          ctx.moveTo(pos, h - ((2 * j + 1) * sheight + (2 * j + 2) * connection));
          ctx.lineTo(pos, h - (2 * j + 3) * (sheight + connection));
        }
      } else {
        for (let j = 0; j < Math.floor(sections / 2); j++) {
          ctx.moveTo(pos, h - connection - 2 * j * (sheight + connection));
          ctx.lineTo(pos, h - 2 * (j + 1) * (sheight + connection));
        }
      }
    }

    ctx.stroke();
    ctx.moveTo(0, 0);
    ctx.lineTo(x, 0);
    const [cx, cy] = ctx.getCurrentPoint();
    ctx.translate(cx, cy);
  }
}
