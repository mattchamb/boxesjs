/**
 * Air purifier — ported from boxes.py `boxes/generators/airpurifier.py`
 * (class `AirPurifier`).
 *
 * A housing for the Nukit Open Air Purifier: a box of PC fans with a filter
 * on one or both sides, held in frames.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { DOVETAIL_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

/** Fan size, and the spacing of its screw holes, in mm. */
const FAN_HOLES: Record<number, number> = {
  40: 32.5,
  60: 50,
  80: 71.5,
  92: 82.5,
  120: 105,
  140: 125,
};

interface AirPurifierOptions {
  x: number;
  y: number;
  filterHeight: number;
  rim: number;
  fanDiameter: number;
  fanWidth: number;
  filters: number;
  splitFrames: boolean;
  fansLeft: number;
  fansRight: number;
  fansTop: number;
  fansBottom: number;
  screwHoles: number;
}

class AirPurifier extends Boxes {
  constructor(
    private o: AirPurifierOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private fanCB(n: number, h: number, l: number, fingerHoles = true, splitFrames = false, sides = 10) {
    const fh = this.o.filterHeight;
    const t = this.thickness;
    const r = this.o.rim;
    const d = this.o.fanDiameter;

    return (): void => {
      if (fingerHoles) {
        const heights = [fh + t / 2];
        if (this.o.filters > 1) heights.push(h - fh - t / 2);
        for (const h_ of heights) {
          if (splitFrames) {
            this.fingerHolesAt(0, h_, r, 0);
            this.fingerHolesAt(r, h_, l - 2 * r, 0);
            this.fingerHolesAt(l - r, h_, r, 0);
          } else {
            this.fingerHolesAt(0, h_, l, 0);
          }
        }
      }

      const maxN = Math.trunc(Math.floor((l - 2 * sides) / (d + 10)));
      const n_ = n === -1 ? maxN : Math.min(maxN, n);

      if (n_ === 0) return;
      const w = (l - 2 * sides) / n_;
      const x = sides + w / 2;
      const delta = FAN_HOLES[d]! / 2;
      const posy = this.o.filters === 2 ? h / 2 : (h + t + fh) / 2;

      for (let i = 0; i < n_; i++) {
        const posx = x + i * w;
        this.hole(posx, posy, 0, d - 4);
        for (const dx of [-delta, delta]) {
          for (const dy of [-delta, delta]) {
            this.hole(posx + dx, posy + dy, 0, this.o.screwHoles);
          }
        }
      }
    };
  }

  render(): void {
    const { x, fanDiameter: d, rim: r, filters, splitFrames } = this.o;
    const t = this.thickness;

    // One thickness shorter, as the walls take up that room.
    const y = this.o.y - t;

    const fh = this.o.filterHeight;
    const h = d + 2 + filters * (fh + t);

    const sides =
      (this.o.fansLeft || this.o.fansRight) && (this.o.fansTop || this.o.fansBottom) ? this.o.fanWidth : 10;

    this.rectangularWall(x, d, 'ffff', { callback: [this.fanCB(this.o.fansTop, d, x, false, false, sides)], label: 'top', move: 'up' });
    this.rectangularWall(x, h, 'ffff', { callback: [this.fanCB(this.o.fansBottom, h, x, true, false, sides)], label: 'bottom', move: 'up' });

    const be: EdgeSpec = splitFrames ? this.makeCompoundEdge(Array.from('fff'), [r, y - 2 * r, r]) : 'f';
    let te: EdgeSpec = be;

    let le: EdgeSpec;
    if (filters === 2) {
      le = this.makeCompoundEdge(Array.from('EFE'), [fh + t, d + 2, fh + t]);
    } else {
      le = this.makeCompoundEdge(Array.from('FE'), [d + 2, fh + t]);
      te = 'f';
    }

    for (const [fans, label] of [
      [this.o.fansLeft, 'left'],
      [this.o.fansRight, 'right'],
    ] as const) {
      this.rectangularWall(y, h, [be, 'h', te, le], { callback: [this.fanCB(fans, h, y, true, splitFrames)], move: 'up', label });
    }

    if (splitFrames) {
      const e = this.makeCompoundEdge(Array.from('DeD'), [r, x - 2 * r, r]);
      for (let i = 0; i < filters; i++) {
        const f = filters > 1 ? ` ${i + 1}` : '';
        this.rectangularWall(x, r, ['E', 'h', e, 'h'], { move: 'up', label: `outer frame${f} bottom` });
        this.rectangularWall(y - 2 * r, r, 'hded', { move: 'up', label: `outer frame${f} side` });
        this.rectangularWall(y - 2 * r, r, 'hded', { move: 'up', label: `outer frame${f} side` });
        this.rectangularWall(x, r, [e, 'h', 'h', 'h'], { move: 'up', label: `outer frame${f} top` });

        this.rectangularWall(x, r, ['F', 'f', e, 'f'], { move: 'up', label: `inner frame${f} bottom` });
        this.rectangularWall(y - 2 * r, r, 'fded', { move: 'up', label: `inner frame${f} side` });
        this.rectangularWall(y - 2 * r, r, 'fded', { move: 'up', label: `inner frame${f} side` });
        this.rectangularWall(x, r, [e, 'f', 'f', 'f'], { move: 'up', label: `inner frame${f} top` });
      }
    } else {
      const opening = [() => this.rectangularHole(x / 2, y / 2, x - r, y - r, 10)];
      for (let i = 0; i < filters; i++) {
        const f = filters > 1 ? ` ${i + 1}` : '';
        this.rectangularWall(x, y, 'Ffff', { callback: opening, move: 'up', label: `inner frame${f}` });
        this.rectangularWall(x, y, 'Ehhh', { callback: opening, move: 'up', label: `outer frame${f}` });
      }
    }
    if (filters === 1) this.rectangularWall(x, y, 'hhhh', { move: 'up', label: 'back' });
  }
}

const fans = (key: string, label: string, def: number) =>
  ({
    key,
    kind: 'number',
    label,
    default: def,
    min: -1,
    max: 20,
    step: 1,
    integer: true,
    group: 'dimensions',
    help: '-1 fits as many as there is room for.',
  }) as const;

export const airPurifier: GeneratorDef = {
  meta: {
    id: 'airpurifier',
    name: 'Air Purifier',
    group: 'Misc',
    summary: 'Housing for the Nukit Open Air Purifier',
    description:
      'A box of PC fans that draws air through a filter on one or both ' +
      'sides, held in by frames. See the Nukit Open Air Purifier project for ' +
      'the fans, filters and wiring.',
  },
  // boxes.py's own defaults: bigger, deeper dovetails for the split frames.
  paramDefaults: { dt_size: 2, dt_depth: 1 },
  params: [
    { key: 'x', kind: 'length', label: 'Filter width', unit: 'mm', default: 498, min: 100, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Filter height', unit: 'mm', default: 496, min: 100, max: 1000, step: 1, group: 'dimensions' },
    { key: 'filter_height', kind: 'length', label: 'Filter depth', unit: 'mm', default: 46.77, min: 5, max: 200, step: 0.01, group: 'dimensions', help: 'Along the air flow.' },
    { key: 'rim', kind: 'length', label: 'Frame rim', unit: 'mm', default: 30, min: 5, max: 100, step: 1, group: 'dimensions', help: 'Round the filter, holding it in place.' },
    {
      key: 'fan_diameter',
      kind: 'enum',
      label: 'Fan size',
      default: '140',
      choices: Object.keys(FAN_HOLES).map((d) => ({ value: d, label: `${d} mm` })),
      group: 'dimensions',
    },
    { key: 'fan_width', kind: 'length', label: 'Fan depth', unit: 'mm', default: 25, min: 5, max: 60, step: 1, group: 'dimensions', help: 'Front to back.' },
    {
      key: 'filters',
      kind: 'enum',
      label: 'Filters',
      default: '2',
      choices: [
        { value: '2', label: 'Both sides' },
        { value: '1', label: 'One side' },
      ],
      group: 'dimensions',
    },
    { key: 'split_frames', kind: 'bool', label: 'Split frames', default: true, group: 'dimensions', help: 'Cut each frame as four strips, to save material.' },
    fans('fans_left', 'Fans on the left', -1),
    fans('fans_right', 'Fans on the right', -1),
    fans('fans_top', 'Fans on the top', 0),
    fans('fans_bottom', 'Fans on the bottom', 0),
    { key: 'screw_holes', kind: 'length', label: 'Fan screw holes', unit: 'mm', default: 5, min: 1, max: 10, step: 0.1, group: 'dimensions' },
    ...DOVETAIL_PARAMS.map((spec) => ({ ...spec, showIf: (v: ParamValues) => v['split_frames'] === true })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new AirPurifier(
      {
        x: n(v, 'x', 498),
        y: n(v, 'y', 496),
        filterHeight: n(v, 'filter_height', 46.77),
        rim: n(v, 'rim', 30),
        fanDiameter: n(v, 'fan_diameter', 140),
        fanWidth: n(v, 'fan_width', 25),
        filters: n(v, 'filters', 2),
        splitFrames: b(v, 'split_frames', true),
        fansLeft: n(v, 'fans_left', -1),
        fansRight: n(v, 'fans_right', -1),
        fansTop: n(v, 'fans_top', 0),
        fansBottom: n(v, 'fans_bottom', 0),
        screwHoles: n(v, 'screw_holes', 5),
      },
      config,
    ),
};
