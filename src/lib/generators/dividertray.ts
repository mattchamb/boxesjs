/**
 * Divider tray — ported from boxes.py `boxes/generators/dividertray.py`
 * (class `DividerTray`).
 *
 * Rows of loose dividers standing in slots cut into the side walls — for
 * cards, envelopes, records. The slots can lean back so whatever is filed
 * leans with them, and every divider and front/back wall carries a finger
 * notch so the contents can be pulled out.
 *
 * Four sets of dividers are drawn, because which one fits depends on how the
 * columns meet: tabs that stack on top of each other, half-thickness tabs that
 * sit side by side, full-thickness tabs, and one divider spanning every
 * column. You cut as many of whichever set suits.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { BaseEdge } from '../edges/base';
import { HANDLE_EDGE_PARAMS, LID_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface NotchSettings {
  upperRadius: number;
  lowerRadius: number;
  depth: number;
}

interface DividerTrayOptions {
  sx: number[];
  sy: number[];
  h: number;
  outside: boolean;
  slotDepth: number;
  slotAngle: number;
  slotRadius: number;
  slotExtraSlack: number;
  notch: NotchSettings;
  dividerBottomMargin: number;
  dividerPlay: number;
  notchesInWall: boolean;
  leftWall: boolean;
  rightWall: boolean;
  bottom: boolean;
  handle: boolean;
}

// ----------------------------------------------------------------------------
// Slot layout along the side walls. boxes.py describes the slotted edge as a
// list of straight runs and slots first, so the whole run can be stretched to
// an outside measurement before anything is drawn.
// ----------------------------------------------------------------------------

class StraightEdgeDescription {
  constructor(
    public askedLength: number,
    public roundEdgeCompensation = 0,
    public outsideRatio = 1,
    public angleCompensation = 0,
  ) {}

  tracingLength(): number {
    return this.askedLength * this.outsideRatio - this.roundEdgeCompensation + this.angleCompensation;
  }
}

class SlotDescription {
  readonly startRadius: number;
  readonly endRadius: number;

  constructor(
    readonly width: number,
    readonly depth: number,
    readonly angle: number,
    radius: number,
    startRadius?: number,
    endRadius?: number,
  ) {
    this.startRadius = startRadius ?? radius;
    this.endRadius = endRadius ?? radius;
  }

  private divByCos(): number {
    return 1 / Math.cos(this.angle * DEG);
  }

  private tan(): number {
    return Math.tan(this.angle * DEG);
  }

  /** Width measured along the wall, which the lean makes wider than the slot. */
  angleCorrectedWidth(): number {
    return this.width * this.divByCos();
  }

  /** How much of the straight run before the slot the entry radius consumes. */
  roundEdgeStartCorrection(): number {
    return this.startRadius * (this.divByCos() - this.tan());
  }

  roundEdgeEndCorrection(): number {
    return this.endRadius * (this.divByCos() + this.tan());
  }

  /** The lean makes one side of the slot deeper than the other. */
  private depthAngleCorrection(): number {
    return this.width * this.tan();
  }

  correctedStartDepth(): number {
    return this.depth + Math.max(0, this.depthAngleCorrection()) - this.roundEdgeStartCorrection();
  }

  correctedEndDepth(): number {
    return this.depth + Math.max(0, -this.depthAngleCorrection()) - this.roundEdgeEndCorrection();
  }

  tracingLength(): number {
    return this.roundEdgeStartCorrection() + this.angleCorrectedWidth() + this.roundEdgeEndCorrection();
  }
}

type Description = StraightEdgeDescription | SlotDescription;

class SlottedEdgeDescriptions {
  descriptions: Description[] = [];

  add(d: Description): void {
    this.descriptions.push(d);
  }

  straightEdges(): StraightEdgeDescription[] {
    return this.descriptions.filter((d): d is StraightEdgeDescription => d instanceof StraightEdgeDescription);
  }

  lastEdge(): Description {
    return this.descriptions[this.descriptions.length - 1]!;
  }

  /** Stretch the straight runs (never the slots) so the edge totals `target`. */
  adjustToTargetLength(target: number): void {
    const compensation = this.totalLength() - target;
    const ratio = compensation / this.straightEdges().reduce((a, e) => a + e.askedLength, 0);
    for (const e of this.straightEdges()) e.outsideRatio = 1 - ratio;
  }

  totalLength(): number {
    return this.descriptions.reduce((a, d) => a + d.tracingLength(), 0);
  }
}

function generateAllSameAngles(
  sections: number[],
  thickness: number,
  extraSlack: number,
  depth: number,
  height: number,
  angle: number,
  radius: number,
): SlottedEdgeDescriptions {
  const width = thickness + extraSlack;
  const descriptions = new SlottedEdgeDescriptions();

  // A leading 0 puts a slot hard against the back wall; with nothing before it
  // there is no corner to round on its near side.
  let firstCorrection = 0;
  let current = 0;
  if (sections[0] === 0) {
    const slot = new SlotDescription(width, depth, angle, radius, 0, radius);
    descriptions.add(slot);
    firstCorrection = slot.roundEdgeEndCorrection();
    current++;
  }

  descriptions.add(new StraightEdgeDescription(sections[current]!, firstCorrection));
  current++;

  for (const l of sections.slice(current)) {
    const slot = new SlotDescription(width, depth, angle, radius);
    // Only straight runs reach here as the previous entry: a slot is always
    // followed by one, and the leading slot is followed by the first run.
    (descriptions.lastEdge() as StraightEdgeDescription).roundEdgeCompensation +=
      slot.roundEdgeStartCorrection();
    descriptions.add(slot);
    descriptions.add(new StraightEdgeDescription(l, slot.roundEdgeEndCorrection()));
  }

  // Leaning slots need extra room at the front so a divider can slide all the
  // way down to the floor without hitting the front wall.
  const last = descriptions.lastEdge();
  if (last instanceof StraightEdgeDescription) {
    last.angleCompensation += height * Math.tan(angle * DEG);
  }

  return descriptions;
}

// ----------------------------------------------------------------------------
// Generator-local edges (PORTING.md §7). boxes.py reads the notch and slot
// settings off the box; here they are passed in.
// ----------------------------------------------------------------------------

/** Top edge with a rounded finger notch in the middle of each section. */
class DividerNotchesEdge extends BaseEdge {
  override description = 'Edge with multiple notches for easier access to dividers';

  constructor(
    boxes: Boxes,
    private sx: number[],
    private notch: NotchSettings,
  ) {
    super(boxes, null);
  }

  call(): void {
    this.sx.forEach((width, i) => {
      if (i > 0) this.edge(this.thickness);
      this.edgeWithNotch(width);
    });
  }

  private edgeWithNotch(width: number): void {
    const { upperRadius, lowerRadius, depth } = this.notch;
    const upperThird = (width - 2 * upperRadius - 2 * lowerRadius) / 3;
    if (upperThird > 0) {
      const straightHeight = depth - upperRadius - lowerRadius;
      this.polyline(
        upperThird,
        [90, upperRadius],
        straightHeight,
        [-90, lowerRadius],
        upperThird,
        [-90, lowerRadius],
        straightHeight,
        [90, upperRadius],
        upperThird,
      );
    } else {
      // Too narrow for the radii; leave the section plain.
      this.edge(width);
    }
  }
}

/** Top edge of a side wall: the rounded, possibly leaning, divider slots. */
class DividerSlotsEdge extends BaseEdge {
  override description = 'Edge with multiple angled rounded slots for dividers';

  constructor(
    boxes: Boxes,
    private descriptions: Description[],
  ) {
    super(boxes, null);
  }

  call(length: number): void {
    this.boxes.ctx.save();
    for (const d of this.descriptions) {
      if (d instanceof SlotDescription) this.doSlot(d);
      else this.edge(d.tracingLength());
    }
    // Rounding errors accumulate over the slots, so boxes.py returns to the
    // start and makes the full move in one step.
    this.boxes.ctx.restore();
    this.moveTo(length);
  }

  private doSlot(slot: SlotDescription): void {
    this.boxes.ctx.save();
    this.polyline(
      0,
      [90 - slot.angle, slot.startRadius],
      slot.correctedStartDepth(),
      -90,
      slot.width,
      -90,
      slot.correctedEndDepth(),
      [90 + slot.angle, slot.endRadius],
    );
    this.boxes.ctx.restore();
    this.moveTo(slot.tracingLength());
  }
}

class DividerTray extends Boxes {
  /** Mutated by the `outside` adjustment in render(), as boxes.py does. */
  private sx: number[];
  private h: number;

  constructor(
    private o: DividerTrayOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.sx = [...o.sx];
    this.h = o.h;
  }

  render(): void {
    const t = this.thickness;
    const o = this.o;

    const sideWallsNumber = this.sx.length - 1 + Number(o.leftWall) + Number(o.rightWall);
    if (sideWallsNumber === 0) {
      // boxes.py raises here; a single column with both side walls off has
      // nothing to hold the dividers.
      this.warn('A single column needs at least one side wall to hold the dividers.', 'left_wall');
      return;
    }
    if (o.sy.length === 0 || (o.sy[0] === 0 && o.sy.length < 2)) {
      // boxes.py indexes past the end of the list here.
      this.warn('Give at least one row depth.', 'sy');
      return;
    }

    // The height has to be settled before the slots are laid out.
    if (o.outside) {
      if (o.bottom) this.h -= t;
    } else {
      // An inside height is the height of the filed content, which leans with
      // the slots, so the tray itself can be lower.
      this.h = this.h * Math.cos(o.slotAngle * DEG);
    }

    const slots = generateAllSameAngles(
      o.sy,
      t,
      o.slotExtraSlack,
      o.slotDepth,
      this.h,
      o.slotAngle,
      o.slotRadius,
    );

    // Outside measurements are applied after the slots exist, by stretching
    // the straight runs between them.
    if (o.outside) {
      this.sx = this.adjustSize(this.sx, o.leftWall, o.rightWall);
      slots.adjustToTargetLength(o.sy.reduce((a, c) => a + c, 0) - 2 * t);
    }

    this.ctx.save();

    // Front and back, with slots for the inner side walls.
    const facingWallLength = this.sx.reduce((a, c) => a + c, 0) + t * (this.sx.length - 1);
    const sideEdge = (withWall: boolean): string => (withWall ? 'F' : 'e');
    const bottomEdge = (withWall: boolean, withHandle: boolean): string =>
      withWall ? (withHandle ? 'f' : 'F') : 'e';
    const upperEdge: EdgeSpec = o.notchesInWall
      ? new DividerNotchesEdge(this, [...this.sx].reverse(), o.notch)
      : 'e';
    for (const front of [false, true]) {
      this.rectangularWall(
        facingWallLength,
        this.h,
        [bottomEdge(o.bottom, front && o.handle), sideEdge(o.rightWall), upperEdge, sideEdge(o.leftWall)],
        {
          callback: [() => this.generateFingerHoles(this.h)],
          move: 'up',
          label: front ? 'Front' : 'Back',
        },
      );
    }

    // Side walls, outer then inner, with the slots the dividers stand in.
    const sideWallLength = slots.totalLength();
    const outerWalls = sideWallsNumber - (this.sx.length - 1);
    for (let i = 0; i < sideWallsNumber; i++) {
      // Outer walls join the bottom at its edge; inner ones stand in slots.
      const be = i < outerWalls ? (o.bottom ? 'F' : 'e') : o.bottom ? 'f' : 'e';
      const se = new DividerSlotsEdge(this, slots.descriptions);
      this.rectangularWall(sideWallLength, this.h, [be, 'f', se, 'f'], {
        move: 'up',
        label: `Sidepiece ${i + 1}`,
      });
    }

    this.lid(facingWallLength, sideWallLength);

    // Back to the bottom of the sheet, then across past the widest wall.
    this.ctx.restore();
    this.rectangularWall(Math.max(facingWallLength, sideWallLength), this.h, 'ffff', {
      move: 'right only',
      label: 'invisible',
    });

    if (o.bottom) {
      this.rectangularWall(
        facingWallLength,
        sideWallLength,
        ['f', o.rightWall ? 'f' : 'e', o.handle ? 'Y' : 'f', o.leftWall ? 'f' : 'e'],
        {
          callback: [() => this.generateFingerHoles(sideWallLength)],
          move: 'up',
          label: 'Bottom',
        },
      );
    }

    const dividerHeight =
      // The divider runs the length of the leaning slot...
      this.h / Math.cos(o.slotAngle * DEG) -
      // ...less what its own thickness would push above the wall...
      t * Math.tan(o.slotAngle * DEG) -
      // ...and the clearance asked for underneath.
      o.dividerBottomMargin;

    this.generateDivider(this.sx, dividerHeight, 'up', o.leftWall ? t : 0, o.rightWall ? t : 0);
    const sets: [number, number | null][] = [
      [t, null],
      [t / 2, null],
      [t, 0.5],
    ];
    for (const [tabs, asymmetricTabs] of sets) {
      this.savedContext(() => {
        this.sx.forEach((length, i) => {
          this.generateDivider(
            [length],
            dividerHeight,
            'right',
            o.leftWall || i > 0 ? tabs : 0,
            o.rightWall || i < this.sx.length - 1 ? tabs : 0,
            asymmetricTabs,
          );
          if (asymmetricTabs) this.moveTo(-tabs, this.spacing);
        });
      });
      this.generateDivider(this.sx, dividerHeight, 'up only');
    }
    // boxes.py's `debug` annotation is not ported: the config never enables it.
  }

  /** Slots for the inner side walls, one between each pair of columns. */
  private generateFingerHoles(length: number): void {
    let posX = -0.5 * this.thickness;
    for (const x of this.sx.slice(0, -1)) {
      posX += x + this.thickness;
      this.fingerHolesAt(posX, 0, length);
    }
  }

  private generateDivider(
    widths: number[],
    height: number,
    move: string,
    firstTabWidth = 0,
    secondTabWidth = 0,
    asymmetricTabs: number | null = null,
  ): void {
    const t = this.thickness;
    const totalWidth =
      widths.reduce((a, c) => a + c, 0) + (widths.length - 1) * t + firstTabWidth + secondTabWidth;

    if (this.move(totalWidth, height, move, true)) return;

    const play = this.o.dividerPlay;
    const slotDepth = this.o.slotDepth;
    let leftTabHeight = slotDepth;
    let rightTabHeight = slotDepth;
    if (asymmetricTabs) {
      leftTabHeight = leftTabHeight * asymmetricTabs - play;
      rightTabHeight = rightTabHeight * (1 - asymmetricTabs);
    }

    // Upper edge: first tab, then each column with its notch.
    if (asymmetricTabs) this.moveTo(firstTabWidth - play);
    else this.edge(firstTabWidth - play);
    widths.forEach((width, nr) => {
      if (nr > 0) this.edge(t);
      new DividerNotchesEdge(this, [width], this.o.notch).call();
    });

    this.polyline(
      secondTabWidth - play,
      90,
      leftTabHeight,
      90,
      secondTabWidth,
      -90,
      height - leftTabHeight,
      90,
    );

    // Lower edge, cut away under each inner side wall.
    for (const width of widths.slice(1).reverse()) {
      this.polyline(
        width - 2 * play,
        90,
        height - slotDepth,
        -90,
        t + 2 * play,
        -90,
        height - slotDepth,
        90,
      );
    }

    this.polyline(widths[0]! - 2 * play, 90, height - slotDepth, -90, firstTabWidth, 90, rightTabHeight, 90);
    if (asymmetricTabs) {
      this.polyline(firstTabWidth - play, -90, slotDepth - rightTabHeight, 90);
    }

    this.move(totalWidth, height, move, false, 'Divider');
  }
}

export const dividerTray: GeneratorDef = {
  meta: {
    id: 'dividertray',
    name: 'Divider Tray',
    group: 'Tray',
    summary: 'Tray of loose dividers standing in slotted side walls',
    description:
      'Rows of removable dividers that stand in slots cut into the side walls, ' +
      'for filing cards, envelopes or records. The slots can lean back so the ' +
      'contents lean with them. Four sets of dividers are drawn — stacking tabs, ' +
      'half-thickness tabs, full-thickness tabs, and one spanning every column — ' +
      'so cut as many of whichever set suits. Start the row depths with "0:" to ' +
      'add a slot against the back wall, or end them with ":0" for one at the front.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Columns left to right',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'column',
      help: 'Width of each column. Inner side walls separate them.',
    },
    {
      key: 'sy',
      kind: 'sections',
      label: 'Rows back to front',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'row',
      help: 'Space between dividers. A slot is cut between each pair of rows.',
    },
    {
      key: 'h',
      kind: 'length',
      label: 'Height',
      unit: 'mm',
      default: 100,
      min: 20,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'Inside, this is the height of what you are filing; the tray is lowered to match its lean.',
    },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: false, group: 'dimensions' },
    { key: 'left_wall', kind: 'bool', label: 'Left wall', default: true, group: 'dimensions' },
    { key: 'right_wall', kind: 'bool', label: 'Right wall', default: true, group: 'dimensions' },
    { key: 'bottom', kind: 'bool', label: 'Bottom panel', default: false, group: 'dimensions' },
    {
      key: 'notches_in_wall',
      kind: 'bool',
      label: 'Notches in front and back',
      default: true,
      group: 'dimensions',
      help: 'Cuts the same finger notches into the front and back walls as the dividers have.',
    },
    {
      key: 'handle',
      kind: 'bool',
      label: 'Handle on the bottom',
      default: false,
      group: 'top',
      help: 'Extends the bottom panel past the front into a pull handle. Needs the bottom panel.',
    },
    ...HANDLE_EDGE_PARAMS,
    ...LID_PARAMS,

    // These keep boxes.py's names (`Slot_depth`, not `slot_depth`) so a
    // permalink reads the same as a boxes.py URL, and so `divider_` cannot
    // collide with DisplayShelf's `divider_wall_height` in the golden script.
    // boxes.py declares all but the slack and play as integers.
    {
      key: 'Slot_depth',
      kind: 'length',
      label: 'Slot depth',
      unit: 'mm',
      default: 20,
      min: 5,
      max: 100,
      step: 1,
      group: 'joints',
    },
    {
      key: 'Slot_angle',
      kind: 'number',
      label: 'Slot lean',
      unit: '°',
      default: 0,
      min: 0,
      max: 60,
      step: 1,
      group: 'joints',
      help: 'Zero stands the dividers upright; higher values lean them back.',
    },
    {
      key: 'Slot_radius',
      kind: 'length',
      label: 'Slot entry radius',
      unit: 'mm',
      default: 2,
      min: 0,
      max: 10,
      step: 1,
      group: 'joints',
    },
    {
      key: 'Slot_extra_slack',
      kind: 'length',
      label: 'Slot slack',
      unit: 'mm',
      default: 0.2,
      min: 0,
      max: 2,
      step: 0.05,
      group: 'joints',
      help: 'Added to the material thickness so the dividers drop in easily.',
    },
    {
      key: 'Notch_depth',
      kind: 'length',
      label: 'Finger notch depth',
      unit: 'mm',
      default: 15,
      min: 0,
      max: 100,
      step: 1,
      group: 'joints',
    },
    {
      key: 'Notch_upper_radius',
      kind: 'length',
      label: 'Notch top radius',
      unit: 'mm',
      default: 1,
      min: 0,
      max: 20,
      step: 1,
      group: 'joints',
    },
    {
      key: 'Notch_lower_radius',
      kind: 'length',
      label: 'Notch bottom radius',
      unit: 'mm',
      default: 8,
      min: 0,
      max: 40,
      step: 1,
      group: 'joints',
    },
    {
      key: 'Divider_bottom_margin',
      kind: 'length',
      label: 'Divider floor gap',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 50,
      step: 1,
      group: 'joints',
      help: 'Shortens the dividers so they stop this far above the floor.',
    },
    {
      // boxes.py declares this relative to thickness, but reads the raw
      // argument straight off the box, so it is used as millimetres. The port
      // keeps that, or the geometry would not match.
      key: 'Divider_play',
      kind: 'length',
      label: 'Divider play',
      unit: 'mm',
      default: 0.05,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'joints',
      help: 'Trimmed off each side of a divider so it does not bind against the walls.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new DividerTray(
      {
        sx: parseSections(s(v, 'sx', '50*3')),
        sy: parseSections(s(v, 'sy', '50*3')),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', false),
        slotDepth: n(v, 'Slot_depth', 20),
        slotAngle: n(v, 'Slot_angle', 0),
        slotRadius: n(v, 'Slot_radius', 2),
        slotExtraSlack: n(v, 'Slot_extra_slack', 0.2),
        notch: {
          upperRadius: n(v, 'Notch_upper_radius', 1),
          lowerRadius: n(v, 'Notch_lower_radius', 8),
          depth: n(v, 'Notch_depth', 15),
        },
        dividerBottomMargin: n(v, 'Divider_bottom_margin', 0),
        dividerPlay: n(v, 'Divider_play', 0.05),
        notchesInWall: b(v, 'notches_in_wall', true),
        leftWall: b(v, 'left_wall', true),
        rightWall: b(v, 'right_wall', true),
        bottom: b(v, 'bottom', false),
        handle: b(v, 'handle', false),
      },
      config,
    ),
};
