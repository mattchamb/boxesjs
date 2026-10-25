/**
 * Wedged through-tenons are this port's own joint, so there is no boxes.py
 * golden to compare against. These tests pin the geometry the design calls
 * for instead (see src/lib/edges/wedgedtenon.ts): that tenons and holes line
 * up, that the wedge slot sits where it must to pull the joint tight, and that
 * the wedges lock half-way in.
 */
import { describe, expect, it } from 'vitest';
import { WedgedTenonSettings } from '~/lib/edges/wedgedtenon';
import { defaultsFor, paramsFor } from '~/lib/generators/registry';
import { buildDrawing, renderPreview } from '~/lib/preview';
import type { DrawingPart, DrawingPath } from '~/lib/render';
import type { ParamValues } from '~/lib/params/schema';

const T = 3;
const S = new WedgedTenonSettings(T, true, {});
const P = S.protrusion();

interface Box { minX: number; minY: number; maxX: number; maxY: number }

/** Bounding box of a path from its end points; exact for the straight-sided shapes here. */
function pathBox(path: DrawingPath): Box {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const c of path.cmds) {
    if (!('x' in c)) continue;
    b.minX = Math.min(b.minX, c.x);
    b.maxX = Math.max(b.maxX, c.x);
    b.minY = Math.min(b.minY, c.y);
    b.maxY = Math.max(b.maxY, c.y);
  }
  return b;
}

const outlineBox = (part: DrawingPart): Box =>
  part.paths.filter((p) => p.layer === 'cut').map(pathBox).reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));

const holes = (part: DrawingPart): Box[] =>
  part.paths.filter((p) => p.layer === 'inner').map(pathBox).sort((a, b) => a.minX - b.minX);

function panel(edges: Partial<Record<'bottom_edge' | 'right_edge' | 'top_edge' | 'left_edge', string>>, burn = 0) {
  const values: ParamValues = {
    ...defaultsFor('rectangularwall'),
    x: 150,
    h: 100,
    thickness: T,
    burn,
    labels: false,
    ...edges,
  };
  return buildDrawing('rectangularwall', values);
}

describe('WedgedTenonSettings', () => {
  it('spaces tenons symmetrically about the middle of the edge', () => {
    const c = S.centres(150);
    expect(c).toHaveLength(2); // 150 mm at a 75 mm pitch
    expect(c[0]! + c[1]!).toBeCloseTo(150, 9);
  });

  it('gives a short edge one tenon, and one with no room none at all', () => {
    expect(S.centres(30)).toEqual([15]);
    expect(S.centres(S.width + T)).toEqual([]);
  });

  it('makes the wedge exactly the gap width at its middle', () => {
    expect((S.wedgeNarrow() + S.wedgeWide()) / 2).toBeCloseTo(S.gap, 9);
  });

  it('rejects a wedge whose narrow end would vanish', () => {
    expect(() => new WedgedTenonSettings(T, true, { gap: 0.5, wedge_length: 12, taper: 5 })).toThrow(/narrow end/);
  });
});

describe('a w edge', () => {
  const d = panel({ bottom_edge: 'w' });
  const part = d.parts.find((p) => p.name === 'Panel')!;
  const out = outlineBox(part);
  const slots = holes(part);
  // Which side the tenons are on depends on the sheet's y direction; the
  // slots are near the tips, so whichever side they are closer to.
  const tipIsMin = slots[0]!.minY - out.minY < out.maxY - slots[0]!.maxY;
  const fromTip = (y: number) => (tipIsMin ? y - out.minY : out.maxY - y);

  it('stands the tenons out by thickness + gap + end margin', () => {
    expect(out.maxY - out.minY).toBeCloseTo(100 + P, 6);
    expect(out.maxX - out.minX).toBeCloseTo(150, 6);
  });

  it('cuts one wedge slot per tenon, the wedge thickness wide', () => {
    expect(slots).toHaveLength(2);
    for (const s of slots) {
      expect(s.maxX - s.minX).toBeCloseTo(T + S.slack, 6);
      expect(s.maxY - s.minY).toBeCloseTo(S.gap + S.draw, 6);
    }
  });

  it('centres each slot on its tenon', () => {
    const centres = S.centres(150);
    slots.forEach((s, i) => expect((s.minX + s.maxX) / 2 - out.minX).toBeCloseTo(centres[i]!, 6));
  });

  it('starts each slot inside the mating panel and leaves the end margin at the tip', () => {
    for (const s of slots) {
      const far = Math.min(fromTip(s.minY), fromTip(s.maxY));
      const near = Math.max(fromTip(s.minY), fromTip(s.maxY));
      expect(far).toBeCloseTo(S.end_margin, 6);
      // The shoulder is P from the tip; the slot reaches `draw` past the
      // mating panel's outer face, which is one thickness from the shoulder.
      expect(P - near).toBeCloseTo(T - S.draw, 6);
    }
  });

  it('keeps the slot in place under kerf compensation', () => {
    const b = 0.1;
    const kd = panel({ bottom_edge: 'w' }, b);
    const kp = kd.parts.find((p) => p.name === 'Panel')!;
    const ko = outlineBox(kp);
    const ks = holes(kp);
    const tipMin = ks[0]!.minY - ko.minY < ko.maxY - ks[0]!.maxY;
    for (const s of ks) {
      // Outline grows by the kerf, holes shrink by it: the cut lines move
      // apart by 2b while the finished faces stay where the design puts them.
      const far = tipMin ? s.minY - ko.minY : ko.maxY - s.maxY;
      expect(far).toBeCloseTo(S.end_margin + 2 * b, 6);
      expect(s.maxY - s.minY).toBeCloseTo(S.gap + S.draw - 2 * b, 6);
    }
  });

  it('comes with one wedge per tenon, exactly as designed', () => {
    const wedges = d.parts.filter((p) => p.name === 'wedge');
    expect(wedges).toHaveLength(2);
    for (const w of wedges) {
      const b = outlineBox(w);
      expect(b.maxX - b.minX).toBeCloseTo(S.wedge_length, 6);
      expect(b.maxY - b.minY).toBeCloseTo(S.wedgeWide(), 6);
    }
  });
});

describe('a W edge', () => {
  it('sets its holes in far enough that the wedges stay inside the edge', () => {
    expect(S.holeInset()).toBeGreaterThanOrEqual(S.wedge_length / 2);
    const mate = panel({ bottom_edge: 'W' }).parts.find((p) => p.name === 'Panel')!;
    const out = outlineBox(mate);
    for (const h of holes(mate)) {
      const centre = (h.minY + h.maxY) / 2;
      expect(Math.min(centre - out.minY, out.maxY - centre)).toBeCloseTo(S.holeInset(), 6);
    }
  });

  it('cuts holes that line up with the tenons of a w edge of the same length', () => {
    const tenon = panel({ bottom_edge: 'w' }).parts.find((p) => p.name === 'Panel')!;
    const mate = panel({ bottom_edge: 'W' }).parts.find((p) => p.name === 'Panel')!;
    const tOut = outlineBox(tenon);
    const mOut = outlineBox(mate);
    const slots = holes(tenon);
    const hs = holes(mate);
    expect(hs).toHaveLength(slots.length);
    hs.forEach((h, i) => {
      expect(h.maxX - h.minX).toBeCloseTo(S.width + S.slack, 6);
      expect(Math.min(h.maxY - h.minY, h.maxX - h.minX)).toBeCloseTo(T + S.slack, 6);
      const hc = (h.minX + h.maxX) / 2 - mOut.minX;
      const sc = (slots[i]!.minX + slots[i]!.maxX) / 2 - tOut.minX;
      expect(hc).toBeCloseTo(sc, 6);
    });
  });
});

describe('StorageShelf with wedged tenons', () => {
  const base: ParamValues = { ...defaultsFor('storageshelf'), wedged: true, burn: 0, labels: false };

  const s = new WedgedTenonSettings(3, true, {});
  // Outside measurements: the recessed back costs its W edge's width.
  const x = Number(base['x']) - (s.holeInset() + 3 / 2);
  const isWedgeSlot = (h: Box) => {
    const dims = [h.maxX - h.minX, h.maxY - h.minY].sort((a, b) => a - b);
    return Math.abs(dims[0]! - (3 + s.slack)) < 1e-6 && Math.abs(dims[1]! - (s.gap + s.draw)) < 1e-6;
  };

  it('wedges the back to the sides as well as the shelves', () => {
    const d = buildDrawing('storageshelf', base);
    const back = d.parts.find((p) => p.name === 'back')!;
    const backSlots = holes(back).filter(isWedgeSlot).length;
    expect(backSlots).toBeGreaterThan(0);
    expect(backSlots % 2).toBe(0); // the same tenons on both side edges

    const shelves = d.parts.filter((p) => p.name.startsWith('inner horizontal'));
    const wedges = d.parts.filter((p) => p.name === 'wedge');
    expect(wedges).toHaveLength(s.centres(x).length * 2 * shelves.length + backSlots);
  });

  it('puts a tenon hole in the side walls for every tenon', () => {
    const d = buildDrawing('storageshelf', base);
    const shelves = d.parts.filter((p) => p.name.startsWith('inner horizontal')).length;
    const backTenons = holes(d.parts.find((p) => p.name === 'back')!).filter(isWedgeSlot).length / 2;
    for (const name of ['left', 'right']) {
      const side = d.parts.find((p) => p.name === name)!;
      // The bottom panel stays finger-jointed, so its slots are here too;
      // count only the holes of tenon size.
      const tenonHoles = holes(side).filter((h) => {
        const dims = [h.maxX - h.minX, h.maxY - h.minY].sort((a, b) => a - b);
        return Math.abs(dims[0]! - (3 + s.slack)) < 1e-6 && Math.abs(dims[1]! - (s.width + s.slack)) < 1e-6;
      });
      expect(tenonHoles, name).toHaveLength(s.centres(x).length * shelves + backTenons);
    }
  });

  it('warns when a shallow shelf puts shelf wedges and back wedges in each other’s way', () => {
    expect(renderPreview('storageshelf', base).warnings).toEqual([]);
    const shallow = renderPreview('storageshelf', { ...base, x: 35 });
    expect(shallow.warnings.map((w) => w.param)).toContain('wt_pitch');
  });

  it('survives the extremes of every tenon setting', () => {
    for (const spec of paramsFor('storageshelf')) {
      if (!spec.key.startsWith('wt_') || (spec.kind !== 'number' && spec.kind !== 'length')) continue;
      for (const v of [spec.min, spec.max]) {
        expect(() => renderPreview('storageshelf', { ...base, [spec.key]: v }), `${spec.key}=${v}`).not.toThrow();
      }
    }
  });

  // That the switched-off shelf is unchanged is the storageshelf goldens' job.
  it('draws no wedges when switched off', () => {
    const off = buildDrawing('storageshelf', { ...base, wedged: false });
    expect(off.parts.some((p) => p.name === 'wedge')).toBe(false);
  });
});

describe('DisplayShelf with wedged tenons', () => {
  const s = new WedgedTenonSettings(3, true, {});
  const base: ParamValues = { ...defaultsFor('displayshelf'), wedged: true, burn: 0, labels: false };
  const closed: ParamValues = { ...base, include_back: true, include_front: true, include_bottom: true };
  const isTenonHole = (h: Box) => {
    const dims = [h.maxX - h.minX, h.maxY - h.minY].sort((a, b) => a - b);
    return Math.abs(dims[0]! - (3 + s.slack)) < 1e-6 && Math.abs(dims[1]! - (s.width + s.slack)) < 1e-6;
  };
  const wedgeSlots = (p: DrawingPart) =>
    holes(p).filter((h) => {
      const dims = [h.maxX - h.minX, h.maxY - h.minY].sort((a, b) => a - b);
      return Math.abs(dims[0]! - (3 + s.slack)) < 1e-6 && Math.abs(dims[1]! - (s.gap + s.draw)) < 1e-6;
    }).length;

  it('wedges every floor, and nothing at all when switched off', () => {
    const d = buildDrawing('displayshelf', base);
    const floors = d.parts.filter((p) => p.name.startsWith('shelf '));
    expect(floors).toHaveLength(3);
    const perFloor = wedgeSlots(floors[0]!);
    expect(perFloor).toBeGreaterThan(0);
    expect(d.parts.filter((p) => p.name === 'wedge')).toHaveLength(3 * perFloor);
    const off = buildDrawing('displayshelf', { ...base, wedged: false });
    expect(off.parts.some((p) => p.name === 'wedge')).toBe(false);
  });

  // Upright axis-aligned holes only: the back, front and bottom panels'.
  // A floor's holes are slanted, so their bounding boxes are not tenon-sized.
  for (const slope_top of [false, true]) {
    const v = { ...closed, slope_top };
    const d = buildDrawing('displayshelf', v);
    const side = d.parts.find((p) => p.name === 'left side')!;
    const out = outlineBox(side);
    const tenonHoles = holes(side).filter(isTenonHole);
    const back = tenonHoles.filter((h) => h.maxY - h.minY > h.maxX - h.minX && h.minX - out.minX < 20);
    const front = tenonHoles.filter((h) => h.maxY - h.minY > h.maxX - h.minX && out.maxX - h.maxX < 20);
    const bottom = tenonHoles.filter((h) => h.maxX - h.minX > h.maxY - h.minY);

    it(`sets the panels' holes in from the side's edges${slope_top ? ', sloped' : ''}`, () => {
      expect(back.length).toBeGreaterThan(0);
      expect(front.length).toBeGreaterThan(0);
      expect(bottom.length).toBeGreaterThan(0);
      for (const h of back) expect((h.minX + h.maxX) / 2 - out.minX).toBeCloseTo(s.holeInset(), 6);
      for (const h of front) expect(out.maxX - (h.minX + h.maxX) / 2).toBeCloseTo(s.holeInset(), 6);
      // The sheet's y may run either way; the bottom holes are nearer one edge.
      for (const h of bottom) {
        const c = (h.minY + h.maxY) / 2;
        expect(Math.min(c - out.minY, out.maxY - c)).toBeCloseTo(s.holeInset(), 6);
      }
    });

    it(`puts the bottom panel's holes where its tenons are${slope_top ? ', sloped' : ''}`, () => {
      const panel = d.parts.find((p) => p.name === 'bottom wall')!;
      const panelOut = outlineBox(panel);
      // The bottom panel's depth is the space between the recessed back and front.
      const depth = out.maxX - out.minX - 2 * (s.holeInset() + 3 / 2);
      const centres = bottom.map((h) => (h.minX + h.maxX) / 2 - out.minX - (s.holeInset() + 3 / 2)).sort((a, b) => a - b);
      const expected = s.centres(depth);
      expect(centres).toHaveLength(expected.length);
      centres.forEach((c, i) => expect(c).toBeCloseTo(expected[i]!, 6));
      // Its side edges carry tenons that stand out of the panel by the protrusion.
      expect(panelOut.maxY - panelOut.minY).toBeCloseTo(depth + 2 * s.protrusion(), 6);
    });

    it(`counts one wedge per tenon${slope_top ? ', sloped' : ''}`, () => {
      const slots = d.parts.filter((p) => !['left side', 'right side', 'wedge'].includes(p.name)).reduce((a, p) => a + wedgeSlots(p), 0);
      expect(d.parts.filter((p) => p.name === 'wedge')).toHaveLength(slots);
    });

    it(`fits the default shelf without a warning${slope_top ? ', sloped' : ''}`, () => {
      expect(renderPreview('displayshelf', v).warnings).toEqual([]);
    });
  }

  it('keeps the outside depth with a recessed back and front', () => {
    for (const slope_top of [false, true]) {
      const side = buildDrawing('displayshelf', { ...closed, slope_top }).parts.find((p) => p.name === 'left side')!;
      const out = outlineBox(side);
      expect(out.maxX - out.minX).toBeCloseTo(Number(closed['y']), 6);
    }
  });

  it('warns when a floor sits on the bottom panel, where their wedges meet', () => {
    const r = renderPreview('displayshelf', { ...base, angle: 0, include_bottom: true });
    expect(r.warnings.map((w) => w.param)).toContain('wt_pitch');
    expect(renderPreview('displayshelf', { ...base, angle: 0, include_bottom: true, bottom_distance: 30 }).warnings).toEqual([]);
  });

  it('warns when a wedge hangs off the side', () => {
    // Flat floors with no bottom panel: the lowest floor's wedges reach below the side.
    const r = renderPreview('displayshelf', { ...base, angle: 0 });
    expect(r.warnings.map((w) => w.param)).toContain('wt_wedge_length');
  });

  it('survives the extremes of every tenon setting', () => {
    for (const spec of paramsFor('displayshelf')) {
      if (!spec.key.startsWith('wt_') || (spec.kind !== 'number' && spec.kind !== 'length')) continue;
      for (const v of [spec.min, spec.max]) {
        expect(() => renderPreview('displayshelf', { ...closed, [spec.key]: v }), `${spec.key}=${v}`).not.toThrow();
      }
    }
  });
});
