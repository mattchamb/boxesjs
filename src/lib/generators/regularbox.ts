/**
 * Regular polygon box — ported from boxes.py `boxes/generators/regularbox.py`
 * (class `RegularBox`).
 *
 * A box whose base is a regular n-gon. The top and bottom radii are set
 * separately, so it can be a straight prism or taper into a frustum; the side
 * walls then meet at an angle that depends on the taper, and each of the three
 * joints in the box needs finger joints cut for its own angle.
 *
 * boxes.py's `bayonet mount` top style is not offered here — it needs the
 * `BayonetBox` base class, which is not ported.
 */
import { Boxes, type BoxesConfig, type PolygonBorder } from '../boxes';
import type { FingerJointSettings } from '../edges/fingerjoint';
import type { ParamValues } from '../params/schema';
import { b, n as num, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

/** Styles whose top or bottom panel is joined to the walls with fingers. */
const FINGERED = ['closed', 'hole', 'angled hole', 'round lid', 'angled lid2'];

interface RegularBoxOptions {
  h: number;
  outside: boolean;
  radiusBottom: number;
  radiusTop: number;
  n: number;
  top: string;
  bottom: string;
}

class RegularBox extends Boxes {
  constructor(
    private o: RegularBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const { n, top, bottom } = this.o;
    let r0 = this.o.radiusBottom;
    let r1 = this.o.radiusTop;
    let h = this.o.h;

    if (this.o.outside) {
      r0 -= this.thickness / Math.cos((360 / (2 * n)) * DEG);
      r1 -= this.thickness / Math.cos((360 / (2 * n)) * DEG);
      if (top === 'none') {
        h = this.adjustSize(h, false);
      } else if (top.includes('lid') && top !== 'angled lid') {
        h = this.adjustSize(h) - this.thickness;
      } else {
        h = this.adjustSize(h);
      }
    }

    const t = this.thickness;

    let sh0: number;
    let side0: number;
    let sh1: number;
    let side1: number;
    [r0, sh0, side0] = this.regularPolygon(n, r0);
    [r1, sh1, side1] = this.regularPolygon(n, r1);

    // Length of a side edge, and half the apex angle of the pyramid the
    // tapering sides would meet at.
    let l = Math.sqrt((r0 - r1) ** 2 + h ** 2);
    const a = Math.asin((side1 - side0) / 2 / l) / DEG;
    // Angle between neighbouring side walls, as a change of travel.
    const phi = 180 - 2 * (Math.asin(Math.cos(Math.PI / n) / Math.cos(a * DEG)) / DEG);

    // Three joints, three different angles, so three independent copies of the
    // finger-joint settings. They register new edge characters on the box as a
    // side effect — `H` is bound by all three and only the last survives, which
    // is harmless because nothing below refers to it.
    const fjs = this.getEdge('f').settings as FingerJointSettings;

    const sideSettings = fjs.clone();
    sideSettings.setValues(t, true, { angle: phi });
    sideSettings.edgeObjects(this, 'gGH');

    const beta = Math.atan((sh1 - sh0) / h) / DEG;

    const bottomSettings = fjs.clone();
    bottomSettings.setValues(t, true, { angle: 90 + beta });
    bottomSettings.edgeObjects(this, 'yYH');

    const topSettings = fjs.clone();
    topSettings.setValues(t, true, { angle: 90 - beta });
    topSettings.edgeObjects(this, 'zZH');

    const drawTop = (r: number, sh: number, style: string, joint: string, label: string): void => {
      const panel = joint[1]!;
      if (style === 'closed') {
        this.regularPolygonWall(n, { r, edges: panel, move: 'right', label });
      } else if (style === 'angled lid') {
        this.regularPolygonWall(n, { r, edges: 'e', move: 'right', label });
        this.regularPolygonWall(n, { r, edges: 'E', move: 'right', label: 'Lid' });
      } else if (style === 'angled hole' || style === 'angled lid2') {
        this.regularPolygonWall(n, {
          r,
          edges: panel,
          move: 'right',
          label,
          callback: [() => this.regularPolygonAt(0, 0, n, { h: sh - t })],
        });
        if (style === 'angled lid2') {
          this.regularPolygonWall(n, { r, edges: 'E', move: 'right', label: 'Lid' });
        }
      } else if (style === 'hole' || style === 'round lid') {
        this.regularPolygonWall(n, { r, edges: panel, move: 'right', label, hole: (sh - t) * 2 });
      }
      if (style === 'round lid') {
        this.parts.disc(sh * 2, { move: 'right', label: 'Lid' });
      }
    };

    this.savedContext(() => {
      drawTop(r0, sh0, bottom, 'yY', 'Bottom');
      drawTop(r1, sh1, top, 'zZ', 'Top');
    });

    // Pure cursor advance: nothing is drawn, but the step has to match the
    // tallest panel above it.
    this.regularPolygonWall(n, { r: Math.max(r0, r1), edges: 'F', move: 'up only' });

    const bottomEdge = FINGERED.includes(bottom) ? 'y' : 'e';
    const topEdge = FINGERED.includes(top) ? 'z' : 'e';

    // Width of the angled counterpart edge, used to inset the wall where the
    // taper makes one end overhang the other.
    const tw = this.getEdge('G').startWidth();
    const dTop = Math.max(0, -tw * Math.sin(a * DEG));
    const dBottom = Math.max(0.0, tw * Math.sin(a * DEG));
    l -= dTop + dBottom;

    if (n % 2) {
      // An odd polygon has no opposite face to pair with, so every wall is the
      // same part: fingered down one side, slotted down the other.
      const edge = `${bottomEdge}ege${topEdge}eeGee`;
      const borders: PolygonBorder[] = [
        side0, 90 - a, dBottom, 0, l, 0, dTop, 90 + a,
        side1, 90 + a, dTop, -90, tw, 90, l, 90, tw, -90, dBottom, 90 - a,
      ];
      for (let i = 0; i < n; i++) {
        this.polygonWall(borders, { edge, correctCorners: false, move: 'right', label: 'Side' });
      }
    } else {
      // An even polygon alternates: one wall carries slots on both sides, the
      // next carries fingers on both.
      const borders0: PolygonBorder[] = [
        side0, 90 - a, dBottom, -90, tw, 90, l, 90, tw, -90, dTop, 90 + a,
        side1, 90 + a, dTop, -90, tw, 90, l, 90, tw, -90, dBottom, 90 - a,
      ];
      const edge0 = `${bottomEdge}eeGee${topEdge}eeGee`;
      const borders1: PolygonBorder[] = [
        side0, 90 - a, dBottom, 0, l, 0, dTop, 90 + a,
        side1, 90 + a, dTop, 0, l, 0, dBottom, 90 - a,
      ];
      const edge1 = `${bottomEdge}ege${topEdge}ege`;
      for (let i = 0; i < n / 2; i++) {
        this.polygonWall(borders0, {
          edge: edge0,
          correctCorners: false,
          move: 'right',
          label: 'Side',
        });
        this.polygonWall(borders1, {
          edge: edge1,
          correctCorners: false,
          move: 'right',
          label: 'Side',
        });
      }
    }
  }
}

/** Same seven styles at both ends; boxes.py only differs in which it defaults to. */
const PANEL_CHOICES = [
  { value: 'none', label: 'Open' },
  { value: 'closed', label: 'Closed panel' },
  { value: 'hole', label: 'Round hole' },
  { value: 'angled hole', label: 'Polygon hole' },
  { value: 'angled lid', label: 'Polygon lid, inset' },
  { value: 'angled lid2', label: 'Polygon hole with lid' },
  { value: 'round lid', label: 'Round hole with disc lid' },
];

export const regularBox: GeneratorDef = {
  meta: {
    id: 'regularbox',
    name: 'Regular Box',
    group: 'Box',
    summary: 'Box with a regular polygon base, straight or tapered',
    description:
      'A box built on a regular polygon. Setting different top and bottom radii ' +
      'tapers the sides. Lids are a friction fit and need gluing. Short side ' +
      'walls may not fit a connecting finger — reduce the edge margin and finger ' +
      'width in the joint settings if that happens. boxes.py’s bayonet mount ' +
      'lid is not offered, as it needs machinery this port does not have.',
  },
  // Side walls here are narrow; the library edge margin would leave many of them
  // with no fingers at all, so boxes.py starts this generator with a smaller one.
  paramDefaults: { fj_surroundingspaces: 1 },
  params: [
    {
      key: 'n',
      kind: 'number',
      label: 'Number of sides',
      default: 5,
      min: 3,
      max: 16,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'radius_bottom',
      kind: 'length',
      label: 'Bottom radius',
      unit: 'mm',
      default: 50,
      min: 10,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'Inner radius at the bottom, measured to a corner.',
    },
    {
      key: 'radius_top',
      kind: 'length',
      label: 'Top radius',
      unit: 'mm',
      default: 50,
      min: 10,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'Inner radius at the top. Differ from the bottom to taper the box.',
    },
    {
      key: 'h',
      kind: 'length',
      label: 'Height',
      unit: 'mm',
      default: 100,
      min: 20,
      max: 1000,
      step: 1,
      group: 'dimensions',
    },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'top',
      kind: 'enum',
      label: 'Top style',
      choices: PANEL_CHOICES,
      default: 'none',
      group: 'top',
    },
    {
      key: 'bottom',
      kind: 'enum',
      label: 'Bottom style',
      choices: PANEL_CHOICES,
      default: 'closed',
      group: 'top',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new RegularBox(
      {
        h: num(v, 'h', 100),
        outside: b(v, 'outside', true),
        radiusBottom: num(v, 'radius_bottom', 50),
        radiusTop: num(v, 'radius_top', 50),
        n: num(v, 'n', 5),
        top: s(v, 'top', 'none'),
        bottom: s(v, 'bottom', 'closed'),
      },
      config,
    ),
};
