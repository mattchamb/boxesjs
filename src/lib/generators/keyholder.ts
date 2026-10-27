/**
 * Key holder — ported from boxes.py `boxes/generators/keyholder.py`
 * (class `KeyHolder`).
 *
 * A back plate with a row of hooks for keys or other small things.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { BaseEdge } from '../edges/base';
import { MOUNTING_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

/**
 * The hook's curl, drawn along one side of each hook. boxes.py reads the
 * hook sizes from the generator through the edge; here it holds it directly.
 */
class HangerEdge extends BaseEdge {
  override char: string | null = 'H';

  constructor(private holder: KeyHolder) {
    super(holder, null);
  }

  override margin(): number {
    return this.holder.hookHeight * 0.7;
  }

  call(_length: number): void {
    const { hookHeight, hookThickness } = this.holder;
    // Radius of the bottom part of the hook
    const radiusOutside = hookHeight * 0.5;
    const radiusInside = radiusOutside - hookThickness;

    // Make corners less sharp
    const radiusBurr = 1.5;

    const hookInnerHeight = hookHeight * 0.7;
    const hookLength = hookHeight * 0.7;

    // Correct orientation
    this.polyline(0, -90);

    // Line bottom
    this.edge(hookLength - radiusOutside);

    // Outer corner
    this.corner(90, radiusOutside);

    // Line right
    this.edge(hookInnerHeight - radiusOutside - hookThickness / 2);

    // Semicircle at top
    this.corner(180, hookThickness / 2);

    // Line left-ish
    this.edge(hookInnerHeight - hookThickness - hookThickness / 2 - radiusInside);

    // Inner corner
    this.corner(-90, radiusInside);

    // Line bottom
    this.edge(hookLength - hookThickness - 2 * radiusBurr - radiusInside);
    this.corner(-90, radiusBurr);

    // Line top
    this.edge(hookHeight - hookThickness - 2 * radiusBurr);
    this.corner(90, radiusBurr);

    // Correct orientation
    this.polyline(0, -90);
  }
}

interface KeyHolderOptions {
  numHooks: number;
  hookDistance: number;
  hookThickness: number;
  hookHeight: number;
  paddingTop: number;
  paddingLeftRight: number;
  paddingBot: number;
  mounting: boolean;
}

class KeyHolder extends Boxes {
  readonly hookHeight: number;
  readonly hookThickness: number;

  constructor(
    private o: KeyHolderOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.hookHeight = o.hookHeight;
    this.hookThickness = o.hookThickness;
  }

  /** Holes for the hooks to attach to. */
  private yHoles = (): void => {
    let posx = 0.5 * this.thickness;
    posx += this.o.paddingLeftRight;
    for (let i = 0; i < this.o.numHooks; i++) {
      this.fingerHolesAt(posx, this.o.paddingBot, this.hookHeight);
      posx += this.o.hookDistance + this.thickness;
    }
  };

  render(): void {
    this.addPart(new HangerEdge(this));
    const { numHooks, hookDistance, paddingLeftRight, paddingBot, paddingTop } = this.o;

    // Total height and width of the backplate
    const h = this.hookHeight + paddingBot + paddingTop;
    const w = paddingLeftRight * 2 + numHooks * this.thickness + (numHooks - 1) * hookDistance;

    this.rectangularWall(w, h, this.o.mounting ? 'eeGe' : 'eeee', {
      callback: [this.yHoles, null, null, null],
      move: 'up',
      label: 'back',
    });

    for (let i = 0; i < numHooks; i++) {
      this.rectangularWall(this.hookThickness, this.hookHeight, 'eHef', { move: 'right', label: `hook ${i + 1}` });
    }
  }
}

export const keyHolder: GeneratorDef = {
  meta: {
    id: 'keyholder',
    name: 'Key Holder',
    group: 'Wall mounted',
    summary: 'Back plate with a row of hooks for keys',
    description: 'A row of hooks on a back plate, for keys or other small things. Thicker material makes stronger hooks.',
  },
  // boxes.py's own defaults: small fingers, right up to the ends of the
  // short hook joints.
  paramDefaults: { fj_surroundingspaces: 0, fj_finger: 1, fj_space: 1 },
  params: [
    { key: 'num_hooks', kind: 'number', label: 'Hooks', default: 7, min: 1, max: 50, step: 1, integer: true, group: 'dimensions' },
    { key: 'hook_distance', kind: 'length', label: 'Hook spacing', unit: 'mm', default: 20, min: 0, max: 200, step: 1, group: 'dimensions', help: 'Gap between hooks.' },
    { key: 'hook_thickness', kind: 'length', label: 'Hook thickness', unit: 'mm', default: 5, min: 1, max: 50, step: 0.5, group: 'dimensions' },
    { key: 'hook_height', kind: 'length', label: 'Hook height', unit: 'mm', default: 20, min: 5, max: 200, step: 1, group: 'dimensions', help: 'Of the part against the plate.' },
    { key: 'padding_top', kind: 'length', label: 'Space above', unit: 'mm', default: 10, min: 0, max: 200, step: 1, group: 'dimensions' },
    { key: 'padding_left_right', kind: 'length', label: 'Space at the sides', unit: 'mm', default: 5, min: 0, max: 200, step: 1, group: 'dimensions' },
    { key: 'padding_bot', kind: 'length', label: 'Space below', unit: 'mm', default: 30, min: 0, max: 200, step: 1, group: 'dimensions' },
    { key: 'mounting', kind: 'bool', label: 'Mounting holes', default: false, group: 'dimensions', help: 'Keyhole slots along the top.' },
    ...MOUNTING_PARAMS.map((spec) => ({ ...spec, showIf: (v: ParamValues) => v['mounting'] === true })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new KeyHolder(
      {
        numHooks: n(v, 'num_hooks', 7),
        hookDistance: n(v, 'hook_distance', 20),
        hookThickness: n(v, 'hook_thickness', 5),
        hookHeight: n(v, 'hook_height', 20),
        paddingTop: n(v, 'padding_top', 10),
        paddingLeftRight: n(v, 'padding_left_right', 5),
        paddingBot: n(v, 'padding_bot', 30),
        mounting: b(v, 'mounting', false),
      },
      config,
    ),
};
