/**
 * Paper box — ported from boxes.py `boxes/generators/paperbox.py`
 * (class `PaperBox`).
 *
 * A folded paper box with a lid, cut as one outline. Short marks on the
 * leftover paper outside show where to fold.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

type Design = 'automatic' | 'widebox' | 'tuckbox';
type Path = Array<number | [number, number]>;

interface PaperBoxOptions {
  x: number;
  y: number;
  h: number;
  design: Design;
  lidHeight: number;
  lidRadius: number;
  lidSides: number;
  margin: number;
  markLength: number;
  tabAngleRad: number;
  fingerHoleDiameter: number;
}

class PaperBox extends Boxes {
  constructor(
    private o: PaperBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const { x, y, h } = this.o;
    let design = this.o.design;
    if (design === 'automatic') design = h > y ? 'tuckbox' : 'widebox';

    const path = design === 'tuckbox' ? this.tuckbox(x, y, h) : this.widebox(x, y, h);

    this.polyline(...path);
    // boxes.py draws the box without a move, so it has no name of its own.
    this.ctx.nameCurrentPart('box');
  }

  private tuckbox(width: number, length: number, height: number): Path {
    const t = this.thickness;
    const ml = this.o.markLength;
    const lidCutLength = Math.min(10, length / 2, width / 5);
    const halfSide: Path = [
      ...this.mark(ml),
      0, 90,
      ...this.earDescription(length, lidCutLength),
      0, -90,
      length, 0,
      ...this.lidCut(lidCutLength),
      ...this.lidTab(width - 2 * t),
      0,
      ...this.lidCut(lidCutLength, true),
      length, -90,
      ...this.earDescription(length, lidCutLength, true),
      ...this.mark(ml),
    ];
    return [
      height, 0,
      ...halfSide,
      ...this.sideWithFingerHole(width, this.o.fingerHoleDiameter),
      ...this.mark(ml),
      0, 90,
      ...this.tabDescription(length - this.o.margin - t, height),
      0, 90,
      ...this.mark(ml),
      width,
      ...[...halfSide].reverse(),
    ];
  }

  private widebox(width: number, length: number, height: number): Path {
    const ml = this.o.markLength;
    const margin = this.o.margin;
    const halfSide: Path = [
      ...this.mark(ml),
      0, 90,
      ...this.tabDescription(length / 2 - margin, height),
      0, -90,
      height, 0,
      ...this.mark(ml),
      0, 90,
      ...this.tabDescription(this.o.lidSides, length),
      0, 90,
      ...this.mark(ml),
      height, -90,
      ...this.tabDescription(length / 2 - margin, height),
      length, 0,
      ...this.mark(ml),
    ];
    return [
      ...this.sideWithFingerHole(width, this.o.fingerHoleDiameter),
      ...halfSide,
      ...this.lidTab(width),
      ...[...halfSide].reverse(),
    ];
  }

  private lidTab(width: number): Path {
    const { lidHeight, lidRadius } = this.o;
    return [lidHeight - lidRadius, [90, lidRadius], width - 2 * lidRadius, [90, lidRadius], lidHeight - lidRadius];
  }

  /** A short cut out and back, marking a fold. */
  private mark(length: number): Path {
    if (length === 0) return [];
    return [0, -90, length, 180, length, -90];
  }

  private lidCut(length: number, reverse = false): Path {
    const path: Path = [90, length + this.thickness, -180, length, 90];
    return [0, ...(reverse ? path.reverse() : path)];
  }

  private sideWithFingerHole(width: number, fingerHoleDiameter: number): Path {
    const halfWidth = (width - fingerHoleDiameter) / 2;
    return [halfWidth, 90, 0, [-180, fingerHoleDiameter / 2], 0, 90, halfWidth, 0];
  }

  /** A glue tab, its sides angled in so it folds inside without catching. */
  private tabDescription(height: number, width: number): Path {
    const a = this.o.tabAngleRad;
    const deg = a / DEG;
    const side = height / Math.cos(a);
    const endWidth = width - 2 * height * Math.tan(a);
    return [0, deg - 90, side, 90 - deg, endWidth, 90 - deg, side, deg - 90];
  }

  private earDescription(length: number, lidCutLength: number, reverse = false): Path {
    const earDepth = Math.max(lidCutLength, this.o.lidHeight);
    const radius = Math.min(this.o.lidRadius, earDepth - lidCutLength);
    const startMargin = this.thickness;
    const endMargin = 2 * this.burn;
    const path: Path = [
      startMargin, -90,
      lidCutLength, 90,
      0, [-90, radius],
      0, 90,
      length - radius - startMargin - endMargin, 90,
      earDepth, -90,
      endMargin,
    ];
    return [...(reverse ? path.reverse() : path), 0];
  }
}

export const paperBox: GeneratorDef = {
  meta: {
    id: 'paperbox',
    name: 'Paper Box',
    group: 'Misc',
    summary: 'Folded paper box with a lid',
    description:
      'Cut from paper or card as one piece and folded up. Short marks on the ' +
      'leftover paper outside show where to fold. The fit is tight, so fold ' +
      'and glue it round a box of the same size if you have one; a bone ' +
      'folder helps.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 10, max: 500, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 10, max: 500, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 10, max: 500, step: 1, group: 'dimensions' },
    {
      key: 'design',
      kind: 'enum',
      label: 'Design',
      default: 'automatic',
      choices: [
        { value: 'automatic', label: 'Automatic' },
        { value: 'widebox', label: 'Wide box' },
        { value: 'tuckbox', label: 'Tuck box' },
      ],
      group: 'dimensions',
      help: 'Laid out to save paper. The tuck box’s lid locks into cuts. Automatic picks the tuck box when it is taller than deep.',
    },
    { key: 'lid_height', kind: 'length', label: 'Lid tab height', unit: 'mm', default: 15, min: 2, max: 100, step: 1, group: 'top', help: 'Of the part that tucks inside the box.' },
    { key: 'lid_radius', kind: 'length', label: 'Lid tab corner radius', unit: 'mm', default: 7, min: 0, max: 50, step: 0.5, group: 'top' },
    { key: 'lid_sides', kind: 'length', label: 'Lid side width', unit: 'mm', default: 20, min: 2, max: 200, step: 1, group: 'top', help: 'Of the two sides the lid rests on. Wide box only.' },
    { key: 'finger_hole_diameter', kind: 'length', label: 'Finger hole', unit: 'mm', default: 15, min: 0, max: 100, step: 1, group: 'top', help: 'Diameter of the notch for catching the lid.' },
    { key: 'margin', kind: 'length', label: 'Glue tab margin', unit: 'mm', default: 0, min: 0, max: 20, step: 0.1, group: 'advanced' },
    { key: 'mark_length', kind: 'length', label: 'Fold mark length', unit: 'mm', default: 1.5, min: 0, max: 10, step: 0.5, group: 'advanced', help: '0 leaves them off.' },
    {
      key: 'tab_angle_rad',
      kind: 'number',
      label: 'Glue tab angle',
      unit: 'rad',
      default: Math.atan(2 / 25),
      min: 0,
      max: 0.7,
      step: 0.01,
      group: 'advanced',
      help: 'How far the glue tabs’ sides lean in.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new PaperBox(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        design: s(v, 'design', 'automatic') as Design,
        lidHeight: n(v, 'lid_height', 15),
        lidRadius: n(v, 'lid_radius', 7),
        lidSides: n(v, 'lid_sides', 20),
        margin: n(v, 'margin', 0),
        markLength: n(v, 'mark_length', 1.5),
        tabAngleRad: n(v, 'tab_angle_rad', Math.atan(2 / 25)),
        fingerHoleDiameter: n(v, 'finger_hole_diameter', 15),
      },
      config,
    ),
};
