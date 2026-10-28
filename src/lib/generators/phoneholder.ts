/**
 * Phone holder — ported from boxes.py `boxes/generators/phoneholder.py`
 * (class `PhoneHolder`).
 *
 * A desk stand that leans a phone back between two side tabs, resting on two
 * hooked supports with a gap between them for the charging cable.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { BaseEdge } from '../edges/base';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface PhoneHolderOptions {
  phoneHeight: number;
  phoneWidth: number;
  phoneDepth: number;
  angle: number;
  bottomMargin: number;
  tabSize: number;
  bottomSupportSpacing: number;
}

/** Slots for the two supports, with a round notch for the cable between them. */
class BottomEdge extends BaseEdge {
  constructor(
    boxes: Boxes,
    private supportStartHeight: number,
    private supportSpacing: number,
  ) {
    super(boxes, null);
  }

  call(length: number): void {
    const cableHoleRadius = 2.5;
    this.supportSpacing = Math.max(this.supportSpacing, 2 * cableHoleRadius);
    const side = (length - this.supportSpacing - 2 * this.thickness) / 2;

    const half = [
      side, 90,
      this.supportStartHeight, -90,
      this.thickness, -90,
      this.supportStartHeight, 90,
      this.supportSpacing / 2 - cableHoleRadius, 90,
      2 * cableHoleRadius,
    ];
    this.polyline(...half, [-180, cableHoleRadius], ...[...half].reverse());
  }
}

/** Fingers into the back plate, stepped out round the tab's fingers. */
class SideEdge extends BaseEdge {
  constructor(
    boxes: Boxes,
    private tabStart: number,
    private tabLength: number,
    private reverse = false,
  ) {
    super(boxes, null);
  }

  call(length: number): void {
    let tabStart = this.tabStart;
    let tabEnd = length - this.tabStart - this.tabLength;
    if (this.reverse) [tabStart, tabEnd] = [tabEnd, tabStart];

    this.boxes.getEdge('F').call(tabStart);
    this.polyline(0, 90, this.thickness, -90);
    this.boxes.getEdge('f').call(this.tabLength);
    this.polyline(0, -90, this.thickness, 90);
    this.boxes.getEdge('F').call(tabEnd);
  }

  override startWidth(): number {
    return this.boxes.thickness;
  }
}

/** The side plate's tab that holds the phone, with finger holes for the front plate. */
class TabbedEdge extends BaseEdge {
  constructor(
    boxes: Boxes,
    private tabStart: number,
    private tabLength: number,
    private tabDepth: number,
    private reverse = false,
  ) {
    super(boxes, null);
  }

  call(length: number): void {
    let tabStart = this.tabStart;
    let tabEnd = length - this.tabStart - this.tabLength;
    if (this.reverse) [tabStart, tabEnd] = [tabEnd, tabStart];

    this.boxes.getEdge('f').call(tabStart);

    this.boxes.ctx.save();
    this.boxes.fingerHolesAt(0, -this.thickness / 2, this.tabLength, 0);
    this.boxes.ctx.restore();

    this.polyline(
      0, -90,
      this.thickness, [90, this.tabDepth],
      this.tabLength - 2 * this.tabDepth, [90, this.tabDepth],
      this.thickness, -90,
    );
    this.boxes.getEdge('f').call(tabEnd);
  }

  override margin(): number {
    return this.tabDepth + this.thickness;
  }
}

class PhoneHolder extends Boxes {
  private h = 0;
  private standDepth = 0;
  private standHeight = 0;

  constructor(
    private o: PhoneHolderOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const o = this.o;
    this.h = o.phoneHeight + o.bottomMargin;
    const tabStart = o.bottomMargin;
    const tabLength = o.tabSize;
    const tabDepth = o.phoneDepth;
    const supportDepth = o.phoneDepth;
    const supportSpacing = o.bottomSupportSpacing;
    const rad = o.angle * DEG;
    this.standDepth = this.h * Math.sin(rad);
    this.standHeight = this.h * Math.cos(rad);

    this.renderFrontPlate(tabStart, tabLength, supportSpacing, 'right');
    this.renderBackPlate('right');
    this.renderSidePlate(tabStart, tabLength, tabDepth, 'right');
    for (const move of ['right mirror', 'right']) {
      this.renderBottomSupport(tabStart, supportDepth, tabLength, move);
    }
  }

  // boxes.py labels none of these parts, so they are named through
  // callbacks: a label would print on the sheet.
  private renderFrontPlate(tabStart: number, tabLength: number, supportSpacing: number, move: string): void {
    const supportFingersLength = tabLength;
    const be = new BottomEdge(this, tabStart, supportSpacing);
    const se1 = new SideEdge(this, tabStart, tabLength);
    const se2 = new SideEdge(this, tabStart, tabLength, true);
    this.rectangularWall(this.o.phoneWidth, this.h, [be, se1, 'e', se2], {
      move,
      callback: [
        () => {
          this.ctx.nameCurrentPart('front');
          this.frontPlateHoles(tabStart, supportFingersLength, supportSpacing);
        },
      ],
    });
  }

  private renderBackPlate(move: string): void {
    const be = new BottomEdge(this, 0, 0);
    this.rectangularWall(this.o.phoneWidth, this.standHeight, [be, 'F', 'e', 'F'], {
      move,
      callback: [() => this.ctx.nameCurrentPart('back')],
    });
  }

  private frontPlateHoles(supportStartHeight: number, supportFingersLength: number, supportSpacing: number): void {
    const w = this.o.phoneWidth;
    const margin = (w - supportSpacing - this.thickness) / 2;
    this.fingerHolesAt(margin, supportStartHeight, supportFingersLength);
    this.fingerHolesAt(w - margin, supportStartHeight, supportFingersLength);
  }

  private renderSidePlate(tabStart: number, tabLength: number, tabDepth: number, move: string): void {
    const te = new TabbedEdge(this, tabStart, tabLength, tabDepth, true);
    this.rectangularTriangle(this.standDepth, this.standHeight, ['e', 'f', te], {
      move,
      num: 2,
      callback: [() => this.ctx.nameCurrentPart('side')],
    });
  }

  private renderBottomSupport(supportStartHeight: number, supportDepth: number, supportFingersLength: number, move: string): void {
    const t = this.thickness;
    const angle = this.o.angle;
    const fullHeight = supportStartHeight + supportFingersLength;
    const rad = angle * DEG;
    const floorLength = fullHeight * Math.sin(rad);
    const angledHeight = fullHeight * Math.cos(rad);
    const bottomRadius = Math.min(supportStartHeight, 3 * t + supportDepth);
    const smallerRadius = 0.5;
    const supportHookHeight = 5;
    const fullWidth = floorLength + (supportDepth + 3 * t) * Math.cos(rad);
    if (this.move(fullWidth, angledHeight, move, true)) return;

    this.polyline(
      floorLength, angle,
      3 * t + supportDepth - bottomRadius, [90, bottomRadius],
      supportHookHeight + supportStartHeight - bottomRadius, [180, t],
      supportHookHeight - smallerRadius, [-90, smallerRadius],
      t + supportDepth - smallerRadius, -90,
    );
    this.getEdge('f').call(supportFingersLength);
    this.polyline(0, 180 - angle, angledHeight, 90);

    // boxes.py gives the supports no label.
    this.ctx.nameCurrentPart('support');
    this.move(fullWidth, angledHeight, move);
  }
}

export const phoneHolder: GeneratorDef = {
  meta: {
    id: 'phoneholder',
    name: 'Phone Holder',
    group: 'Misc',
    summary: 'Desk stand that leans a phone back between two tabs',
    description:
      'Holds a phone between two side tabs, resting on two hooked supports ' +
      'with a gap between them, so the charging port, headphone socket and ' +
      'microphone stay clear. The defaults fit a Galaxy S7.',
  },
  params: [
    { key: 'phone_height', kind: 'length', label: 'Phone height', unit: 'mm', default: 142, min: 50, max: 400, step: 1, group: 'dimensions' },
    { key: 'phone_width', kind: 'length', label: 'Phone width', unit: 'mm', default: 73, min: 30, max: 300, step: 1, group: 'dimensions' },
    {
      key: 'phone_depth',
      kind: 'length',
      label: 'Phone depth',
      unit: 'mm',
      default: 11,
      min: 3,
      max: 50,
      step: 0.5,
      group: 'dimensions',
      help: 'Sets the depth of the supports and side tabs. Keep it at least the material thickness, or it will not assemble.',
    },
    { key: 'angle', kind: 'number', label: 'Lean', unit: '°', default: 25, min: 5, max: 60, step: 1, group: 'dimensions', help: 'Back from vertical.' },
    { key: 'bottom_margin', kind: 'length', label: 'Height below phone', unit: 'mm', default: 30, min: 10, max: 150, step: 1, group: 'dimensions' },
    { key: 'tab_size', kind: 'length', label: 'Tab length', unit: 'mm', default: 76, min: 20, max: 300, step: 1, group: 'dimensions', help: 'Of the tabs and supports holding the phone.' },
    {
      key: 'bottom_support_spacing',
      kind: 'length',
      label: 'Gap between supports',
      unit: 'mm',
      default: 16,
      min: 5,
      max: 200,
      step: 1,
      group: 'dimensions',
      help: 'Wide enough for the charging cable without blocking the other ports.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new PhoneHolder(
      {
        phoneHeight: n(v, 'phone_height', 142),
        phoneWidth: n(v, 'phone_width', 73),
        phoneDepth: n(v, 'phone_depth', 11),
        angle: n(v, 'angle', 25),
        bottomMargin: n(v, 'bottom_margin', 30),
        tabSize: n(v, 'tab_size', 76),
        bottomSupportSpacing: n(v, 'bottom_support_spacing', 16),
      },
      config,
    ),
};
