/**
 * The `Boxes` base class, ported from boxes.py `boxes/__init__.py`.
 *
 * Everything is turtle graphics: the pen sits at the origin of a moving
 * coordinate system, `edge()` walks it forward and `corner()` turns it. Kerf
 * compensation lives inside `corner()` — every turn is drawn as an arc whose
 * radius is offset by half the beam width, so the cut line lands on the true
 * outline and parts come out at their nominal size.
 *
 * Generators subclass this and implement `render()`.
 */
import { Context, Surface, type FontStyle, type InnerCorners, type TextAlign } from './geom/context';
import { Extents } from './geom/extents';
import { ANNOTATIONS, Color, INNER_CUT, OUTER_CUT, type RGB } from './geom/colors';
import { BaseEdge, CompoundEdge, Edge, NoopEdge, OutSetEdge, type BoltPolicy } from './edges/base';
import { FingerHoles, FingerJointSettings } from './edges/fingerjoint';
import { StackableSettings } from './edges/stackable';
import { GripSettings } from './edges/grip';
import { RoundedTriangleEdgeSettings } from './edges/roundedtriangle';
import { MountingSettings } from './edges/mounting';
import { Lid, LidSettings } from './lids';
import { HexHolesSettings, type HexHoleSkip } from './hexholes';
import type { SettingsOverrides } from './edges/settings';

const DEG = Math.PI / 180;

export type EdgeSpec = string | BaseEdge;
export type Callback =
  | ((n: number) => void)
  | Array<((n?: number) => void) | null | undefined>
  | null
  | undefined;

export interface BoxesConfig {
  thickness: number;
  /** Kerf compensation in mm — half the beam width. */
  burn: number;
  /** Gap between parts, in multiples of thickness. */
  spacingFactor: number;
  /** Additional flat gap between parts in mm. */
  spacingExtra: number;
  /** Draw part names on the annotation layer. */
  labels: boolean;
  /** Length of the reference rectangle; 0 disables it. */
  reference: number;
  /** Width of tabs holding parts in the sheet; 0 disables. */
  tabs: number;
  innerCorners: InnerCorners;
  debug: boolean;
  /** Per-edge-family setting overrides, keyed by family name. */
  edgeSettings: Record<string, SettingsOverrides>;
}

export const DEFAULT_CONFIG: BoxesConfig = {
  thickness: 3.0,
  burn: 0.1,
  spacingFactor: 0.5,
  spacingExtra: 0.0,
  labels: true,
  reference: 0,
  tabs: 0.0,
  innerCorners: 'loop',
  debug: false,
  edgeSettings: {},
};

export abstract class Boxes {
  thickness: number;
  burn: number;
  labels: boolean;
  reference: number;
  tabs: number;
  innerCorners: InnerCorners;
  debug: boolean;
  edgeSettings: Record<string, SettingsOverrides>;

  /** Resolved gap between parts, computed in `open()`. */
  spacing = 0;
  private spacingFactor: number;
  private spacingExtra: number;

  surface!: Surface;
  ctx!: Context;
  edges: Record<string, BaseEdge> = {};
  fingerHolesObj!: FingerHoles;
  lidSettings!: LidSettings;
  lidObj!: Lid;
  hexHolesSettings!: HexHolesSettings;

  /** [d, d_nut, h_nut, l, l1] */
  bedBoltSettings: readonly number[] = [3, 5.5, 2, 20, 15];

  /** Collected non-fatal problems, surfaced next to the offending field. */
  warnings: { param?: string; message: string }[] = [];

  constructor(config: Partial<BoxesConfig> = {}) {
    const c = { ...DEFAULT_CONFIG, ...config };
    this.thickness = c.thickness;
    this.burn = c.burn;
    this.labels = c.labels;
    this.reference = c.reference;
    this.tabs = c.tabs;
    this.innerCorners = c.innerCorners;
    this.debug = c.debug;
    this.spacingFactor = c.spacingFactor;
    this.spacingExtra = c.spacingExtra;
    this.edgeSettings = c.edgeSettings ?? {};
  }

  abstract render(): void;

  warn(message: string, param?: string): void {
    if (!this.warnings.some((w) => w.message === message && w.param === param)) {
      this.warnings.push({ message, param });
    }
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  open(): void {
    if (this.ctx) return;

    this.surface = new Surface();
    this.ctx = new Context(this.surface);

    this.ctx.setLineWidth(Math.max(2 * this.burn, 0.05));
    this.setSourceColor(OUTER_CUT);

    this.spacing = 2 * this.burn + this.spacingFactor * this.thickness + this.spacingExtra;
    this.setFont('sans-serif');
    this.buildObjects();

    if (this.reference) {
      this.move(this.reference, 10, 'up', true);
      this.ctx.rectangle(0, 0, this.reference, 10);
      const caption = `${this.reference.toFixed(1)}mm, burn:${this.burn.toFixed(2)}mm`;
      if (this.reference < 80) {
        this.text(caption, this.reference + 5, 5, 0, 'middle left', 6, ANNOTATIONS);
      } else {
        this.text(caption, this.reference / 2.0, 5, 0, 'middle center', 6, ANNOTATIONS);
      }
      this.move(this.reference, 10, 'up');
      this.ctx.stroke();
    }
  }

  close(): Surface {
    this.ctx.stroke();
    return this.surface;
  }

  addPart(part: BaseEdge, name?: string): void {
    if (part.char) this.edges[part.char] = part;
    if (name) (this as unknown as Record<string, unknown>)[name] = part;
  }

  addParts(parts: BaseEdge[]): void {
    for (const p of parts) this.addPart(p);
  }

  private settingsFor(family: string): SettingsOverrides {
    return this.edgeSettings[family] ?? {};
  }

  /** Instantiate the edge families the generators can reference by character. */
  protected buildObjects(): void {
    this.edges = {};
    const t = this.thickness;

    this.addPart(new Edge(this, null));
    this.addPart(new OutSetEdge(this, null));

    new GripSettings(t, true, this.settingsFor('Grip')).edgeObjects(this);

    const fj = new FingerJointSettings(t, true, this.settingsFor('FingerJoint'));
    fj.edgeObjects(this);
    this.fingerHolesObj = new FingerHoles(this, fj);

    new StackableSettings(t, true, this.settingsFor('Stackable')).edgeObjects(this, 'sSšŠ', true, fj);
    new RoundedTriangleEdgeSettings(t, true, this.settingsFor('RoundedTriangleEdge')).edgeObjects(this);
    new MountingSettings(t, true, this.settingsFor('Mounting')).edgeObjects(this);

    this.lidSettings = new LidSettings(t, true, this.settingsFor('Lid'));
    this.lidObj = new Lid(this, this.lidSettings);

    this.hexHolesSettings = new HexHolesSettings(t, true, this.settingsFor('HexHoles'));
  }

  /** Draw the configured lid. Returns false when the lid style is "none". */
  lid(x: number, y: number, edge?: string): boolean {
    return this.lidObj.call(x, y, edge);
  }

  /** Resolve an edge character (or an edge object) to an edge object. */
  getEdge(e: EdgeSpec): BaseEdge {
    if (typeof e !== 'string') return e;
    const found = this.edges[e];
    if (!found) throw new Error(`Unknown edge type: '${e}'`);
    return found;
  }

  makeCompoundEdge(types: EdgeSpec[], lengths: number[]): CompoundEdge {
    return new CompoundEdge(this, types.map((t) => this.getEdge(t)), lengths);
  }

  makeNoopEdge(margin = 0): NoopEdge {
    return new NoopEdge(this, margin);
  }

  // ==========================================================================
  // Context helpers
  // ==========================================================================

  /** Run `fn` with the transform saved and restored around it. */
  savedContext(fn: () => void): void {
    this.ctx.save();
    try {
      fn();
    } finally {
      this.ctx.restore();
    }
  }

  /** Python's `@restore` decorator: run, restore, then reset to the origin. */
  protected withRestore(fn: () => void): void {
    this.savedContext(fn);
    this.ctx.moveTo(0, 0);
  }

  /** Python's `@holeCol` decorator: draw in the inner-cut colour. */
  protected withHoleColor(color: RGB | undefined, fn: () => void): void {
    this.ctx.stroke();
    this.savedContext(() => {
      this.setSourceColor(color ?? INNER_CUT);
      fn();
      this.ctx.stroke();
    });
  }

  setSourceColor(color: RGB): void {
    this.ctx.setSourceRGB(color);
  }

  setFont(style: FontStyle, bold = false, italic = false): void {
    this.ctx.setFont(style, bold, italic);
  }

  getEntry<T>(param: T | T[] | null | undefined, idx: number): T | null {
    if (Array.isArray(param)) return idx < param.length ? (param[idx] as T) : null;
    return (param ?? null) as T | null;
  }

  /**
   * Invoke a part callback at a position on the part.
   * Callbacks are how generators punch holes into otherwise generic walls.
   */
  cc(callback: Callback, number: number, x = 0.0, y?: number, a = 0.0): void {
    if (y === undefined) y = this.burn;

    let fn: ((n?: number) => void) | null | undefined;
    let num: number | null = number;

    if (Array.isArray(callback)) {
      fn = callback[number];
      num = null;
    } else {
      fn = callback as ((n?: number) => void) | null | undefined;
    }

    if (typeof fn === 'function') {
      const f = fn;
      this.savedContext(() => {
        this.moveTo(x, y, a);
        if (num === null) f();
        else f(num);
      });
      this.ctx.moveTo(0, 0);
    }
  }

  /**
   * Shrink a nominal outside measurement to the inner size, accounting for the
   * material the chosen edges consume. This is what the "outside" toggle uses.
   */
  adjustSize(l: number, e1?: EdgeSpec | boolean, e2?: EdgeSpec | boolean): number;
  adjustSize(l: number[], e1?: EdgeSpec | boolean, e2?: EdgeSpec | boolean): number[];
  adjustSize(
    l: number | number[],
    e1: EdgeSpec | boolean = true,
    e2: EdgeSpec | boolean = true,
  ): number | number[] {
    const resolve = (e: EdgeSpec | boolean): BaseEdge | boolean => {
      if (typeof e === 'boolean') return e;
      const found = typeof e === 'string' ? this.edges[e] : e;
      return found ?? Boolean(e);
    };
    const r1 = resolve(e1);
    const r2 = resolve(e2);

    let total: number;
    let walls: number;
    if (Array.isArray(l)) {
      total = l.reduce((a, b) => a + b, 0);
      walls = (l.length - 1) * this.thickness;
    } else {
      total = l;
      walls = 0;
    }

    for (const r of [r1, r2]) {
      if (r instanceof BaseEdge) walls += r.startWidth() + r.margin();
      else if (r) walls += this.thickness;
    }

    if (Array.isArray(l)) {
      const factor = total > 0.0 ? (total - walls) / total : 1.0;
      return l.map((s) => s * factor);
    }
    return l - walls;
  }

  // ==========================================================================
  // Turtle graphics
  // ==========================================================================

  /**
   * Turn by `degrees`, optionally around a radius. This is where kerf
   * compensation happens: the arc radius is grown on outside turns and shrunk
   * on inside turns so the kerf falls outside the finished part.
   */
  corner(degrees: number | [number, number], radius = 0, tabs = 0): void {
    if (Array.isArray(degrees)) {
      [degrees, radius] = degrees;
    }
    const rad = degrees * DEG;

    if (tabs && this.tabs) {
      let r_: number;
      let tabrad: number;
      if (degrees > 0) {
        r_ = radius + this.burn;
        tabrad = this.tabs / Math.max(r_, 0.01);
      } else {
        r_ = radius - this.burn;
        tabrad = -this.tabs / Math.max(r_, 0.01);
      }
      const length = Math.abs(r_ * rad);
      const n = Math.min(tabs, Math.floor(length / (tabs * 3 * this.tabs)));

      if (n) {
        const l = (length - n * this.tabs) / n;
        let lang = (l / r_) / DEG;
        if (degrees < 0) lang = -lang;
        this.corner(lang / 2.0, radius);
        for (let i = 0; i < n - 1; i++) {
          this.moveArc(tabrad / DEG, r_);
          this.corner(lang, radius);
        }
        this.moveArc(tabrad / DEG, r_);
        this.corner(lang / 2.0, radius);
        return;
      }
    }

    // Break big turns into shallower arcs so the bézier approximation stays tight.
    if ((radius > 0.5 * this.burn && Math.abs(degrees) > 36) || Math.abs(degrees) > 100) {
      const steps = Math.floor(Math.abs(degrees) / 36) + 1;
      for (let i = 0; i < steps; i++) this.corner(degrees / steps, radius);
      return;
    }

    if (degrees > 0) {
      this.ctx.arc(0, radius + this.burn, radius + this.burn, -0.5 * Math.PI, rad - 0.5 * Math.PI);
    } else if (radius > this.burn) {
      this.ctx.arcNegative(0, -(radius - this.burn), radius - this.burn, 0.5 * Math.PI, rad + 0.5 * Math.PI);
    } else {
      // Inner corner tighter than the kerf: the beam rounds it for us.
      this.ctx.arcNegative(0, this.burn - radius, this.burn - radius, -0.5 * Math.PI, -0.5 * Math.PI + rad);
    }

    this.continueDirection(rad);
  }

  /** Straight line of `length` mm, optionally broken by holding tabs. */
  edge(length: number, tabs = 0): void {
    this.ctx.moveTo(0, 0);
    if (tabs && this.tabs) {
      if (this.tabs > length) {
        this.ctx.moveTo(length, 0);
      } else {
        const n = Math.min(tabs, Math.max(1, Math.floor(length / (tabs * 3 * this.tabs))));
        const l = (length - n * this.tabs) / n;
        this.ctx.lineTo(0.5 * l, 0);
        for (let i = 0; i < n - 1; i++) {
          this.ctx.moveTo((i + 0.5) * l + this.tabs, 0);
          this.ctx.lineTo((i + 0.5) * l + this.tabs + l, 0);
        }
        if (n === 1) this.ctx.moveTo((n - 0.5) * l + this.tabs, 0);
        else this.ctx.moveTo((n - 0.5) * l + 2 * this.tabs, 0);
        this.ctx.lineTo(length, 0);
      }
    } else {
      this.ctx.lineTo(length, 0);
    }
    const [cx, cy] = this.ctx.getCurrentPoint();
    this.ctx.translate(cx, cy);
  }

  /** Step sideways, perpendicular to the current heading. */
  step(out: number): void {
    if (out > 1e-5) {
      this.corner(-90);
      this.edge(out);
      this.corner(90);
    } else if (out < -1e-5) {
      this.corner(90);
      this.edge(-out);
      this.corner(-90);
    }
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    this.ctx.curveTo(x1, y1, x2, y2, x3, y3);
    const rad = Math.atan2(y3 - y2, x3 - x2);
    this.continueDirection(rad);
  }

  /** Alternating lengths and angles. `[len, tabs]` and `[angle, radius]` pairs are allowed. */
  polyline(...args: Array<number | [number, number]>): void {
    args.forEach((arg, i) => {
      if (i % 2) {
        if (Array.isArray(arg)) this.corner(arg[0], arg[1]);
        else this.corner(arg);
      } else {
        if (Array.isArray(arg)) this.edge(arg[0], arg[1]);
        else this.edge(arg);
      }
    });
  }

  moveTo(x: number, y = 0.0, degrees = 0): void {
    this.ctx.moveTo(0, 0);
    this.ctx.translate(x, y);
    this.ctx.rotate(degrees * DEG);
    this.ctx.moveTo(0, 0);
  }

  moveArc(angle: number, r = 0.0): void {
    if (r < 0) {
      r = -r;
      angle = -angle;
    }
    const rad = angle * DEG;
    if (angle > 0) {
      this.moveTo(r * Math.sin(rad), r * (1 - Math.cos(rad)), angle);
    } else {
      this.moveTo(r * Math.sin(-rad), -r * (1 - Math.cos(-rad)), angle);
    }
  }

  private continueDirection(angle = 0): void {
    const [cx, cy] = this.ctx.getCurrentPoint();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(angle);
  }

  /** Corner between two edges, allowing for how far each sits off the outline. */
  edgeCorner(edge1: EdgeSpec, edge2: EdgeSpec, angle = 90): void {
    const e1 = this.getEdge(edge1);
    const e2 = this.getEdge(edge2);
    this.edge(e2.startWidth() * Math.tan((angle / 2) * DEG));
    this.corner(angle);
    this.edge(e1.endWidth() * Math.tan((angle / 2) * DEG));
  }

  /** Slot for a bed bolt: a keyhole that captures a nut. */
  bedBoltHole(length: number, bedBoltSettings: readonly number[] | null = null, tabs = 0): void {
    const [d, dNut, hNut, l, l1] = (bedBoltSettings ?? this.bedBoltSettings) as [
      number, number, number, number, number,
    ];
    this.edge((length - d) / 2.0, Math.floor(tabs / 2));
    this.corner(90);
    this.edge(l1);
    this.corner(90);
    this.edge((dNut - d) / 2.0);
    this.corner(-90);
    this.edge(hNut);
    this.corner(-90);
    this.edge((dNut - d) / 2.0);
    this.corner(90);
    this.edge(l - l1 - hNut);
    this.corner(-90);
    this.edge(d);
    this.corner(-90);
    this.edge(l - l1 - hNut);
    this.corner(90);
    this.edge((dNut - d) / 2.0);
    this.corner(-90);
    this.edge(hNut);
    this.corner(-90);
    this.edge((dNut - d) / 2.0);
    this.corner(90);
    this.edge(l1);
    this.corner(90);
    this.edge((length - d) / 2.0, tabs - Math.floor(tabs / 2));
  }

  // ==========================================================================
  // Part placement
  // ==========================================================================

  /**
   * Part layout. Called twice per part: once with `before = true` to reserve
   * space and set up the transform, once after drawing to advance the cursor.
   * Returns true when the caller should skip drawing entirely.
   */
  move(x: number, y: number, where: string | null | undefined, before = false, label = ''): boolean {
    const terms = (where ?? '').split(/\s+/).filter(Boolean);
    const dontdraw = before && terms.includes('only');

    x += this.spacing;
    y += this.spacing;

    if (terms.includes('rotated')) {
      [x, y] = [y, x];
    }

    const moves: Record<string, [number, number, boolean | null]> = {
      up: [0, y, false],
      down: [0, -y, true],
      left: [-x, 0, true],
      right: [x, 0, false],
      only: [0, 0, null],
      mirror: [0, 0, null],
      upsidedown: [0, 0, null],
      rotated: [0, 0, null],
    };

    if (!before) {
      this.ctx.stroke();
      this.ctx.restore();
      if (this.labels && label) {
        this.text(label, x / 2, y / 2, 0, 'middle center', 4, ANNOTATIONS);
        this.ctx.stroke();
      }
      if (label) this.ctx.nameCurrentPart(label);
    }

    for (const term of terms) {
      const m = moves[term];
      if (!m) throw new Error(`Unknown direction: '${term}'`);
      const [mx, my, moveBeforePrint] = m;
      if (moveBeforePrint && before) {
        this.moveTo(mx, my);
      } else if ((!moveBeforePrint && !before) || dontdraw) {
        this.moveTo(mx, my);
      }
    }

    if (!dontdraw && before) {
      if (this.debug) {
        this.savedContext(() => {
          this.setSourceColor(ANNOTATIONS);
          this.ctx.rectangle(0, 0, x, y);
        });
      }
      this.ctx.save();
      if (terms.includes('rotated')) {
        this.moveTo(x, 0, 90);
        [x, y] = [y, x];
      }
      if (terms.includes('mirror')) {
        this.moveTo(x, 0);
        this.ctx.scale(-1, 1);
      }
      if (terms.includes('upsidedown')) {
        this.moveTo(0, y);
        this.ctx.scale(1, -1);
      }
      this.moveTo(this.spacing / 2.0, this.spacing / 2.0);
    }
    this.ctx.newPart();

    return dontdraw;
  }

  // ==========================================================================
  // Holes and markings
  // ==========================================================================

  /** Filled disc (drawn as a cut circle). */
  circle(x: number, y: number, r: number): void {
    this.withRestore(() => {
      const rr = r + this.burn;
      this.moveTo(x + rr, y);
      const n = 10;
      const da = (2 * Math.PI) / n;
      let a = 0;
      for (let i = 0; i < n; i++) {
        this.ctx.arc(-rr, 0, rr, a, a + da);
        a += da;
      }
      this.ctx.stroke();
    });
  }

  hole(x: number, y: number, r = 0.0, d = 0.0, tabs = 0, color?: RGB): void {
    this.withRestore(() =>
      this.withHoleColor(color, () => {
        if (!r) r = d / 2.0;
        if (r < this.burn) r = this.burn + 1e-9;
        const r_ = r - this.burn;
        this.moveTo(x + r_, y, -90);
        this.corner(-360, r, tabs);
      }),
    );
  }

  rectangularHole(
    x: number,
    y: number,
    dx: number,
    dy: number,
    r = 0,
    centerX = true,
    centerY = true,
    color?: RGB,
  ): void {
    this.withRestore(() =>
      this.withHoleColor(color, () => {
        r = Math.min(r, dx / 2.0, dy / 2.0);
        const xStart = centerX ? x : x + dx / 2.0;
        const yStart = centerY ? y - dy / 2.0 : y;
        this.moveTo(xStart, yStart + this.burn, 180);
        // Start on an edge so inner-corner handling has a straight run to work with.
        this.edge(dx / 2.0 - r);
        for (const d of [dy, dx, dy, dx / 2.0 + r]) {
          this.corner(-90, r);
          this.edge(d - 2 * r);
        }
      }),
    );
  }

  regularPolygonHole(
    x: number,
    y: number,
    r = 0.0,
    d = 0.0,
    n = 6,
    a = 0.0,
    tabs = 0,
    cornerRadius = 0.0,
    color?: RGB,
  ): void {
    this.withRestore(() =>
      this.withHoleColor(color, () => {
        if (!r) r = d / 2.0;
        if (n === 0) {
          this.hole(x, y, r, 0, tabs);
          return;
        }
        if (r < this.burn) r = this.burn + 1e-9;
        const r_ = r - this.burn;
        if (cornerRadius < this.burn) cornerRadius = this.burn;
        const cr_ = cornerRadius - this.burn;

        const sideLength = 2 * r_ * Math.sin(Math.PI / n);
        const s = Math.sqrt(2 * cr_ ** 2 * (1 - Math.cos((2 * Math.PI) / n)));
        const b = (Math.sin(Math.PI / n) / Math.sin((2 * Math.PI) / n)) * s;
        const flatSideLength = sideLength - 2 * b;

        this.moveTo(x, y, a);
        this.moveTo(r_, 0, 90 + 180 / n);
        this.moveTo(b, 0, 0);
        for (let i = 0; i < n; i++) {
          this.edge(flatSideLength);
          this.corner(360 / n, cr_);
        }
      }),
    );
  }

  /**
   * Pear-shaped hole to hang a part on a screw: a head-sized opening that
   * narrows to a shaft-sized slot. Total height is 1.5 * dShaft + dHead.
   */
  mountingHole(x: number, y: number, dShaft: number, dHead = 0.0, angle = 0, tabs = 0, color?: RGB): void {
    // Below the kerf width there is nothing to cut.
    if (dShaft < 2 * this.burn) return;
    if (!dHead || dHead < 2 * this.burn) {
      this.hole(x, y, 0, dShaft, tabs, color);
      return;
    }

    this.withRestore(() =>
      this.withHoleColor(color, () => {
        const rs = dShaft / 2;
        const rh = dHead / 2;
        this.moveTo(x, y, angle);
        this.moveTo(0, rs - this.burn, 0);
        this.corner(-180, rs, tabs);
        this.edge(2 * rs, tabs);
        const a = Math.asin(rs / rh) / DEG;
        this.corner(90 - a, 0, tabs);
        this.corner(-360 + 2 * a, rh, tabs);
        this.corner(90 - a, 0, tabs);
        this.edge(2 * rs, tabs);
      }),
    );
  }

  /** Finger slots at an arbitrary position and angle on the current part. */
  fingerHolesAt(
    x: number,
    y: number,
    length: number,
    angle = 90,
    bedBolts: BoltPolicy | null = null,
    bedBoltSettings: readonly number[] | null = null,
  ): void {
    this.fingerHolesObj.call(x, y, length, angle, bedBolts, bedBoltSettings);
  }

  /** Slots forming a rectangle, for a box inside a box. */
  fingerHoleRectangle(dx: number, dy: number, x = 0, y = 0, angle = 0, outside = false): void {
    const t = this.thickness;
    const d = outside ? t : 0;
    this.withRestore(() => {
      this.moveTo(x, y, angle);
      this.fingerHolesAt(-dx / 2, -dy / 2 + d / 2, dx - d, 0);
      this.fingerHolesAt(-dx / 2, dy / 2 - d / 2, dx - d, 0);
      this.fingerHolesAt(-dx / 2 + d / 2, -dy / 2, dy - d, 90);
      this.fingerHolesAt(dx / 2 - d / 2, -dy / 2, dy - d, 90);
    });
  }

  /**
   * A staggered grid of round holes filling an `x` by `y` area.
   *
   * boxes.py has no `@restore` on this one, so it leaves the cursor where the
   * last hole put it — callers that care wrap it themselves.
   */
  hexHolesRectangle(
    x: number,
    y: number,
    settings?: HexHolesSettings,
    skip?: HexHoleSkip,
  ): void {
    const s = settings ?? this.hexHolesSettings;
    const r = s.diameter / 2;
    const b = s.distance;

    const w = r + b / 2.0;
    const dist = w * Math.cos(Math.PI / 6.0);

    // How many half circles fit, plus the two that hang over the edges.
    const cx = Math.floor((x - 2 * r) / w) + 2;
    const cy = Math.floor((y - 2 * r) / dist) + 2;

    // What is left over at the sides, so the grid ends up centred.
    const lx = (x - (2 * r + (cx - 2) * w)) / 2.0;
    const ly = (y - (2 * r + Math.floor(cy / 2) * 2 * dist - 2 * dist)) / 2.0;

    for (let i = 0; i < Math.floor(cy / 2); i++) {
      for (let j = 0; j < Math.floor((cx - (i % 2)) / 2); j++) {
        let px = 2 * j * w + r + lx;
        const py = i * 2 * dist + r + ly;
        if (i % 2) px += w;
        if (skip && skip(x, y, r, b, px, py)) continue;
        this.hole(px, py, r);
      }
    }
  }

  /**
   * Text, drawn on the annotation layer by default so it is never cut.
   * `align` combines (top|middle|bottom) with (left|center|right).
   *
   * The coordinate system is restored afterwards: without that, drawing a part
   * label would leave the cursor at the label and every part placed after it
   * would be offset.
   */
  text(
    text: string,
    x = 0,
    y = 0,
    angle = 0,
    align = '',
    fontsize = 10,
    color: RGB = Color.BLACK,
    font = 'Arial',
  ): void {
    this.withRestore(() => {
      this.moveTo(x, y, angle);
      const lines = text.split('\n');
      const height = lines.length * fontsize + (lines.length - 1) * 0.4 * fontsize;

      let halign: TextAlign = 'left';
      const vmoves: Record<string, number> = { top: -height, middle: -0.5 * height, bottom: 0 };
      const hmoves: Record<string, TextAlign> = { left: 'left', center: 'middle', right: 'end' };

      for (const a of align.split(/\s+/).filter(Boolean)) {
        if (a in hmoves) halign = hmoves[a]!;
        else if (a in vmoves) this.moveTo(0, vmoves[a]!);
        else throw new Error(`Unknown alignment: ${align}`);
      }

      for (const line of [...lines].reverse()) {
        this.ctx.showText(line, { fs: fontsize, align: halign, rgb: color, font });
        this.moveTo(0, 1.4 * fontsize);
      }
    });
  }

  // ==========================================================================
  // Walls
  // ==========================================================================

  /**
   * The everyday part: a rectangle whose four sides can each be any edge type.
   * Edges run counter-clockwise starting at the bottom.
   */
  rectangularWall(
    x: number,
    y: number,
    edges: string | EdgeSpec[] = 'eeee',
    opts: {
      ignoreWidths?: number[];
      bedBolts?: (BoltPolicy | null)[] | BoltPolicy | null;
      bedBoltSettings?: readonly number[][] | readonly number[] | null;
      callback?: Callback;
      move?: string | null;
      label?: string;
    } = {},
  ): void {
    const { ignoreWidths = [], bedBolts = null, bedBoltSettings = null, callback, move, label = '' } = opts;

    const specs = typeof edges === 'string' ? Array.from(edges) : edges;
    if (specs.length !== 4) throw new Error('four edges required');
    const e = specs.map((s) => this.getEdge(s));
    const ee = [...e, ...e]; // wrap around

    const overallwidth = x + e[3]!.spacing() + e[1]!.spacing();
    const overallheight = y + e[0]!.spacing() + e[2]!.spacing();

    if (this.move(overallwidth, overallheight, move, true)) return;

    if (!ignoreWidths.includes(7)) this.moveTo(e[3]!.spacing());
    this.moveTo(0, e[0]!.margin());

    const lengths = [x, y, x, y];
    for (let i = 0; i < 4; i++) {
      let l = lengths[i]!;
      this.cc(callback, i, 0, ee[i]!.startWidth() + this.burn);
      let e1 = ee[i]!;
      let e2 = ee[i + 1]!;

      if (ignoreWidths.includes(2 * i - 1) || ignoreWidths.includes(2 * i - 1 + 8)) {
        l += ee[(i + 3) % 4]!.endWidth();
      }
      if (ignoreWidths.includes(2 * i)) {
        l += ee[i + 1]!.startWidth();
        e2 = this.edges['e']!;
      }
      if (ignoreWidths.includes(2 * i + 1)) {
        e1 = this.edges['e']!;
      }

      ee[i]!.call(l, {
        bedBolts: this.getEntry(bedBolts as BoltPolicy | BoltPolicy[] | null, i),
        bedBoltSettings: this.getEntry(bedBoltSettings as never, i),
      });
      this.edgeCorner(e1, e2, 90);
    }

    this.move(overallwidth, overallheight, move, false, label);
  }

  /** Wall with different heights at left and right, joined by a straight slope. */
  trapezoidWall(
    w: number,
    h0: number,
    h1: number,
    edges: string | EdgeSpec[] = 'eeee',
    opts: { callback?: Callback; move?: string | null; label?: string } = {},
  ): void {
    const { callback, move, label = '' } = opts;
    const specs = typeof edges === 'string' ? Array.from(edges) : edges;
    const e = specs.map((s) => this.getEdge(s));

    const overallwidth = w + e[e.length - 1]!.spacing() + e[1]!.spacing();
    const overallheight = Math.max(h0, h1) + e[0]!.spacing() + e[2]!.spacing();

    if (this.move(overallwidth, overallheight, move, true)) return;

    const a = Math.atan((h1 - h0) / w) / DEG;
    const l = Math.sqrt((h0 - h1) ** 2 + w ** 2);

    this.moveTo(e[e.length - 1]!.spacing(), e[0]!.margin());
    this.cc(callback, 0, 0, e[0]!.startWidth());
    e[0]!.call(w);
    this.edgeCorner(e[0]!, e[1]!, 90);
    this.cc(callback, 1, 0, e[1]!.startWidth());
    e[1]!.call(h1);
    this.edgeCorner(e[1]!, this.edges['e']!, 90);
    this.corner(a);
    this.cc(callback, 2);
    e[2]!.call(l);
    this.corner(-a);
    this.edgeCorner(this.edges['e']!, e[e.length - 1]!, 90);
    this.cc(callback, 3, 0, e[e.length - 1]!.startWidth());
    e[3]!.call(h0);
    this.edgeCorner(e[e.length - 1]!, e[0]!, 90);

    this.move(overallwidth, overallheight, move, false, label);
  }

  /** Trapezoid whose sloped top can be rounded — the classic console side. */
  trapezoidSideWall(
    w: number,
    h0: number,
    h1: number,
    edges: string | EdgeSpec[] = 'eeee',
    opts: { radius?: number; callback?: Callback; move?: string | null; label?: string } = {},
  ): void {
    const { radius = 0.0, callback, move, label = '' } = opts;
    const specs = typeof edges === 'string' ? Array.from(edges) : edges;
    const e = specs.map((s) => this.getEdge(s));

    const overallwidth = w + e[e.length - 1]!.spacing() + e[1]!.spacing();
    const overallheight = Math.max(h0, h1) + e[0]!.spacing();

    if (this.move(overallwidth, overallheight, move, true)) return;

    const r = Math.min(radius, Math.abs(h0 - h1));
    let ws = w - r;
    if (h0 > h1) ws += e[1]!.endWidth();
    else ws += e[3]!.startWidth();
    const hs = Math.abs(h1 - h0) - r;
    const a = Math.atan(hs / ws) / DEG;
    const l = Math.sqrt(ws ** 2 + hs ** 2);

    this.moveTo(e[e.length - 1]!.spacing(), e[0]!.margin());
    this.cc(callback, 0, 0, e[0]!.startWidth());
    e[0]!.call(w);
    this.edgeCorner(e[0]!, e[1]!, 90);
    this.cc(callback, 1, 0, e[1]!.startWidth());
    e[1]!.call(h1);

    if (h0 > h1) {
      this.polyline(0, [90 - a, r]);
      this.cc(callback, 2);
      e[2]!.call(l);
      this.polyline(0, [a, r], e[3]!.startWidth(), 90);
    } else {
      this.polyline(0, 90, e[1]!.endWidth(), [a, r]);
      this.cc(callback, 2);
      e[2]!.call(l);
      this.polyline(0, [90 - a, r]);
    }
    this.cc(callback, 3, 0, e[e.length - 1]!.startWidth());
    e[3]!.call(h0);
    this.edgeCorner(e[e.length - 1]!, e[0]!, 90);

    this.move(overallwidth, overallheight, move, false, label);
  }

  /** Measures of a regular polygon: returns [radius, apothem, side]. */
  regularPolygon(
    corners = 3,
    radius?: number,
    h?: number,
    side?: number,
  ): [number, number, number] {
    if (radius) {
      side = 2 * Math.sin((180.0 / corners) * DEG) * radius;
      h = radius * Math.cos((180.0 / corners) * DEG);
    } else if (h) {
      side = 2 * Math.tan((180.0 / corners) * DEG) * h;
      radius = Math.sqrt((side / 2) ** 2 + h ** 2);
    } else if (side) {
      h = 0.5 * side * Math.tan((90 - 180.0 / corners) * DEG);
      radius = Math.sqrt((side / 2) ** 2 + h ** 2);
    }
    return [radius!, h!, side!];
  }

  regularPolygonWall(
    corners = 3,
    opts: {
      r?: number;
      h?: number;
      side?: number;
      edges?: string | EdgeSpec[];
      hole?: number;
      callback?: Callback;
      move?: string | null;
      label?: string;
    } = {},
  ): void {
    const { r: rIn, h: hIn, side: sideIn, edges = 'e', hole, callback, move, label = '' } = opts;
    const [r, h, side] = this.regularPolygon(corners, rIn, hIn, sideIn);

    let specs: EdgeSpec[] = typeof edges === 'string' ? Array.from(edges) : edges;
    if (specs.length === 1) specs = Array(corners).fill(specs[0]!);
    const e = specs.map((s) => this.getEdge(s));
    const ee = [...e, ...e];

    let th: number;
    if (corners % 2) {
      th =
        r +
        h +
        ee[0]!.spacing() +
        Math.max(ee[Math.floor(corners / 2)]!.spacing(), ee[Math.floor(corners / 2) + 1]!.spacing()) /
          Math.sin((90 - 180 / corners) * DEG);
    } else {
      th = 2 * h + ee[0]!.spacing() + ee[Math.floor(corners / 2)]!.spacing();
    }

    let tw = 0;
    for (let i = 0; i < corners; i++) {
      const ang = (180 + 360 * i) / corners;
      tw = Math.max(
        tw,
        2 *
          Math.abs(
            Math.sin(ang * DEG) *
              (r + Math.max(ee[i]!.spacing(), ee[i + 1]!.spacing()) / Math.sin((90 - 180 / corners) * DEG)),
          ),
      );
    }

    if (this.move(tw, th, move, true)) return;

    this.moveTo(0.5 * tw - 0.5 * side, ee[0]!.margin());

    if (hole) this.hole(side / 2, h + ee[0]!.startWidth() + this.burn, hole / 2);
    this.cc(callback, 0, side / 2, h + ee[0]!.startWidth() + this.burn);
    for (let i = 0; i < corners; i++) {
      this.cc(callback, i + 1, 0, ee[i]!.startWidth() + this.burn);
      ee[i]!.call(side);
      this.edgeCorner(ee[i]!, ee[i + 1]!, 360.0 / corners);
    }

    this.move(tw, th, move, false, label);
  }

  /** Right triangle, used for brackets and shelf supports. */
  rectangularTriangle(
    x: number,
    y: number,
    edges: string | EdgeSpec[] = 'eee',
    opts: {
      r?: number;
      num?: number;
      bedBolts?: (BoltPolicy | null)[] | BoltPolicy | null;
      bedBoltSettings?: readonly number[][] | readonly number[] | null;
      callback?: Callback;
      move?: string | null;
      label?: string;
    } = {},
  ): void {
    const { r: rIn = 0.0, num = 1, bedBolts = null, bedBoltSettings = null, callback, move, label = '' } = opts;

    const specs = typeof edges === 'string' ? Array.from(edges) : edges;
    const e = specs.map((s) => this.getEdge(s));
    if (e.length === 2) e.push(this.edges['e']!);
    if (e.length !== 3) throw new Error('two or three edges required');
    if (num <= 0) return;

    const r = Math.min(rIn, x, y);
    const a = Math.atan2(y - r, x - r);
    const alpha = a / DEG;

    let width: number;
    if (a > 0) {
      width = x + (e[2]!.spacing() + this.spacing) / Math.sin(a) + e[1]!.spacing() + this.spacing;
    } else {
      width = x + (e[2]!.spacing() + this.spacing) + e[1]!.spacing() + this.spacing;
    }
    let height = y + e[0]!.spacing() + e[2]!.spacing() * Math.cos(a) + 2 * this.spacing + this.spacing;
    if (num > 1) width = 2 * width - x + r - this.spacing;

    const dx = width - x - e[1]!.spacing() - this.spacing / 2;
    const dy = e[0]!.margin() + this.spacing / 2;

    const overallwidth = width * (Math.floor(num / 2) + (num % 2)) - this.spacing;
    const overallheight = height - this.spacing;

    if (this.move(overallwidth, overallheight, move, true)) return;

    if (this.debug) this.rectangularHole(width / 2, height / 2, width, height);

    this.moveTo(dx - this.spacing / 2, dy - this.spacing / 2);

    for (let n = 0; n < num; n++) {
      const lengths = [x, y];
      for (let i = 0; i < 2; i++) {
        this.cc(callback, i, 0, e[i]!.startWidth() + this.burn);
        e[i]!.call(lengths[i]!, {
          bedBolts: this.getEntry(bedBolts as BoltPolicy | BoltPolicy[] | null, i),
          bedBoltSettings: this.getEntry(bedBoltSettings as never, i),
        });
        if (i === 0) this.edgeCorner(e[i]!, e[i + 1]!, 90);
      }
      this.edgeCorner(e[1]!, 'e', 90);

      this.corner(alpha, r);
      this.cc(callback, 2);
      this.step(e[2]!.startWidth());
      e[2]!.call(Math.sqrt((x - r) ** 2 + (y - r) ** 2));
      this.step(-e[2]!.endWidth());
      this.corner(90 - alpha, r);
      this.edge(e[0]!.startWidth());
      this.corner(90);
      this.ctx.stroke();

      this.moveTo(width - 2 * dx, height - 2 * dy, 180);
      if (n % 2) this.moveTo(width);
    }

    this.move(overallwidth, overallheight, move, false, label);
  }

  /**
   * Place `n` copies of the same part in rows of `width`.
   * `part` must accept a move directive and otherwise draw itself.
   */
  partsMatrix(
    n: number,
    width: number,
    move: string | null | undefined,
    part: (move: string) => void,
  ): void {
    if (n <= 0) return;
    if (!width) width = n;

    const rows = Math.floor(n / width) + (n % width ? 1 : 0);
    const terms = (move ?? '').split(/\s+/).filter(Boolean);

    // Reserve space by moving before drawing anything.
    for (const m of terms) {
      if (m === 'left') for (let i = 0; i < width; i++) part('left only');
      if (m === 'down') for (let i = 0; i < rows; i++) part('down only');
    }

    for (let i = 0; i < rows; i++) {
      this.savedContext(() => {
        for (let j = 0; j < width; j++) {
          if (terms.includes('only')) break;
          if (width * i + j >= n) break;
          part('right');
        }
      });
      part('up only');
    }

    if (!terms.includes('up')) {
      for (let i = 0; i < rows; i++) part('down only');
    }
    if (terms.includes('right')) {
      for (let i = 0; i < width; i++) part('right only');
    }
  }

  /** Wrap a drawing callback so it is mirrored across the y axis. */
  mirrorX(f: () => void, offset = 0.0): () => void {
    return () => {
      this.moveTo(offset, 0);
      this.savedContext(() => {
        this.ctx.scale(-1, 1);
        f();
      });
    };
  }

  /** Wrap a drawing callback so it is mirrored across the x axis. */
  mirrorY(f: () => void, offset = 0.0): () => void {
    return () => {
      this.moveTo(0, offset);
      this.savedContext(() => {
        this.ctx.scale(1, -1);
        f();
      });
    };
  }

  extents(): Extents {
    return this.surface.extents();
  }
}
