/**
 * Wall-mounting edges and the wall-mounted box base class, ported from
 * boxes.py `boxes/walledges.py`.
 *
 * A wall-mounted part has a back edge shaped to hang on some wall system: a
 * plain wall (screwed through), slatwall, DIN rail, French cleat or IKEA
 * Skådis board. Along that edge, stretches of *joint* (fingers or holes that
 * other parts attach to) alternate with *sections* (the hooks themselves).
 *
 * boxes.py builds the edge classes at runtime with `type()`, crossing each
 * wall profile with five roles through multiple inheritance. Here that is
 * composition: the profile lives on the settings class (`lengths`, the
 * section's polyline, `profileMargin`), and one edge class per role asks it.
 * Each role keeps exactly the methods its Python mixin overrides, so the
 * method resolution comes out the same:
 *
 *   char  role         joint            section          margin
 *   a/A   plain        edge             profile          profile
 *   b/B   joined       step + f         profile          profile
 *   c/C   back         F                straight edge    thickness
 *   d/D   hole edge    (draws `|` alongside, then a straight edge)
 *   |     holes        finger slots     rectangular hole —
 *
 * Upper-case is the same edge traced in reverse.
 */
import { Boxes, type BoxesConfig } from './boxes';
import { BaseEdge, type EdgeCallOptions } from './edges/base';
import { Settings } from './edges/settings';

const DEG = Math.PI / 180;

type Poly = Array<number | [number, number]>;

// ============================================================================
// Settings, one per wall system. Each carries its profile.
// ============================================================================

export class WallSettings extends Settings {
  static override absoluteParams = {};
  static override relativeParams = { edge_width: 1.0 };

  get edge_width(): number { return this.getNum('edge_width'); }

  /** Alternating joint, section, joint, … lengths along an edge. */
  lengths(length: number): number[] {
    return [length];
  }

  /** The `nr`th section, as polyline arguments. */
  section(_nr: number, length: number): Poly {
    return [length];
  }

  /** How far the hooks reach behind the edge. */
  profileMargin(): number {
    return 0.0;
  }

  edgeObjects(boxes: Boxes, chars = 'aAbBcCdD|', add = true): BaseEdge[] {
    const holes = new WallHoles(boxes, this);
    const edges: BaseEdge[] = [
      new WallEdge(boxes, this, false),
      new WallEdge(boxes, this, true),
      new WallJoinedEdge(boxes, this, false),
      new WallJoinedEdge(boxes, this, true),
      new WallBackEdge(boxes, this, false),
      new WallBackEdge(boxes, this, true),
      new WallHoleEdge(boxes, holes, false),
      new WallHoleEdge(boxes, holes, true),
      holes,
    ];
    edges.forEach((e, i) => {
      if (i < chars.length) e.char = chars[i]!;
    });
    if (add) boxes.addParts(edges);
    return edges;
  }
}

export class SlatWallSettings extends WallSettings {
  static override absoluteParams = {
    bottom_hook: ['hook', 'spring', 'stud', 'none'] as const,
    pitch: 101.6,
    hook_depth: 4.0,
    hook_distance: 5.5,
    hook_height: 6.0,
    hook_overall_height: 12.0,
  };
  static override relativeParams = { hook_extra_height: 2.0, edge_width: 1.0 };

  get bottom_hook(): string { return this.getStr('bottom_hook'); }
  get pitch(): number { return this.getNum('pitch'); }
  get hook_depth(): number { return this.getNum('hook_depth'); }
  get hook_distance(): number { return this.getNum('hook_distance'); }
  get hook_height(): number { return this.getNum('hook_height'); }
  get hook_overall_height(): number { return this.getNum('hook_overall_height'); }
  get hook_extra_height(): number { return this.getNum('hook_extra_height'); }

  override lengths(length: number): number[] {
    const pitch = this.pitch;
    const h = this.hook_height;
    const he = this.hook_extra_height;
    if (length < h + he) return [length];
    const lengths = [0, h + he];
    length -= h + he;
    if (length > pitch) {
      // Python's `//` and `%` floor; JS `%` truncates, but length is positive.
      lengths.push(Math.floor(length / pitch) * pitch - h - 2 - 2 * he, h + 2 + 2 * he, length % pitch);
    } else {
      lengths.push(length);
    }
    return lengths;
  }

  override section(nr: number, length: number): Poly {
    const w = this.hook_height;
    const hd = this.hook_depth;
    const hdist = this.hook_distance;
    const hh = this.hook_overall_height;
    const he = this.hook_extra_height;
    const ro = w;
    const ri = Math.min(w / 2, hd / 2);
    const rt = Math.min(1, hd / 2);
    const slot = this.hook_height + 2;

    if (nr === 0) {
      return [0, -90, hdist - ri, [-90, ri], hh - ri - w - rt, [90, rt],
        hd - 2 * rt, [90, rt], hh - ro - rt, [90, ro], hdist + hd - ro, -90,
        length - 6];
    }
    // boxes.py only ever asks for sections 0 and 1.
    switch (this.bottom_hook) {
      case 'spring': {
        const rPlug = slot * 0.4;
        const slotslot = slot - rPlug * 2 ** 0.5;
        return [he, -90, 5.0, -45, 0, [135, rPlug], 0, 90, 10, -90, slotslot, -90, 10, 90, 0,
          [135, rPlug], 0, -45, 5, -90, he];
      }
      case 'hook': {
        const d = 2;
        return [he + d - 1, -90, 4.5 + hd, [90, 1], slot - 2, [90, 1], hd - 1, 90, d,
          -90, 5.5, -90, he + 1];
      }
      case 'stud':
        return [he, -90, 6, [90, 1], slot - 2, [90, 1], 6, -90, he];
      default:
        return [2 * he + slot];
    }
  }

  override profileMargin(): number {
    return this.hook_depth + this.hook_distance;
  }
}

export class DinRailSettings extends WallSettings {
  static override absoluteParams = {
    bottom: ['stud', 'none'] as const,
    depth: 8.0,
  };
  static override relativeParams = { edge_width: 1.0 };

  get bottom(): string { return this.getStr('bottom'); }
  get depth(): number { return this.getNum('depth'); }

  override lengths(length: number): number[] {
    if (length < 20) return [length];
    if (length > 50 && this.bottom === 'stud') return [0, 20, length - 40, 20];
    return [0, 20, length - 20];
  }

  override section(nr: number, _length: number): Poly {
    const d = this.depth;
    if (nr === 0) {
      const r = 1.0;
      return [0, -90, d - 0.5 - r, [90, r], 15 + 3 - 2 * r, [90, r],
        d - 4 - r, 45, 4 * 2 ** 0.5, -45, 0.5, -90, 6];
    }
    const slot = 20;
    if (this.bottom === 'stud') {
      const r = 1.0;
      return [0, -90, 7.5 - r, [90, r], slot - 2 * r, [90, r], 7.5 - r, -90, 0];
    }
    return [slot];
  }

  override profileMargin(): number {
    return this.depth;
  }
}

export class FrenchCleatSettings extends WallSettings {
  static override absoluteParams = {
    bottom: ['stud', 'hook', 'none'] as const,
    depth: 18.0,
    spacing: 200.0,
    angle: 45.0,
  };
  static override relativeParams = { edge_width: 1.0 };

  get bottom(): string { return this.getStr('bottom'); }
  get depth(): number { return this.getNum('depth'); }
  get spacing(): number { return this.getNum('spacing'); }
  get angle(): number { return this.getNum('angle'); }

  override lengths(length: number): number[] {
    const d = this.depth;
    const t = this.thickness;
    const s = this.spacing;
    const h = d * Math.tan(this.angle * DEG);
    // Small enough that these stretches get no finger holes.
    const top = 0.5 * t;
    const bottom = 0.5 * t;
    if (length < top + bottom + 1.5 * d + h) return [length];
    if (length > top + bottom + 2 * t + 1.5 * d + h && this.bottom === 'stud') {
      return [top, 1.5 * d + h, length - top - bottom - 2.5 * d - h, d, bottom];
    }
    if (length > top + bottom + 2.5 * d + s && this.bottom === 'hook') {
      const dist = Math.floor((length - top - t - 1.5 * d - h) / s) * s - 1.5 * d - h;
      return [top, 1.5 * d + h, dist, 1.5 * d + h, length - dist - top - 3 * d - 2 * h];
    }
    return [top, 2.5 * d, length - top - 2.5 * d];
  }

  override section(nr: number, length: number): Poly {
    const d = this.depth;
    const t = this.thickness;
    const a = this.angle;
    const h = d * Math.tan(a * DEG);
    const l = d / Math.cos(a * DEG);

    if (nr === 0 || this.bottom === 'hook') {
      return [0, -90, 0, [90, d], 0.5 * d + h, 90 + a, l, -90 - a, length - 1.5 * d];
    }
    if (this.bottom === 'stud') {
      const r = Math.min(t, length / 4, d);
      return [0, -90, d - r, [90, r], length - 2 * r, [90, r], d - r, -90, 0];
    }
    return [length];
  }

  override profileMargin(): number {
    return this.depth;
  }
}

export class SkadisSettings extends WallSettings {
  static override absoluteParams = {
    style: ['hooks', 'hook+stud', 'single'] as const,
    board_thickness: 5.1,
  };
  // boxes.py does not redeclare relative_params here, so edge_width is
  // inherited from WallSettings.
  static override relativeParams = { edge_width: 1.0 };

  get style(): string { return this.getStr('style'); }
  get board_thickness(): number { return this.getNum('board_thickness'); }

  override lengths(length: number): number[] {
    if (length < 11) return [length];
    if (this.style === 'hooks') {
      const out = [0, 11];
      for (let i = 0; i < Math.floor((length - 11) / 40); i++) out.push(29, 11);
      out.push((length - 11) % 40);
      return out;
    }
    if (this.style === 'hook+stud' && length > 40 + 15) return [0, 11, 29, 10, length - 11 - 29 - 10];
    return [0, 11, length - 11];
  }

  override section(nr: number, length: number): Poly {
    const r = 1;
    const a = 10;
    const ar = a * DEG;
    const b = this.board_thickness;
    const h = 4.8;
    if (nr === 0 || this.style === 'hooks') {
      return [0, -90, b + h - r, [90, r], 10 - 2 * r, [90, r],
        h - r - 5 * Math.tan(ar), 90 - a,
        5 / Math.cos(ar), -90 + a, b - r, [-90, r], length - r - 5];
    }
    return [0, -90, b, [90, 2], 10 - 4, [90, 2], b, -90, length - 10];
  }

  override profileMargin(): number {
    return this.board_thickness + 4.8;
  }
}

// ============================================================================
// Edges, one class per role
// ============================================================================

export class WallEdge extends BaseEdge {
  declare settings: WallSettings;

  constructor(
    boxes: Boxes,
    settings: WallSettings,
    protected reversed: boolean,
  ) {
    super(boxes, settings);
  }

  protected joint(length: number): void {
    this.edge(length);
  }

  protected section(nr: number, length: number): void {
    const poly = this.settings.section(nr, length);
    this.polyline(...(this.reversed ? [...poly].reverse() : poly));
  }

  /** Walks the joint/section list, skipping empty stretches. */
  protected trace(length: number): void {
    let lengths = this.settings.lengths(length).map((l, nr) => [nr, l] as const);
    if (this.reversed) lengths = [...lengths].reverse();
    for (const [nr, l] of lengths) {
      if (l === 0.0) continue;
      if (nr % 2) this.section(Math.floor(nr / 2), l);
      else this.joint(l);
    }
  }

  call(length: number, _opts?: EdgeCallOptions): void {
    this.trace(length);
  }

  override margin(): number {
    return this.settings.profileMargin();
  }
}

/** A wall edge that also carries fingers, for a part joining the wall plate. */
export class WallJoinedEdge extends WallEdge {
  protected override joint(length: number): void {
    const t = this.settings.thickness;
    this.boxes.step(-t);
    this.boxes.getEdge('f').call(length);
    this.boxes.step(t);
  }

  override startWidth(): number {
    return this.settings.thickness;
  }
}

/** The plate itself: counter-fingers at the joints, straight between them. */
export class WallBackEdge extends WallEdge {
  protected override section(_nr: number, length: number): void {
    this.edge(length);
  }

  protected override joint(length: number): void {
    const F = this.boxes.getEdge('F');
    this.boxes.step(F.startWidth());
    F.call(length);
    this.boxes.step(-F.endWidth());
  }

  override margin(): number {
    return this.settings.thickness;
  }
}

/**
 * Holes in a panel for a wall-joined edge to pass through: finger slots at
 * the joints, a rectangular cut at each hook. Called like `fingerHolesAt`.
 */
export class WallHoles extends WallEdge {
  constructor(boxes: Boxes, settings: WallSettings) {
    super(boxes, settings, false);
  }

  protected override section(_nr: number, length: number): void {
    this.boxes.rectangularHole(length / 2, 0, length, this.settings.thickness);
    this.moveTo(length, 0);
  }

  protected override joint(length: number): void {
    this.boxes.fingerHolesAt(0, 0, length, 0);
    this.moveTo(length, 0);
  }

  /** `wallHolesAt(x, y, length, angle)`. As an edge it has no sensible use. */
  override call(length: number): void {
    this.at(0, 0, length, 0);
  }

  at(x: number, y: number, length: number, angle: number): void {
    this.boxes.savedContext(() => {
      this.boxes.moveTo(x, y, angle);
      // boxes.py's debug outline is not ported; the config never enables it.
      this.boxes.moveTo(length, 0, 180);
      this.trace(length);
    });
  }
}

/** Straight edge with wall holes running alongside it, one slot-width in. */
export class WallHoleEdge extends WallEdge {
  constructor(
    boxes: Boxes,
    private wallHoles: WallHoles,
    reversed: boolean,
  ) {
    super(boxes, wallHoles.settings, reversed);
  }

  override call(length: number): void {
    const dist = this.wallHoles.settings.edge_width + this.settings.thickness / 2;
    this.boxes.savedContext(() => {
      const [px, angle] = this.reversed ? [0, 0] : [length, 180];
      this.wallHoles.at(px, dist, length, angle);
    });
    this.edge(length, 2);
  }

  override startWidth(): number {
    return this.wallHoles.settings.edge_width + this.settings.thickness;
  }

  override margin(): number {
    return 0.0;
  }
}

// ============================================================================
// Base class for wall-mounted generators
// ============================================================================

export type WallType = 'plain' | 'plain reinforced' | 'slatwall' | 'dinrail' | 'french cleat' | 'skadis';

export abstract class WallMountedBox extends Boxes {
  private wallHoles: WallHoles | null = null;

  constructor(
    protected walltype: WallType,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /** Registers `aAbBcCdD|` for the chosen wall system. */
  protected generateWallEdges(): void {
    const t = this.thickness;
    const fam = (name: string) => this.edgeSettings[name] ?? {};
    let s: WallSettings;
    if (this.walltype.startsWith('plain')) s = new WallSettings(t, true, fam('Wall'));
    else if (this.walltype === 'slatwall') s = new SlatWallSettings(t, true, fam('SlatWall'));
    else if (this.walltype === 'dinrail') s = new DinRailSettings(t, true, fam('DinRail'));
    else if (this.walltype === 'french cleat') s = new FrenchCleatSettings(t, true, fam('FrenchCleat'));
    else s = new SkadisSettings(t, true, fam('Skadis'));

    s.edgeObjects(this);
    this.wallHoles = this.edges['|'] as WallHoles;
    if (this.walltype.endsWith('reinforced')) {
      // A reinforced plain wall screws through a second plate, so the back
      // edges become hole edges for it.
      this.edges['c'] = this.edges['d']!;
      this.edges['C'] = this.edges['D']!;
    }
  }

  /** Holes for a `b`/`B` edge, as `fingerHolesAt` is for `f`. */
  protected wallHolesAt(x: number, y: number, length: number, angle: number): void {
    if (!this.wallHoles) throw new Error('generateWallEdges() must run before wallHolesAt()');
    this.wallHoles.at(x, y, length, angle);
  }
}
