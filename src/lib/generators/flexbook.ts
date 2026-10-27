/**
 * Flex book — ported from boxes.py `boxes/generators/flexbook.py`
 * (class `FlexBook`).
 *
 * A box styled after a book: the cover wraps round from back to front over
 * a living-hinge spine, and latches shut with a sliding pin at the fore-edge.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { FlexEdge } from '../edges/flex';
import { FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface FlexBookOptions {
  x: number;
  y: number;
  h: number;
  /** In multiples of the thickness. */
  latchsize: number;
  recessWall: boolean;
}

class FlexBook extends Boxes {
  private x: number;
  /** boxes.py swaps y and h in render(); these hold the swapped values. */
  private y: number;
  private h: number;
  private latchsize: number;
  private radius = 0;
  private c4 = 0;

  constructor(
    private o: FlexBookOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.x = o.x;
    this.y = o.y;
    this.h = o.h;
    this.latchsize = o.latchsize;
  }

  private flexBookSide(h: number, x: number, r: number, move?: string, label = ''): void {
    const t = this.thickness;

    const tw = h + t;
    const th = x + 2 * t + r;
    if (this.move(tw, th, move, true)) return;

    this.fingerHolesAt(0, x + 1.5 * t, h, 0);

    this.getEdge('F').call(h);
    this.corner(90, 0);
    this.getEdge('e').call(t);
    this.getEdge('f').call(x + t);
    this.corner(180, r);
    this.getEdge('e').call(x + 2 * t);
    this.corner(90);

    this.move(tw, th, move, false, label);
  }

  private flexBookRecessedWall(h: number, y: number, includeRecess: boolean, move?: string): void {
    const t = this.thickness;

    const tw = h;
    const th = y + 2 * t;

    if (this.move(tw, th, move, true)) return;

    const cutoutRadius = Math.min(h / 4, y / 8);
    const cutoutAngle = 90;
    const cutoutPredist = y * 0.2;
    const cutoutAngleDist = h / 2 - 2 * cutoutRadius;
    const cutoutBaseDist = y - y * 0.4 - 4 * cutoutRadius;

    this.moveTo(0, t);

    this.getEdge('f').call(h);
    this.corner(90);
    this.getEdge('e').call(y);
    this.corner(90);
    this.getEdge('f').call(h);
    this.corner(90);
    if (includeRecess) {
      this.polyline(
        cutoutPredist,
        [cutoutAngle, cutoutRadius],
        cutoutAngleDist,
        [-cutoutAngle, cutoutRadius],
        cutoutBaseDist,
        [-cutoutAngle, cutoutRadius],
        cutoutAngleDist,
        [cutoutAngle, cutoutRadius],
        cutoutPredist,
      );
    } else {
      this.getEdge('e').call(y);
    }
    this.corner(90);

    this.move(tw, th, move, false, 'inner wall');
  }

  private flexBookLatchWall(h: number, y: number, latchSize: number, move?: string): void {
    const t = this.thickness;

    const xAdjust = this.o.recessWall ? 0 : 3 * t;

    const tw = h + t + xAdjust;
    const th = y + 2 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(xAdjust, t);

    this.getEdge('f').call(h);
    this.corner(90);
    this.getEdge('f').call(y);
    this.corner(90);
    this.getEdge('f').call(h);
    this.corner(90);

    this.rectangularHole(y / 2, -1.5 * t, latchSize - 1.9 * t, t * 1.1);

    this.polyline(
      (y - latchSize) / 2,
      -90,
      2.5 * t,
      [90, t / 2],
      latchSize - t,
      [90, t / 2],
      2.5 * t,
      -90,
      (y - latchSize) / 2,
      90,
    );

    this.move(tw, th, move, false, 'latch wall');
  }

  private flexBookCover(move?: string): void {
    const { x, y, c4 } = this;
    const latchSize = this.latchsize;
    const t = this.thickness;
    const h = this.getEdge('h');
    const e = this.getEdge('e');

    const tw = 2 * x + 6 * t + 2 * c4 + t;
    const th = y + 4 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(2 * t, 0);

    h.call(x + t);
    // boxes.py adds a thickness to the hinge, and to the edge opposite, so
    // the cover fits round the spine.
    (this.getEdge('X') as FlexEdge).call(2 * c4 + t, { h: y + 4 * t });
    e.call(x + t);
    this.corner(90, 2 * t);
    e.call(y / 2);

    this.rectangularHole(0, 1.5 * t, latchSize + 0.1 * t, 1.15 * t);
    this.rectangularHole((latchSize + 7 * t) / 2, 3.5 * t, t, t);
    this.rectangularHole(-(latchSize + 7 * t) / 2, 3.5 * t, t, t);

    e.call(y / 2);
    this.corner(90, 2 * t);
    e.call(x + t + 2 * c4 + t);
    h.call(x + t);
    this.corner(90, 2 * t);
    h.call(y);
    this.corner(90, 2 * t);

    this.move(tw, th, move, false, 'cover');
  }

  private flexBookLatchBracket(isCover: boolean, move?: string): void {
    const t = this.thickness;
    const round = t / 3;

    const tw = 5 * t;
    const th = 5.5 * t;
    if (this.move(tw, th, move, true)) return;

    if (isCover) {
      this.edge(5 * t);
    } else {
      this.edge(t);
      this.corner(90);
      this.edge(2 * t - round);
      this.corner(-90, round);
      this.edge(1.5 * t - round);
      this.rectangularHole(0, 1.5 * t, t, t);
      this.edge(1.5 * t - round);
      this.corner(-90, round);
      this.edge(2 * t - round);
      this.corner(90);
      this.edge(t);
    }

    this.corner(90);
    this.edge(3 * t);
    this.corner(180, 2.5 * t);
    this.edge(3 * t);

    const label = isCover ? 'cover bracket' : 'bracket';
    if (!isCover) {
      // The anchor pin is a part of its own, drawn in the bracket's frame,
      // so the bracket is named before it starts.
      this.moveTo(-1.5 * t, 1.25 * t);
      this.ctx.stroke();
      this.ctx.nameCurrentPart(label);
      this.rectangularWall(t, 2 * t, 'eeee', { label: 'pin' });
    }

    this.move(tw, th, move, false, isCover ? label : '');
  }

  private flexBookLatchPin(move?: string): void {
    const t = this.thickness;
    const l = this.latchsize;

    const tw = l + 4 * t;
    const th = 5 * t;

    if (this.move(tw, th, move, true)) return;

    const round = t / 3;

    this.moveTo(2 * t, 0);

    this.polyline(
      l,
      90,
      2 * t,
      -90,
      2 * t - round,
      [90, round],
      2 * t - 2 * round,
      [90, round],
      3 * t - round,
      -90,
      t - round,
      [90, round],
      l - 2 * t - 2 * round,
      [90, round],
      t - round,
      -90,
      3 * t - round,
      [90, round],
      2 * t - 2 * round,
      [90, round],
      2 * t - round,
      -90,
      2 * t,
      90,
    );
    this.move(tw, th, move, false, 'latch');
  }

  render(): void {
    // boxes.py swaps y and h here, finding it easier to think of.
    [this.y, this.h] = [this.h, this.y];
    const t = this.thickness;

    this.radius = this.h / 2;
    this.c4 = Math.PI * this.radius * 0.5;

    this.latchsize *= this.thickness;

    this.flexBookCover('up');
    this.flexBookRecessedWall(this.h, this.y, this.o.recessWall, 'mirror right');
    this.flexBookLatchWall(this.h, this.y, this.latchsize, 'right');

    this.savedContext(() => {
      this.flexBookSide(this.h, this.x, this.radius, 'right', 'top');
      this.flexBookSide(this.h, this.x, this.radius, 'mirror right', 'bottom');
    });
    this.flexBookSide(this.h, this.x, this.radius, 'up only');

    this.savedContext(() => {
      this.flexBookLatchBracket(false, 'up');
      this.flexBookLatchBracket(false, 'up');
    });
    this.flexBookLatchBracket(false, 'right only');

    this.savedContext(() => {
      this.flexBookLatchBracket(true, 'up');
      this.flexBookLatchBracket(true, 'up');
    });
    this.flexBookLatchBracket(false, 'right only');

    const l = this.latchsize;
    this.rectangularWall(4 * t, l, 'eeee', {
      callback: [() => this.rectangularHole(2 * t, l / 2, 2.5 * t, 0.8 * l, 2 * t)],
      move: 'right',
      label: 'latch guide',
    });
    this.flexBookLatchPin('right');
  }
}

export const flexBook: GeneratorDef = {
  meta: {
    id: 'flexbook',
    name: 'Flex Book',
    group: 'Box',
    summary: 'Box styled after a book, with a living-hinge spine',
    description:
      'The cover wraps round a living-hinge spine and latches shut at the ' +
      'fore-edge with a sliding pin. If your laser has an enclosure, put the ' +
      'hinge as close to the extractor fan as you can.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 75, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'Spine to fore-edge.' },
    { key: 'y', kind: 'length', label: 'Thickness', unit: 'mm', default: 35, min: 10, max: 500, step: 1, group: 'dimensions', help: 'Of the book, across the spine.' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 125, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'latchsize', kind: 'number', label: 'Latch size', unit: '× thickness', default: 8, min: 4, max: 30, step: 0.5, group: 'top' },
    {
      key: 'recess_wall',
      kind: 'bool',
      label: 'Recessed inner wall',
      default: false,
      group: 'top',
      help: 'Cut a dip in the inner wall to make the contents easier to take out.',
    },
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new FlexBook(
      {
        x: n(v, 'x', 75),
        y: n(v, 'y', 35),
        h: n(v, 'h', 125),
        latchsize: n(v, 'latchsize', 8),
        recessWall: b(v, 'recess_wall', false),
      },
      config,
    ),
};
