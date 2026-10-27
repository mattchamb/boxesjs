/**
 * Box with angled ends — ported from boxes.py `boxes/generators/angledbox.py`
 * (class `AngledBox`).
 *
 * A long box whose two ends are each half of a regular polygon, so the floor
 * is an elongated polygon and every wall meets its neighbours at the same
 * angle. The walls are joined with finger joints cut for that angle.
 */
import { Boxes, type BoxesConfig, type Callback, type EdgeSpec } from '../boxes';
import type { FingerJointSettings } from '../edges/fingerjoint';
import type { ParamValues } from '../params/schema';
import { BOTTOM_EDGE_CHOICES } from '../topedge';
import { b, n, s, type GeneratorDef } from './types';

type TopStyle = 'none' | 'angled hole' | 'angled lid' | 'angled lid2';

interface AngledBoxOptions {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  bottomEdge: string;
  /** Walls on each end, not counting the long sides. */
  n: number;
  top: TopStyle;
}

interface FloorOptions {
  edge?: EdgeSpec;
  hole?: boolean;
  move?: string;
  callback?: Callback;
  label?: string;
}

class AngledBox extends Boxes {
  constructor(
    private o: AngledBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /** The floor, or a lid or rim of the same outline, optionally with a hole. */
  private floor(x: number, y: number, n: number, opts: FloorOptions = {}): void {
    const [r, h, side] = this.regularPolygon(2 * n + 2, undefined, y / 2.0);
    const t = this.thickness;

    const lx = n % 2 ? x - 2 * h + side : x - 2 * r + side;

    const edge = this.getEdge(opts.edge ?? 'e');

    const tx = x + 2 * edge.spacing();
    const ty = y + 2 * edge.spacing();

    if (this.move(tx, ty, opts.move, true)) return;

    this.moveTo((tx - lx) / 2, edge.margin());

    if (opts.hole) {
      this.savedContext(() => {
        const [, , hside] = this.regularPolygon(2 * n + 2, undefined, y / 2.0 - t);
        const dx = side - hside;
        const hlx = lx - dx;

        this.moveTo(dx / 2.0, t + edge.spacing());
        const lengths = [hlx, ...Array<number>(n).fill(hside)];
        for (const l of [...lengths, ...lengths]) {
          this.edge(l);
          this.corner(360.0 / (2 * n + 2));
        }
      });
    }

    const lengths = [lx, ...Array<number>(n).fill(side)];
    [...lengths, ...lengths].forEach((l, i) => {
      this.cc(opts.callback ?? null, i, 0, edge.startWidth() + this.burn);
      edge.call(l);
      this.edgeCorner(edge, edge, 360.0 / (2 * n + 2));
    });

    this.move(tx, ty, opts.move, false, opts.label ?? '');
  }

  render(): void {
    let { x, y, h, n } = this.o;
    const be = this.o.bottomEdge;
    const top = this.o.top;

    if (n < 1) n = 1;

    if (x < y) [x, y] = [y, x];

    if (this.o.outside) {
      x = this.adjustSize(x);
      y = this.adjustSize(y);
      if (top === 'none') h = this.adjustSize(h, false);
      else if (top.includes('lid') && top !== 'angled lid') h = this.adjustSize(h) - this.thickness;
      else h = this.adjustSize(h);
    }

    const [r, hp, side] = this.regularPolygon(2 * n + 2, undefined, y / 2.0);

    const lx = n % 2 ? x - 2 * hp + side : x - 2 * r + side;

    // The walls meet at the polygon's angle, so they get their own copy of the
    // finger-joint settings, registered as g and G. H is bound too and unused.
    const fingerJointSettings = (this.getEdge('f').settings as FingerJointSettings).clone();
    fingerJointSettings.setValues(this.thickness, true, { angle: 360 / (2 * (n + 1)) });
    fingerJointSettings.edgeObjects(this, 'gGH');

    this.savedContext(() => {
      if (be !== 'e') this.floor(x, y, n, { edge: 'f', move: 'right', label: 'Bottom' });
      if (top === 'angled lid') {
        this.floor(x, y, n, { edge: 'e', move: 'right', label: 'Lower Lid' });
        this.floor(x, y, n, { edge: 'E', move: 'right', label: 'Upper Lid' });
      } else if (top === 'angled hole' || top === 'angled lid2') {
        this.floor(x, y, n, { edge: 'F', move: 'right', hole: true, label: 'Top Rim and Lid' });
        if (top === 'angled lid2') this.floor(x, y, n, { edge: 'E', move: 'right', label: 'Upper Lid' });
      }
    });
    this.floor(x, y, n, { edge: 'F', move: 'up only' });

    const fingers = top === 'angled lid2' || top === 'angled hole';
    const up = fingers ? 'GfG' : 'GeG';
    const down = fingers ? 'gfg' : 'geg';

    let cnt = 0;
    for (let j = 0; j < 2; j++) {
      cnt += 1;
      const ends = j === 0 || n % 2 ? up : down;
      this.rectangularWall(lx, h, be + ends, { move: 'right', label: `wall ${cnt}` });
      for (let i = 0; i < n; i++) {
        cnt += 1;
        // With an even count the second half runs the other way round.
        const e = (i + j * ((n + 1) % 2)) % 2 ? up : down;
        this.rectangularWall(side, h, be + e, { move: 'right', label: `wall ${cnt}` });
      }
    }
  }
}

export const angledBox: GeneratorDef = {
  meta: {
    id: 'angledbox',
    name: 'Angled Box',
    group: 'Box',
    summary: 'Long box with both ends cornered like half a polygon',
    description:
      'Each end of the box is half of a regular polygon, so the corners are ' +
      'cut off at an even angle. More end walls make the ends rounder. Can be ' +
      'closed with a lift-off lid or a rim with a lid that drops into it.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Length', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions', help: 'The longer of length and width is always used as the length.' },
    { key: 'y', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'n',
      kind: 'number',
      label: 'Walls at each end',
      default: 5,
      min: 1,
      max: 20,
      step: 1,
      group: 'dimensions',
      help: 'Not counting the long sides. More walls make the ends rounder.',
    },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: BOTTOM_EDGE_CHOICES,
      default: 'h',
      group: 'joints',
      help: 'Straight leaves the box without a floor.',
    },
    {
      key: 'top',
      kind: 'enum',
      label: 'Top',
      default: 'none',
      choices: [
        { value: 'none', label: 'Open' },
        { value: 'angled hole', label: 'Rim' },
        { value: 'angled lid', label: 'Lift-off lid' },
        { value: 'angled lid2', label: 'Rim and lid' },
      ],
      group: 'top',
      help: 'A rim is a top panel with the middle cut out, which can be used as a drop-in lid; the lid adds a cover over the rim. The lift-off lid is two layers, the lower one fitting inside the walls.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new AngledBox(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        bottomEdge: s(v, 'bottom_edge', 'h'),
        n: Math.floor(n(v, 'n', 5)),
        top: s(v, 'top', 'none') as TopStyle,
      },
      config,
    ),
};
