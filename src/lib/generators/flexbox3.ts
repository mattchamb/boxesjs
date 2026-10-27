/**
 * Flex box 3 — ported from boxes.py `boxes/generators/flexbox3.py`
 * (class `FlexBox3`).
 *
 * A box with one rounded top-back corner, bent as a living hinge, whose top
 * is a shallow lid on the same bent piece. The lid's front and sides are
 * separate parts that hang down over the box's front with some clearance.
 */
import { Boxes, type BoxesConfig, type Callback } from '../boxes';
import type { FlexEdge } from '../edges/flex';
import { FingerJointSettings } from '../edges/fingerjoint';
import { FLEX_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface FlexBox3Options {
  x: number;
  y: number;
  /** Height of the box. */
  z: number;
  /** Height of the lid. */
  h: number;
  outside: boolean;
  radius: number;
  /** Clearance of the lid. */
  d: number;
}

class FlexBox3 extends Boxes {
  private x: number;
  private y: number;
  private z: number;
  private radius: number;
  /** The bent corner's length, slightly short of a quarter circle; set in render(). */
  private c4 = 0;

  constructor(
    private o: FlexBox3Options,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.x = o.x;
    this.y = o.y;
    this.z = o.z;
    this.radius = o.radius;
  }

  private flexBoxSide(y: number, z: number, r: number, opts: { callback?: Callback; move?: string; label?: string } = {}): void {
    const t = this.thickness;
    const { callback = null, move } = opts;
    if (this.move(y + 2 * t, z + t, move, true)) return;

    this.moveTo(t, t);
    this.cc(callback, 0);
    this.getEdge('f').call(y);
    this.corner(90, 0);
    this.cc(callback, 1);
    this.getEdge('f').call(z - r);
    this.corner(90, r);
    this.cc(callback, 2);
    this.edge(y - r);
    this.corner(90, 0);
    this.cc(callback, 3);
    this.getEdge('f').call(z);
    this.corner(90);

    this.move(y + 2 * t, z + t, move, false, opts.label ?? '');
  }

  /**
   * The back, bent corner and lid top in one piece. boxes.py names this
   * `surroundingWall`, shadowing the base class's, which has a different
   * signature.
   */
  private flexWall(move?: string): void {
    const { x, y, z, radius: r } = this;
    const d = this.o.d;
    const t = this.thickness;
    const f = this.getEdge('f');
    const F = this.getEdge('F');

    const tw = y + z - 2 * r + this.c4 + 2 * t + t;
    const th = x + 4 * t + 2 * d;

    if (this.move(tw, th, move, true)) return;

    this.moveTo(t, d + t);

    F.call(z - r);
    (this.getEdge('X') as FlexEdge).call(this.c4, { h: x + 2 * t });
    this.corner(-90);
    this.edge(d);
    this.corner(90);
    f.call(y - r + t);
    this.corner(90);
    f.call(x + 2 * t + 2 * d);
    this.corner(90);
    f.call(y - r + t);
    this.corner(90);
    this.edge(d);
    this.corner(-90);
    this.edge(this.c4);
    F.call(z - r);
    this.corner(90);
    this.edge(t);
    f.call(x);
    this.edge(t);
    this.corner(90);

    this.move(tw, th, move, false, 'wall');
  }

  /** One side of the lid, rounded to follow the bent corner. */
  private lidSide(move?: string, label = ''): void {
    const { y, radius: r } = this;
    const { h } = this.o;
    const t = this.thickness;
    let r2 = Math.min(r + t, h + t);
    let baseL: number;

    if (r < h) {
      r2 = r + t;
      baseL = y + 2 * t;
      if (this.move(h + t, baseL + t, move, true)) return;

      this.edge(h + t - r2);
      this.corner(90, r2);
      this.edge(r - r2 + 1 * t);
    } else {
      const a = Math.acos((r - h) / (r + t));
      const ang = a / DEG;
      baseL = y + (r + t) * Math.sin(a) - r + t;
      if (this.move(h + t, baseL + t, move, true)) return;

      this.corner(90 - ang);
      this.corner(ang, r + t);
    }

    this.getEdge('F').call(y - r + t);
    this.edgeCorner('F', 'f');
    this.getEdge('g').call(h);
    this.edgeCorner('f', 'e');
    this.edge(baseL);
    this.corner(90);

    this.move(h + t, baseL + t, move, false, label);
  }

  render(): void {
    if (this.o.outside) {
      this.x = this.adjustSize(this.x);
      this.y = this.adjustSize(this.y);
      this.z = this.adjustSize(this.z);
    }

    const { x, y, z } = this;
    const { d, h } = this.o;
    const r = (this.radius = this.radius || Math.min(y, z) / 2.0);

    this.c4 = Math.PI * r * 0.5 * 0.95;

    // The lid's front meets its sides with fine fingers of their own,
    // whatever the box's finger settings are.
    const s = new FingerJointSettings(this.thickness, true, { finger: 1, space: 1, surroundingspaces: 1 });
    s.edgeObjects(this, 'gGH');

    this.savedContext(() => {
      this.flexWall('right');
      this.rectangularWall(y, x, 'FFFF', { move: 'right', label: 'bottom' });
      this.rectangularWall(h, x + 2 * (d + this.thickness), 'GeGF', { move: 'right', label: 'lid front' });
      this.lidSide('right', 'lid left');
      this.lidSide('mirror right', 'lid right');
    });

    this.flexWall('up only');

    this.flexBoxSide(y, z, r, { move: 'right', label: 'left' });
    this.flexBoxSide(y, z, r, { move: 'mirror right', label: 'right' });
    this.rectangularWall(x, z, 'fFeF', { label: 'front' });
  }
}

export const flexBox3: GeneratorDef = {
  meta: {
    id: 'flexbox3',
    name: 'Flex Box 3',
    group: 'Box',
    summary: 'Box with a shallow hinged lid bent from a living hinge',
    description:
      'The back bends over one rounded corner into a shallow lid, which ' +
      'hinges open on the bend. The lid’s front and sides hang down over the ' +
      'box with a little clearance.',
  },
  // A smaller edge margin keeps fingers on the short lid parts.
  paramDefaults: { fj_surroundingspaces: 1 },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'z', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Lid height', unit: 'mm', default: 10, min: 2, max: 200, step: 1, group: 'top' },
    {
      key: 'radius',
      kind: 'length',
      label: 'Hinge radius',
      unit: 'mm',
      default: 10,
      min: 0,
      max: 300,
      step: 1,
      group: 'top',
      help: 'Radius the lid bends round. 0 makes it half the smaller of depth and height.',
    },
    // boxes.py's flag is --c, stored as `d`.
    { key: 'c', kind: 'length', label: 'Lid clearance', unit: 'mm', default: 1, min: 0, max: 10, step: 0.1, group: 'top' },
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new FlexBox3(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        z: n(v, 'z', 100),
        h: n(v, 'h', 10),
        outside: b(v, 'outside', true),
        radius: n(v, 'radius', 10),
        d: n(v, 'c', 1),
      },
      config,
    ),
};
