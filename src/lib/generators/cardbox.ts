/**
 * Card box — ported from boxes.py `boxes/generators/cardbox.py`.
 *
 * A deck box with a sliding lid. The lid runs in a rebate formed by gluing a
 * second, shorter wall inside each side wall; the two edge families below are
 * what cut that rebate and the finger scoop that lets you get the cards out.
 *
 * Both edges are local to this generator in boxes.py too — they share names with
 * library edges but not their geometry, so they stay here rather than in
 * `src/lib/edges/`.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { BaseEdge } from '../edges/base';
import { Settings } from '../edges/settings';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

/** Steps out by one thickness and back, leaving a channel for the lid to slide in. */
class InsetEdge extends BaseEdge {
  override char: string | null = 'a';
  override description = 'Edge with space to slide in a lid';

  call(length: number): void {
    const t = this.thickness;
    this.corner(90);
    this.edge(t, 2);
    this.corner(-90);
    this.edge(length, 2);
    this.corner(-90);
    this.edge(t, 2);
    this.corner(90);
  }
}

class CardFingerHoleEdgeSettings extends Settings {
  static override absoluteParams = {
    wallheight: 0,
    fingerholedepth: 0,
  };

  get fingerholedepth(): number {
    return this.getNum('fingerholedepth');
  }
}

/** A half-round bite out of the wall, deep enough to pinch the cards. */
class CardFingerHoleEdge extends BaseEdge {
  override char: string | null = 'A';
  override description = 'Edge with room to get your fingers around cards';
  declare settings: CardFingerHoleEdgeSettings;

  constructor(boxes: Boxes, settings: CardFingerHoleEdgeSettings) {
    super(boxes, settings);
  }

  call(length: number): void {
    // The 10 mm here is the radius of the half circle the cut-out ends in.
    const depth = this.settings.fingerholedepth - 10;
    this.edge(length / 2 - 10, 2);
    this.corner(90);
    this.edge(depth, 2);
    this.corner(-180, 10);
    this.edge(depth, 2);
    this.corner(90);
    this.edge(length / 2 - 10, 2);
  }
}

type OpeningDirection = 'front' | 'right';
type FingerholeMode = 'regular' | 'deep' | 'custom';

interface CardBoxOptions {
  sx: number[];
  y: number;
  h: number;
  outside: boolean;
  openingdirection: OpeningDirection;
  fingerhole: FingerholeMode;
  fingerholeDepth: number;
  addLidtopper: boolean;
}

class CardBox extends Boxes {
  constructor(private o: CardBoxOptions, config: Partial<BoxesConfig>) {
    super(config);
  }

  /** Depth of the finger scoop, measured from the top of the inner wall. */
  private get fingerholedepth(): number {
    if (this.o.fingerhole === 'custom') return this.o.fingerholeDepth;
    if (this.o.fingerhole === 'regular') return Math.min(this.o.h / 4, 35);
    return this.o.h - this.thickness - 10;
  }

  // Inner dimensions of the surrounding box, disregarding the inlays.
  private get boxhight(): number {
    return this.o.outside ? this.o.h - 3 * this.thickness : this.o.h;
  }

  private get boxwidth(): number {
    const t = this.thickness;
    return (this.o.sx.length + 1) * t + this.o.sx.reduce((a, v) => a + v, 0);
  }

  private get boxdepth(): number {
    const t = this.thickness;
    if (this.o.outside) return this.o.y - 2 * t;
    // Opening to the right means the lid slides along y, so the box gains the
    // two rails it runs in.
    if (this.o.openingdirection === 'right') return this.o.y + 2 * t;
    return this.o.y;
  }

  private dividerBottom = (): void => {
    const t = this.thickness;
    const y = this.boxdepth;
    let pos = 0.5 * t;
    for (const i of this.o.sx.slice(0, -1)) {
      pos += i + t;
      this.fingerHolesAt(pos, 0, y, 90);
    }
  };

  private dividerBackAndFront = (): void => {
    const t = this.thickness;
    const y = this.boxhight;
    let pos = 0.5 * t;
    for (const i of this.o.sx.slice(0, -1)) {
      pos += i + t;
      this.fingerHolesAt(pos, 0, y, 90);
    }
  };

  render(): void {
    const t = this.thickness;

    const h = this.boxhight;
    const x = this.boxwidth;
    const y = this.boxdepth;
    const sx = this.o.sx;

    this.addPart(new InsetEdge(this, null));
    this.addPart(
      new CardFingerHoleEdge(
        this,
        new CardFingerHoleEdgeSettings(t, true, {
          wallheight: h,
          fingerholedepth: this.fingerholedepth,
        }),
      ),
    );

    if (this.o.openingdirection === 'right') {
      this.savedContext(() => {
        this.rectangularWall(x, y - t * 0.2, 'eFee', { move: 'right', label: 'Lid' });
        this.rectangularWall(x, y, 'ffff', {
          callback: [this.dividerBottom],
          move: 'right',
          label: 'Bottom',
        });
      });
      this.rectangularWall(x, y, 'eEEE', { move: 'up only' });
      this.rectangularWall(x, t, 'feee', { move: 'up', label: 'Lip Front' });
      this.rectangularWall(x, t, 'eefe', { move: 'up', label: 'Lip Back' });

      this.savedContext(() => {
        this.rectangularWall(x, h + t, 'FfFf', {
          callback: [this.dividerBackAndFront],
          move: 'right',
          label: 'Back',
        });
        this.rectangularWall(x, h + t, 'FfFf', {
          callback: [this.dividerBackAndFront],
          move: 'right',
          label: 'Front',
        });
      });
      this.rectangularWall(x, h + t, 'EEEE', { move: 'up only' });

      this.savedContext(() => {
        this.rectangularWall(y, h + t, 'FFEF', { move: 'right', label: 'Outer Side Left' });
        this.rectangularWall(y, h + t, 'FFaF', { move: 'right', label: 'Outer Side Right' });
      });
      this.rectangularWall(y, h + t, 'fFfF', { move: 'up only' });

      this.savedContext(() => {
        this.rectangularWall(y, h, 'Aeee', { move: 'right', label: 'Inner Side Left' });
        this.rectangularWall(y, h, 'Aeee', { move: 'right', label: 'Inner Side Right' });
      });
      this.rectangularWall(y, h, 'eAee', { move: 'up only' });

      this.savedContext(() => {
        this.rectangularWall(y - t * 0.2, t, 'fEeE', { move: 'right', label: 'Lid Lip' });
      });
      this.rectangularWall(y, t * 2, 'efee', { move: 'up only' });

      for (let i = 0; i < sx.length - 1; i++) {
        this.rectangularWall(h, y, 'fAff', { move: 'right', label: 'Divider' });
      }

      for (const c of sx) {
        this.rectangularWall(c, h, 'eeee', { move: 'right', label: 'Front inlay' });
        this.rectangularWall(c, h, 'eeee', { move: 'right', label: 'Back inlay' });
      }

      if (this.o.addLidtopper) {
        this.rectangularWall(x, y - 2.2 * t, 'eeee', { move: 'right', label: 'Lid topper' });
      }
    } else {
      this.savedContext(() => {
        this.rectangularWall(x - t * 0.2, y, 'eeFe', { move: 'right', label: 'Lid' });
        this.rectangularWall(x, y, 'ffff', {
          callback: [this.dividerBottom],
          move: 'right',
          label: 'Bottom',
        });
      });
      this.rectangularWall(x, y, 'eEEE', { move: 'up only' });
      this.rectangularWall(x - t * 0.2, t, 'fEeE', { move: 'up', label: 'Lid Lip' });

      this.savedContext(() => {
        this.rectangularWall(x, h + t, 'FFEF', {
          callback: [this.dividerBackAndFront],
          move: 'right',
          label: 'Back',
        });
        this.rectangularWall(x, h + t, 'FFaF', {
          callback: [this.dividerBackAndFront],
          move: 'right',
          label: 'Front',
        });
      });
      this.rectangularWall(x, h + t, 'EEEE', { move: 'up only' });

      this.savedContext(() => {
        this.rectangularWall(y, h + t, 'FfFf', { move: 'right', label: 'Outer Side Left' });
        this.rectangularWall(y, h + t, 'FfFf', { move: 'right', label: 'Outer Side Right' });
      });
      this.rectangularWall(y, h + t, 'fFfF', { move: 'up only' });

      this.savedContext(() => {
        this.rectangularWall(y, h, 'Aeee', { move: 'right', label: 'Inner Side Left' });
        this.rectangularWall(y, h, 'Aeee', { move: 'right', label: 'Inner Side Right' });
      });
      this.rectangularWall(y, h, 'eAee', { move: 'up only' });

      this.savedContext(() => {
        this.rectangularWall(y, t, 'eefe', { move: 'right', label: 'Lip Left' });
        this.rectangularWall(y, t, 'feee', { move: 'right', label: 'Lip Right' });
      });
      this.rectangularWall(y, t * 2, 'efee', { move: 'up only' });

      for (let i = 0; i < sx.length - 1; i++) {
        this.rectangularWall(h, y, 'fAff', { move: 'right', label: 'Divider' });
      }

      if (this.o.addLidtopper) {
        this.rectangularWall(x - 2.2 * t, y, 'eeee', { move: 'right', label: 'Lid topper' });
      }
    }
  }
}

export const cardBox: GeneratorDef = {
  meta: {
    id: 'cardbox',
    name: 'Card Box',
    group: 'Box',
    summary: 'Deck box for playing cards, with a sliding lid',
    description:
      'Storage for one or more card decks. The lid slides in a rebate formed by a ' +
      'second wall glued inside each side, so nothing shows on the outside. Choose ' +
      'whether it opens along the front or off the right-hand end.',
  },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartments left to right',
      default: '65*4',
      group: 'dimensions',
      itemLabel: 'deck',
      help: 'Width of each deck slot. 65 mm suits standard-size sleeved cards.',
    },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 68, min: 20, max: 500, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 92, min: 20, max: 500, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: false, group: 'dimensions' },
    {
      key: 'openingdirection',
      kind: 'enum',
      label: 'Lid slides open',
      default: 'front',
      choices: [
        { value: 'front', label: 'Towards the front' },
        { value: 'right', label: 'Off the right end' },
      ],
      group: 'top',
      help: 'A lid longer than it is wide slides more smoothly, so pick the long axis.',
    },
    {
      key: 'add_lidtopper',
      kind: 'bool',
      label: 'Lid topper',
      default: false,
      group: 'top',
      help: 'An extra plate to glue on top of the lid, for engraving or inlay.',
    },
    {
      key: 'fingerhole',
      kind: 'enum',
      label: 'Card scoop',
      default: 'regular',
      choices: [
        { value: 'regular', label: 'Regular' },
        { value: 'deep', label: 'Deep' },
        { value: 'custom', label: 'Custom depth' },
      ],
      group: 'dimensions',
      help: 'How far the cut-out in the inner wall reaches down, so you can grab the cards.',
    },
    {
      key: 'fingerhole_depth',
      kind: 'length',
      label: 'Scoop depth',
      unit: 'mm',
      default: 20,
      min: 10,
      max: 200,
      step: 1,
      group: 'dimensions',
      help: 'Only used when the card scoop is set to custom.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new CardBox(
      {
        sx: parseSections(s(v, 'sx', '65*4')),
        y: n(v, 'y', 68),
        h: n(v, 'h', 92),
        outside: b(v, 'outside', false),
        openingdirection: s(v, 'openingdirection', 'front') as OpeningDirection,
        fingerhole: s(v, 'fingerhole', 'regular') as FingerholeMode,
        fingerholeDepth: n(v, 'fingerhole_depth', 20),
        addLidtopper: b(v, 'add_lidtopper', false),
      },
      config,
    ),
};
