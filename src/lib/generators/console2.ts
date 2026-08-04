/**
 * Console with a slanted panel — ported from boxes.py `boxes/generators/console2.py`.
 *
 * A housing for electronics. What makes it more than a box is the hardware: the
 * back wall and the front panel can both be held by sprung latches rather than
 * glue, so the case can be re-opened with a screwdriver but not by hand.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

const rad = (degrees: number) => (degrees * Math.PI) / 180;

interface Console2Options {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  bottomEdge: string;
  frontHeight: number;
  angle: number;
  removableBackwall: boolean;
  removablePanel: boolean;
  gluedPanel: boolean;
}

class Console2 extends Boxes {
  /** Where the back-wall latch sits along the side wall; set in render(). */
  private latchpos = 0;

  constructor(private o: Console2Options, config: Partial<BoxesConfig>) {
    super(config);
  }

  /**
   * The outline of a side wall as alternating lengths and turns, starting at the
   * bottom and running counter-clockwise. Ten entries when the slanted panel
   * stops short of the back and leaves a flat top; eight when it reaches all the
   * way and the top disappears.
   */
  private borders(): number[] {
    const { y, frontHeight: fh, angle } = this.o;
    const t = this.thickness;

    const panel = Math.min((this.o.h - fh) / Math.cos(rad(90 - angle)), y / Math.cos(rad(angle)));
    const top = y - panel * Math.cos(rad(angle));
    const h = fh + panel * Math.sin(rad(angle));

    if (top > 0.1 * t) {
      return [y, 90, fh, 90 - angle, panel, angle, top, 90, h, 90];
    }
    return [y, 90, fh, 90 - angle, panel, angle + 90, h, 90];
  }

  /** The sprung bar that holds the back wall shut. */
  private latch = (move?: string): void => {
    const t = this.thickness;
    const tw = 8 * t;
    const th = 3 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(0, 1.2 * t);
    this.polyline(
      t, -90, 0.2 * t, 90, 2 * t, -90, t, 90, t, 90, t, -90, 3 * t,
      90, t, -90, t, 90, t, 90, 2 * t, 90, 0.5 * t,
      -94, 4.9 * t, 94, 0.5 * t, 86, 4.9 * t, -176, 5 * t,
      -90, 1.0 * t, 90, t, 90, 1.8 * t, 90,
    );

    this.move(tw, th, move, false, 'Latch');
  };

  /** U-shaped clip glued over a latch to keep it in its slot. */
  private latchClamp = (move?: string): void => {
    const t = this.thickness;
    const s = 0.1 * t;
    const tw = 4 * t;
    const th = 4 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(0.5 * t);
    this.polyline(
      t - 0.5 * s, 90, 2.5 * t + 0.5 * s, -90, t + s, -90, 2.5 * t + 0.5 * s, 90, t - 0.5 * s, 90,
      t, -90, 0.5 * t, 90, 2 * t, 45, 2 ** 0.5 * t, 45, 2 * t, 45, 2 ** 0.5 * t, 45, 2 * t, 90,
      0.5 * t, -90, t, 90,
    );

    this.move(tw, th, move, false, 'Clamp');
  };

  /** The slot in the side wall that a latch drops into. */
  private latchHole = (posx: number): void => {
    this.withRestore(() =>
      this.withHoleColor(undefined, () => {
        const t = this.thickness;
        const s = 0.1 * t;

        this.moveTo(posx, 2 * t, 180);

        // Built by mirroring: one quarter of the keyhole is described, then
        // reflected twice, so the two halves cannot drift out of step.
        let path: number[] = [1.5 * t, -90, t, -90, t - 0.5 * s, 90];
        path = [...path, 2 * t, ...[...path].reverse()];
        const half = path.slice(0, -1);
        path = [...half, 3 * t, ...[...half].reverse()];

        this.polyline(...path);
      }),
    );
  };

  private panelSide = (l: number, move?: string): void => {
    const t = this.thickness;
    const tw = l;
    let th = 3 * t;

    if (!this.o.gluedPanel) th += t;

    if (this.move(tw, th, move, true)) return;

    this.rectangularHole(3 * t, 1.5 * t, 3 * t, 1.05 * t);
    this.rectangularHole(l - 3 * t, 1.5 * t, 3 * t, 1.05 * t);
    this.rectangularHole(l / 2, 1.5 * t, 2 * t, t);
    if (this.o.gluedPanel) {
      const half = [l, 90, t, 90, t, -90, t, -90, t, 90, t, 90];
      this.polyline(...half, ...half);
    } else {
      this.polyline(l, 90, 3 * t, 90);
      this.edges['f']!.call(l);
      this.polyline(0, 90, 3 * t, 90);
    }
    this.move(tw, th, move, false, 'Panel Side');
  };

  /** The sprung tabs that grip the panel; pressing them in releases it. */
  private panelLock = (l: number, move?: string): void => {
    const t = this.thickness;

    l -= 4 * t;
    const tw = l;
    const th = 2.5 * t;

    if (this.move(tw, th, move, true)) return;

    const end: Array<number | [number, number]> = [
      l / 2 - 3 * t, -90, 1.5 * t, [90, 0.5 * t], t, [90, 0.5 * t],
      t, 90, 0.5 * t, -90, 0.5 * t, -90, 0, [90, 0.5 * t], 0, 90,
    ];

    this.moveTo(l / 2 - t, 2 * t, -90);
    this.polyline(t, 90, 2 * t, 90, t, -90, ...end, l, ...[...end].reverse());
    this.move(tw, th, move, false, 'Panel Lock');
  };

  private panelCrossBeam = (l: number, move?: string): void => {
    const t = this.thickness;
    const tw = l + 2 * t;
    const th = 3 * t;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(t, 0);
    const half = [l, 90, t, -90, t, 90, t, 90, t, -90, t, 90];
    this.polyline(...half, ...half);

    this.move(tw, th, move, false, 'Panel Cross Beam');
  };

  private side(borders: number[], bottomEdge: EdgeSpec, move?: string, label = ''): void {
    const t = this.thickness;
    const bottom = this.getEdge(bottomEdge);
    const f = this.edges['f']!;

    const tw = borders[0]! + 2 * f.spacing();
    const th = borders[borders.length - 2]! + bottom.spacing() + f.spacing();
    if (this.move(tw, th, move, true)) return;

    // The panel meets the walls at an angle, so the joint has to start and end
    // one thickness in along each axis rather than at the corner itself.
    const d1 = t * Math.cos(rad(this.o.angle));
    const d2 = t * Math.sin(rad(this.o.angle));

    this.moveTo(t, 0);
    bottom.call(borders[0]!);
    this.corner(90);
    f.call(borders[2]! + bottom.endWidth() - d1);
    this.edge(d1);
    this.corner(borders[3]!);
    if (this.o.removablePanel) this.rectangularHole(3 * t, 1.5 * t, 2.5 * t, 1.05 * t);
    if (!this.o.removablePanel && !this.o.gluedPanel) {
      f.call(borders[4]!);
    } else {
      this.edge(borders[4]!);
    }
    if (this.o.removablePanel) this.rectangularHole(-3 * t, 1.5 * t, 2.5 * t, 1.05 * t);
    if (borders.length === 10) {
      this.corner(borders[5]!);
      this.edge(d2);
      f.call(borders[6]! - d2);
    }
    this.corner(borders[borders.length - 3]!);
    if (this.o.removableBackwall) {
      this.rectangularHole(this.latchpos, 1.55 * t, 1.1 * t, 1.1 * t);
      this.edge(borders[borders.length - 2]! - t);
      f.call(t + bottom.startWidth());
    } else {
      f.call(borders[borders.length - 2]! + bottom.startWidth());
    }
    this.corner(borders[borders.length - 1]!);

    this.move(tw, th, move, false, label);
  }

  render(): void {
    const t = this.thickness;
    const bottom = this.edges[this.o.bottomEdge]!;
    let backTopEdge = 'e';
    let topBackEdge = 'e';

    // A glued-on back wall can carry finger joints; a removable one cannot.
    if (!this.o.removableBackwall) {
      backTopEdge = 'f';
      topBackEdge = 'F';
    }

    if (this.o.outside) {
      this.o.x = this.adjustSize(this.o.x);
      this.o.y = this.adjustSize(this.o.y);
      this.o.h = this.adjustSize(this.o.h, bottom);
    }
    const x = this.o.x;

    const d1 = t * Math.cos(rad(this.o.angle));
    const d2 = t * Math.sin(rad(this.o.angle));

    this.latchpos = 6 * t;
    const latchpos = this.latchpos;

    const borders = this.borders();
    this.side(borders, bottom, 'right', 'Left Side');
    this.side(borders, bottom, 'right', 'Right Side');

    this.rectangularWall(borders[0]!, x, 'ffff', { move: 'right', label: 'Floor' });
    this.rectangularWall(borders[2]! - d1, x, ['F', 'e', 'F', bottom], {
      ignoreWidths: [7, 4],
      move: 'right',
      label: 'Front',
    });

    if (this.o.gluedPanel) {
      this.rectangularWall(borders[4]!, x, 'EEEE', { move: 'right', label: 'Panel' });
    } else if (this.o.removablePanel) {
      this.rectangularWall(borders[4]!, x - 2 * t, 'hEhE', { move: 'right', label: 'Panel' });
    } else {
      this.rectangularWall(borders[4]!, x, 'FEFE', { move: 'right', label: 'Panel' });
    }

    if (borders.length === 10) {
      this.rectangularWall(borders[6]! - d2, x, ['F', 'E', 'F', topBackEdge], {
        move: 'right',
        label: 'Top',
      });
    }

    if (this.o.removableBackwall) {
      this.rectangularWall(borders[borders.length - 2]! - 1.05 * t, x, 'EeEe', {
        callback: [
          () => this.latchHole(latchpos),
          () => this.fingerHolesAt(0.5 * t, 0, borders[borders.length - 2]! - 4.05 * t - latchpos),
          () => this.latchHole(borders[borders.length - 2]! - 1.2 * t - latchpos),
          () =>
            this.fingerHolesAt(
              0.5 * t,
              3.05 * t + latchpos,
              borders[borders.length - 2]! - 4.05 * t - latchpos,
            ),
        ],
        move: 'right',
        label: 'Back Wall',
      });
      this.rectangularWall(2 * t, borders[borders.length - 2]! - 4.05 * t - latchpos, 'EeEf', {
        move: 'right',
        label: 'Guide',
      });
      this.rectangularWall(2 * t, borders[borders.length - 2]! - 4.05 * t - latchpos, 'EeEf', {
        move: 'right',
        label: 'Guide',
      });
      this.rectangularWall(t, x, ['F', bottom, 'F', 'e'], {
        ignoreWidths: [0, 3],
        move: 'right',
        label: 'Bottom Back',
      });
    } else {
      this.rectangularWall(borders[borders.length - 2]!, x, ['F', bottom, 'F', backTopEdge], {
        ignoreWidths: [0, 3],
        move: 'right',
        label: 'Back Wall',
      });
    }

    // hardware for panel
    if (this.o.removablePanel) {
      if (this.o.gluedPanel) {
        this.panelCrossBeam(x - 2.05 * t, 'rotated right');
        this.panelCrossBeam(x - 2.05 * t, 'rotated right');
      }

      this.panelLock(borders[4]!, 'up');
      this.panelLock(borders[4]!, 'up');
      this.panelSide(borders[4]!, 'up');
      this.panelSide(borders[4]!, 'up');
    }

    // hardware for back wall
    if (this.o.removableBackwall) {
      this.latch('up');
      this.latch('up');
      this.partsMatrix(4, 2, 'up', this.latchClamp);
    }
  }
}

export const console2: GeneratorDef = {
  meta: {
    id: 'console2',
    name: 'Console',
    group: 'Box',
    summary: 'Instrument case with a slanted front panel and service hatches',
    description:
      'A housing for electronics. The sloped face carries the controls, and both ' +
      'the panel and the back wall can be held by sprung latches instead of glue, ' +
      'so the case re-opens with a simple tool but not with bare hands.',
  },
  // boxes.py narrows the finger-joint margin for this design; the walls meeting
  // the slanted panel are short and the default margin would leave no fingers.
  paramDefaults: { fj_surroundingspaces: 0.5 },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: false, group: 'dimensions' },
    {
      key: 'front_height',
      kind: 'length',
      label: 'Front height',
      unit: 'mm',
      default: 30,
      min: 0,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'Height of the upright section below the slanted panel.',
    },
    {
      key: 'angle',
      kind: 'number',
      label: 'Panel angle',
      unit: '°',
      default: 50,
      min: 5,
      max: 85,
      step: 1,
      group: 'dimensions',
      help: '90° is upright. Shallower angles give a longer panel and a lower case.',
    },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: 'Fhse',
      default: 's',
      group: 'joints',
      help: 'How the floor attaches. "Stackable feet" lets cases sit on each other.',
    },
    {
      key: 'removable_backwall',
      kind: 'bool',
      label: 'Removable back wall',
      default: true,
      group: 'top',
      help: 'Adds latches and guides so the back can be taken off for servicing.',
    },
    {
      key: 'removable_panel',
      kind: 'bool',
      label: 'Removable panel',
      default: true,
      group: 'top',
      help: 'Holds the panel with sprung tabs. Press all four in to lift it out.',
    },
    {
      key: 'glued_panel',
      kind: 'bool',
      label: 'Glued panel',
      default: true,
      group: 'top',
      help: 'Glue the panel to its frame rather than cutting finger joints into it.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Console2(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', false),
        bottomEdge: s(v, 'bottom_edge', 's'),
        frontHeight: n(v, 'front_height', 30),
        angle: n(v, 'angle', 50),
        removableBackwall: b(v, 'removable_backwall', true),
        removablePanel: b(v, 'removable_panel', true),
        gluedPanel: b(v, 'glued_panel', true),
      },
      config,
    ),
};
