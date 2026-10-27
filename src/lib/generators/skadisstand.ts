/**
 * Skadis stand — ported from boxes.py `boxes/generators/skadisstand.py`
 * (class `SkadisStand`).
 *
 * A foot that hooks into the slots of a Skadis pegboard so the board can
 * stand on its own, leaning back.
 */
import { Boxes, type BoxesConfig, type PolygonBorder } from '../boxes';
import type { ParamValues } from '../params/schema';
import { parseSections } from '../params/sections';
import { n, s, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface SkadisStandOptions {
  angle: number;
  foot: number;
  footFront: number;
  connectors: number[];
  extraHeightTop: number;
  extraHeightBottom: number;
}

class SkadisStand extends Boxes {
  constructor(
    private o: SkadisStandOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private connectorPoly(): PolygonBorder[] {
    const cons = [...this.o.connectors].sort((a, b) => a - b);
    // The slots alternate between rows, so every connector must be on the
    // same parity as the first.
    for (let i = 0; i < cons.length; i++) {
      if (mod(cons[i]!, 2) !== mod(cons[0]!, 2)) cons[i]! += 1;
    }
    let pos = 0;
    const poly: PolygonBorder[] = [this.o.extraHeightBottom + 5, 0];
    for (const c of cons) {
      poly.push((c - pos) * 20 - 10, -90, 4.5, 90, 10, 90, 4.5, -90);
      pos = c;
    }
    return poly;
  }

  render(): void {
    const t = this.thickness;

    const a = this.o.angle;
    const [f, ff] = [this.o.foot, this.o.footFront];
    const [hB, hT] = [this.o.extraHeightBottom, this.o.extraHeightTop];
    const cons = this.o.connectors;
    const r = 0.2 * f;
    const w = Math.max(f / 10, t);

    const h = hB + hT + Math.max(...cons) * 20 + 20;
    const dr = r * Math.tan((90 - a / 2) * DEG);

    if (ff) {
      this.roundedPlate(f + ff, 2 * w, w, {
        edge: 'e',
        callback: [() => this.fingerHolesAt(ff - w, w, f - 0.5 * t, 0)],
        extendCorners: false,
        move: 'up',
        label: 'front foot',
      });
    }

    this.polygonWall(
      [
        f - t / 2,
        [90, t / 2],
        w - t,
        [90, t / 2],
        f - t / 2 - dr - w * Math.tan((90 - a) * DEG) - w / Math.sin(a * DEG),
        [-180 + a, r],
        h - dr - w / Math.sin(a * DEG) - w * Math.cos(a * DEG) - t / 2,
        [90, t / 2],
        w - t,
        [90, t / 2],
        hT + 15 - t / 2,
        ...this.connectorPoly().reverse(),
        180 - a,
      ],
      { edge: ff ? 'feeeeeeeeeeeeeeeeeeeee' : 'e', correctCorners: false, label: 'stand' },
    );
  }
}

/** Python's modulo, which keeps the divisor's sign. */
function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

export const skadisStand: GeneratorDef = {
  meta: {
    id: 'skadisstand',
    name: 'Skadis Stand',
    group: 'Wall mounted',
    summary: 'Foot that lets a Skadis pegboard stand on its own',
    description:
      'Hooks into the slots of a Skadis board and holds it leaning back at ' +
      'the angle you choose. Cut one for each side. A foot to the front ' +
      'steadies it further.',
  },
  params: [
    { key: 'angle', kind: 'number', label: 'Board angle', unit: '°', default: 70, min: 30, max: 90, step: 1, group: 'dimensions', help: '90 stands the board upright.' },
    { key: 'foot', kind: 'length', label: 'Foot length', unit: 'mm', default: 100, min: 20, max: 500, step: 1, group: 'dimensions', help: 'Behind the board.' },
    {
      key: 'foot_front',
      kind: 'length',
      label: 'Front foot length',
      unit: 'mm',
      default: 0,
      min: 0,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'A separate foot in front of the board. 0 leaves it out.',
    },
    {
      key: 'connectors',
      kind: 'text',
      label: 'Connector rows',
      default: '1:3',
      group: 'dimensions',
      placeholder: '1:3',
      help: 'Which rows of slots the stand hooks into, counted from the bottom, separated by colons. All odd or all even.',
    },
    { key: 'extra_height_top', kind: 'length', label: 'Height above', unit: 'mm', default: 20, min: 0, max: 500, step: 1, group: 'dimensions', help: 'Above the top connector.' },
    { key: 'extra_height_bottom', kind: 'length', label: 'Height below', unit: 'mm', default: 0, min: 0, max: 500, step: 1, group: 'dimensions', help: 'Space below the board.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new SkadisStand(
      {
        angle: n(v, 'angle', 70),
        foot: n(v, 'foot', 100),
        footFront: n(v, 'foot_front', 0),
        // boxes.py reads these as whole numbers.
        connectors: parseSections(s(v, 'connectors', '1:3')).map(Math.trunc),
        extraHeightTop: n(v, 'extra_height_top', 20),
        extraHeightBottom: n(v, 'extra_height_bottom', 0),
      },
      config,
    ),
};
