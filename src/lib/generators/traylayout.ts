/**
 * Tray layout — ported from boxes.py `boxes/generators/traylayout.py`
 * (the `TrayLayout` class).
 *
 * A tray whose compartment grid is described by a small text drawing rather
 * than by numbers: every wall and every floor panel can be removed
 * individually, which is what separates this from TypeTray's uniform grid.
 * Walls that survive are welded into single parts wherever they run
 * uninterrupted, so an L-shaped compartment costs no more pieces than a
 * rectangular one.
 *
 * Upstream this is step 2 of a two-step process — `TrayLayoutFile` emits the
 * skeleton text from `sx`/`sy` and the user edits it before running this
 * generator. boxes.py leaves a hook for collapsing the two (`generate_layout`,
 * `traylayout.py:170`), and that is what this port does: an empty layout box
 * means "full grid from the compartment sizes", so the generator is usable
 * without ever touching the text.
 */
import { Boxes, type BoxesConfig, type Callback, type EdgeSpec } from '../boxes';
import { CrossingFingerHoleEdge } from '../edges/crossingfingerhole';
import { Slot } from '../edges/slots';
import { ANNOTATIONS } from '../geom/colors';
import { LID_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

interface TrayLayoutOptions {
  h: number;
  hi: number;
  outside: boolean;
  /** The layout sketch itself; `sx`/`sy` only ever seed it. */
  layout: string;
}

const sum = (v: number[]): number => v.reduce((a, x) => a + x, 0);

/**
 * Bottom edge of a back-to-front wall → its top edge. These walls hang from
 * above, so their slots sit on the top edge while the bottom carries the
 * joints; "S" is boxes.py's marker for a crossing that wants a plain outset
 * edge at the bottom and a slot above.
 */
const UPPER_EDGE: Record<string, string> = {
  f: 'e',
  s: 's',
  S: 's',
  e: 'e',
  E: 'e',
  C: 'e',
  D: 'e',
};

/** Python-style indexing, where -1 is the last entry. base_plate relies on it. */
const at = <T,>(v: T[], i: number): T | undefined => v[i < 0 ? v.length + i : i];

/**
 * The skeleton layout for a full grid — `TrayLayoutFile.fillDefault` plus its
 * `__str__`, which is the exact text upstream hands the user to edit.
 */
export function defaultLayout(sx: number[], sy: number[]): string {
  const lines: string[] = [];
  sx.forEach((x, i) => lines.push(' |'.repeat(i) + ` ,> ${x.toFixed(1)}mm`));
  const hline = '+' + sx.map(() => '-+').join('');
  for (const y of sy) {
    lines.push(hline);
    lines.push(sx.map(() => '| ').join('') + `| ${y.toFixed(1)}mm`);
  }
  lines.push(hline);
  return lines.join('\n') + '\n';
}

class TrayLayout extends Boxes {
  private h: number;
  private hi: number;

  /** Compartment widths and depths, read out of the layout text. */
  private x: number[] = [];
  private y: number[] = [];
  /** `hwalls[row][col]`: is there a wall running along x here? */
  private hwalls: boolean[][] = [];
  /** `vwalls[row][col]`: is there a wall running along y here? */
  private vwalls: boolean[][] = [];
  /** `floors[row][col]`, padded right and bottom with a false column/row. */
  private floors: boolean[][] = [];

  private edgeC!: CrossingFingerHoleEdge;
  private edgeD!: CrossingFingerHoleEdge;

  constructor(
    private o: TrayLayoutOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.h = o.h;
    this.hi = o.hi;
  }

  // ==========================================================================
  // The layout mini-language
  // ==========================================================================

  private parse(input: string[]): void {
    const x: number[] = [];
    const y: number[] = [];
    const hwalls: boolean[][] = [];
    const vwalls: boolean[][] = [];
    const floors: boolean[][] = [];

    const sizeRe = /^( \|)* ,>\s*(\d*\.?\d+)\s*mm\s*/;
    const rowRe = /^([ |][ xX])+[ |]\s*(\d*\.?\d+)\s*mm\s*/;

    for (let nr = 0; nr < input.length; nr++) {
      // Textareas hand back CRLF; boxes.py only ever reads LF files.
      const line = input[nr]!.replace(/\r$/, '');
      if (!line || line[0] === '#') continue;

      const m = sizeRe.exec(line);
      if (m) {
        x.push(parseFloat(m[2]!));
        continue;
      }

      const width = Math.min(line.length, x.length * 2 + 1);

      if (line[0] === '+') {
        const w: boolean[] = [];
        for (let i = 0; i < width; i++) {
          // Odd columns are walls, even ones the "+" crossings. boxes.py
          // ignores anything else rather than rejecting the line.
          if (i % 2) {
            if (line[i] === ' ') w.push(false);
            else if (line[i] === '-') w.push(true);
          }
        }
        hwalls.push(w);
      }

      if (line[0] === ' ' || line[0] === '|') {
        const w: boolean[] = [];
        const f: boolean[] = [];
        for (let i = 0; i < width; i++) {
          const c = line[i]!;
          if (i % 2) {
            if (c === 'x' || c === 'X') f.push(false);
            else if (c === ' ') f.push(true);
            else
              throw new Error(
                `Can't parse line ${nr + 1} in layout: expected " ", "x" or "X" for char #${i + 1}`,
              );
          } else {
            if (c === ' ') w.push(false);
            else if (c === '|') w.push(true);
            else
              throw new Error(
                `Can't parse line ${nr + 1} in layout: expected " " or "|" for char #${i + 1}`,
              );
          }
        }
        floors.push(f);
        vwalls.push(w);

        const rm = rowRe.exec(line);
        if (!rm) throw new Error(`Can't parse line ${nr + 1} in layout: can't read height of the row`);
        y.push(parseFloat(rm[2]!));
      }
    }

    const lx = x.length;
    const ly = y.length;

    if (lx === 0) throw new Error('Need more than one wall in x direction');
    if (ly === 0) throw new Error('Need more than one wall in y direction');
    if (hwalls.length !== ly + 1)
      throw new Error(
        `Wrong number of horizontal wall lines: ${hwalls.length} (${ly + 1} expected)`,
      );
    hwalls.forEach((walls, nr) => {
      if (walls.length !== lx)
        throw new Error(
          `Wrong number of horizontal walls in line ${nr}: ${walls.length} (${lx} expected)`,
        );
    });
    if (vwalls.length !== ly)
      throw new Error(`Wrong number of vertical wall lines: ${vwalls.length} (${ly} expected)`);
    vwalls.forEach((walls, nr) => {
      if (walls.length !== lx + 1)
        throw new Error(
          `Wrong number of vertical walls in line ${nr}: ${walls.length} (${lx + 1} expected)`,
        );
    });

    this.x = x;
    this.y = y;
    this.hwalls = hwalls;
    this.vwalls = vwalls;
    this.floors = floors;
    // A floorless column on the right and row at the bottom, so the border
    // needs no special casing: index -1 wraps onto them, Python-style.
    for (const row of floors) row.push(false);
    floors.push(new Array<boolean>(lx + 1).fill(false));
  }

  /** `self.floors[y][x]` with Python's negative indices. */
  private floor(y: number, x: number): boolean {
    return at(at(this.floors, y) ?? [], x) ?? false;
  }

  /** Number of vertical walls at a crossing. */
  private vWalls(x: number, y: number): number {
    let result = 0;
    if (y > 0 && this.vwalls[y - 1]![x]) result += 1;
    if (y < this.y.length && this.vwalls[y]![x]) result += 1;
    return result;
  }

  /** Number of horizontal walls at a crossing. */
  private hWalls(x: number, y: number): number {
    let result = 0;
    if (x > 0 && this.hwalls[y]![x - 1]) result += 1;
    if (x < this.x.length && this.hwalls[y]![x]) result += 1;
    return result;
  }

  /** Is there floor under a vertical wall? */
  private vFloor(x: number, y: number): boolean {
    if (y >= this.y.length) return false;
    return (x > 0 && this.floor(y, x - 1)) || (x < this.x.length && this.floor(y, x));
  }

  /** Is there floor under a horizontal wall? */
  private hFloor(x: number, y: number): boolean {
    if (x >= this.x.length) return false;
    return (y > 0 && this.floor(y - 1, x)) || (y < this.y.length && this.floor(y, x));
  }

  // ==========================================================================
  // Drawing helpers
  // ==========================================================================

  /** boxes.py decorates both of these with @restore. */
  private edgeAt(edge: EdgeSpec, x: number, y: number, length: number, angle = 0): void {
    this.withRestore(() => {
      this.moveTo(x, y, angle);
      this.getEdge(edge).call(length);
    });
  }

  private cornerAt(x: number, y: number, length: number, angle = 0): void {
    this.withRestore(() => {
      this.moveTo(x, y, angle);
      this.polyline(length, 90, length);
    });
  }

  private prepare(): void {
    this.parse(this.o.layout.split('\n'));

    if (this.o.outside) {
      this.x = this.adjustSize(this.x);
      this.y = this.adjustSize(this.y);
      this.h = this.adjustSize(this.h, true, false);
      if (this.hi) this.hi = this.adjustSize(this.hi, true, false);
    }

    this.hi = this.hi || this.h;
    // Rebinding "s" clobbers the stackable-feet edge for the rest of the
    // render, exactly as boxes.py does. Nothing here asks for feet — the
    // over-the-top lid uses "š" — so only the wall slots see it.
    this.edges['s'] = new Slot(this, this.hi / 2.0);
    this.edgeC = new CrossingFingerHoleEdge(this, this.hi);
    this.edgeD = new CrossingFingerHoleEdge(this, this.hi, this.thickness);
    this.edges['C'] = this.edgeC;
    this.edges['D'] = this.edgeD;
  }

  /** Which compartment each stretch of a wall belongs to, on the anno layer. */
  private wallLabelsCB(start: number, end: number, row: number, alongX = true): void {
    if (!this.labels) return;
    const sx = alongX ? this.x : this.y;
    let posx = 0;
    for (let pos = start; pos < end; pos++) {
      posx += sx[pos]! / 2;
      this.text(
        alongX ? `x ${pos + 1}/${row + 1}` : `y ${row + 1}/${pos + 1}`,
        posx,
        0,
        0,
        'center',
        2 * this.thickness,
        ANNOTATIONS,
      );
      posx += sx[pos]! / 2 + this.thickness;
    }
  }

  // ==========================================================================
  // Parts
  // ==========================================================================

  private walls(): void {
    const lx = this.x.length;
    const ly = this.y.length;
    const t = this.thickness;

    let le_f: EdgeSpec = 'f';
    let re_f: EdgeSpec = 'f';
    let ole_f: EdgeSpec = 'f';
    let ore_f: EdgeSpec = 'f';
    let le_F: EdgeSpec = 'F';
    let re_F: EdgeSpec = 'F';
    let ole_F: EdgeSpec = 'F';
    let ore_F: EdgeSpec = 'F';

    if (this.hi > this.h) {
      // If hi is bigger limit finger joints at the outside to h.
      le_f = this.makeCompoundEdge(['e', 'f'], [this.hi - this.h, this.h]);
      re_f = this.makeCompoundEdge(['f', 'e'], [this.h, this.hi - this.h]);
      le_F = this.makeCompoundEdge(['e', 'F'], [this.hi - this.h, this.h]);
      re_F = this.makeCompoundEdge(['F', 'e'], [this.h, this.hi - this.h]);
    } else if (this.hi < this.h) {
      // If hi is smaller limit the finger joint in the outside walls to hi.
      ole_f = this.makeCompoundEdge(['E', 'f'], [this.h - this.hi, this.hi]);
      ore_f = this.makeCompoundEdge(['f', 'E'], [this.hi, this.h - this.hi]);
      ole_F = this.makeCompoundEdge(['E', 'F'], [this.h - this.hi, this.hi]);
      ore_F = this.makeCompoundEdge(['F', 'E'], [this.hi, this.h - this.hi]);
    }

    this.savedContext(() => {
      // Walls running left to right.
      for (let y = 0; y <= ly; y++) {
        let h: number;
        if (y === 0 || y === ly) {
          // Limit finger holes to h on the outside.
          h = this.h;
          this.edgeC.height = Math.min(this.h, this.hi);
          this.edgeD.height = Math.min(this.h, this.hi);
        } else {
          h = this.hi;
          this.edgeC.height = this.hi;
          this.edgeD.height = this.hi;
        }

        let start = 0;
        let end = 0;
        let piece = 0;

        while (end < lx) {
          const lengths: number[] = [];
          const edges: string[] = [];

          while (start < lx && !this.hwalls[y]![start]) start += 1;
          if (start === lx) break;

          end = start;

          while (end < lx && this.hwalls[y]![end]) {
            edges.push(this.hFloor(end, y) ? 'f' : 'E');
            lengths.push(this.x[end]!);
            // A crossing with no floor either side has nothing to join to, so
            // the wall passes straight through instead of slotting in.
            if (!this.hFloor(end, y) && !this.hFloor(end + 1, y)) {
              edges.push('EDs'[this.vWalls(end + 1, y)]!);
            } else {
              edges.push('eCs'[this.vWalls(end + 1, y)]!);
            }
            lengths.push(t);
            end += 1;
          }

          // Remove the last "slot": the wall ends here, it does not cross.
          lengths.pop();
          edges.pop();

          const le: EdgeSpec =
            start === 0 && y !== 0 && y !== ly
              ? le_f
              : start > 0 && (y === 0 || y === ly)
                ? ole_f
                : 'f';
          const re: EdgeSpec =
            end === lx && y !== 0 && y !== ly
              ? re_f
              : end < lx && (y === 0 || y === ly)
                ? ore_f
                : 'f';

          const [cbStart, cbEnd] = [start, end];
          piece += 1;
          this.rectangularWall(
            sum(lengths),
            h,
            [
              this.makeCompoundEdge(edges, lengths),
              this.vWalls(end, y) ? re : 'e',
              'e',
              this.vWalls(start, y) ? le : 'e',
            ],
            {
              callback: [() => this.wallLabelsCB(cbStart, cbEnd, y)],
              move: 'right',
              label: `Wall x${y + 1}${piece > 1 ? `.${piece}` : ''}`,
            },
          );
          start = end;
        }
      }
    });

    this.rectangularWall(10, Math.max(this.h, this.hi), 'ffef', { move: 'up only' });

    this.savedContext(() => {
      // Walls running back to front. These slot the opposite way, from the top
      // down, so the two sets interlock into an egg crate.
      for (let x = 0; x <= lx; x++) {
        let h: number;
        if (x === 0 || x === lx) {
          h = this.h;
          this.edgeC.height = Math.min(this.h, this.hi);
          this.edgeD.height = Math.min(this.h, this.hi);
        } else {
          h = this.hi;
          this.edgeC.height = this.hi;
          this.edgeD.height = this.hi;
        }

        let start = 0;
        let end = 0;
        let piece = 0;

        while (end < ly) {
          const lengths: number[] = [];
          let edges: string[] = [];

          while (start < ly && !this.vwalls[start]![x]) start += 1;
          if (start === ly) break;

          end = start;

          while (end < ly && this.vwalls[end]![x]) {
            edges.push(this.vFloor(x, end) ? 'f' : 'E');
            lengths.push(this.y[end]!);
            if (!this.vFloor(x, end) && !this.vFloor(x, end + 1)) {
              edges.push('EDS'[this.hWalls(x, end + 1)]!);
            } else {
              edges.push('eCs'[this.hWalls(x, end + 1)]!);
            }
            lengths.push(t);
            end += 1;
          }

          lengths.pop();
          edges.pop();

          // The slots move to the top edge, and the bottom keeps only the
          // joints.
          const upper = [...edges].reverse().map((e) => UPPER_EDGE[e]!);
          edges = edges.map((e) => (e === 's' ? 'e' : e === 'S' ? 'E' : e));

          const les: EdgeSpec[] =
            start === 0 && x !== 0 && x !== lx
              ? ['e', le_F, le_f]
              : start > 0 && (x === 0 || x === lx)
                ? ['e', ole_F, ole_f]
                : ['e', 'F', 'f'];
          const res: EdgeSpec[] =
            end === ly && x !== 0 && x !== lx
              ? ['e', re_F, re_f]
              : end < ly && (x === 0 || x === lx)
                ? ['e', ore_F, ore_f]
                : ['e', 'F', 'f'];

          const [cbStart, cbEnd] = [start, end];
          piece += 1;
          this.rectangularWall(
            sum(lengths),
            h,
            [
              this.makeCompoundEdge(edges, lengths),
              res[this.hWalls(x, end)]!,
              this.makeCompoundEdge(upper, [...lengths].reverse()),
              les[this.hWalls(x, start)]!,
            ],
            {
              callback: [() => this.wallLabelsCB(cbStart, cbEnd, x, false)],
              move: 'right',
              label: `Wall y${x + 1}${piece > 1 ? `.${piece}` : ''}`,
            },
          );
          start = end;
        }
      }
    });

    this.rectangularWall(10, Math.max(this.h, this.hi), 'ffef', { move: 'up only' });
  }

  /**
   * The floor. Only compartments that keep their floor are drawn, so the plate
   * is traced border by border rather than as a rectangle with slots in it.
   */
  private basePlate(opts: { callback?: Callback; move?: string; label?: string } = {}): void {
    const { callback = null, move, label = '' } = opts;
    const lx = this.x.length;
    const ly = this.y.length;
    const t = this.thickness;
    const w = this.getEdge('F').startWidth();
    const b = this.burn;
    const t2 = t / 2.0;

    const tw = sum(this.x) + (lx - 1) * t + 2 * w;
    const th = sum(this.y) + (ly - 1) * t + 2 * w;

    if (this.move(tw, th, move, true)) return;

    const corners: [number, number, number][] = [
      [w, w + b, 0],
      [tw - w, w + b, 90],
      [tw - w, th - w + b, 180],
      [w, th - w + b, 270],
    ];
    corners.forEach(([x, y, a], i) => this.cc(callback, i, x, y, a));

    // Borders and slots running along x.
    let posy = w - t;
    for (let y = ly; y >= 0; y--) {
      let posx = w;
      for (let x = 0; x < lx; x++) {
        const e = this.hwalls[y]![x] ? 'F' : 'e';
        if (this.labels) {
          this.text(
            `x ${x + 1}/${y + 1}`,
            posx + this.x[x]! / 2,
            posy + (y > 0 ? t : 0),
            0,
            y > 0 ? 'center' : 'center top',
            2 * this.thickness,
            ANNOTATIONS,
          );
        }
        if (this.floor(y, x)) {
          if (this.floor(y - 1, x)) {
            // Inside wall
            if (this.hwalls[y]![x]) this.fingerHolesAt(posx, posy + t2, this.x[x]!, 0);
          } else {
            // Top edge
            this.edgeAt(e, posx + this.x[x]!, posy + w + b, this.x[x]!, -180);

            if (!this.floor(y - 1, x - 1) && !this.floor(y, x - 1)) {
              this.cornerAt(posx, posy + w + b, w, 180); // top left corner
            }
            if (!this.floor(y - 1, x + 1) && !this.floor(y, x + 1)) {
              this.cornerAt(posx + this.x[x]! + w + b, posy, w, 90); // top right corner
            }
            if (!this.floor(y - 1, x - 1) && this.floor(y, x - 1)) {
              this.edgeAt('e', posx - t, posy + w + b, t, 0); // top edge under wall
            }
          }
        } else if (this.floor(y - 1, x)) {
          // Bottom edge
          this.edgeAt(e, posx, posy - b + t - w, this.x[x]!);
          if (!this.floor(y - 1, x - 1) && !this.floor(y, x - 1)) {
            this.cornerAt(posx - w - b, posy + t, w, -90); // bottom left corner
          }
          if (!this.floor(y - 1, x + 1) && !this.floor(y, x + 1)) {
            this.cornerAt(posx + this.x[x]!, posy + t - w - b, w, 0); // bottom right corner
          }
          if (this.floor(y - 1, x - 1) && !this.floor(y, x - 1)) {
            this.edgeAt('e', posx - t, posy + t - w - b, t); // bottom edge under wall
          }
        }
        posx += this.x[x]! + t;
      }
      // y - 1 is -1 on the last pass; posy is not read again, but boxes.py's
      // wrap-around indexing is kept so the arithmetic stays identical.
      posy += (at(this.y, y - 1) ?? 0) + t;
    }

    // Borders and slots running along y.
    let posx = w - t;
    for (let x = 0; x <= lx; x++) {
      posy = w;
      for (let y = ly - 1; y >= 0; y--) {
        const e = this.vwalls[y]![x] ? 'F' : 'e';
        if (this.labels) {
          this.text(
            `y ${x + 1}/${y + 1}`,
            posx + (x < lx ? t : 0),
            posy + this.y[y]! / 2,
            -90,
            x < lx ? 'center' : 'center top',
            2 * this.thickness,
            ANNOTATIONS,
          );
        }
        if (this.floor(y, x - 1)) {
          if (this.floor(y, x)) {
            // Inside wall
            if (this.vwalls[y]![x]) this.fingerHolesAt(posx + t2, posy, this.y[y]!);
          } else {
            // Right edge
            this.edgeAt(e, posx + w + b, posy, this.y[y]!, 90);
            if (this.floor(y - 1, x - 1) && !this.floor(y - 1, x)) {
              this.edgeAt('e', posx + w + b, posy + this.y[y]!, t, 90); // right edge under wall
            }
          }
        } else if (this.floor(y, x)) {
          // Left edge
          this.edgeAt(e, posx + t - w - b, posy + this.y[y]!, this.y[y]!, -90);
          if (this.floor(y - 1, x) && !this.floor(y - 1, x - 1)) {
            this.edgeAt('e', posx + t - w - b, posy + this.y[y]! + t, t, -90);
          }
        }
        posy += this.y[y]! + t;
      }
      if (x < lx) posx += this.x[x]! + t;
    }

    this.move(tw, th, move, false, label);
  }

  render(): void {
    this.prepare();
    this.walls();
    this.basePlate({ move: 'up', label: 'Base plate' });
    this.lid(
      sum(this.x) + (this.x.length - 1) * this.thickness,
      sum(this.y) + (this.y.length - 1) * this.thickness,
    );
  }
}

export const trayLayout: GeneratorDef = {
  meta: {
    id: 'traylayout',
    name: 'Tray Layout',
    group: 'Tray',
    summary: 'Tray with an arbitrary compartment layout',
    description:
      'A compartmented tray drawn from a text sketch of the grid: hyphens and ' +
      'vertical bars are walls, and an "X" removes the floor of a compartment. ' +
      'Leave the sketch empty for a plain grid built from the compartment sizes.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartments left to right',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'compartment',
      help: 'Used to build the starting layout. The sketch below wins once it is filled in.',
    },
    {
      key: 'sy',
      kind: 'sections',
      label: 'Compartments back to front',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'compartment',
    },
    {
      key: 'h',
      kind: 'length',
      label: 'Height',
      unit: 'mm',
      default: 100,
      min: 10,
      max: 500,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'hi',
      kind: 'length',
      label: 'Divider height',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'Height of the inner walls. Leave at 0 to match the outer walls.',
    },
    {
      key: 'outside',
      kind: 'bool',
      label: 'Outside measurements',
      default: true,
      group: 'dimensions',
    },
    {
      key: 'layout',
      kind: 'text',
      label: 'Layout sketch',
      default: '',
      multiline: true,
      group: 'dimensions',
      placeholder: 'Leave empty for a full grid of the compartments above',
      help:
        'One "+-+" line per row of walls, one "| |" line per row of compartments ' +
        'ending in its depth. Replace a "-" or "|" with a space to drop that wall, ' +
        'and the space inside a compartment with an "X" to leave it without a floor.',
    },
    ...LID_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) => {
    const sx = parseSections(s(v, 'sx', '50*3'));
    const sy = parseSections(s(v, 'sy', '50*3'));
    // Not trimmed: every size line in the sketch starts with a space.
    const layout = s(v, 'layout', '');
    return new TrayLayout(
      {
        h: n(v, 'h', 100),
        hi: n(v, 'hi', 0),
        outside: b(v, 'outside', true),
        layout: layout.trim() === '' ? defaultLayout(sx, sy) : layout,
      },
      config,
    );
  },
};
