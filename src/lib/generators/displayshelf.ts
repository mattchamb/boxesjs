/**
 * Display shelf — ported from boxes.py `boxes/generators/displayshelf.py`
 * (class `DisplayShelf`).
 *
 * Two side panels carry a stack of slanted floors, each with a lip along its
 * front edge so whatever is on display leans back and cannot slide off. The
 * floors are divided across their width by dividers that drop into slots.
 *
 * `slope_top` cuts the top front corner off both sides so the shelf steps back
 * as it rises; that variant is the only one drawn with `polygonWall` rather
 * than `rectangularWall`.
 */
import { Boxes, type BoxesConfig, type EdgeSpec, type PolygonBorder } from '../boxes';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface DisplayShelfOptions {
  sx: number[];
  y: number;
  h: number;
  outside: boolean;
  num: number;
  frontWallHeight: number;
  angle: number;
  includeBack: boolean;
  includeFront: boolean;
  includeBottom: boolean;
  slopeTop: boolean;
  dividerWallHeight: number;
  bottomDistance: number;
  topDistance: number;
}

class DisplayShelf extends Boxes {
  /** Mutated by the `outside` adjustment in render(), as boxes.py does. */
  private sx: number[];
  private y: number;
  private x = 0;
  private radians = 0;
  /** Floor depth, measured along the slant. */
  private sl = 0;
  /** Height of the front wall once the top has been sloped away. */
  private front = 0;

  constructor(
    private o: DisplayShelfOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.sx = [...o.sx];
    this.y = o.y;
  }

  /** Slots in a side panel: one per floor, plus one per front lip. */
  private generateFingerHoles(): void {
    const t = this.thickness;
    const a = this.radians;
    const { num, angle, frontWallHeight, bottomDistance, topDistance } = this.o;

    const hs = (this.sl + t) * Math.sin(a) + Math.cos(a) * t;
    const bOffs = bottomDistance;
    const h = this.o.h - bOffs - topDistance;

    if (this.o.slopeTop && this.o.includeBottom) {
      this.moveTo(0, this.getEdge('h').startWidth());
    }

    if (h - Math.abs(hs) - 3 * t * (num - 1) < 0) {
      // boxes.py raises here and renders nothing; a warning keeps the rest of
      // the sheet usable and puts the message on the offending field.
      this.warn('Not enough height to fit this many shelves.', 'h');
      return;
    }

    for (let i = 0; i < num; i++) {
      let posX = Math.abs(0.5 * t * Math.sin(a));
      let posY = hs - Math.cos(a) * 0.5 * t + (i * (h - Math.abs(hs))) / (num - 0.5) + bOffs;
      if (a < 0) posY += -Math.sin(a) * this.sl;
      this.fingerHolesAt(posX, posY, this.sl, -angle);
      posX += Math.cos(-a) * (this.sl + 0.5 * t) + Math.sin(a) * 0.5 * t;
      posY += Math.sin(-a) * (this.sl + 0.5 * t) + Math.cos(a) * 0.5 * t;
      this.fingerHolesAt(posX, posY, frontWallHeight, 90 - angle);
    }
  }

  private generateSlopedSides(width: number, height: number): void {
    const { num, frontWallHeight, angle, includeBottom, includeFront, includeBack } = this.o;
    const a = this.radians;

    const topSegmentHeight = height / num;

    // Largest triangle that can come off the top front corner.
    let verticalCut = topSegmentHeight - frontWallHeight;
    let hypotenuse = verticalCut / Math.sin(a);
    let horizontalCut = Math.sqrt(hypotenuse ** 2 - verticalCut ** 2);

    if (horizontalCut > width) {
      // Shrink the cut to keep the full height.
      horizontalCut = width - 1; // keep a 1mm edge on the top
      verticalCut = horizontalCut * Math.tan(a);
      hypotenuse = Math.sqrt(horizontalCut ** 2 + verticalCut ** 2);
    }

    const top = width - horizontalCut;
    this.front = height - verticalCut;

    let edges = includeBottom ? 'he' : 'ee';
    const le = includeBottom ? this.getEdge('h').startWidth() : this.getEdge('e').startWidth();
    edges += includeFront ? 'f' : 'e';
    edges += includeBack ? 'eefe' : 'eeee';

    // Seven legs to seven edge characters; nothing wraps.
    const borders: PolygonBorder[] = [
      width, 90,
      le, 0,
      this.front, 90 - angle,
      hypotenuse, angle,
      top, 90,
      height, 0,
      le, 90,
    ];
    const holes = [() => this.generateFingerHoles()];
    this.polygonWall(borders, { edge: edges, callback: holes, move: 'up', label: 'left side' });
    this.polygonWall(borders, { edge: edges, callback: holes, move: 'up', label: 'right side' });
  }

  private generateRectangularSides(width: number, height: number): void {
    let edges = this.o.includeBottom ? 'h' : 'e';
    edges += this.o.includeFront ? 'fe' : 'ee';
    edges += this.o.includeBack ? 'f' : 'e';

    const holes = [() => this.generateFingerHoles()];
    this.rectangularWall(width, height, edges, { callback: holes, move: 'up', label: 'left side' });
    this.rectangularWall(width, height, edges, { callback: holes, move: 'up', label: 'right side' });
  }

  private generateShelveFingerHoles(): void {
    const t = this.thickness;
    let posX = -0.5 * t;
    for (const x of this.sx.slice(0, -1)) {
      posX += x + t;
      this.fingerHolesAt(posX, 0, this.sl, 90);
    }
  }

  private generateFrontLipFingerHoles(): void {
    const t = this.thickness;
    const height = Math.min(this.o.frontWallHeight, this.o.dividerWallHeight);
    let posX = -0.5 * t;
    for (const x of this.sx.slice(0, -1)) {
      posX += x + t;
      this.fingerHolesAt(posX, 0, height, 90);
    }
  }

  private generateShelves(): void {
    const { num, frontWallHeight } = this.o;

    if (frontWallHeight) {
      for (let i = 0; i < num; i++) {
        this.rectangularWall(this.x, this.sl, 'ffef', {
          callback: [() => this.generateShelveFingerHoles()],
          move: 'up',
          label: `shelf ${i + 1}`,
        });
        this.rectangularWall(this.x, frontWallHeight, 'Ffef', {
          callback: [() => this.generateFrontLipFingerHoles()],
          move: 'up',
          label: `front lip ${i + 1}`,
        });
      }
      return;
    }

    for (let i = 0; i < num; i++) {
      this.rectangularWall(this.x, this.sl, 'Efef', {
        callback: [() => this.generateShelveFingerHoles()],
        move: 'up',
        label: `shelf ${i + 1}`,
      });
    }
  }

  private generateDividers(): void {
    const { num, frontWallHeight, dividerWallHeight } = this.o;

    let edges: string | EdgeSpec[] = 'feee';
    if (frontWallHeight) {
      edges = 'ffee';
      if (dividerWallHeight > frontWallHeight) {
        // The divider stands taller than the lip, so its front edge is fingered
        // only for the part that meets the lip and plain above it.
        edges = [
          'f',
          this.makeCompoundEdge(['f', 'e'], [frontWallHeight, dividerWallHeight - frontWallHeight]),
          'e',
          'e',
        ];
      }
    }

    for (let i = 0; i < num; i++) {
      for (let j = 0; j < this.sx.length - 1; j++) {
        this.rectangularWall(this.sl, dividerWallHeight, edges, {
          move: 'up',
          label: `divider ${j + 1} for shelf ${i + 1}`,
        });
      }
    }
  }

  render(): void {
    const t = this.thickness;
    const front = this.o.frontWallHeight;
    const h = this.o.h;

    if (this.o.outside) {
      // boxes.py computes a float here and passes it where only truthiness is
      // read — and both branches of its conditional are truthy, so the bottom
      // always costs one thickness whether or not there is a bottom panel.
      this.sx = this.adjustSize(this.sx, true);
      this.y = this.adjustSize(this.y, this.o.includeBack, this.o.includeFront);
    }

    const y = this.y;
    this.x = this.sx.reduce((a, c) => a + c, 0) + t * (this.sx.length - 1);
    const a = this.o.angle * DEG;
    this.radians = a;
    this.sl =
      (y - t * (Math.cos(a) + Math.abs(Math.sin(a))) - Math.max(0, Math.sin(a) * front)) /
      Math.cos(a);

    if (this.o.slopeTop && this.o.angle !== 0) {
      this.generateSlopedSides(y, h);
    } else {
      if (this.o.slopeTop) {
        // The sloped cut is sized by dividing by sin(angle); boxes.py divides by
        // zero here and emits NaN coordinates. With flat floors there is nothing
        // to slope, so the plain sides are the honest answer.
        this.warn('Sloping the top needs a floor angle other than zero.', 'angle');
      }
      this.generateRectangularSides(y, h);
    }

    this.generateShelves();
    this.generateDividers();

    const bottomEdge = this.o.includeBottom ? 'h' : 'e';
    if (this.o.includeBack) {
      this.rectangularWall(this.x, h, `${bottomEdge}FeF`, { label: 'back wall', move: 'up' });
    }
    if (this.o.includeFront) {
      // Under slope_top the front wall stops where the slope begins, and that
      // height is only known once the sides have been drawn.
      const fh = this.o.slopeTop && this.o.angle !== 0 ? this.front : h;
      this.rectangularWall(this.x, fh, `${bottomEdge}FeF`, { label: 'front wall', move: 'up' });
    }
    if (this.o.includeBottom) {
      let edges = this.o.includeFront ? 'ff' : 'ef';
      edges += this.o.includeBack ? 'ff' : 'ef';
      this.rectangularWall(this.x, y, edges, { label: 'bottom wall', move: 'up' });
    }
  }
}

export const displayShelf: GeneratorDef = {
  meta: {
    id: 'displayshelf',
    name: 'Display Shelf',
    group: 'Shelf',
    summary: 'Tiered shelf with slanted floors and front lips',
    description:
      'A stack of slanted floors between two side panels, each floor with a lip ' +
      'along its front so what you put on it leans back and stays put. Dividers ' +
      'drop into slots to split each floor across its width. Sloping the top ' +
      'steps the shelf back as it rises, so the upper tiers stay visible.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartments left to right',
      default: '400',
      group: 'dimensions',
      itemLabel: 'compartment',
      help: 'Width of each compartment. Dividers separate them.',
    },
    {
      key: 'y',
      kind: 'length',
      label: 'Depth',
      unit: 'mm',
      default: 100,
      min: 20,
      max: 1000,
      step: 1,
      group: 'dimensions',
      help: 'Front to back.',
    },
    {
      key: 'h',
      kind: 'length',
      label: 'Height',
      unit: 'mm',
      default: 300,
      min: 30,
      max: 2000,
      step: 1,
      group: 'dimensions',
    },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'num',
      kind: 'number',
      label: 'Number of shelves',
      default: 3,
      min: 1,
      max: 20,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'angle',
      kind: 'number',
      label: 'Floor angle',
      unit: '°',
      default: 30,
      min: -60,
      max: 60,
      step: 1,
      group: 'dimensions',
      help: 'How far the floors tilt back. Negative values slant them forwards.',
    },
    {
      key: 'front_wall_height',
      kind: 'length',
      label: 'Front lip height',
      unit: 'mm',
      default: 20,
      min: 0,
      max: 200,
      step: 1,
      group: 'dimensions',
      help: 'Set to zero for open floors with no lip.',
    },
    {
      key: 'divider_wall_height',
      kind: 'length',
      label: 'Divider height',
      unit: 'mm',
      default: 20,
      min: 0,
      max: 300,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'bottom_distance',
      kind: 'length',
      label: 'Space below bottom shelf',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 500,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'top_distance',
      kind: 'length',
      label: 'Space above top shelf',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 500,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'include_back',
      kind: 'bool',
      label: 'Back panel',
      default: false,
      group: 'dimensions',
    },
    {
      key: 'include_front',
      kind: 'bool',
      label: 'Front panel',
      default: false,
      group: 'dimensions',
      help: 'Closes the front instead of the back, for a shelf used facing the other way.',
    },
    {
      key: 'include_bottom',
      kind: 'bool',
      label: 'Bottom panel',
      default: false,
      group: 'dimensions',
    },
    {
      key: 'slope_top',
      kind: 'bool',
      label: 'Slope the top',
      default: false,
      group: 'dimensions',
      help: 'Cuts the top front corner off the sides so the shelf steps back as it rises.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new DisplayShelf(
      {
        sx: parseSections(s(v, 'sx', '400')),
        y: n(v, 'y', 100),
        h: n(v, 'h', 300),
        outside: b(v, 'outside', true),
        num: n(v, 'num', 3),
        frontWallHeight: n(v, 'front_wall_height', 20),
        angle: n(v, 'angle', 30),
        includeBack: b(v, 'include_back', false),
        includeFront: b(v, 'include_front', false),
        includeBottom: b(v, 'include_bottom', false),
        slopeTop: b(v, 'slope_top', false),
        dividerWallHeight: n(v, 'divider_wall_height', 20),
        bottomDistance: n(v, 'bottom_distance', 0),
        topDistance: n(v, 'top_distance', 0),
      },
      config,
    ),
};
