/**
 * Notes holder — ported from boxes.py `boxes/generators/notesholder.py`.
 *
 * A tray for a stack of paper or coasters. The front (and optionally back) wall
 * is cut away in the middle so you can push the stack up with a thumb, which is
 * what the two generator-local edge families below exist to draw.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { BaseEdge, CompoundEdge, Edge, OutSetEdge } from '../edges/base';
import type { FingerJointSettings } from '../edges/fingerjoint';
import { StackableEdge, type StackableSettings } from '../edges/stackable';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

/**
 * A wall edge with a wide, round-cornered slot bitten out of the middle. Unlike
 * a normal edge its settings object is just the opening percentage.
 */
class USlotEdge extends Edge {
  private readonly opening: number;
  private readonly e: string;

  constructor(boxes: Boxes, opening: number, edge = 'f') {
    super(boxes, null);
    this.opening = opening;
    this.e = edge;
  }

  private get inner(): BaseEdge {
    return this.boxes.edges[this.e]!;
  }

  override call(length: number): void {
    const l = length;
    const o = this.opening;
    const d = (length * (1 - o / 100)) / 2;
    const r = Math.min(3 * this.thickness, (l - 2 * d) / 2);
    this.inner.call(d);
    this.boxes.step(-this.inner.endWidth());
    this.polyline(0, 90, 0, [-90, r], l - 2 * d - 2 * r, [-90, r], 0, 90);
    this.boxes.step(this.inner.startWidth());
    this.inner.call(d);
  }

  override margin(): number {
    return this.inner.margin();
  }

  override startWidth(): number {
    return this.inner.startWidth();
  }
}

/**
 * One stackable foot instead of two. The cut-away front wall is split into
 * separate strips, and each strip only carries the foot on its outer end.
 */
class HalfStackableEdge extends StackableEdge {
  override char: string | null = 'H';

  override call(length: number): void {
    const s = this.settings;
    const r = s.height / 2.0 / (1 - Math.cos(s.angle * DEG));
    const l = r * Math.sin(s.angle * DEG);
    const p = this.bottom ? 1 : -1;

    if (this.bottom) {
      this.boxes.fingerHolesAt(
        0,
        s.height + s.holedistance + 0.5 * this.boxes.thickness,
        length,
        0,
      );
    }

    this.boxes.edge(s.width, 1);
    this.boxes.corner(p * s.angle, r);
    this.boxes.corner(-p * s.angle, r);
    this.boxes.edge(length - 1 * s.width - 2 * l);
  }

  override endWidth(): number {
    return this.settings.holedistance + this.settings.thickness;
  }
}

/** A plain edge that sits at whatever height another edge starts at. */
class MatchedEdge extends Edge {
  constructor(boxes: Boxes, private readonly ref: BaseEdge) {
    super(boxes, null);
  }

  override startWidth(): number {
    return this.ref.startWidth();
  }
}

interface NotesHolderOptions {
  sx: number[];
  y: number;
  h: number;
  bottomEdge: string;
  opening: number;
  backOpenings: boolean;
}

class NotesHolder extends Boxes {
  constructor(private o: NotesHolderOptions, config: Partial<BoxesConfig>) {
    super(config);
  }

  private fingerHoleCB(lengths: number[], height: number, posy = 0.0): () => void {
    return () => {
      const t = this.thickness;
      let px = -0.5 * t;
      for (const x of lengths.slice(0, -1)) {
        px += x + t;
        this.fingerHolesAt(px, posy, height, 90);
      }
    };
  }

  render(): void {
    let sx = this.o.sx;
    const { y, h } = this.o;
    const t = this.thickness;

    const x = sx.reduce((a, v) => a + v, 0) + (sx.length - 1) * t;

    const o = Math.max(0, Math.min(this.o.opening, 100));

    const b: EdgeSpec = this.edges[this.o.bottomEdge] ?? this.edges['F']!;
    let b2: EdgeSpec;
    let b3: BaseEdge;
    if (this.o.bottomEdge === 's') {
      b2 = new HalfStackableEdge(
        this,
        this.edges['s']!.settings as StackableSettings,
        this.edges['f']!.settings as FingerJointSettings,
      );
      b3 = this.edges['h']!;
    } else {
      b2 = b;
      b3 = this.getEdge(b);
    }

    const b4 = new MatchedEdge(this, b3);

    for (let side = 0; side < 2; side++) {
      const face = side === 0 ? 'Front' : 'Back';
      this.savedContext(() => {
        this.rectangularWall(y, h, [b, 'F', 'e', 'F'], {
          ignoreWidths: [1, 6],
          move: 'right',
          label: side === 0 ? 'Left Side' : 'Right Side',
        });
        // front walls
        if (this.o.opening === 0.0 || (side && !this.o.backOpenings)) {
          this.rectangularWall(x, h, [b, 'f', 'e', 'f'], {
            callback: [this.fingerHoleCB(sx, h)],
            ignoreWidths: [1, 6],
            move: 'right',
            label: face,
          });
        } else {
          this.rectangularWall((sx[0]! * (1 - o / 100)) / 2, h, [b2, 'e', 'e', 'f'], {
            ignoreWidths: [1, 6],
            move: 'right',
            label: `${face} Left`,
          });
          for (let ix = 0; ix < sx.length - 1; ix++) {
            const left = (sx[ix]! * (1 - o / 100)) / 2;
            const right = (sx[ix + 1]! * (1 - o / 100)) / 2;
            const bottomEdge = new CompoundEdge(this, [b3, b4, b3], [left, t, right]);
            this.rectangularWall(left + right + t, h, [bottomEdge, 'e', 'e', 'e'], {
              callback: [() => this.fingerHolesAt(left + t / 2, 0, h, 90)],
              move: 'right',
              label: `${face} Post`,
            });
          }

          this.rectangularWall(
            (sx[sx.length - 1]! * (1 - o / 100)) / 2,
            h,
            [b2, 'e', 'e', 'f'],
            {
              ignoreWidths: [1, 6],
              move: 'right mirror',
              label: `${face} Right`,
            },
          );
        }
      });

      this.rectangularWall(x, h, [b, 'F', 'e', 'F'], {
        ignoreWidths: [1, 6],
        move: 'up only',
      });
      // hack to have it reversed in second go and then back to normal
      sx = [...sx].reverse();
    }

    // bottom
    if (this.o.bottomEdge !== 'e') {
      const outerEdge = this.o.bottomEdge === 'f' ? 'h' : 'f';
      // boxes.py writes `font_edge` here, so with opening=0 its `front_edge` is
      // never bound and the generator raises NameError. The intent is plain, so
      // this assigns the name the author meant.
      let frontEdge: EdgeSpec = outerEdge;
      let backEdge: EdgeSpec = outerEdge;
      const uEdge = new USlotEdge(this, o, outerEdge);
      const outerWidth = this.edges[outerEdge]!.startWidth();
      if (this.o.opening > 0.0) {
        frontEdge = new CompoundEdge(
          this,
          repeatPair(uEdge, new OutSetEdge(this, outerWidth), sx.length),
          interleave(sx, t),
        );
      }
      if (this.o.opening > 0.0 && this.o.backOpenings) {
        backEdge = new CompoundEdge(
          this,
          repeatPair(uEdge, new OutSetEdge(this, outerWidth), sx.length),
          interleave([...sx].reverse(), t),
        );
      }

      this.rectangularWall(x, y, [frontEdge, outerEdge, backEdge, outerEdge], {
        callback: [this.fingerHoleCB(sx, y)],
        move: 'up',
        label: 'Bottom',
      });
    }
    // innner walls
    for (let i = 0; i < sx.length - 1; i++) {
      this.rectangularWall(y, h, `${this.o.bottomEdge === 'e' ? 'e' : 'f'}fef`, {
        move: 'right',
        label: 'Divider',
      });
    }
  }
}

/** `[a, b] * n` with the trailing `b` dropped, as boxes.py builds it. */
function repeatPair(a: BaseEdge, b: BaseEdge, n: number): BaseEdge[] {
  const out: BaseEdge[] = [];
  for (let i = 0; i < n; i++) out.push(a, b);
  return out.slice(0, -1);
}

/** Section widths with a thickness between each, and no trailing gap. */
function interleave(sections: number[], t: number): number[] {
  const out: number[] = [];
  for (const v of sections) out.push(v, t);
  return out.slice(0, -1);
}

export const notesHolder: GeneratorDef = {
  meta: {
    id: 'notesholder',
    name: 'Notes Holder',
    group: 'Box',
    summary: 'Open tray for a stack of paper, cards or coasters',
    description:
      'The front wall is cut away in the middle so a thumb can push the stack up. ' +
      'Stackable feet let several sit on top of each other; if the feet do not fit ' +
      'on the narrow front strips, reduce the opening or the stackable foot width.',
  },
  // boxes.py widens the finger-joint margin here: the front is split into short
  // strips, and the default margin would leave some of them without fingers.
  paramDefaults: { fj_surroundingspaces: 1 },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartments left to right',
      default: '78*1',
      group: 'dimensions',
      itemLabel: 'stack',
      help: '78 mm suits a standard square sticky-note pad.',
    },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 78, min: 20, max: 500, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 35, min: 5, max: 300, step: 1, group: 'dimensions' },
    {
      key: 'opening',
      kind: 'number',
      label: 'Opening',
      unit: '%',
      default: 40,
      min: 0,
      max: 100,
      step: 1,
      group: 'dimensions',
      help: 'How much of the front wall is cut away. Zero leaves it solid.',
    },
    {
      key: 'back_openings',
      kind: 'bool',
      label: 'Open the back too',
      default: false,
      group: 'dimensions',
    },
    {
      key: 'bottom_edge',
      kind: 'edge',
      label: 'Bottom edge',
      choices: 'Fhsfe',
      default: 's',
      group: 'joints',
      help: 'How the bottom attaches. "Stackable feet" lets holders sit on each other.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new NotesHolder(
      {
        sx: parseSections(s(v, 'sx', '78*1')),
        y: n(v, 'y', 78),
        h: n(v, 'h', 35),
        bottomEdge: s(v, 'bottom_edge', 's'),
        opening: n(v, 'opening', 40),
        backOpenings: b(v, 'back_openings', false),
      },
      config,
    ),
};
