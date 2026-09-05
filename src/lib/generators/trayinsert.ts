/**
 * Tray insert — ported from boxes.py `boxes/generators/trayinsert.py`.
 *
 * Dividers only: no floor and no outer walls. The grid drops into a tray or box
 * you already have, which is why it can also be sized to the box rather than to
 * the compartments — see the `x`/`y` handling in `render()`.
 */
import { Boxes, type BoxesConfig, type EdgeSpec } from '../boxes';
import { BaseEdge } from '../edges/base';
import { SlottedEdge } from '../edges/slots';
import { parseSections } from '../params/sections';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

/**
 * A side edge that leans over by a fixed angle, so the walls splay outwards
 * towards the top and the insert lifts out of a moulded tray. Like several
 * generator-local edges in boxes.py its "settings" is a bare number — here the
 * signed angle, whose sign picks which way the lean goes — so the port takes it
 * as a real constructor argument.
 */
class SlantedEdge extends BaseEdge {
  override description = 'Slanted edge';

  constructor(
    boxes: Boxes,
    private readonly slant: number,
  ) {
    super(boxes, null);
  }

  call(length: number): void {
    const angle = Math.abs(this.slant);
    let poly: number[];
    if (angle === 0) {
      poly = [length];
    } else {
      const d = length * Math.tan(angle * DEG);
      const l = length / Math.cos(angle * DEG);
      poly = [0, -90, d, 90 + angle, l, -angle, 0];
    }

    if (this.slant >= 0) poly.reverse();

    this.polyline(...poly);
  }
}

interface TrayInsertOptions {
  sx: number[];
  sy: number[];
  h: number;
  outside: boolean;
  x: number;
  y: number;
  draftAngle: number;
}

class TrayInsert extends Boxes {
  private sx: number[];
  private sy: number[];

  constructor(
    private o: TrayInsertOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.sx = [...o.sx];
    this.sy = [...o.sy];
  }

  render(): void {
    if (this.o.outside) {
      this.sx = this.adjustSize(this.sx, false, false);
      this.sy = this.adjustSize(this.sy, false, false);
    }

    const t = this.thickness;
    let x = this.sx.reduce((a, v) => a + v, 0) + t * (this.sx.length - 1);
    let y = this.sy.reduce((a, v) => a + v, 0) + t * (this.sy.length - 1);
    const h = this.o.h;

    const l = new SlantedEdge(this, -this.o.draftAngle);
    const r = new SlantedEdge(this, this.o.draftAngle);

    // Sized to a container rather than to the compartments: spread the slack
    // across two new outer cells, unless there is less of it than one wall is
    // thick, in which case widen the outermost cells instead.
    if (this.o.x > x) {
      const delta = this.o.x - x;
      if (delta > 2 * t) {
        this.sx = [delta / 2 - t, ...this.sx, delta / 2 - t];
      } else {
        this.sx[0]! += delta / 2;
        this.sx[this.sx.length - 1]! += delta / 2;
      }
      x = this.o.x;
    }

    if (this.o.y > y) {
      const delta = this.o.y - y;
      if (delta > 2 * t) {
        this.sy = [delta / 2 - t, ...this.sy, delta / 2 - t];
      } else {
        this.sy[0]! += delta / 2;
        this.sy[this.sy.length - 1]! += delta / 2;
      }
      y = this.o.y;
    }

    // Inner walls. The two sets slot into each other from opposite ends.
    for (let i = 0; i < this.sx.length - 1; i++) {
      const e: EdgeSpec[] = [new SlottedEdge(this, this.sy, 'e', 0.5 * h), r, 'e', l];
      this.rectangularWall(y, h, e, { move: 'up', label: `Divider along ${i + 1}` });
    }

    for (let i = 0; i < this.sy.length - 1; i++) {
      const e: EdgeSpec[] = [
        'e',
        r,
        new SlottedEdge(this, [...this.sx].reverse(), 'e', 0.5 * h),
        l,
      ];
      this.rectangularWall(x, h, e, { move: 'up', label: `Divider across ${i + 1}` });
    }
  }
}

export const trayInsert: GeneratorDef = {
  meta: {
    id: 'trayinsert',
    name: 'Tray Insert',
    group: 'Tray',
    summary: 'Divider grid with no floor or outer walls',
    description:
      'An egg-crate of dividers that drops into a tray or box you already have. ' +
      'Give the compartment sizes, and optionally the inside size of the container: ' +
      'any slack is taken up by extra outer cells so the grid fills it exactly. ' +
      'A draft angle leans the walls outwards towards the top for an easier lift-out.',
  },
  // Divider walls are short; the standard edge margin would leave many of them
  // with no fingers at all, which is why the slots need a smaller one.
  paramDefaults: { fj_surroundingspaces: 0.5 },
  params: [
    {
      key: 'sx',
      kind: 'sections',
      label: 'Compartments left to right',
      default: '50*3',
      group: 'dimensions',
      itemLabel: 'compartment',
      help: 'Width of each compartment across the insert.',
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
    {
      key: 'outside',
      kind: 'bool',
      label: 'Outside measurements',
      default: true,
      group: 'dimensions',
      help: 'On, the compartment sizes add up to the overall size; off, the walls sit between them.',
    },
    {
      key: 'x',
      kind: 'length',
      label: 'Container width',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 1000,
      step: 1,
      group: 'dimensions',
      // boxes.py uses -1 for "not given"; anything at or below the compartment
      // total is ignored either way, so 0 reads better as the off position.
      help: 'Inside width of the tray this fits into. Leave at 0 to size to the compartments.',
    },
    {
      key: 'y',
      kind: 'length',
      label: 'Container depth',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 1000,
      step: 1,
      group: 'dimensions',
      help: 'Inside depth of the tray this fits into. Leave at 0 to size to the compartments.',
    },
    {
      key: 'draft_angle',
      kind: 'number',
      label: 'Draft angle',
      unit: '°',
      default: 0,
      min: 0,
      max: 30,
      step: 0.5,
      group: 'advanced',
      help: 'Lean on the wall ends, so the insert widens towards the top. The compartment sizes are measured at the bottom.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new TrayInsert(
      {
        sx: parseSections(s(v, 'sx', '50*3')),
        sy: parseSections(s(v, 'sy', '50*3')),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        x: n(v, 'x', 0),
        y: n(v, 'y', 0),
        draftAngle: n(v, 'draft_angle', 0),
      },
      config,
    ),
};
