/**
 * Crate — ported from boxes.py `boxes/generators/crate.py` (class `Crate`).
 *
 * An open box with a hand hole in every wall, stackable by default. The
 * optional pattern mask draws, on the annotation layer, the area of each wall
 * that is free for a decorative cut-out pattern added in another program.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { StackableSettings } from '../edges/stackable';
import { ANNOTATIONS } from '../geom/colors';
import { BOTTOM_LIP_PARAMS, STACKABLE_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface CrateOptions {
  x: number;
  y: number;
  h: number;
  handleOffset: number;
  handleWidth: number;
  handleHeight: number;
  handleRadius: number;
  stackable: boolean;
  patternMask: boolean;
}

class Crate extends Boxes {
  constructor(
    private o: CrateOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private handleHole(width: number): void {
    const o = this.o;
    const stackEdge = this.getEdge('s').settings as StackableSettings;
    const offsetForStacking = o.stackable ? stackEdge.height : 0;
    const hoffset = o.handleOffset;
    const handley = o.handleHeight / 2 + hoffset - offsetForStacking;
    this.rectangularHole(width / 2, handley, o.handleWidth, o.handleHeight, o.handleRadius);
    if (o.patternMask) {
      this.rectangularHole(
        width / 2,
        handley,
        o.handleWidth + hoffset * 2,
        o.handleHeight + hoffset * 2,
        o.handleRadius + hoffset,
        true,
        true,
        ANNOTATIONS,
      );
      const patternHeight = o.h - hoffset * 2;
      const patterny = o.stackable ? handley + patternHeight / 2 : hoffset + patternHeight / 2;
      this.rectangularHole(width / 2, patterny, width - hoffset * 2, patternHeight, 0, true, true, ANNOTATIONS);
    }
  }

  private frontHandleHole = (): void => this.handleHole(this.o.x);

  private sideHandleHole = (): void => this.handleHole(this.o.y);

  render(): void {
    const { x, y, h } = this.o;

    this.rectangularWall(y, x, 'ffff', { move: 'up', label: 'Bottom' });

    const frontEdges = this.o.stackable ? 'sfSf' : 'hfef';
    const sideEdges = this.o.stackable ? 'sFSF' : 'hFeF';

    // The handle holes are drawn from the top edge's callback, so they are
    // placed in the wall's frame turned upside down: measured from the top.
    const side = { callback: [null, null, this.sideHandleHole, null], ignoreWidths: [1, 6] };
    this.rectangularWall(y, h, sideEdges, { ...side, move: 'up', label: 'side1' });
    this.rectangularWall(y, h, sideEdges, { ...side, move: 'up', label: 'side2' });

    const front = { callback: [null, null, this.frontHandleHole, null], ignoreWidths: [1, 6] };
    this.rectangularWall(x, h, frontEdges, { ...front, move: 'right', label: 'front' });
    this.rectangularWall(x, h, frontEdges, { ...front, label: 'back' });
  }
}

export const crate: GeneratorDef = {
  meta: {
    id: 'crate',
    name: 'Crate',
    group: 'Box',
    summary: 'Open crate with a hand hole in every wall, stackable',
    description:
      'An open-topped crate with a rounded hand hole near the top of each ' +
      'wall. Stackable feet let crates sit on one another. The pattern mask ' +
      'marks the part of each wall left free for a decorative cut-out, for ' +
      'filling in another program.',
  },
  // Upstream starts the finger-hole bottom with a lip and the stackable feet
  // with stabilisers under the bottom panel.
  paramDefaults: { fj_bottom_lip: 1.0, st_bottom_stabilizers: 2.0 },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 150, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 200, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    {
      key: 'MakeStackable',
      kind: 'bool',
      label: 'Stackable',
      default: true,
      group: 'joints',
      help: 'Feet under the walls that locate in the top of the crate below.',
    },
    {
      key: 'HandleWidth',
      kind: 'length',
      label: 'Handle width',
      unit: 'mm',
      default: 100,
      min: 10,
      max: 500,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'HandleHeight',
      kind: 'length',
      label: 'Handle height',
      unit: 'mm',
      default: 25,
      min: 5,
      max: 200,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'HandleRadius',
      kind: 'length',
      label: 'Handle corner radius',
      unit: 'mm',
      default: 12.5,
      min: 0,
      max: 100,
      step: 0.5,
      group: 'dimensions',
    },
    {
      key: 'HandleOffset',
      kind: 'length',
      label: 'Handle distance from top',
      unit: 'mm',
      default: 10,
      min: 0,
      max: 200,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'AddPatternMask',
      kind: 'bool',
      label: 'Pattern mask',
      default: false,
      group: 'advanced',
      help: 'Marks, on the annotation layer, the area of each wall left free for a decorative pattern.',
    },
    ...STACKABLE_PARAMS.map((spec) => ({ ...spec, showIf: (v: ParamValues) => v['MakeStackable'] === true })),
    ...BOTTOM_LIP_PARAMS,
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Crate(
      {
        x: n(v, 'x', 150),
        y: n(v, 'y', 200),
        h: n(v, 'h', 100),
        handleOffset: n(v, 'HandleOffset', 10),
        handleWidth: n(v, 'HandleWidth', 100),
        handleHeight: n(v, 'HandleHeight', 25),
        handleRadius: n(v, 'HandleRadius', 12.5),
        stackable: b(v, 'MakeStackable', true),
        patternMask: b(v, 'AddPatternMask', false),
      },
      config,
    ),
};
