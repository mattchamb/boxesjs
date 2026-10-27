/**
 * Joint panel — ported from boxes.py `boxes/generators/jointpanel.py`
 * (class `JointPanel`).
 *
 * A panel larger than the laser bed, made from pieces that join with
 * dovetails. Lay a large part's outline over it to split the part.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { DOVETAIL_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { parseSections } from '../params/sections';
import { b, s, type GeneratorDef } from './types';

class JointPanel extends Boxes {
  constructor(
    private o: { sx: number[]; sy: number[]; separate: boolean },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const { sx, sy, separate } = this.o;
    let edges: EdgeSpec[] = [];
    let x = 0;
    const firstPart = this.ctx.nextPartIndex;

    sy.forEach((y, ny) => {
      const t0 = ny === 0 ? 'e' : 'd';
      const t2 = ny === sy.length - 1 ? 'e' : 'D';
      this.savedContext(() => {
        sx.forEach((xx, nx) => {
          x = xx;
          const t1 = nx === sx.length - 1 ? 'e' : 'd';
          const t3 = nx === 0 ? 'e' : 'D';
          edges = [t0, t1, t2, t3];
          this.rectangularWall(x, y, edges, { label: `piece ${ny + 1}.${nx + 1}` });
          if (separate) {
            this.rectangularWall(x, y, edges, { move: 'right only' });
          } else {
            this.moveTo(x);
          }
        });
      });
      if (separate) {
        // boxes.py moves up by the last piece of the row.
        this.rectangularWall(x, y, edges, { move: 'up only' });
      } else {
        this.moveTo(0, ny === 0 ? y - this.getEdge('d').spacing() : y);
      }
    });

    // Drawn together, the pieces share their seams and are cut as one
    // sheet, so they are one part.
    if (!separate) this.ctx.joinPartsFrom(firstPart, 'panel');
  }
}

export const jointPanel: GeneratorDef = {
  meta: {
    id: 'jointpanel',
    name: 'Joint Panel',
    group: 'Misc',
    summary: 'Panel larger than your laser, made of dovetailed pieces',
    description:
      'Split a big panel, or a big part, into pieces that fit your laser and ' +
      'join with dovetails. Lay the part’s outline over the panel and ' +
      'intersect it with each piece, cutting each with the sheet round it so ' +
      'the kerf comes out right. Small dovetails fit most easily; in plywood, ' +
      'aim for a fit stiff enough to need a hammer.',
  },
  // boxes.py's own defaults: small, shallow dovetails.
  paramDefaults: { dt_size: 1, dt_depth: 0.5, dt_radius: 0.1 },
  params: [
    { key: 'sx', kind: 'sections', label: 'Piece widths, left to right', default: '400/2', group: 'dimensions', itemLabel: 'piece' },
    { key: 'sy', kind: 'sections', label: 'Piece heights, bottom to top', default: '400/3', group: 'dimensions', itemLabel: 'piece' },
    { key: 'separate', kind: 'bool', label: 'Draw pieces apart', default: false, group: 'dimensions', help: 'So they can be cut out to form a large sheet.' },
    ...DOVETAIL_PARAMS.map((spec) => ({ ...spec, showIf: undefined })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new JointPanel(
      { sx: parseSections(s(v, 'sx', '400/2')), sy: parseSections(s(v, 'sy', '400/3')), separate: b(v, 'separate', false) },
      config,
    ),
};
