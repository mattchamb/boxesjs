/**
 * Rounded box — ported from boxes.py `boxes/generators/roundedbox.py`
 * (class `RoundedBox`).
 *
 * A box with its four vertical corners rounded: rounded plates for the
 * bottom, any shelves and the top, and one wall bent round them as a living
 * hinge, split into up to four pieces that meet with dovetails.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { DOVETAIL_PARAMS, FLEX_PARAMS } from '../params/common';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

type TopStyle = 'hole' | 'lid' | 'closed';

interface RoundedBoxOptions {
  x: number;
  y: number;
  sh: number[];
  outside: boolean;
  radius: number;
  wallpieces: number;
  edgeStyle: string;
  top: TopStyle;
}

class RoundedBox extends Boxes {
  private x: number;
  private y: number;
  private sh: number[];
  private radius: number;

  constructor(
    private o: RoundedBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.x = o.x;
    this.y = o.y;
    this.sh = [...o.sh];
    this.radius = o.radius;
  }

  /**
   * The opening in the top plate. boxes.py names this `hole`, shadowing the
   * base class's, which takes arguments; nothing that calls that one runs
   * here.
   */
  private holeCB = (): void => {
    const t = this.thickness;
    const { x, y } = this;
    let r = this.radius;

    const dr = this.o.edgeStyle === 'h' ? t : 2 * t;

    if (r > dr) {
      r -= dr;
    } else {
      this.moveTo(dr - r, 0);
      r = 0;
    }

    const lx = x - 2 * r - 2 * dr;
    const ly = y - 2 * r - 2 * dr;

    this.moveTo(0, dr);
    for (const l of [lx, ly, lx, ly]) {
      this.edge(l);
      this.corner(90, r);
    }
  };

  /** Slots for the shelves, along whichever run of the wall this is. */
  private cb = (nr: number): void => {
    let h = 0.5 * this.thickness;

    const [, l] = this.surroundingWallPiece(nr, this.x, this.y, this.radius, this.o.wallpieces);
    for (const dh of this.sh.slice(0, -1)) {
      h += dh;
      this.fingerHolesAt(0, h, l, 0);
    }
  };

  render(): void {
    const es = this.o.edgeStyle;
    const wallpieces = this.o.wallpieces;

    if (this.o.outside) {
      this.x = this.adjustSize(this.x, es, es);
      this.y = this.adjustSize(this.y, es, es);
      this.sh = this.adjustSize(this.sh);
    }
    const { x, y, sh } = this;

    const r = (this.radius = Math.min(this.radius, y / 2.0));

    const t = this.thickness;

    const h = sh.reduce((a, c) => a + c, 0) + t * (sh.length - 1);

    // The wall takes the counterpart of the plates' edge. With finger holes
    // in the wall, the plates' corners are extended to meet it.
    const pe = es === 'f' ? 'F' : 'f';
    const ec = es === 'h';

    this.savedContext(() => {
      this.roundedPlate(x, y, r, { edge: es, wallpieces, extendCorners: ec, move: 'right', label: 'bottom' });
      sh.slice(0, -1).forEach((_, i) => {
        this.roundedPlate(x, y, r, { edge: 'f', wallpieces, extendCorners: false, move: 'right', label: `shelf ${i + 1}` });
      });
      this.roundedPlate(x, y, r, {
        edge: es,
        wallpieces,
        extendCorners: ec,
        move: 'right',
        callback: this.o.top !== 'closed' ? [this.holeCB] : null,
        label: 'top',
      });
      if (this.o.top === 'lid') {
        const rExtra = this.getEdge(es).spacing();
        this.roundedPlate(x + 2 * rExtra, y + 2 * rExtra, r + rExtra, {
          edge: 'e',
          wallpieces,
          extendCorners: false,
          move: 'right',
          label: 'lid',
        });
      }
    });

    this.roundedPlate(x, y, r, { edge: es, wallpieces, move: 'up only' });

    this.surroundingWall(x, y, r, h, { bottom: pe, top: pe, pieces: wallpieces, callback: this.cb, label: 'wall' });
  }
}

export const roundedBox: GeneratorDef = {
  meta: {
    id: 'roundedbox',
    name: 'Rounded Box',
    group: 'Box',
    summary: 'Box with rounded vertical corners, its wall bent from a living hinge',
    description:
      'Rounded plates for the bottom and top, and optional shelves between, ' +
      'with one wall bent round them as a living hinge. Split the wall into ' +
      'up to four pieces, joined with dovetails, to fit a smaller sheet. The ' +
      'top can have an opening, an opening with a lid, or be closed.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    {
      key: 'sh',
      kind: 'sections',
      label: 'Shelf heights, bottom to top',
      default: '100.0',
      group: 'dimensions',
      itemLabel: 'level',
      help: 'More than one level adds a shelf between each.',
    },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    { key: 'radius', kind: 'length', label: 'Corner radius', unit: 'mm', default: 15, min: 0, max: 300, step: 1, group: 'dimensions' },
    {
      key: 'wallpieces',
      kind: 'enum',
      label: 'Wall pieces',
      default: '1',
      choices: [
        { value: '1', label: 'One' },
        { value: '2', label: 'Two' },
        { value: '3', label: 'Three' },
        { value: '4', label: 'Four' },
      ],
      group: 'joints',
      help: 'Split the wall so it fits a smaller sheet. The pieces meet with dovetails.',
    },
    {
      key: 'edge_style',
      kind: 'edge',
      label: 'Plate edge',
      choices: 'fFh',
      default: 'f',
      group: 'joints',
      help: 'How the bottom and top plates join the wall. Finger holes put the plates inside the wall.',
    },
    {
      key: 'top',
      kind: 'enum',
      label: 'Top',
      default: 'hole',
      choices: [
        { value: 'hole', label: 'Opening' },
        { value: 'lid', label: 'Opening and lid' },
        { value: 'closed', label: 'Closed' },
      ],
      group: 'top',
    },
    ...DOVETAIL_PARAMS.map((spec) => ({ ...spec, showIf: undefined })),
    ...FLEX_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new RoundedBox(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        sh: parseSections(s(v, 'sh', '100.0')),
        outside: b(v, 'outside', true),
        radius: n(v, 'radius', 15),
        wallpieces: n(v, 'wallpieces', 1),
        edgeStyle: s(v, 'edge_style', 'f'),
        top: s(v, 'top', 'hole') as TopStyle,
      },
      config,
    ),
};
