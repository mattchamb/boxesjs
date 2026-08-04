/**
 * Type tray — ported from boxes.py `boxes/generators/typetray.py`.
 *
 * A compartmented tray built from interlocking dividers. The most useful
 * generator in the library, and the one that makes the compartment editor in
 * the UI worth having.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { CompoundEdge } from '../edges/base';
import { FingerHoleEdge, FingerHoleEdgeSettings } from '../edges/fingerhole';
import { SlottedEdge } from '../edges/slots';
import { ETCHING } from '../geom/colors';
import { HANDLE_PARAMS, LID_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { BOTTOM_EDGE_CHOICES, drawLid, isClosedTop, topEdges, TOP_EDGE_CHOICES } from '../topedge';
import { b, n, s, type GeneratorDef } from './types';

type FingerHolesMode = 'none' | 'inside-only' | 'front' | 'back' | 'front-and-back';
type TextAlign = 'left' | 'center' | 'right';

interface TypeTrayOptions {
  sx: number[];
  sy: number[];
  h: number;
  hi: number;
  outside: boolean;
  bottomEdge: string;
  topEdge: string;
  gripHeight: number;
  gripWidth: number;
  fingerholes: FingerHolesMode;
  labelText: string;
  textSize: number;
  textAlignment: TextAlign;
  textDistanceX: number;
  textDistanceY: number;
  textAtFront: boolean;
}

class TypeTray extends Boxes {
  private sx: number[];
  private sy: number[];
  private h: number;
  private hi: number;
  private textContent: string[];
  private textNumber = 0;

  constructor(private o: TypeTrayOptions, config: Partial<BoxesConfig>) {
    super(config);
    this.sx = [...o.sx];
    this.sy = [...o.sy];
    this.h = o.h;
    this.hi = o.hi;
    this.textContent = o.labelText.split('\n').filter((l, i, a) => i < a.length || l !== '');
  }

  /** Slots along x for the dividers that run front-to-back. */
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

  /** Slots along y for the dividers that run left-to-right. */
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

  private gripHole = (): void => {
    if (!this.o.gripWidth) return;
    const t = this.thickness;
    const x = this.sx.reduce((a, v) => a + v, 0) + t * (this.sx.length - 1);
    const r = Math.min(this.o.gripWidth, this.o.gripHeight) / 2.0;
    this.rectangularHole(x / 2.0, this.o.gripHeight * 1.5, this.o.gripWidth, this.o.gripHeight, r);
  };

  /**
   * Compartment labels, drawn on the engrave layer so they mark the tray
   * rather than cutting through it.
   */
  private textCB = (): void => {
    if (this.textContent.length === 0) return;
    const t = this.thickness;
    const size = this.o.textSize;
    const align = this.o.textAlignment;

    let texty = this.hi - size - this.o.textDistanceY;
    if (align === 'center') texty -= this.fingerHoleDepth();

    for (let i = 0; i < this.sx.length; i++) {
      if (this.textNumber >= this.textContent.length) break;
      const w = this.sx[i]!;
      let textx = i * (this.sx[0]! + t);
      if (align === 'left') textx += this.o.textDistanceX;
      else if (align === 'center') textx += w / 2;
      else textx += w - this.o.textDistanceX;

      this.text(
        this.textContent[this.textNumber]!,
        textx,
        texty,
        0,
        align === 'center' ? 'center' : align,
        size,
        ETCHING,
      );
      this.textNumber++;
    }
  };

  private fingerHoleDepth(): number {
    return this.o.fingerholes === 'none' ? 0 : this.hi * 0.9;
  }

  render(): void {
    const t = this.thickness;

    if (this.o.outside) {
      this.sx = this.adjustSize(this.sx);
      this.sy = this.adjustSize(this.sy);
      this.h = this.adjustSize(this.h, true, false);
      if (this.hi) this.hi = this.adjustSize(this.hi, true, false);
    }

    const x = this.sx.reduce((a, v) => a + v, 0) + t * (this.sx.length - 1);
    const y = this.sy.reduce((a, v) => a + v, 0) + t * (this.sy.length - 1);
    const h = this.h;
    const sameh = !this.hi;
    const hi = (this.hi = this.hi || h);

    // The finger-access scoop needs to know how tall the wall is.
    const fhSettings = new FingerHoleEdgeSettings(t, true);
    fhSettings.wallheight = this.o.fingerholes === 'none' ? 0 : hi;
    this.addPart(new FingerHoleEdge(this, fhSettings));

    const bottom = this.edges[this.o.bottomEdge] ? this.o.bottomEdge : 'F';
    const [tl, tb0, tr, tf0] = topEdges(this, this.o.topEdge);
    let tb: EdgeSpec = tb0;
    let tf: EdgeSpec = tf0;
    const closedtop = isClosedTop(this.o.topEdge);
    const ignoreWidths = [1, 6];

    const be = bottom !== 'e' ? 'f' : 'e';
    // When the dividers are taller than the walls, the extra height has no
    // joint to sit in, so the side edges become part joint and part plain.
    const le: EdgeSpec =
      hi <= h ? 'f' : new CompoundEdge(this, [this.getEdge('e'), this.getEdge('f')], [hi - h, h]);
    const re: EdgeSpec =
      hi <= h ? 'f' : new CompoundEdge(this, [this.getEdge('f'), this.getEdge('e')], [h, hi - h]);

    this.savedContext(() => {
      // Floor
      if (bottom !== 'e') {
        this.rectangularWall(x, y, 'ffff', {
          callback: [this.xSlots, this.ySlots],
          move: 'up',
          label: 'Bottom',
        });
      }

      // Front wall
      const frontCBs = this.o.textAtFront
        ? [
            () => {
              this.textCB();
              this.xHoles();
            },
            null,
            this.gripHole,
          ]
        : [this.xHoles, null, this.gripHole];

      if (!closedtop && (this.o.fingerholes === 'front' || this.o.fingerholes === 'front-and-back')) {
        tf = new SlottedEdge(this, [...this.sx].reverse(), 'A');
      }

      this.rectangularWall(x, h, [bottom, 'F', tf, 'F'], {
        callback: frontCBs,
        ignoreWidths,
        move: 'up',
        label: 'Front',
      });

      // Dividers running left-to-right. These slot downward from the top.
      for (let i = 0; i < this.sy.length - 1; i++) {
        const topSlot =
          closedtop && sameh
            ? new SlottedEdge(this, [...this.sx].reverse(), 'f', 0.5 * hi)
            : new SlottedEdge(this, [...this.sx].reverse(), 'A', 0.5 * hi);
        const e: EdgeSpec[] = [new SlottedEdge(this, this.sx, be), re, topSlot, le];
        this.rectangularWall(x, hi, e, {
          move: 'up',
          callback: [this.textCB],
          label: `Divider across ${i + 1}`,
        });
      }

      // Back wall
      if (!closedtop && (this.o.fingerholes === 'back' || this.o.fingerholes === 'front-and-back')) {
        tb = new SlottedEdge(this, [...this.sx].reverse(), 'A');
      }
      this.rectangularWall(x, h, [bottom, 'F', tb, 'F'], {
        callback: [this.xHoles],
        ignoreWidths,
        move: 'mirror up',
        label: 'Back',
      });

      // Top panel or lid
      if (closedtop && sameh) {
        this.rectangularWall(x, y, this.o.topEdge === 'f' ? 'FFFF' : 'ffff', {
          callback: [this.xSlots, this.ySlots],
          move: 'up',
          label: 'Top',
        });
      } else {
        drawLid(this, x, y, this.o.topEdge);
      }
      this.lid(x, y, this.o.topEdge);
    });

    // Step right past the column just drawn.
    this.rectangularWall(x, hi, 'ffff', { move: 'right only' });

    // Outer side walls. The right one mirrors the left so their slots line up.
    this.rectangularWall(y, h, [bottom, 'f', tl, 'f'], {
      callback: [this.yHoles],
      ignoreWidths,
      move: 'up',
      label: 'Left side',
    });
    this.rectangularWall(y, h, [bottom, 'f', tr, 'f'], {
      callback: [this.mirrorX(this.yHoles, y)],
      ignoreWidths,
      move: 'up',
      label: 'Right side',
    });

    // Dividers running front-to-back. These slot upward from the bottom, so
    // that together with the cross dividers they form an egg-crate.
    for (let i = 0; i < this.sx.length - 1; i++) {
      const e: EdgeSpec[] =
        closedtop && sameh
          ? [
              new SlottedEdge(this, this.sy, be, 0.5 * hi),
              re,
              new SlottedEdge(this, [...this.sy].reverse(), 'f'),
              le,
            ]
          : [new SlottedEdge(this, this.sy, be, 0.5 * hi), re, 'e', le];
      this.rectangularWall(y, hi, e, { move: 'up', label: `Divider along ${i + 1}` });
    }
  }

  private yHoles = (): void => {
    const t = this.thickness;
    let posy = -0.5 * t;
    for (const yy of this.sy.slice(0, -1)) {
      posy += yy + t;
      this.fingerHolesAt(posy, 0, Math.min(this.h, this.hi));
    }
  };
}

export const typeTray: GeneratorDef = {
  meta: {
    id: 'typetray',
    name: 'Type Tray',
    group: 'Tray',
    summary: 'Compartmented tray with interlocking dividers',
    description:
      'A grid of compartments built from slotted dividers that slide together. ' +
      'Compartment labels are engraved rather than cut, so they land on their own ' +
      'LightBurn layer and can be switched off without touching the geometry.',
  },
  // Tray dividers are short walls; the standard edge margin would leave many of
  // them with no fingers at all, so this generator starts with a smaller one.
  paramDefaults: { fj_surroundingspaces: 0.5, rt_outset: 1 },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartments left to right',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'compartment',
      help: 'Width of each compartment across the tray.',
    },
    {
      key: 'sy',
      kind: 'sections',
      label: 'Compartments back to front',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'compartment',
    },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 10, max: 500, step: 1, group: 'dimensions' },
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
      help: 'Height of the inner dividers. Leave at 0 to match the outer walls.',
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
      key: 'top_edge',
      kind: 'edge',
      label: 'Top edge',
      choices: TOP_EDGE_CHOICES,
      default: 'e',
      group: 'top',
      help: 'Straight leaves the tray open. Finger joints add a closed top.',
    },
    ...HANDLE_PARAMS,
    ...LID_PARAMS,
    {
      key: 'fingerholes',
      kind: 'enum',
      label: 'Finger scoops',
      default: 'inside-only',
      choices: [
        { value: 'none', label: 'None' },
        { value: 'inside-only', label: 'Dividers only' },
        { value: 'front', label: 'Dividers + front' },
        { value: 'back', label: 'Dividers + back' },
        { value: 'front-and-back', label: 'Dividers + front and back' },
      ],
      group: 'dimensions',
      help: 'Scooped cut-outs that let you get a finger into a compartment.',
    },
    {
      key: 'gripwidth',
      kind: 'length',
      label: 'Grip hole width',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 300,
      step: 5,
      group: 'advanced',
      help: 'Cuts a carry handle in the front wall. 0 for none.',
    },
    {
      key: 'gripheight',
      kind: 'length',
      label: 'Grip hole height',
      unit: 'mm',
      default: 30,
      min: 5,
      max: 100,
      step: 1,
      group: 'advanced',
    },
    {
      key: 'label_text',
      kind: 'text',
      label: 'Compartment labels',
      default: '',
      group: 'advanced',
      multiline: true,
      help: 'One line per compartment, starting front left. Engraved, not cut.',
    },
    {
      key: 'text_size',
      kind: 'number',
      label: 'Label size',
      unit: 'mm',
      default: 12,
      min: 3,
      max: 40,
      step: 1,
      group: 'advanced',
    },
    {
      key: 'text_alignment',
      kind: 'enum',
      label: 'Label alignment',
      default: 'left',
      choices: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Centre' },
        { value: 'right', label: 'Right' },
      ],
      group: 'advanced',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new TypeTray(
      {
        sx: parseSections(s(v, 'sx', '50*3')),
        sy: parseSections(s(v, 'sy', '50*3')),
        h: n(v, 'h', 100),
        hi: n(v, 'hi', 0),
        outside: b(v, 'outside', true),
        bottomEdge: s(v, 'bottom_edge', 'h'),
        topEdge: s(v, 'top_edge', 'e'),
        gripHeight: n(v, 'gripheight', 30),
        gripWidth: n(v, 'gripwidth', 0),
        fingerholes: s(v, 'fingerholes', 'inside-only') as FingerHolesMode,
        labelText: s(v, 'label_text', ''),
        textSize: n(v, 'text_size', 12),
        textAlignment: s(v, 'text_alignment', 'left') as TextAlign,
        textDistanceX: 2.0,
        textDistanceY: 2.0,
        textAtFront: false,
      },
      config,
    ),
};
