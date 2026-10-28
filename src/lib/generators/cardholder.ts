/**
 * Card holder — ported from boxes.py `boxes/generators/cardholder.py`.
 *
 * A shelf of side-by-side piles of playing cards or notes. The floor leans
 * back by `angle` so the pile rests against the back wall, and its front edge
 * is grooved so a finger can get under the bottom card.
 */
import { Boxes, type BoxesConfig, type Callback } from '../boxes';
import { CompoundEdge, type BaseEdge } from '../edges/base';
import { groovedParams, STACKABLE_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface CardHolderOptions {
  sx: number[];
  y: number;
  h: number;
  outside: boolean;
  angle: number;
  stackable: boolean;
}

class CardHolder extends Boxes {
  private sx: number[];
  private y: number;
  private h: number;

  constructor(private o: CardHolderOptions, config: Partial<BoxesConfig>) {
    super(config);
    this.sx = o.sx;
    this.y = o.y;
    this.h = o.h;
  }

  /**
   * boxes.py labels none of the parts, so they are named through a callback:
   * a label would print on the sheet. `fn` is the wall's own first callback.
   */
  private named(name: string, fn?: () => void): Callback {
    return [
      () => {
        this.ctx.nameCurrentPart(name);
        fn?.();
      },
    ];
  }

  private side(): void {
    const t = this.thickness;
    const a = this.o.angle * DEG;

    const posY = this.y - Math.abs(0.5 * t * Math.sin(a));
    const posH = t - Math.cos(a) * 0.5 * t;
    this.fingerHolesAt(posY, posH, this.y, 180 - this.o.angle);
  }

  private fingerHoleCB(length: number, posy = 0.0): () => void {
    return () => {
      const t = this.thickness;
      let px = -0.5 * t;
      for (const x of this.sx.slice(0, -1)) {
        px += x + t;
        this.fingerHolesAt(px, posy, length, 90);
      }
    };
  }

  private middleWall(move: string | null = null): void {
    const { y, h } = this;
    const a = this.o.angle;
    const t = this.thickness;
    const tw = y + t;
    const th = h;

    if (this.move(tw, th, move, true)) return;
    this.ctx.nameCurrentPart('divider');

    this.moveTo(t, t, a);

    this.getEdge('f').call(y);
    this.polyline(0, 90 - a, h - t - y * Math.sin(a * DEG), 90, y * Math.cos(a * DEG), 90);
    this.getEdge('f').call(h - t);

    this.move(tw, th, move);
  }

  render(): void {
    let sx = this.sx;
    const y = this.y;
    const t = this.thickness;

    const bottom = this.o.stackable ? 'š' : 'e';
    const top = this.o.stackable ? 'S' : 'e';

    let h: number;
    if (this.o.outside) {
      this.sx = sx = this.adjustSize(sx);
      h = this.h = this.adjustSize(this.h, bottom, top);
    } else {
      h = this.h = this.h + t + y * Math.sin(this.o.angle * DEG);
    }
    const x = sx.reduce((a, v) => a + v, 0) + t * (sx.length - 1);

    this.rectangularWall(y, h, [bottom, 'F', top, 'e'], {
      ignoreWidths: [1, 6],
      callback: this.named('side', () => this.side()),
      move: 'up',
    });
    this.rectangularWall(y, h, [bottom, 'F', top, 'e'], {
      ignoreWidths: [1, 6],
      callback: this.named('side', () => this.side()),
      move: 'up mirror',
    });

    const nx = sx.length;
    const fLengths: number[] = [];
    for (const val of sx) fLengths.push(val, t);
    fLengths.pop();

    // "e".join("z" * nx): a groove per pile, plain where a divider meets it.
    const types: BaseEdge[] = [];
    for (let i = 0; i < nx; i++) types.push(this.getEdge('z'), this.getEdge('e'));
    types.pop();
    const frontedge = new CompoundEdge(this, types, fLengths);

    this.rectangularWall(x, y, [frontedge, 'f', 'e', 'f'], {
      callback: this.named('floor', this.fingerHoleCB(y)),
      move: 'up',
    });
    this.rectangularWall(x, h, bottom + 'f' + top + 'f', {
      ignoreWidths: [1, 6],
      callback: this.named('back', this.fingerHoleCB(h - t, t)),
      move: 'up',
    });
    for (let i = 0; i < nx - 1; i++) this.middleWall('right');
  }
}

export const cardHolder: GeneratorDef = {
  meta: {
    id: 'cardholder',
    name: 'Card Holder',
    group: 'Shelf',
    summary: 'Shelf for side-by-side piles of playing cards or notes',
    description:
      'The floor tilts back so each pile leans against the back wall, and a ' +
      'groove in its front edge lets a finger reach the bottom card. Stackable ' +
      'feet let several holders sit on top of each other.',
  },
  // boxes.py widens the finger-joint margin here: the dividers are short, and
  // the default margin would leave them with too few fingers.
  paramDefaults: { fj_surroundingspaces: 1.0 },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Piles left to right',
      default: '68*3',
      group: 'dimensions',
      itemLabel: 'pile',
      help: '68 mm fits a standard playing card on its long side.',
    },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 500, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 40, min: 10, max: 300, step: 1, group: 'dimensions' },
    {
      key: 'outside',
      kind: 'bool',
      label: 'Outside measurements',
      default: false,
      group: 'dimensions',
      help: 'When on, the sizes above are the finished exterior. When off, they are the usable interior.',
    },
    {
      key: 'angle',
      kind: 'number',
      label: 'Floor tilt',
      unit: '°',
      default: 7.5,
      min: 0,
      max: 45,
      step: 0.5,
      group: 'dimensions',
      help: 'How far the floor leans back, so the cards rest against the back wall.',
    },
    {
      key: 'stackable',
      kind: 'bool',
      label: 'Stackable',
      default: true,
      group: 'joints',
      help: 'Feet on the bottom and recesses on top, so holders stack.',
    },
    ...STACKABLE_PARAMS.map((p) => ({ ...p, showIf: (v: ParamValues) => v['stackable'] === true })),
    ...groovedParams(),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new CardHolder(
      {
        sx: parseSections(s(v, 'sx', '68*3')),
        y: n(v, 'y', 100),
        h: n(v, 'h', 40),
        outside: b(v, 'outside', false),
        angle: n(v, 'angle', 7.5),
        stackable: b(v, 'stackable', true),
      },
      config,
    ),
};
