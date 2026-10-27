/**
 * Console — ported from boxes.py `boxes/generators/console.py`
 * (class `Console`).
 *
 * A box whose front slopes back as a control panel above a short upright
 * front, as for an arcade stick or a keyboard enclosure. The two sides are
 * the profile; `polygonWalls` draws everything that runs between them.
 * Console2 is the fuller version, with a removable panel and back.
 */
import { Boxes, type BoxesConfig, type PolygonBorder } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

interface ConsoleOptions {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  frontHeight: number;
  angle: number;
}

class Console extends Boxes {
  constructor(
    private o: ConsoleOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    let { x, y, h } = this.o;
    const { frontHeight: hf, angle } = this.o;
    const t = this.thickness;

    if (this.o.outside) {
      x = this.adjustSize(x);
      y = this.adjustSize(y);
      h = this.adjustSize(h);
    }

    // The panel is as long as fits under the height and within the depth.
    const panel = Math.min((h - hf) / Math.cos((90 - angle) * DEG), y / Math.cos(angle * DEG));
    const top = y - panel * Math.cos(angle * DEG);
    h = hf + panel * Math.sin(angle * DEG);

    let borders: PolygonBorder[] =
      top > 0.1 * t
        ? [y, 90, hf, 90 - angle, panel, angle, top, 90, h, 90]
        : [y, 90, hf, 90 - angle, panel, angle + 90, h, 90];

    // With no upright front, the panel starts straight from the bottom.
    if (hf < 0.01 * t) borders = [borders[0]!, 180 - angle, ...borders.slice(4)];

    this.polygonWall(borders, { move: 'right', label: 'left' });
    this.polygonWall(borders, { move: 'right', label: 'right' });
    this.polygonWalls(borders, x);
  }
}

export const consoleBox: GeneratorDef = {
  meta: {
    id: 'console',
    name: 'Console',
    group: 'Box',
    summary: 'Box with a sloping front panel, for an arcade stick or keyboard',
    description:
      'A closed box whose front slopes back as a control panel above a short ' +
      'upright front. Cut holes for buttons or a joystick into the panel ' +
      'afterwards. See Console 2 for a version with a removable panel.',
  },
  // The bottom, panel and front are short walls; a smaller edge margin keeps
  // fingers on them.
  paramDefaults: { fj_surroundingspaces: 0.5 },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 10, max: 1000, step: 1, group: 'dimensions', help: 'The most the back can be; a shallow box with a steep panel ends up lower.' },
    {
      key: 'front_height',
      kind: 'length',
      label: 'Front height',
      unit: 'mm',
      default: 30,
      min: 0,
      max: 500,
      step: 1,
      group: 'dimensions',
      help: 'Height of the upright front below the panel. 0 slopes the panel straight from the bottom.',
    },
    {
      key: 'angle',
      kind: 'number',
      label: 'Panel angle',
      unit: '°',
      default: 50,
      min: 10,
      max: 90,
      step: 1,
      group: 'dimensions',
      help: '90° is upright.',
    },
    {
      key: 'outside',
      kind: 'bool',
      label: 'Outside measurements',
      default: false,
      group: 'dimensions',
      help: 'When on, the sizes above are the exterior. When off, they are the interior.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Console(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', false),
        frontHeight: n(v, 'front_height', 30),
        angle: n(v, 'angle', 50),
      },
      config,
    ),
};
