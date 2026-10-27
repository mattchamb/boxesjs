/**
 * Angled cut jig — ported from boxes.py `boxes/generators/angledcutjig.py`
 * (class `AngledCutJig`).
 *
 * A jig that holds a workpiece at an angle on the laser bed, for cutting
 * angled edges.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

class AngledCutJig extends Boxes {
  constructor(
    private o: { x: number; y: number; angle: number },
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private bottomCB = (): void => {
    const t = this.thickness;
    const { x, y } = this.o;
    this.fingerHolesAt(10 - t, 4.5 * t, 20, 0);
    this.fingerHolesAt(30 + t, 4.5 * t, x, 0);
    this.fingerHolesAt(10 - t, y - 4.5 * t, 20, 0);
    this.fingerHolesAt(30 + t, y - 4.5 * t, x, 0);
  };

  render(): void {
    const { x, y, angle } = this.o;
    const t = this.thickness;

    const th = x * Math.tan((90 - angle) * DEG);
    const l = (x ** 2 + th ** 2) ** 0.5;
    const th2 = 20 * Math.tan(angle * DEG);
    const l2 = (20 ** 2 + th2 ** 2) ** 0.5;

    const holes = (len: number) => () => this.fingerHolesAt(0, 4.5 * t, len, 0);

    this.rectangularWall(30 + x + 2 * t, y, 'eeee', { callback: [this.bottomCB], move: 'right', label: 'bottom' });
    this.rectangularWall(l, y, 'eeee', { callback: [holes(l), null, holes(l), null], move: 'right', label: 'ramp' });
    this.rectangularWall(l2, y, 'eeee', { callback: [holes(l2), null, holes(l2), null], move: 'right', label: 'stop' });

    this.rectangularTriangle(x, th, 'fef', { num: 2, move: 'up', label: 'ramp support' });
    this.rectangularTriangle(20, th2, 'fef', { num: 2, move: 'up', label: 'stop support' });
  }
}

export const angledCutJig: GeneratorDef = {
  meta: {
    id: 'angledcutjig',
    name: 'Angled Cut Jig',
    group: 'Misc',
    summary: 'Jig for making angled cuts in a laser cutter',
    description: 'Holds a workpiece tilted on the laser bed, so the beam cuts its edge at the chosen angle.',
  },
  // boxes.py's own default: a smaller edge margin.
  paramDefaults: { fj_surroundingspaces: 1 },
  params: [
    { key: 'x', kind: 'length', label: 'Ramp length', unit: 'mm', default: 50, min: 10, max: 500, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'angle', kind: 'number', label: 'Cut angle', unit: '°', default: 45, min: 5, max: 85, step: 1, group: 'dimensions' },
  ],
  create: (v: ParamValues, config: BoxesConfig) => new AngledCutJig({ x: n(v, 'x', 50), y: n(v, 'y', 100), angle: n(v, 'angle', 45) }, config),
};
