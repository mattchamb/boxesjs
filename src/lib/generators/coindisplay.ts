/**
 * Coin display — ported from boxes.py `boxes/generators/coindisplay.py`
 * (class `CoinDisplay`).
 *
 * A closed showcase holding a single coin on a tilted plate.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { BaseEdge } from '../edges/base';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

/**
 * The sloping top of the coin plate's sides. boxes.py hands the generator
 * itself to this edge as its settings; here it holds the generator directly.
 */
class CoinHolderSideEdge extends BaseEdge {
  override char: string | null = 'B';

  constructor(private display: CoinDisplay) {
    super(display, null);
  }

  call(_length: number): void {
    const { coinPlate, angle } = this.display;
    const aL2 = coinPlate * Math.sin(angle);
    const a = (angle * 180) / Math.PI;

    this.corner(-a);
    // The plate and its base lie on top of each other here, so the joint is
    // cut for twice the thickness.
    const F = this.boxes.getEdge('F');
    F.settings!.thickness = this.thickness * 2;
    F.call(coinPlate);
    F.settings!.thickness = this.thickness;

    this.polyline(0, 90 + a, aL2, -90);
  }

  override margin(): number {
    return this.display.coinPlateX;
  }
}

interface CoinDisplayOptions {
  x: number;
  y: number;
  h: number;
  outside: boolean;
  coinD: number;
  coinPlate: number;
  coinShowcaseH: number;
  angle: number;
}

class CoinDisplay extends Boxes {
  readonly coinPlate: number;
  /** In radians; set in render(). */
  angle = 0;
  coinPlateX = 0;
  private x = 0;
  private y = 0;

  constructor(
    private o: CoinDisplayOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
    this.coinPlate = o.coinPlate;
  }

  /** Finger holes in the bottom for the coin holder. */
  private bottomHoles = (): void => {
    const t = this.thickness;
    const { x, y, coinPlate, coinPlateX } = this;
    this.fingerHolesAt(x / 2 - t - t / 2 - coinPlate / 2, y / 2 + coinPlateX / 2 - t, coinPlateX, -90);
    this.fingerHolesAt(x / 2 - t + t / 2 + coinPlate / 2, y / 2 + coinPlateX / 2 - t, coinPlateX, -90);

    this.fingerHolesAt(x / 2 - coinPlate / 2 - t, y / 2 - coinPlateX / 2 - t * 1.5, coinPlate, 0);
  };

  private coinCutout = (): void => {
    this.hole(this.coinPlate / 2, this.coinPlate / 2, this.o.coinD / 2);
  };

  render(): void {
    let { x, y, h } = this.o;

    if (this.o.outside) {
      x = this.adjustSize(x);
      y = this.adjustSize(y);
      h = this.adjustSize(h);
    }
    // boxes.py's bottomHoles reads the unadjusted sizes.
    this.x = this.o.x;
    this.y = this.o.y;

    // boxes.py builds bolt policies here and then sets both to None, so the
    // walls are drawn without bolts.

    this.addPart(new CoinHolderSideEdge(this));

    this.angle = (this.o.angle * Math.PI) / 180;
    this.coinPlateX = this.coinPlate * Math.cos(this.angle);

    this.rectangularWall(x, h, 'FFFF', { move: 'right', label: 'Wall 1' });
    this.rectangularWall(y, h, 'FfFf', { move: 'up', label: 'Wall 2' });
    this.rectangularWall(y, h, 'FfFf', { label: 'Wall 4' });
    this.rectangularWall(x, h, 'FFFF', { move: 'left up', label: 'Wall 3' });

    this.rectangularWall(x, y, 'ffff', { move: 'right', label: 'Top' });
    this.rectangularWall(x, y, 'ffff', { move: 'right', label: 'Bottom', callback: [this.bottomHoles] });

    // The coin holder's sides
    const e = ['f', 'f', 'B', 'e'];
    const sh = this.o.coinShowcaseH;
    this.rectangularWall(this.coinPlateX, sh, e, { move: 'right', label: 'CoinSide1' });
    this.rectangularWall(this.coinPlateX, sh, e, { move: 'right', label: 'CoinSide2' });

    this.rectangularWall(this.coinPlate, this.coinPlate, 'efef', { move: 'left down', label: 'Coin Plate Base' });
    this.rectangularWall(this.coinPlate, this.coinPlate, 'efef', { move: 'down', label: 'Coin Plate', callback: [this.coinCutout] });

    this.rectangularWall(this.coinPlate, sh, 'fFeF', { move: 'down', label: 'CoinSide3' });
  }
}

export const coinDisplay: GeneratorDef = {
  meta: {
    id: 'coindisplay',
    name: 'Coin Display',
    group: 'Misc',
    summary: 'Closed showcase for a single coin on a tilted plate',
    description: 'A closed box with a plate inside, tilted back, that holds one coin in a round recess. Cut it from clear acrylic to show the coin off.',
  },
  params: [
    { key: 'x', kind: 'length', label: 'Width', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'y', kind: 'length', label: 'Depth', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'h', kind: 'length', label: 'Height', unit: 'mm', default: 100, min: 20, max: 1000, step: 1, group: 'dimensions' },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
    { key: 'coin_d', kind: 'length', label: 'Coin diameter', unit: 'mm', default: 20, min: 5, max: 200, step: 0.5, group: 'dimensions' },
    { key: 'coin_plate', kind: 'length', label: 'Coin plate size', unit: 'mm', default: 50, min: 10, max: 500, step: 1, group: 'dimensions' },
    { key: 'coin_showcase_h', kind: 'length', label: 'Coin stand height', unit: 'mm', default: 50, min: 5, max: 500, step: 1, group: 'dimensions' },
    { key: 'angle', kind: 'number', label: 'Tilt', unit: '°', default: 30, min: 0, max: 80, step: 1, group: 'dimensions', help: 'Of the coin, back from upright.' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new CoinDisplay(
      {
        x: n(v, 'x', 100),
        y: n(v, 'y', 100),
        h: n(v, 'h', 100),
        outside: b(v, 'outside', true),
        coinD: n(v, 'coin_d', 20),
        coinPlate: n(v, 'coin_plate', 50),
        coinShowcaseH: n(v, 'coin_showcase_h', 50),
        angle: n(v, 'angle', 30),
      },
      config,
    ),
};
