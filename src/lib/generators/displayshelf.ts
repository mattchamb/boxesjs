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
 *
 * `wedged` is this port's own: everything that holds the two sides apart is
 * joined with wedged through-tenons instead, so the shelf comes apart again.
 */
import { Boxes, type BoxesConfig, type EdgeSpec, type PolygonBorder } from '../boxes';
import { tenonFootprints, wedgeClearance, type FaceRect } from '../edges/wedgedtenon';
import { WEDGED_TENON_PARAMS, assemblyParam } from '../params/common';
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
  /** This port's own option: floors and panels held by wedged through-tenons. */
  wedged: boolean;
}

/** A line of slots in a side panel, as `fingerHolesAt` takes it. */
interface HoleLine {
  x: number;
  y: number;
  length: number;
  angle: number;
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
  /**
   * Under `wedged`, how far the side panels reach past the space between the
   * panels they hold: the recessed back and front, and the raised bottom.
   */
  private reach = { back: 0, front: 0, bottom: 0 };
  /** Where the slope starts on the front edge, and how far back it cuts. */
  private slope: { front: number; cut: number } | null = null;

  constructor(
    private o: DisplayShelfOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.sx = [...o.sx];
    this.y = o.y;
  }

  /**
   * The slots in a side panel: one line per floor, and one per front lip.
   * Null, with a warning, when the floors do not fit.
   */
  private holeLines(): { floors: HoleLine[]; lips: HoleLine[] } | null {
    const t = this.thickness;
    const a = this.radians;
    const { num, angle, frontWallHeight, bottomDistance, topDistance } = this.o;

    const hs = (this.sl + t) * Math.sin(a) + Math.cos(a) * t;
    const bOffs = bottomDistance;
    const h = this.o.h - bOffs - topDistance;

    if (h - Math.abs(hs) - 3 * t * (num - 1) < 0) {
      // boxes.py raises here and renders nothing; a warning keeps the rest of
      // the sheet usable and puts the message on the offending field.
      this.warn('Not enough height to fit this many shelves.', 'h');
      return null;
    }

    const floors: HoleLine[] = [];
    const lips: HoleLine[] = [];
    for (let i = 0; i < num; i++) {
      let posX = Math.abs(0.5 * t * Math.sin(a));
      let posY = hs - Math.cos(a) * 0.5 * t + (i * (h - Math.abs(hs))) / (num - 0.5) + bOffs;
      if (a < 0) posY += -Math.sin(a) * this.sl;
      floors.push({ x: posX, y: posY, length: this.sl, angle: -angle });
      posX += Math.cos(-a) * (this.sl + 0.5 * t) + Math.sin(a) * 0.5 * t;
      posY += Math.sin(-a) * (this.sl + 0.5 * t) + Math.cos(a) * 0.5 * t;
      lips.push({ x: posX, y: posY, length: frontWallHeight, angle: 90 - angle });
    }
    return { floors, lips };
  }

  /** Slots in a side panel: one per floor, plus one per front lip. */
  private generateFingerHoles(): void {
    if (this.o.wedged) {
      // The callback starts at the polygon's corner, outside the reach of the
      // recessed back and the raised bottom.
      if (this.slope) this.moveTo(this.reach.back, this.reach.bottom);
    } else if (this.o.slopeTop && this.o.includeBottom) {
      this.moveTo(0, this.getEdge('h').startWidth());
    }

    const lines = this.holeLines();
    if (!lines) return;
    for (let i = 0; i < this.o.num; i++) {
      const f = lines.floors[i]!;
      if (this.o.wedged) this.tenonHolesAt(f.x, f.y, f.length, f.angle);
      else this.fingerHolesAt(f.x, f.y, f.length, f.angle);
      // The lips stay finger-jointed even when wedged: a lip's wedges would
      // hang off the side's front edge. Fitted dry, a lip is trapped between
      // the sides and its floor.
      const l = lines.lips[i]!;
      this.fingerHolesAt(l.x, l.y, l.length, l.angle);
    }
  }

  /**
   * Outside each side panel lie the wedges of the floors and of any back,
   * front and bottom panels. A shelf whose wedges meet, or hang off the side,
   * cannot be assembled as drawn; that is worth a warning.
   */
  private checkWedgeClearance(): void {
    const lines = this.holeLines();
    if (!lines) return;
    const s = this.wedgedTenonSettings;
    const t = this.thickness;
    const { includeBack, includeFront, includeBottom } = this.o;
    const y = this.y;
    const h = this.o.h;
    const fh = this.slope ? this.slope.front : h;

    // All in the frame the side's holes are drawn in: the inner corner of
    // the back and bottom, with the joined panels' mid-planes t/2 outside.
    const tenons: FaceRect[][] = lines.floors.flatMap((f) => tenonFootprints(s, f.x, f.y, f.length, f.angle));
    if (includeBack) tenons.push(...tenonFootprints(s, -t / 2, 0, h, 90));
    if (includeFront) tenons.push(...tenonFootprints(s, y + t / 2, 0, fh, 90));
    if (includeBottom) tenons.push(...tenonFootprints(s, 0, -t / 2, y, 0));

    const { back, front, bottom } = this.reach;
    const right = y + front;
    const outline: [number, number][] = this.slope
      ? [[-back, -bottom], [right, -bottom], [right, this.slope.front], [right - this.slope.cut, h], [-back, h]]
      : [[-back, -bottom], [right, -bottom], [right, h], [-back, h]];

    const { clash, overhang } = wedgeClearance(tenons, outline);
    if (clash) {
      this.warn(
        'Some of the wedges outside the side panels meet each other. Change the tenon spacing, ' +
          'or the depth or angle of the floors.',
        'wt_pitch',
      );
    }
    if (overhang) {
      this.warn(
        'Some wedges hang off the edge of the side panels, so they bear on one side of their ' +
          'tenon only. Shorten the wedges or change the tenon spacing.',
        'wt_wedge_length',
      );
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
    this.slope = { front: this.front, cut: horizontalCut };

    if (this.o.wedged) {
      this.generateWedgedSlopedSides(width, height, top, hypotenuse);
      return;
    }

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

  /**
   * The sloped sides with wedged joints. polygonWall draws each edge on its
   * leg, where rectangularWall would push it out by its width, so the reach
   * of the recessed panels is added to the legs here instead — and the
   * bottom is split so its hole edge spans exactly the bottom panel.
   */
  private generateWedgedSlopedSides(width: number, height: number, top: number, hypotenuse: number): void {
    const { angle, includeBottom, includeFront, includeBack } = this.o;
    const { back, front, bottom } = this.reach;
    const borders: PolygonBorder[] = [];
    const edges: EdgeSpec[] = [];
    const leg = (l: number, a: number, e: EdgeSpec) => {
      borders.push(l, a);
      edges.push(e);
    };
    if (back) leg(back, 0, 'e');
    leg(width, front ? 0 : 90, includeBottom ? 'W' : 'e');
    if (front) leg(front, 90, 'e');
    leg(bottom, 0, 'e');
    leg(this.front, 90 - angle, includeFront ? 'W' : 'e');
    leg(hypotenuse, angle, 'e');
    leg(top + back + front, 90, 'e');
    leg(height, 0, includeBack ? 'W' : 'e');
    leg(bottom, 90, 'e');

    const holes = [() => this.generateFingerHoles()];
    this.polygonWall(borders, { edge: edges, callback: holes, move: 'up', label: 'left side' });
    this.polygonWall(borders, { edge: edges, callback: holes, move: 'up', label: 'right side' });
  }

  private generateRectangularSides(width: number, height: number): void {
    if (this.o.wedged) {
      const edges = [
        this.o.includeBottom ? 'W' : 'e',
        this.o.includeFront ? 'W' : 'e',
        'e',
        this.o.includeBack ? 'W' : 'e',
      ];
      const holes = [() => this.generateFingerHoles()];
      this.rectangularWall(width, height, edges, { callback: holes, move: 'up', label: 'left side' });
      this.rectangularWall(width, height, edges, { callback: holes, move: 'up', label: 'right side' });
      return;
    }

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

    // Wedged floors pass through the sides and are wedged outside them.
    const side = this.o.wedged ? 'w' : 'f';
    if (frontWallHeight) {
      for (let i = 0; i < num; i++) {
        this.rectangularWall(this.x, this.sl, `f${side}e${side}`, {
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
      this.rectangularWall(this.x, this.sl, `E${side}e${side}`, {
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
      // A wedged back or front is recessed into the sides, which costs more depth.
      const w = this.o.wedged ? 'W' : true;
      this.y = this.adjustSize(this.y, this.o.includeBack && w, this.o.includeFront && w);
    }
    if (this.o.wedged) {
      const reach = this.getEdge('W').startWidth();
      this.reach = {
        back: this.o.includeBack ? reach : 0,
        front: this.o.includeFront ? reach : 0,
        bottom: this.o.includeBottom ? reach : 0,
      };
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

    // Wedged, the back and front pass through the sides, and the bottom
    // passes through all four.
    const wedged = this.o.wedged;
    const bottomEdge = this.o.includeBottom ? (wedged ? 'W' : 'h') : 'e';
    const panelSides = wedged ? 'w' : 'F';
    if (this.o.includeBack) {
      this.rectangularWall(this.x, h, `${bottomEdge}${panelSides}e${panelSides}`, { label: 'back wall', move: 'up' });
    }
    if (this.o.includeFront) {
      // Under slope_top the front wall stops where the slope begins, and that
      // height is only known once the sides have been drawn.
      const fh = this.o.slopeTop && this.o.angle !== 0 ? this.front : h;
      this.rectangularWall(this.x, fh, `${bottomEdge}${panelSides}e${panelSides}`, { label: 'front wall', move: 'up' });
    }
    if (this.o.includeBottom) {
      const j = wedged ? 'w' : 'f';
      const edges = [this.o.includeFront ? j : 'e', j, this.o.includeBack ? j : 'e', j];
      this.rectangularWall(this.x, y, edges, { label: 'bottom wall', move: 'up' });
    }

    if (wedged) {
      this.checkWedgeClearance();
      const n = (l: number) => this.tenonCount(l);
      let count = this.o.num * 2 * n(this.sl);
      if (this.o.includeBack) count += 2 * n(h);
      if (this.o.includeFront) count += 2 * n(this.slope ? this.slope.front : h);
      if (this.o.includeBottom) {
        count += 2 * n(y);
        if (this.o.includeFront) count += n(this.x);
        if (this.o.includeBack) count += n(this.x);
      }
      this.wedges(count, 'up');
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
    assemblyParam(
      ['wedges'],
      'The floors and any back, front and bottom pass through the sides, the back and front recessed so their wedges stay within the depth; the lips and dividers fit dry.',
    ),
    ...WEDGED_TENON_PARAMS,
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
        wedged: s(v, 'assembly', 'glue') === 'wedges',
      },
      config,
    ),
};
