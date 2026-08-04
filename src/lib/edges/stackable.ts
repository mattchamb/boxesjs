/**
 * Stackable edges, ported from boxes.py `boxes/edges.py`.
 *
 * The bottom edge grows two feet; the top edge cuts matching recesses. Stack
 * two boxes and the feet drop into the recesses so the stack cannot slide.
 */
import type { Boxes } from '../boxes';
import { BaseEdge, type EdgeCallOptions } from './base';
import { Settings } from './settings';
import type { FingerJointSettings } from './fingerjoint';

const DEG = Math.PI / 180;

export class StackableSettings extends Settings {
  static override absoluteParams = {
    /** Inside angle of the feet. */
    angle: 60,
  };

  static override relativeParams = {
    height: 2.0,
    width: 4.0,
    holedistance: 1.0,
    bottom_stabilizers: 0.0,
  };

  get angle(): number { return this.getNum('angle'); }
  get height(): number { return this.getNum('height'); }
  get width(): number { return this.getNum('width'); }
  get holedistance(): number { return this.getNum('holedistance'); }
  get bottom_stabilizers(): number { return this.getNum('bottom_stabilizers'); }

  override checkValues(): void {
    const a = this.values['angle'] as number;
    if (a < 20) throw new Error("StackableSettings: 'angle' is too small. Use value >= 20");
    if (a > 260) throw new Error("StackableSettings: 'angle' is too big. Use value < 260");
  }

  edgeObjects(
    boxes: Boxes,
    chars = 'sSšŠ',
    add = true,
    fingerSettings?: FingerJointSettings,
  ): BaseEdge[] {
    const fs = fingerSettings ?? (boxes.edges['f']!.settings as FingerJointSettings);
    const edges: BaseEdge[] = [
      new StackableEdge(boxes, this, fs),
      new StackableEdgeTop(boxes, this, fs),
      new StackableFeet(boxes, this, fs),
      new StackableHoleEdgeTop(boxes, this, fs),
    ];
    edges.forEach((e, i) => {
      if (i < chars.length) e.char = chars[i]!;
    });
    if (add) boxes.addParts(edges);
    return edges;
  }
}

export class StackableBaseEdge extends BaseEdge {
  override char: string | null = 's';
  override description = 'Abstract Stackable class';
  bottom = true;
  declare settings: StackableSettings;
  fingerjointsettings: FingerJointSettings;

  constructor(boxes: Boxes, settings: StackableSettings, fingerjointsettings: FingerJointSettings) {
    super(boxes, settings);
    this.fingerjointsettings = fingerjointsettings;
  }

  call(_length: number, _opts: EdgeCallOptions = {}): void {
    const s = this.settings;
    const length = _length;
    const r = s.height / 2.0 / (1 - Math.cos(s.angle * DEG));
    const l = r * Math.sin(s.angle * DEG);
    const p = this.bottom ? 1 : -1;

    if (this.bottom && s.bottom_stabilizers) {
      this.boxes.savedContext(() => {
        const sp = this.boxes.spacing;
        this.moveTo(-sp / 2);
        this.boxes.rectangularWall(
          length - 1.05 * this.boxes.thickness,
          s.bottom_stabilizers,
          'eeee',
          { move: 'down' },
        );
      });
    }

    this.boxes.edge(s.width, 1);
    this.boxes.corner(p * s.angle, r);
    this.boxes.corner(-p * s.angle, r);
    this.boxes.edge(length - 2 * s.width - 4 * l);
    this.boxes.corner(-p * s.angle, r);
    this.boxes.corner(p * s.angle, r);
    this.boxes.edge(s.width, 1);
  }

  protected height(): number {
    return this.settings.height + this.settings.holedistance + this.settings.thickness;
  }

  override startWidth(): number {
    return this.bottom ? this.height() : 0;
  }

  override margin(): number {
    if (this.bottom) {
      return this.settings.bottom_stabilizers
        ? this.settings.bottom_stabilizers + this.boxes.spacing
        : 0;
    }
    return this.settings.height;
  }
}

/** Bottom edge with feet, plus finger slots for the bottom panel. */
export class StackableEdge extends StackableBaseEdge {
  override char: string | null = 's';
  override description = 'Stackable (bottom, finger joint holes)';

  override call(length: number, opts: EdgeCallOptions = {}): void {
    const s = this.settings;
    this.boxes.fingerHolesAt(
      0,
      s.height + s.holedistance + 0.5 * this.boxes.thickness,
      length,
      0,
    );
    super.call(length, opts);
  }
}

/** Top edge with recesses matching the feet below. */
export class StackableEdgeTop extends StackableBaseEdge {
  override char: string | null = 'S';
  override description = 'Stackable (top)';
  override bottom = false;
}

/** Feet only, without the finger slots. */
export class StackableFeet extends StackableBaseEdge {
  override char: string | null = 'š';
  override description = 'Stackable feet (bottom)';

  protected override height(): number {
    return this.settings.height;
  }
}

export class StackableHoleEdgeTop extends StackableBaseEdge {
  override char: string | null = 'Š';
  override description = 'Stackable edge with finger holes (top)';
  override bottom = false;

  override startWidth(): number {
    return this.settings.thickness + this.settings.holedistance;
  }

  override call(length: number, opts: EdgeCallOptions = {}): void {
    const s = this.settings;
    this.boxes.fingerHolesAt(0, s.holedistance + 0.5 * this.boxes.thickness, length, 0);
    super.call(length, opts);
  }
}
