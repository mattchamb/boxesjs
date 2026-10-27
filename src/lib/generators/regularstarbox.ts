/**
 * Regular star box — ported from boxes.py `boxes/generators/regularstarbox.py`
 * (class `RegularStarBox`).
 *
 * A regular polygon box whose walls are slotted down the middle, so the box
 * and its lid, slid together, form a star.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { Edge } from '../edges/base';
import type { FingerJointSettings } from '../edges/fingerjoint';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

/**
 * The top of each wall, slotted so the lid's walls slide between them.
 * boxes.py binds it in place of the plain edge `e`, and hands it the
 * generator as its settings; here it holds the generator directly.
 */
class SlotEdge extends Edge {
  constructor(private box: RegularStarBox) {
    super(box, null);
  }

  override call(length: number): void {
    const t = this.box.thickness;
    const { n, h, sh } = this.box;

    const [li, ls1, ls2] = slotSizes(t, n, sh);
    const lo = (length - li - 2 * ls1) / 2;

    const d = h / 2;

    // render() refuses the sizes where the slot's inner run would vanish.
    const poly: Array<number | [number, number]> = [lo - 1, [90, 1], d + t - 1, -90, ls1 + ls2, -90, d - t, [90, t]];
    this.polyline(...poly, li - 2 * ls2 - 2 * t, ...[...poly].reverse());
  }

  override startWidth(): number {
    return this.box.thickness;
  }
}

/** The inner side (twice the polygon's), and the two overlaps of a wall's thickness. */
function slotSizes(t: number, n: number, sh: number): [number, number, number] {
  const li = 2 * sh * Math.tan((90 / n) * DEG);
  const ls2 = t / Math.tan((180 / n) * DEG);
  const ls1 = t / Math.cos((90 - 180 / n) * DEG);
  return [li, ls1, ls2];
}

class RegularStarBox extends Boxes {
  h: number;
  readonly n: number;
  /** Distance from a side to the centre; set in render(). */
  sh = 0;

  constructor(
    private o: { h: number; outside: boolean; radius: number; n: number },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.h = o.h;
    this.n = o.n;
  }

  render(): void {
    let r = this.o.radius;
    const n = this.n;

    if (this.o.outside) {
      r = r - this.thickness / Math.cos((360 / (2 * n)) * DEG);
      this.h = this.adjustSize(this.h);
    }
    const h = this.h;

    const fingerJointSettings = (this.getEdge('f').settings as FingerJointSettings).clone();
    fingerJointSettings.setValues(this.thickness, true, { angle: 360 / n });
    fingerJointSettings.edgeObjects(this, 'gGH');

    this.edges['e'] = new SlotEdge(this);

    const [rr, sh, side] = this.regularPolygon(n, r);
    this.sh = sh;

    const [li, , ls2] = slotSizes(this.thickness, n, sh);
    if (!(li - 2 * ls2 > 0)) {
      // boxes.py raises ValueError from the edge.
      this.warn('The box is too small for this many corners. Make it larger.', 'radius');
      return;
    }

    this.savedContext(() => {
      this.regularPolygonWall(n, { r: rr, edges: 'F', move: 'right', label: 'bottom' });
      this.regularPolygonWall(n, { r: rr, edges: 'F', move: 'right', label: 'lid' });
    });

    this.regularPolygonWall(n, { r: rr, edges: 'F', move: 'up only' });

    for (let k = 0; k < 2; k++) {
      const half = k ? 'lid' : 'box';
      let wall = 0;
      this.savedContext(() => {
        if (n % 2) {
          for (let i = 0; i < n; i++) {
            this.rectangularWall(side, h, 'fgeG', { move: 'right', label: `${half} wall ${++wall}` });
          }
        } else {
          for (let i = 0; i < Math.floor(n / 2); i++) {
            this.rectangularWall(side, h, 'fGeG', { move: 'right', label: `${half} wall ${++wall}` });
            this.rectangularWall(side, h, 'fgeg', { move: 'right', label: `${half} wall ${++wall}` });
          }
        }
      });

      this.rectangularWall(side, h, 'fgeG', { move: 'up only' });
    }
  }
}

export const regularStarBox: GeneratorDef = {
  meta: {
    id: 'regularstarbox',
    name: 'Regular Star Box',
    group: 'Box',
    summary: 'Polygon box whose box and lid slide together into a star',
    description:
      'A box with three, four or five sides. Its walls are slotted, and the ' +
      'lid’s walls slide into the slots, so the closed box forms a star.',
  },
  params: [
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    { key: 'radius', kind: 'length', label: 'Radius', unit: 'mm', default: 50, min: 20, max: 500, step: 1, group: 'dimensions', help: 'Centre to corners, inside.' },
    {
      key: 'n',
      kind: 'enum',
      label: 'Sides',
      default: '5',
      choices: [
        { value: '3', label: 'Three' },
        { value: '4', label: 'Four' },
        { value: '5', label: 'Five' },
      ],
      group: 'dimensions',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new RegularStarBox({ h: n(v, 'h', 100), outside: b(v, 'outside', true), radius: n(v, 'radius', 50), n: n(v, 'n', 5) }, config),
};
