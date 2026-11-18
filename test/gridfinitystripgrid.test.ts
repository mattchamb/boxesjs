/**
 * The strip grid is this port's own, so there is no boxes.py golden to
 * compare against. These tests pin what the grid must do instead: every line
 * of the grid is covered exactly once, no crossing has both its strips
 * broken, no line is a straight seam, the bond continues across grids cut at
 * an offset, and the strips' outlines have the slots where the grid needs
 * them.
 */
import { describe, expect, it } from 'vitest';
import {
  axisSpec,
  linePos,
  MIN_BAY,
  minStripHeight,
  PITCH,
  pieceGeometry,
  seatDepth,
  stripGridLayout,
  stripOutline,
  type StripPiece,
} from '~/lib/generators/gridfinitystripgrid';
import { buildDrawing } from '~/lib/preview';
import type { ParamValues } from '~/lib/params/schema';

const drawing = (values: ParamValues) => buildDrawing('gridfinitystripgrid', { burn: 0, ...values });

const BAYS: { x: [boolean, boolean]; y: [boolean, boolean] }[] = [
  { x: [false, false], y: [false, false] },
  { x: [true, true], y: [true, true] },
  { x: [true, false], y: [false, true] },
];

/** Every grid size, piece length, offset and set of border bays worth trying. */
function* sweep() {
  for (let M = 2; M <= 7; M++)
    for (const nx of [1, 2, 3, 5, 8, 13])
      for (const ny of [1, 2, 4, 9])
        for (const [ox, oy] of [
          [0, 0],
          [1, 0],
          [3, 5],
        ] as const)
          for (const bays of BAYS) yield { nx, ny, maxCells: M, originX: ox, originY: oy, bays };
}

/** The line numbers a sweep case has along one axis, bays included. */
const lineRange = (n: number, bays: [boolean, boolean]) => {
  const out: number[] = [];
  for (let k = bays[0] ? -1 : 0; k <= n + (bays[1] ? 1 : 0); k++) out.push(k);
  return out;
};

const breaksOn = (pieces: StripPiece[], axis: 'x' | 'y', line: number) =>
  pieces.filter((p) => p.axis === axis && p.line === line && p.startBreak).map((p) => p.from);

describe('seat depth and strip height', () => {
  it('seats the foot (t − 0.5)/2 down its chamfer for usual thicknesses', () => {
    for (const t of [1.5, 2, 3, 4, 4.8]) expect(seatDepth(t)).toBeCloseTo((t - 0.5) / 2, 9);
  });
  it('drops the foot in untouched when the cell is wider than it', () => {
    expect(seatDepth(0.3)).toBe(0);
  });
  it('catches only the bottom chamfer on thick strips, and nothing past it', () => {
    expect(seatDepth(6)).toBeCloseTo(2.15 + 1.8 + 0.6, 9);
    expect(seatDepth(10)).toBeCloseTo(4.75, 9);
  });
  it('keeps the foot off the floor with the clearance to spare', () => {
    expect(minStripHeight(3)).toBe(4);
    expect(minStripHeight(2)).toBe(4.5);
    expect(minStripHeight(4)).toBe(3.5);
  });
});

describe('stripGridLayout', () => {
  it('covers every line exactly once, in pieces of 1 to M cells', () => {
    for (const o of sweep()) {
      const { pieces } = stripGridLayout(o);
      for (const [axis, lines, len] of [
        ['x', lineRange(o.ny, o.bays.y), o.nx],
        ['y', lineRange(o.nx, o.bays.x), o.ny],
      ] as const) {
        for (const line of lines) {
          const own = pieces.filter((p) => p.axis === axis && p.line === line).sort((a, b) => a.from - b.from);
          expect(own[0]!.from).toBe(0);
          expect(own[own.length - 1]!.to).toBe(len);
          own.forEach((p, k) => {
            if (k > 0) expect(p.from).toBe(own[k - 1]!.to);
            expect(p.to - p.from).toBeGreaterThanOrEqual(1);
            expect(p.to - p.from).toBeLessThanOrEqual(o.maxCells);
            expect(p.startBreak).toBe(k > 0);
            expect(p.endBreak).toBe(k < own.length - 1);
          });
        }
      }
    }
  });

  it('never breaks both strips at one crossing', () => {
    for (const o of sweep()) {
      const { pieces } = stripGridLayout(o);
      for (const j of lineRange(o.ny, o.bays.y))
        for (const i of breaksOn(pieces, 'x', j)) expect(breaksOn(pieces, 'y', i), JSON.stringify({ ...o, i, j })).not.toContain(j);
    }
  });

  it('leaves no grid line where every strip breaks', () => {
    for (const o of sweep()) {
      const { pieces } = stripGridLayout(o);
      for (let i = 1; i < o.nx; i++) {
        const broken = lineRange(o.ny, o.bays.y).map((j) => breaksOn(pieces, 'x', j).includes(i));
        expect(broken.every(Boolean)).toBe(false);
      }
      for (let j = 1; j < o.ny; j++) {
        const broken = lineRange(o.nx, o.bays.x).map((i) => breaksOn(pieces, 'y', i).includes(j));
        expect(broken.every(Boolean)).toBe(false);
      }
    }
  });

  it('keeps strips whole when they fit', () => {
    const { pieces } = stripGridLayout({ nx: 5, ny: 4, maxCells: 5 });
    expect(pieces.every((p) => !p.startBreak && !p.endBreak)).toBe(true);
  });

  it('continues the bond in a grid cut at an offset', () => {
    // A 6 × 6 window at (4, 3) of a 16 × 12 grid breaks exactly where the big
    // grid does, wherever both are long enough to break at all.
    const M = 4;
    const big = stripGridLayout({ nx: 16, ny: 12, maxCells: M }).pieces;
    const win = stripGridLayout({ nx: 6, ny: 6, maxCells: M, originX: 4, originY: 3 }).pieces;
    for (let j = 0; j <= 6; j++) {
      const inside = breaksOn(big, 'x', j + 3)
        .map((i) => i - 4)
        .filter((i) => i > 0 && i < 6);
      expect(breaksOn(win, 'x', j)).toEqual(inside);
    }
    for (let i = 0; i <= 6; i++) {
      const inside = breaksOn(big, 'y', i + 4)
        .map((j) => j - 3)
        .filter((j) => j > 0 && j < 6);
      expect(breaksOn(win, 'y', i)).toEqual(inside);
    }
  });
});

describe('axisSpec', () => {
  const t = 3;
  it('is the bare grid in cells mode', () => {
    const a = axisSpec(4, t);
    expect(a.size).toBeCloseTo(4 * PITCH + t, 9);
    expect(a.bays).toEqual([false, false]);
    expect(linePos(a, 0, t)).toBeCloseTo(t / 2, 9);
  });
  it('centres the cells in an overall size', () => {
    const a = axisSpec(5, t, 250);
    expect(linePos(a, 0, t) + linePos(a, 5, t)).toBeCloseTo(250, 9);
    expect(a.bays).toEqual([true, true]);
    expect(linePos(a, -1, t)).toBeCloseTo(t / 2, 9);
    expect(linePos(a, 6, t)).toBeCloseTo(250 - t / 2, 9);
  });
  it('makes a bay only where it leaves the minimum clear', () => {
    const just = 5 * PITCH + t + 2 * (MIN_BAY + t);
    expect(axisSpec(5, t, just).bays).toEqual([true, true]);
    expect(axisSpec(5, t, just - 0.1).bays).toEqual([false, false]);
    expect(axisSpec(5, t, 5 * PITCH + t + MIN_BAY + t, 'end').bays).toEqual([false, true]);
  });
});

describe('pieceGeometry', () => {
  const t = 3;
  for (const fit of [0, 0.2]) {
    const w = t + fit;
    it(`adds up to the whole strip with a ${fit} mm allowance`, () => {
      const { pieces } = stripGridLayout({ nx: 11, ny: 2, maxCells: 3 });
      for (let j = 0; j <= 2; j++) {
        const own = pieces.filter((p) => p.axis === 'x' && p.line === j);
        expect(own.length).toBeGreaterThan(1);
        const total = own.reduce((a, p) => a + pieceGeometry(p, t, w, axisSpec(11, t)).length, 0);
        expect(total).toBeCloseTo(11 * PITCH + t, 9);
      }
    });
    it(`fills an overall size with border bays, ${fit} mm allowance`, () => {
      const run = axisSpec(11, t, 11 * PITCH + t + 40);
      const { pieces } = stripGridLayout({ nx: 11, ny: 2, maxCells: 3, bays: { x: run.bays } });
      const own = pieces.filter((p) => p.axis === 'x' && p.line === 0);
      const total = own.reduce((a, p) => a + pieceGeometry(p, t, w, run).length, 0);
      expect(total).toBeCloseTo(run.size, 9);
      expect(own.reduce((a, p) => a + pieceGeometry(p, t, w, run).notches.length, 0)).toBe(12 + 2);
    });
    it(`slots every crossing once, ${fit} mm allowance`, () => {
      const { pieces } = stripGridLayout({ nx: 11, ny: 2, maxCells: 3 });
      for (let j = 0; j <= 2; j++) {
        const own = pieces.filter((p) => p.axis === 'x' && p.line === j);
        const slots = own.reduce((a, p) => a + pieceGeometry(p, t, w, axisSpec(11, t)).notches.length, 0);
        expect(slots).toBe(12);
      }
    });
  }

  it('never leaves an outside end a post narrower than the material', () => {
    const t = 3;
    for (const fit of [-0.5, -0.2, 0, 0.2, 1])
      for (let size = 3 * PITCH + t; size < 4 * PITCH + t + 40; size += 0.5)
        for (const leftover of ['centre', 'start', 'end'] as const) {
          const run = axisSpec(Math.floor((size - t) / PITCH), t, size, leftover);
          const { pieces } = stripGridLayout({ nx: run.n, ny: 1, maxCells: 20, bays: { x: run.bays } });
          const g = pieceGeometry(pieces[0]!, t, t + fit, run);
          const first = g.notches[0]!;
          const last = g.notches[g.notches.length - 1]!;
          const where = JSON.stringify({ fit, size, leftover });
          expect(first.a === 0 || first.a >= t, where).toBe(true);
          expect(last.b === g.length || g.length - last.b >= t, where).toBe(true);
        }
  });

  it('gives interior slots the full width, and ends a tab where they meet an end', () => {
    const t = 3;
    const w = 3.2;
    const p: StripPiece = { axis: 'x', line: 0, index: 1, from: 3, to: 6, startBreak: true, endBreak: true };
    const g = pieceGeometry(p, t, w, axisSpec(9, t));
    expect(g.length).toBeCloseTo(3 * PITCH, 9);
    // The crossing at the start is this piece's, as a tab one slot wide; the
    // one at the end belongs to the next piece.
    const want = [
      [0, w],
      [PITCH, PITCH + w],
      [2 * PITCH, 2 * PITCH + w],
    ];
    expect(g.notches).toHaveLength(want.length);
    g.notches.forEach((nt, k) => {
      expect(nt.a).toBeCloseTo(want[k]![0]!, 9);
      expect(nt.b).toBeCloseTo(want[k]![1]!, 9);
    });
  });
});

/** Area by the shoelace formula; positive when counterclockwise. */
const area = (pts: [number, number][]) =>
  pts.reduce((a, p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return a + (p[0] * q[1] - q[0] * p[1]) / 2;
  }, 0);

describe('stripOutline', () => {
  const cases: [string, number, { a: number; b: number }[]][] = [
    ['plain', 100, []],
    ['inner slots', 100, [{ a: 20, b: 23 }, { a: 60, b: 63 }]],
    ['end tabs', 100, [{ a: 0, b: 3 }, { a: 40, b: 43 }, { a: 97, b: 100 }]],
  ];
  for (const fromTop of [true, false]) {
    for (const [name, length, notches] of cases) {
      it(`${name}, slotted from the ${fromTop ? 'top' : 'bottom'}`, () => {
        const h = 4;
        const pts = stripOutline(length, h, notches, fromTop);
        // Counterclockwise, closed, and every edge square to the strip.
        expect(area(pts)).toBeCloseTo(length * h - notches.reduce((a, nt) => a + (nt.b - nt.a) * (h / 2), 0), 9);
        pts.forEach((p, i) => {
          const q = pts[(i + 1) % pts.length]!;
          expect(p[0] === q[0] || p[1] === q[1]).toBe(true);
        });
        // Each slot, or end tab, has its two inside corners at half height,
        // and opens on the side it should.
        expect(pts.filter((p) => p[1] === h / 2).length).toBe(2 * notches.length);
        const open = fromTop ? h : 0;
        for (const nt of notches) {
          const mid = (nt.a + nt.b) / 2;
          expect(pts.some((p) => p[1] === open && Math.abs(p[0] - mid) < 1e-9)).toBe(false);
        }
      });
    }
  }
});

describe('the drawing', () => {
  it('draws one strip per line when the strips fit whole', () => {
    const d = drawing({ x: 4, y: 3 });
    expect(d.warnings).toEqual([]);
    expect(d.parts.map((p) => p.name).sort()).toEqual(['X1', 'X2', 'X3', 'X4', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']);
  });

  it('makes the grid n·42 + t across', () => {
    const d = drawing({ x: 4, y: 3, thickness: 3 });
    const x1 = d.parts.find((p) => p.name === 'X1')!;
    const y1 = d.parts.find((p) => p.name === 'Y1')!;
    expect(x1.bbox.width).toBeCloseTo(4 * PITCH + 3, 6);
    expect(y1.bbox.width).toBeCloseTo(3 * PITCH + 3, 6);
    expect(x1.bbox.height).toBeCloseTo(minStripHeight(3), 6);
  });

  it('breaks long strips and keeps every piece within the longest allowed', () => {
    const d = drawing({ x: 12, y: 9, max_length: 200, thickness: 3, slot_fit: 0.2 });
    expect(d.warnings).toEqual([]);
    expect(d.parts.some((p) => /^[XY]\d+[a-z]$/.test(p.name))).toBe(true);
    for (const p of d.parts) expect(p.bbox.width).toBeLessThanOrEqual(200 + 1e-6);
  });

  it('fills an overall size exactly, running the strips on where the leftover is narrow', () => {
    // 200: 4 cells and 29 mm over, 14.5 a side; 140: 3 cells and 11 over.
    const d = drawing({ size_by: 'size', size_x: 200, size_y: 140, thickness: 3 });
    expect(d.warnings).toEqual([]);
    expect(d.parts.filter((p) => p.name.startsWith('Y')).length).toBe(5);
    expect(d.parts.filter((p) => p.name.startsWith('X')).length).toBe(4);
    for (const p of d.parts) expect(p.bbox.width).toBeCloseTo(p.name.startsWith('X') ? 200 : 140, 6);
    expect(d.notes?.map((nt) => nt.param).sort()).toEqual(['size_x', 'size_y']);
  });

  it('adds a border bay where the leftover leaves room for one', () => {
    // 250: 5 cells and 37 mm over, 18.5 a side, so a bay 15.5 mm clear each side.
    const d = drawing({ size_by: 'size', size_x: 250, size_y: 140, thickness: 3 });
    expect(d.parts.filter((p) => p.name.startsWith('Y')).length).toBe(5 + 1 + 2);
    for (const p of d.parts.filter((p) => p.name.startsWith('X'))) expect(p.bbox.width).toBeCloseTo(250, 6);
  });

  it('puts the leftover on one side when asked', () => {
    const d = drawing({ size_by: 'size', size_x: 250, size_y: 140, thickness: 3, leftover: 'start' });
    expect(d.parts.filter((p) => p.name.startsWith('Y')).length).toBe(5 + 1 + 1);
  });

  it('keeps every piece of a drawer-sized grid within the longest strip', () => {
    const d = drawing({ size_by: 'size', size_x: 580, size_y: 320, max_length: 280, thickness: 3, slot_fit: 0.2 });
    expect(d.warnings).toEqual([]);
    for (const p of d.parts) expect(p.bbox.width).toBeLessThanOrEqual(280 + 1e-6);
  });

  it('refuses an overall size smaller than a cell', () => {
    expect(drawing({ size_by: 'size', size_x: 40 }).warnings.map((w) => w.param)).toEqual(['size_x']);
  });

  it('warns on thickness outside the range that seats a bin', () => {
    expect(drawing({ thickness: 6 }).warnings.map((w) => w.param)).toContain('thickness');
    expect(drawing({ thickness: 1 }).warnings.map((w) => w.param)).toContain('thickness');
  });

  it('warns when the strips are too low for a seated bin', () => {
    expect(drawing({ thickness: 3, h: 3 }).warnings.map((w) => w.param)).toEqual(['h']);
  });

  it('refuses strips too short to stagger', () => {
    const d = drawing({ x: 5, y: 5, max_length: 60 });
    expect(d.warnings.map((w) => w.param)).toEqual(['max_length']);
    expect(d.parts).toEqual([]);
  });
});
