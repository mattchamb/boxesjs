/**
 * Compartment box — ported from boxes.py `boxes/generators/compartmentbox.py`.
 *
 * A type tray with a lid that slides in over the inner dividers, held down by a
 * lip around three sides. In boxes.py this subclasses `TypeTray` purely to reuse
 * its slot and finger-hole callbacks — its `__init__` deliberately calls
 * `Boxes.__init__` so none of TypeTray's parameters come with it. Our `TypeTray`
 * takes a typed options object describing knobs this generator does not have
 * (divider height, top edge, scoops, engraved labels), so subclassing it here
 * would mean inventing values for all of them. The four shared callbacks are a
 * few lines each and are duplicated below instead; typetray.ts is left alone.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { CompoundEdge } from '../edges/base';
import { SlottedEdge } from '../edges/slots';
import type { StackableSettings } from '../edges/stackable';
import { STACKABLE_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { parseSections } from '../params/sections';
import { BOTTOM_EDGE_CHOICES } from '../topedge';
import { b, n, s, type GeneratorDef } from './types';

type HandleStyle = 'none' | 'lip' | 'hole';

interface CompartmentBoxOptions {
  sx: number[];
  sy: number[];
  h: number;
  outside: boolean;
  bottomEdge: string;
  handle: HandleStyle;
  radius: number;
  holes: string;
  marginVertical: number;
  marginSide: number;
  splitLip: boolean;
}

class CompartmentBox extends Boxes {
  private sx: number[];
  private sy: number[];
  private h: number;
  /** Divider height. Always equal to `h` here; the callbacks below read it. */
  private hi: number;

  constructor(private o: CompartmentBoxOptions, config: Partial<BoxesConfig>) {
    super(config);
    this.sx = [...o.sx];
    this.sy = [...o.sy];
    this.h = o.h;
    this.hi = o.h;
  }

  // The next four are TypeTray's, inherited in boxes.py and copied here.

  private xSlots = (): void => {
    const t = this.thickness;
    let posx = -0.5 * t;
    for (const x of this.sx.slice(0, -1)) {
      posx += x + t;
      let posy = 0;
      for (const y of this.sy) {
        this.fingerHolesAt(posx, posy, y);
        posy += y + t;
      }
    }
  };

  private ySlots = (): void => {
    const t = this.thickness;
    let posy = -0.5 * t;
    for (const y of this.sy.slice(0, -1)) {
      posy += y + t;
      let posx = 0;
      for (const x of [...this.sx].reverse()) {
        this.fingerHolesAt(posy, posx, x);
        posx += x + t;
      }
    }
  };

  private xHoles = (): void => {
    const t = this.thickness;
    let posx = -0.5 * t;
    for (const x of this.sx.slice(0, -1)) {
      posx += x + t;
      this.fingerHolesAt(posx, 0, Math.min(this.h, this.hi));
    }
  };

  private yHoles = (): void => {
    const t = this.thickness;
    let posy = -0.5 * t;
    for (const y of this.sy.slice(0, -1)) {
      posy += y + t;
      this.fingerHolesAt(posy, 0, Math.min(this.h, this.hi));
    }
  };

  /**
   * Finger slots in the lid, so it can be pulled out. Unlike TypeTray's single
   * grip hole this is a row of slots sized as percentages of the usable width.
   */
  private gripHole = (): void => {
    const radius = this.o.radius;
    if (!radius) return;
    const t = this.thickness;
    const widths = parseSections(this.o.holes);
    const x = this.sx.reduce((a, v) => a + v, 0) + t * (this.sx.length - 1);
    const total = widths.reduce((a, v) => a + v, 0);
    if (total <= 0) return;

    // Percentages summing over 100 are renormalised rather than rejected, and
    // the gaps between slots then vanish.
    const usable = x - (widths.length + 1) * t;
    const slotOffset = total < 100 ? ((1 - total / 100) * usable) / (widths.length * 2) : 0;
    const slotHeight = 2 * radius;
    let slotX = t + slotOffset;

    for (const w of widths) {
      const slotwidth = total > 100 ? (w / total) * usable : (w / 100) * usable;
      slotX += slotwidth / 2;
      this.savedContext(() => {
        this.rectangularHole(slotX, radius + t, slotwidth, slotHeight, radius, true, true);
      });
      slotX += slotwidth / 2 + slotOffset + t + slotOffset;
    }
  };

  render(): void {
    const t = this.thickness;
    const k = this.burn;

    const bottom = this.o.bottomEdge;
    const stackable = bottom === 's';
    const tside = stackable ? 'Š' : 'F';
    let tback = stackable ? 'S' : 'E';

    // boxes.py raises on a negative margin; the UI cannot produce one, but a
    // hand-edited permalink can, so warn and clamp rather than fail to render.
    let marginSide = this.o.marginSide;
    let marginVertical = this.o.marginVertical * t;
    if (marginVertical < 0) {
      this.warn('Vertical margin cannot be negative.', 'margin_t');
      marginVertical = 0;
    }
    if (marginSide < 0) {
      this.warn('Side margin cannot be negative.', 'margin_s');
      marginSide = 0;
    }

    const splitLip = this.o.splitLip;
    // One continuous lip wraps round the back, so the back wall carries the
    // same edge as the sides instead of a plain outset one.
    if (!splitLip) tback = tside;

    if (this.o.outside) {
      this.sx = this.adjustSize(this.sx);
      this.sy = this.adjustSize(this.sy);
      this.h = this.adjustSize(this.h, bottom, tside) - 1 * t - marginVertical;
    }
    this.hi = this.h;

    const x = this.sx.reduce((a, v) => a + v, 0) + t * (this.sx.length - 1);
    const y = this.sy.reduce((a, v) => a + v, 0) + t * (this.sy.length - 1);
    const h = this.h;

    this.savedContext(() => {
      // The back wall is taller: it carries the slot the lid slides through.
      let hb = h + t + marginVertical;
      if (stackable) {
        const st = this.edges['S']!.settings as StackableSettings;
        hb += st.holedistance + (splitLip ? t : -t);
      }
      this.rectangularWall(x, hb, [bottom, 'F', tback, 'F'], {
        callback: [this.xHoles],
        ignoreWidths: [1, 2, 5, 6],
        move: 'up',
        label: 'Back',
      });

      this.rectangularWall(x, h, [bottom, 'F', 'e', 'F'], {
        callback: [this.mirrorX(this.xHoles, x)],
        ignoreWidths: [1, 6],
        move: 'up',
        label: 'Front',
      });

      if (bottom !== 'e') {
        this.rectangularWall(x, y, 'ffff', {
          callback: [this.xSlots, this.ySlots],
          move: 'up',
          label: 'Bottom',
        });
      }

      const be = bottom !== 'e' ? 'f' : 'e';
      for (let i = 0; i < this.sy.length - 1; i++) {
        const e: EdgeSpec[] = [
          new SlottedEdge(this, this.sx, be),
          'f',
          new SlottedEdge(this, [...this.sx].reverse(), 'e', 0.5 * h),
          'f',
        ];
        this.rectangularWall(x, h, e, { move: 'up', label: `Divider across ${i + 1}` });
      }

      const handle = this.o.handle;
      const xCompensated = x - 2 * marginSide * t; // clearance at left and right
      if (handle === 'lip') {
        // The lid sits a little lower because of the vertical margin; the lip
        // makes that back up so the top of the box stays where it was.
        let lipHeight = (stackable ? 0 : t) + marginVertical / 2;
        if (stackable) {
          const st = this.edges['S']!.settings as StackableSettings;
          lipHeight += st.holedistance;
          // The lip is narrower than the box by the side margin, so its
          // stackable recesses have to be pulled in by the same amount.
          // Registering these also rebinds "š" and "Š" on the box, exactly as
          // boxes.py does — the side walls drawn below get the narrowed edge.
          const narrowed = st.clone();
          narrowed.setValues(t, true, { width: st.width / t - marginSide });
          narrowed.edgeObjects(this, 'aA');
        }
        this.rectangularWall(xCompensated, y, 'feee', { move: 'up', label: 'Lid' });
        this.rectangularWall(xCompensated, lipHeight, `Fe${stackable ? 'A' : 'e'}e`, {
          move: 'up',
          label: 'Lid lip',
        });
      }
      if (handle === 'hole') {
        this.rectangularWall(xCompensated, y + t, 'eeee', {
          move: 'up',
          label: 'Lid',
          callback: [this.gripHole],
        });
      }
      if (handle === 'none') {
        this.rectangularWall(xCompensated, y + t, 'eeee', { move: 'up', label: 'Lid' });
      }
    });

    this.rectangularWall(x, h, 'ffff', { move: 'right only' });

    // The side walls run past the top of the box by the lid thickness plus the
    // margin, and that extra run has nothing to joint to.
    const f = new CompoundEdge(
      this,
      [this.getEdge('f'), this.getEdge('E')],
      [h + this.getEdge(bottom).startWidth(), t + marginVertical],
    );
    this.rectangularWall(y, h + t + marginVertical, [bottom, f, tside, 'f'], {
      callback: [this.yHoles],
      ignoreWidths: [1, 5, 6],
      move: 'up',
      label: 'Left side',
    });
    this.rectangularWall(y, h + t + marginVertical, [bottom, f, tside, 'f'], {
      callback: [this.yHoles],
      ignoreWidths: [1, 5, 6],
      move: 'mirror up',
      label: 'Right side',
    });

    const be = bottom !== 'e' ? 'f' : 'e';
    for (let i = 0; i < this.sx.length - 1; i++) {
      const e: EdgeSpec[] = [new SlottedEdge(this, this.sy, be, 0.5 * h), 'f', 'e', 'f'];
      this.rectangularWall(y, h, e, { move: 'up', label: `Divider along ${i + 1}` });
    }

    // The lip the lid slides under. With the "lip" grip the lid stops short of
    // the front, so the lip's front edge is plain; otherwise it is outset to
    // cover the edge of the lid.
    const lipFrontEdge = this.o.handle === 'lip' ? 'e' : 'E';
    if (splitLip) {
      this.rectangularWall(y, t, `eef${lipFrontEdge}`, { move: 'up', label: 'Lip left' });
      this.rectangularWall(y, t, `eef${lipFrontEdge}`, { move: 'mirror up', label: 'Lip right' });
    } else {
      // One U-shaped piece: both side strips and the back cut as a unit. There
      // is no wall helper for this outline, so it is drawn by hand between a
      // matched pair of move() calls.
      const tx = y + this.getEdge('f').spacing() + this.getEdge(lipFrontEdge).spacing();
      const ty = x + 2 * this.getEdge('f').spacing();
      // As sharp as the kerf allows without taking material off the part.
      const r = k;
      this.move(tx, ty, 'up', true);

      this.moveTo(this.getEdge('f').margin(), this.getEdge('f').margin());
      this.getEdge('f').call(y);
      this.edgeCorner('f', lipFrontEdge);
      this.getEdge(lipFrontEdge).call(t);
      this.edgeCorner(lipFrontEdge, 'e');
      this.edge(y - t - r);
      this.corner(-90, r);
      this.edge(x - (t + r) * 2);
      this.corner(-90, r);
      this.edge(y - t - r);
      this.edgeCorner('e', lipFrontEdge);
      this.getEdge(lipFrontEdge).call(t);
      this.edgeCorner(lipFrontEdge, 'f');
      this.getEdge('f').call(y);
      this.corner(90);
      this.getEdge('f').call(x);
      this.corner(90);

      this.move(tx, ty, 'up', false, 'Lip');
    }
  }
}

export const compartmentBox: GeneratorDef = {
  meta: {
    id: 'compartmentbox',
    name: 'Compartment Box',
    group: 'Tray',
    summary: 'Divided tray with a lid that slides in over the compartments',
    description:
      'The lid rests on the inner dividers and slides in under a lip, so there ' +
      'has to be at least one divider for it to sit on — put walls close to both ' +
      'sides for the steadiest lid. The margins add clearance so it does not jam; ' +
      'the vertical one makes the box that much taller.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartments left to right',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'compartment',
      help: 'Width of each compartment across the box. The lid slides on these walls.',
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
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: BOTTOM_EDGE_CHOICES,
      default: 'h',
      group: 'dimensions',
    },
    {
      key: 'handle',
      kind: 'enum',
      label: 'Lid grip',
      default: 'lip',
      choices: [
        { value: 'none', label: 'None' },
        { value: 'lip', label: 'Overhanging lip' },
        { value: 'hole', label: 'Finger slots' },
      ],
      group: 'top',
      help: 'How you get hold of the lid to slide it out.',
    },
    {
      key: 'radius',
      kind: 'length',
      label: 'Finger slot radius',
      unit: 'mm',
      default: 10,
      min: 0,
      max: 50,
      step: 1,
      group: 'top',
      help: 'Half the height of each finger slot. Zero leaves the lid solid.',
    },
    {
      key: 'holes',
      kind: 'text',
      label: 'Finger slot widths',
      default: '70',
      group: 'top',
      help: 'One percentage per slot, as a share of the usable lid width. "40:40" cuts two.',
    },
    {
      key: 'margin_t',
      kind: 'number',
      label: 'Vertical margin',
      unit: '× thickness',
      default: 0.1,
      min: 0,
      max: 2,
      step: 0.05,
      group: 'top',
      help: 'Headroom above the lid. Adds to the overall height.',
    },
    {
      key: 'margin_s',
      kind: 'number',
      label: 'Side margin',
      unit: '× thickness',
      default: 0.05,
      min: 0,
      max: 2,
      step: 0.05,
      group: 'top',
      help: 'Clearance taken off each side of the lid so it does not bind.',
    },
    {
      key: 'split_lip',
      kind: 'bool',
      label: 'Split the lip',
      default: true,
      group: 'top',
      help: 'Two straight strips waste less sheet than one U-shaped piece, but need aligning.',
    },
    ...STACKABLE_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new CompartmentBox(
      {
        sx: parseSections(s(v, 'sx', '50*3')),
        sy: parseSections(s(v, 'sy', '50*3')),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        bottomEdge: s(v, 'bottom_edge', 'h'),
        handle: s(v, 'handle', 'lip') as HandleStyle,
        radius: n(v, 'radius', 10),
        holes: s(v, 'holes', '70'),
        marginVertical: n(v, 'margin_t', 0.1),
        marginSide: n(v, 'margin_s', 0.05),
        splitLip: b(v, 'split_lip', true),
      },
      config,
    ),
};
