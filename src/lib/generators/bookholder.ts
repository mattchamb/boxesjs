/**
 * Book holder — ported from boxes.py `boxes/generators/bookholder.py`
 * (class `BookHolder`).
 *
 * An angled stand for a book, ring binder, flyers, postcards or business
 * cards: a back plate leaning back on two sides, a shelf for the bottom
 * edge, and optionally a ledge to hold the book open.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface BookHolderOptions {
  bookWidth: number;
  bookHeight: number;
  bookDepth: number;
  ledgeHeight: number;
  angle: number;
  bottomSupport: number;
  backSupport: number;
  radius: number;
}

class BookHolder extends Boxes {
  private width = 0;
  private radius: number;

  constructor(
    private o: BookHolderOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.radius = o.radius;
  }

  private sideWall(move?: string): void {
    const { bookHeight, bookDepth, bottomSupport, backSupport } = this.o;
    const r = this.radius;

    // main angle, and the opposite one
    const alpha = this.o.angle;
    const beta = 90 - alpha;

    // The tall right triangle between the front plate and the back, with
    // the book's height as its hypotenuse.
    const a = bookHeight * Math.sin(alpha * DEG);
    const b = bookHeight * Math.sin(beta * DEG);

    // The small triangle between the book's bottom and the front edge, with
    // the book's depth as its hypotenuse.
    const c = bookDepth * Math.sin(beta * DEG);
    const d = bookDepth * Math.sin(alpha * DEG);

    // Highest points, where the book's back and bottom rest
    const maxHeightBack = a + bottomSupport + r;
    const maxHeightFront = c + bottomSupport + r;

    const totalHeight = Math.max(maxHeightBack, maxHeightFront);

    const offsetS = Math.sin(alpha * DEG) * r;
    const offsetC = Math.cos(alpha * DEG) * r;

    const totalWidth = r + offsetC + b + d + offsetS + r;

    if (this.move(totalWidth, totalHeight, move, true)) return;

    // Line on bottom
    this.polyline(totalWidth, 90);

    // Finger holes for the back support
    if (backSupport > 0) {
      this.fingerHolesAt(bottomSupport, 2 * this.thickness, backSupport, 0);
    }

    // Back line straight up
    this.polyline(maxHeightBack - offsetC - r, 0);
    this.corner(90 + alpha, r);

    // Line for the front plate
    this.getEdge('F').call(bookHeight);
    this.corner(-90);

    // Line where the bottom of the book rests
    this.getEdge('F').call(bookDepth);
    this.corner(90 + beta, r);

    // Front line straight down
    this.polyline(maxHeightFront - offsetS - r, 90);

    this.move(totalWidth, totalHeight, move, false, 'side');
  }

  private frontLedge(move: string): void {
    const totalHeight = this.o.ledgeHeight + this.thickness;
    if (this.move(this.width, totalHeight, move, true)) return;
    this.moveTo(this.radius, 0);

    const h = totalHeight - this.radius;
    const w = this.width - 2 * this.radius;
    const e = this.getEdge('e');

    e.call(w);
    this.corner(90, this.radius);
    e.call(h);
    this.corner(90);
    this.getEdge('F').call(this.width);
    this.corner(90);
    e.call(h);
    this.corner(90, this.radius);

    this.move(this.width, totalHeight, move, false, 'ledge');
  }

  render(): void {
    this.width = this.o.bookWidth - 2 * this.thickness;
    if (this.radius < 0) this.radius = this.thickness;

    if (this.o.backSupport > 0) {
      this.rectangularWall(this.width, this.o.backSupport, 'efef', { move: 'up', label: 'back support' });
    }

    // The front ledge, and fingers on the shelf for it
    let e = 'e';
    if (this.o.ledgeHeight > 0) {
      this.frontLedge('up');
      e = 'f';
    }

    this.rectangularWall(this.width, this.o.bookDepth, e + 'fFf', { move: 'up', label: 'book bottom' });
    this.rectangularWall(this.width, this.o.bookHeight, 'ffef', { move: 'right', label: 'book back' });

    this.sideWall('right');
    this.sideWall('right');
  }
}

export const bookHolder: GeneratorDef = {
  meta: {
    id: 'bookholder',
    name: 'Book Holder',
    group: 'Misc',
    summary: 'Angled stand for books, binders, flyers or cards',
    description:
      'A back plate leaning back on two sides, with a shelf for the bottom ' +
      'edge. Defaults suit an A4 book on its side; make it small, with a ' +
      'ledge to hold the front, for postcards or business cards.',
  },
  params: [
    { key: 'book_width', kind: 'length', label: 'Width', unit: 'mm', default: 297, min: 30, max: 1000, step: 1, group: 'dimensions', help: 'Overall.' },
    { key: 'book_height', kind: 'length', label: 'Back plate height', unit: 'mm', default: 210, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'book_depth', kind: 'length', label: 'Shelf depth', unit: 'mm', default: 40, min: 5, max: 300, step: 1, group: 'dimensions', help: 'Larger for thicker books.' },
    { key: 'ledge_height', kind: 'length', label: 'Ledge height', unit: 'mm', default: 0, min: 0, max: 200, step: 1, group: 'dimensions', help: 'A ledge at the front holds the book open. 0 leaves it out.' },
    { key: 'angle', kind: 'number', label: 'Angle', unit: '°', default: 75, min: 30, max: 89, step: 1, group: 'dimensions', help: 'Between the floor and the back plate.' },
    { key: 'bottom_support', kind: 'length', label: 'Raised by', unit: 'mm', default: 20, min: 0, max: 200, step: 1, group: 'dimensions', help: 'Material under the shelf, lifting the book.' },
    { key: 'back_support', kind: 'length', label: 'Back support height', unit: 'mm', default: 50, min: 0, max: 500, step: 1, group: 'dimensions', help: 'A brace between the sides at the back. 0 leaves it out.' },
    { key: 'radius', kind: 'length', label: 'Corner radius', unit: 'mm', default: -1, min: -1, max: 50, step: 0.5, group: 'dimensions', help: 'At the sharp corners. Negative uses the material thickness.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new BookHolder(
      {
        bookWidth: n(v, 'book_width', 297),
        bookHeight: n(v, 'book_height', 210),
        bookDepth: n(v, 'book_depth', 40),
        ledgeHeight: n(v, 'ledge_height', 0),
        angle: n(v, 'angle', 75),
        bottomSupport: n(v, 'bottom_support', 20),
        backSupport: n(v, 'back_support', 50),
        radius: n(v, 'radius', -1),
      },
      config,
    ),
};
