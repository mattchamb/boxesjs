/**
 * Type tray — ported from boxes.py `boxes/generators/typetray.py`.
 *
 * A compartmented tray built from interlocking dividers. The most useful
 * generator in the library, and the one that makes the compartment editor in
 * the UI worth having.
 *
 * `assembly: 'bolts'` is this port's own option, for a tray used as a drawer:
 * pulling on the front loads its corners along the side walls, which a finger
 * joint resists with glue alone. Bolted, captive-nut bolts run through the
 * front and back into the ends of the side walls and of the dividers that run
 * between them, and through the walls into the bottom where its edge allows.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { BaseEdge, CompoundEdge, type BoltPolicy } from '../edges/base';
import { boltPositions, checkBolts, shelfBolts, wallsBetween, type BoltedJoint, type Span } from '../edges/bolts';
import type { FingerJointSettings } from '../edges/fingerjoint';
import { FingerHoleEdge, FingerHoleEdgeSettings } from '../edges/fingerhole';
import { SlottedEdge } from '../edges/slots';
import { ETCHING } from '../geom/colors';
import { BOLT_PARAMS, HANDLE_PARAMS, LID_PARAMS, assemblyParam } from '../params/common';
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
  bolted: boolean;
}

/**
 * Bottom edges that pass bolts on to their slots. A stackable edge draws its
 * slots without them, so its walls would have no holes for the bottom's T-slots.
 */
const BOLTABLE_BOTTOMS = 'Fh';

/**
 * An edge drawn with a fixed bolt policy. CompoundEdge passes no call options
 * to its parts, so this is how a divider taller than the walls gets bolts on
 * the stretch that meets the front and back.
 */
class BoltedEdge extends BaseEdge {
  constructor(boxes: Boxes, private inner: BaseEdge, private policy: BoltPolicy) {
    super(boxes, inner.settings);
  }

  call(length: number): void {
    this.inner.call(length, { bedBolts: this.policy });
  }

  override startWidth(): number {
    return this.inner.startWidth();
  }

  override endWidth(): number {
    return this.inner.endWidth();
  }

  override margin(): number {
    return this.inner.margin();
  }
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

  /** Bolts through the front and back into each divider along, when bolted. */
  private dividerBolts: BoltPolicy | null = null;

  private xHoles = (): void => {
    const t = this.thickness;
    let posx = -0.5 * t;
    for (const x of this.sx.slice(0, -1)) {
      posx += x + t;
      this.fingerHolesAt(posx, 0, Math.min(this.h, this.hi), 90, this.dividerBolts);
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

  /**
   * The corners and the dividers along carry the pull on the front, so each
   * takes at least two bolts, which also stops the front pivoting about a
   * single one. boxes.py's policy never bolts the end gaps nor, for an even
   * count, the middle one, so a low wall with few fingers can fit only one; it
   * keeps that rather than none, and says so. `across` is where other cuts
   * cross the joint.
   */
  private atLeastTwoBolts(length: number, across: Span[], what: string): BoltPolicy {
    const fj = this.getEdge('f').settings as FingerJointSettings;
    const two = shelfBolts(this, length, across, 2);
    if (boltPositions(fj, length, two).length >= 2) return two;
    const usual = shelfBolts(this, length, across);
    if (boltPositions(fj, length, usual).length === 1) {
      this.warn(
        `${what} only have room for one bolt per joint at these finger sizes. ` +
          'Make them taller, or the fingers narrower, for two.',
        'assembly',
      );
    }
    return usual;
  }

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

    // Bolted, each joint's bolts keep off the slots that run in from its
    // edge: the bottom's from the dividers' finger holes. The corners and the
    // dividers' ends have nothing running in across them.
    const bolted = this.o.bolted;
    const botBolted = bolted && BOLTABLE_BOTTOMS.includes(bottom);
    // ignoreWidths lengthens the corner joints by the bottom edge's width, so
    // that is the length both halves are drawn at.
    const bottomWidth = this.getEdge(bottom).startWidth();
    const cornerLength = h + bottomWidth;
    // The joint runs on past the bottom edge, where that edge's own holes or
    // fingers cross it.
    const cornerB = bolted
      ? this.atLeastTwoBolts(cornerLength, bottomWidth ? [[0, bottomWidth]] : [], 'The corners')
      : null;
    const botX = botBolted ? shelfBolts(this, x, wallsBetween(this.sx, t)) : null;
    const botY = botBolted ? shelfBolts(this, y, wallsBetween(this.sy, t)) : null;
    this.dividerBolts =
      bolted && this.sx.length > 1 ? this.atLeastTwoBolts(Math.min(h, hi), [], 'The dividers along') : null;
    // The dividers along get end edges of their own, so the dividers across,
    // which meet the side walls dry, stay unbolted.
    const fb: BaseEdge = this.dividerBolts
      ? new BoltedEdge(this, this.getEdge('f'), this.dividerBolts)
      : this.getEdge('f');
    const leAlong: EdgeSpec = hi <= h ? fb : new CompoundEdge(this, [this.getEdge('e'), fb], [hi - h, h]);
    const reAlong: EdgeSpec = hi <= h ? fb : new CompoundEdge(this, [fb, this.getEdge('e')], [h, hi - h]);

    this.savedContext(() => {
      // Floor
      if (bottom !== 'e') {
        this.rectangularWall(x, y, 'ffff', {
          callback: [this.xSlots, this.ySlots],
          bedBolts: [botX, botY, botX, botY],
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
        bedBolts: [botX, cornerB, null, cornerB],
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
        bedBolts: [botX, cornerB, null, cornerB],
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
      bedBolts: [botY, cornerB, null, cornerB],
      move: 'up',
      label: 'Left side',
    });
    this.rectangularWall(y, h, [bottom, 'f', tr, 'f'], {
      callback: [this.mirrorX(this.yHoles, y)],
      ignoreWidths,
      bedBolts: [botY, cornerB, null, cornerB],
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
              reAlong,
              new SlottedEdge(this, [...this.sy].reverse(), 'f'),
              leAlong,
            ]
          : [new SlottedEdge(this, this.sy, be, 0.5 * hi), reAlong, 'e', leAlong];
      this.rectangularWall(y, hi, e, { move: 'up', label: `Divider along ${i + 1}` });
    }

    if (bolted) {
      const joints: BoltedJoint[] = [{ label: 'the corners', length: cornerLength, policy: cornerB! }];
      if (this.dividerBolts) joints.push({ label: 'the dividers along', length: Math.min(h, hi), policy: this.dividerBolts });
      if (botX) joints.push({ label: 'the bottom’s width edges', length: x, policy: botX });
      if (botY) joints.push({ label: 'the bottom’s depth edges', length: y, policy: botY });
      checkBolts(this, this.getEdge('f').settings as FingerJointSettings, joints);
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
  // M4 rather than the shared M3: a bolted tray is a drawer carrying weight,
  // and in the 6 mm ply that suits one an M4 leaves plenty of wall either side.
  paramDefaults: { fj_surroundingspaces: 0.5, rt_outset: 1, bolt_size: 'M4' },
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
    assemblyParam(['bolts'], {
      bolts:
        'For a tray pulled out as a drawer. The front and back are bolted to the side walls and to every divider along, ' +
        'and the walls to the bottom where its edge is finger joints or finger holes. The dividers across fit dry.',
    }),
    ...BOLT_PARAMS,
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
        bolted: s(v, 'assembly', 'glue') === 'bolts',
      },
      config,
    ),
};
