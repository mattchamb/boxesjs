/**
 * Z-beam — ported from boxes.py `boxes/generators/zbeam.py` (class `ZBeam`).
 *
 * Three strips joined at right angles into a Z or U, optionally with a
 * fourth as a flange.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, s, type GeneratorDef } from './types';

interface ZBeamOptions {
  x: number;
  y: number;
  z: number;
  h: number;
  outside: boolean;
  topEdge: string;
  bottomEdge: string;
  flangedUbeam: boolean;
}

class ZBeam extends Boxes {
  constructor(
    private o: ZBeamOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    let { x, y, z } = this.o;
    const { h, topEdge: te, bottomEdge: be } = this.o;

    if (this.o.outside) {
      x = this.adjustSize(x, false);
      y = this.adjustSize(y, false);
      z = this.adjustSize(z, false);
    }

    this.rectangularWall(x, h, be + 'F' + te + 'e', { move: 'right', label: 'x side' });
    this.rectangularWall(y, h, be + 'f' + te + 'f', { move: 'right', label: 'y side' });
    if (this.o.flangedUbeam) {
      this.rectangularWall(z, h, be + 'F' + te + 'F', { move: 'right', label: 'z side' });
      this.rectangularWall(y + this.thickness, h, be + 'e' + te + 'f', { label: 'flange' });
    } else {
      this.rectangularWall(z, h, be + 'e' + te + 'F', { label: 'z side' });
    }
  }
}

export const zBeam: GeneratorDef = {
  meta: {
    id: 'zbeam',
    name: 'Z-Beam',
    group: 'Misc',
    summary: 'Three strips joined at right angles, as a Z or U',
    description: 'Three pieces finger-jointed along their length. As a U-beam it can have a fourth piece, the length of the middle one, as a flange.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'First side', unit: 'mm', default: 100, min: 5, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Middle', unit: 'mm', default: 100, min: 5, max: 1000, step: 1, group: 'dimensions' },
    { key: 'z', kind: 'length', label: 'Last side', unit: 'mm', default: 100, min: 5, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Length', unit: 'mm', default: 100, min: 10, max: 2000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    { key: 'flanged_ubeam', kind: 'bool', label: 'U-beam with a flange', default: false, group: 'dimensions', help: 'Adds a fourth piece the length of the middle.' },
    { key: 'top_edge', kind: 'edge', label: 'Top edge', choices: 'Ffe', default: 'e', group: 'joints' },
    { key: 'bottom_edge', kind: 'edge', label: 'Bottom edge', choices: 'Ffe', default: 'e', group: 'joints' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new ZBeam(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        z: n(v, 'z', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        topEdge: s(v, 'top_edge', 'e'),
        bottomEdge: s(v, 'bottom_edge', 'e'),
        flangedUbeam: b(v, 'flanged_ubeam', false),
      },
      config,
    ),
};
