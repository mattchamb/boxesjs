/**
 * Matrix — ported from boxes.py `boxes/generators/matrix.py`
 * (class `Matrix`).
 *
 * An enclosure for a cheap prebuilt WS2812b LED matrix: a grid that keeps
 * each LED's light to its own square, a frame holding the panel, spacer and
 * plexiglass together, and a box behind for the electronics.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface MatrixOptions {
  ledWidth: number;
  ledHeight: number;
  physicalLedX: number;
  physicalLedY: number;
  frontFrameBorderOffset: number;
  distanceBetweenLeds: number;
  h: number;
  heightPcb: number;
  plexiglassThickness: number;
  mountingHoles: boolean;
  mountingHoleDiameter: number;
}

class Matrix extends Boxes {
  constructor(
    private o: MatrixOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private drawFrame(sizex: number, sizey: number, posx: number, posy: number): void {
    this.rectangularHole(posx, posy, sizex, sizey, 0, false, false);
  }

  private matrixBackSideholes(length: number): void {
    const sandwichHeight = 2 * this.thickness + this.o.plexiglassThickness + this.o.heightPcb;
    const h = -0.5 * this.thickness + this.o.h - sandwichHeight;
    this.fingerHolesAt(0, h, length, 0);
  }

  private drawLedGrid(): void {
    const { physicalLedX, physicalLedY, ledWidth, ledHeight, distanceBetweenLeds: dist, frontFrameBorderOffset: off } = this.o;
    const spaceX = physicalLedX / ledWidth;
    const spaceY = physicalLedY / ledHeight;
    for (let x = 0; x < ledWidth; x++) {
      for (let y = 0; y < ledHeight; y++) {
        this.rectangularHole(off + x * spaceX + dist / 2, off + y * spaceY + dist / 2, spaceX - dist, spaceY - dist, 0, false, false);
      }
    }
  }

  private createMountingHoles = (): void => {
    if (!this.o.mountingHoles) return;
    const { physicalLedX, physicalLedY, frontFrameBorderOffset: off, mountingHoleDiameter: d } = this.o;
    const posX = (physicalLedX + 2 * off) / 2;
    const posY = ((physicalLedY + 2 * off) * 3) / 4;
    this.rectangularHole(posX, posY, d, d, d);
    this.rectangularHole(posX, posY + d / 2, d / 2, d / 2, d);
  };

  render(): void {
    const { physicalLedX, physicalLedY, frontFrameBorderOffset: off, h } = this.o;
    const x = physicalLedX + 2 * off;
    const y = physicalLedY + 2 * off;

    // boxes.py builds bolt policies here and then sets both to None, so the
    // walls are drawn without bolts.
    this.rectangularWall(x, h, 'FFFF', { move: 'up', label: 'Wall 1', callback: [() => this.matrixBackSideholes(x)] });
    this.rectangularWall(y, h, 'FfFf', { move: 'up', label: 'Wall 2', callback: [() => this.matrixBackSideholes(y)] });
    this.rectangularWall(y, h, 'FfFf', { move: 'up', label: 'Wall 4', callback: [() => this.matrixBackSideholes(y)] });
    this.rectangularWall(x, h, 'FFFF', { move: 'up', label: 'Wall 3', callback: [() => this.matrixBackSideholes(x)] });

    this.rectangularWall(x, y, 'ffff', {
      move: 'right',
      label: 'Top',
      callback: [() => this.drawFrame(physicalLedX, physicalLedY, off, off)],
    });
    this.rectangularWall(x, y, 'ffff', { move: 'right', label: 'Bottom', callback: [this.createMountingHoles] });
    this.rectangularWall(x, y, 'ffff', { move: 'right', label: 'matrix mount frame, please add cable holes as needed' });

    this.rectangularWall(x, y, 'eeee', { label: 'led_grid', move: 'right', callback: [() => this.drawLedGrid()] });
    this.rectangularWall(x, y, 'eeee', { label: 'led_grid', move: 'right', callback: [() => this.drawLedGrid()] });

    this.rectangularWall(x, y, 'eeee', { label: 'Plexiglass' });
  }
}

const int = (key: string, label: string, def: number, min: number, max: number, help?: string, unit?: string) =>
  ({ key, kind: 'number', label, default: def, min, max, step: 1, integer: true, group: 'dimensions', help, unit }) as const;

export const matrix: GeneratorDef = {
  meta: {
    id: 'matrix',
    name: 'LED Matrix',
    group: 'Misc',
    summary: 'Enclosure for a prebuilt WS2812b LED matrix',
    description:
      'A grid keeps each LED’s light to its own square behind a sheet of ' +
      'plexiglass (car tint foil on it gives a black look), and a box behind ' +
      'holds the electronics. Add holes for the power and data cables ' +
      'yourself. Assumes the LEDs are spaced equally both ways. Cut the part ' +
      'labelled Plexiglass from plexiglass.',
  },
  params: [
    int('led_width', 'LEDs across', 16, 1, 256),
    int('led_height', 'LEDs down', 16, 1, 256),
    int('physical_led_x', 'Panel width', 160, 10, 2000, undefined, 'mm'),
    int('physical_led_y', 'Panel height', 160, 10, 2000, undefined, 'mm'),
    int('h', 'Depth', 30, 10, 300, 'Of the enclosure.', 'mm'),
    int('matrix_front_frame_border_offset', 'Frame border', 10, 0, 100, 'Round the panel, holding the plexiglass on.', 'mm'),
    {
      key: 'distance_between_leds',
      kind: 'length',
      label: 'Divider width',
      unit: 'mm',
      default: 1,
      min: 0.2,
      max: 10,
      step: 0.1,
      group: 'dimensions',
      help: 'Between the squares of the grid. Make sure your machine can cut it this thin.',
    },
    { key: 'height_pcb', kind: 'length', label: 'Panel thickness', unit: 'mm', default: 0.2, min: 0, max: 20, step: 0.1, group: 'dimensions', help: 'Including its tallest parts other than the LEDs.' },
    { key: 'plexiglass_thicknes', kind: 'length', label: 'Plexiglass thickness', unit: 'mm', default: 3, min: 0.5, max: 10, step: 0.1, group: 'dimensions' },
    { key: 'mounting_holes', kind: 'bool', label: 'Mounting hole', default: false, group: 'dimensions', help: 'A keyhole in the back, to hang it on a wall.' },
    {
      key: 'mounting_hole_diameter',
      kind: 'length',
      label: 'Mounting hole diameter',
      unit: 'mm',
      default: 5,
      min: 1,
      max: 20,
      step: 0.5,
      group: 'dimensions',
      showIf: (v) => v['mounting_holes'] === true,
    },
    // boxes.py also takes matrix_back_frame_border and matrix_count_x/y, but
    // never reads them, so they are not offered.
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Matrix(
      {
        ledWidth: n(v, 'led_width', 16),
        ledHeight: n(v, 'led_height', 16),
        physicalLedX: n(v, 'physical_led_x', 160),
        physicalLedY: n(v, 'physical_led_y', 160),
        frontFrameBorderOffset: n(v, 'matrix_front_frame_border_offset', 10),
        distanceBetweenLeds: n(v, 'distance_between_leds', 1),
        h: n(v, 'h', 30),
        heightPcb: n(v, 'height_pcb', 0.2),
        plexiglassThickness: n(v, 'plexiglass_thicknes', 3),
        mountingHoles: b(v, 'mounting_holes', false),
        mountingHoleDiameter: n(v, 'mounting_hole_diameter', 5),
      },
      config,
    ),
};
