/**
 * Drill gauge — ported from boxes.py `boxes/generators/drillgauge.py`
 * (class `DrillGauge`).
 *
 * A plate with a slot that narrows in steps, each labelled with its width,
 * for sizing drill bits.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { ETCHING } from '../geom/colors';
import { MOUNTING_PARAMS } from '../params/common';
import type { ParamValues } from '../params/schema';
import { parseSections } from '../params/sections';
import { n, s, type GeneratorDef } from './types';

type MountingHoles = 'none' | 'left' | 'right' | 'top' | 'bottom';

interface DrillGaugeOptions {
  sizes: number[];
  fontsize: number;
  textPlacement: 'left' | 'right';
  mountingHoles: MountingHoles;
}

const DEFAULT_SIZES =
  '1.0:1.5:2.0:2.5:3.0:3.3:3.5:4.0:4.2:4.5' +
  Array.from({ length: 2 * 13 + 1 - 2 * 5 }, (_, i) => `:${((2 * 5 + i) / 2).toFixed(1)}`).join('');

const EDGES: Record<MountingHoles, string> = {
  none: 'eeee',
  bottom: 'Geee',
  right: 'eGee',
  top: 'eeGe',
  left: 'eeeG',
};

class DrillGauge extends Boxes {
  private maxSize = 0;
  private minHeight = 0;

  constructor(
    private o: DrillGaugeOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  private step45(s: number): void {
    if (!s) return;
    const direction = s > 0 ? -1 : 1;
    this.polyline(0, -45 * direction, 2 ** 0.5 * Math.abs(s), 45 * direction);
  }

  private gauge = (): void => {
    const { sizes, fontsize: fs } = this.o;
    const maxSize = Math.max(...sizes);
    const textLeft = this.o.textPlacement === 'left';
    const t = this.thickness;
    this.moveTo((textLeft ? 5 * fs : 3 * t) + maxSize / 2, 3 * t, 90);

    let last = 0;

    const drawSize = (nr: number, s: number, left: boolean) => {
      const length = Math.max(fs / 2, s / 2);

      const drawText = (left: boolean) =>
        this.withRestore(() => {
          this.ctx.stroke();
          this.setSourceColor(ETCHING);
          const direction = left ? -1 : 1;
          this.text(
            s.toFixed(1),
            length / 2 + direction * 0.1 * fs,
            3 + (maxSize - s) / 2 + 2 * fs * (nr % 2),
            direction * 90,
            left ? 'middle right' : 'middle left',
            fs,
            ETCHING,
          );
          // Every other size is set further out, with a line to its step.
          if (nr % 2) {
            this.moveTo(length / 2, fs / 4, 90);
            this.edge(2 * fs + (maxSize - s) / 2);
          }
          this.ctx.stroke();
        });

      this.step45((s - last) / 2);
      if (left === textLeft) drawText(textLeft);
      this.edge(length);
    };

    sizes.forEach((s, nr) => {
      drawSize(nr, s, true);
      last = s;
    });
    this.corner(-180, sizes[sizes.length - 1]! / 2);
    for (let nr = sizes.length - 1; nr >= 0; nr--) {
      drawSize(nr, sizes[nr]!, false);
      last = sizes[nr]!;
    }
    this.step45((0 - last) / 2);
  };

  private gaugeHeight(): number {
    return this.maxSize * (0.5 + 0.5 ** 0.5) + this.o.sizes.reduce((a, size) => a + Math.max(this.minHeight, size / 2), 0);
  }

  render(): void {
    const t = this.thickness;
    this.maxSize = Math.max(...this.o.sizes);
    this.minHeight = this.o.fontsize / 2;

    this.rectangularWall(5 * this.o.fontsize + this.maxSize + 3 * t, 6 * t + this.gaugeHeight(), EDGES[this.o.mountingHoles], {
      callback: [this.gauge],
      label: 'gauge',
    });
  }
}

export const drillGauge: GeneratorDef = {
  meta: {
    id: 'drillgauge',
    name: 'Drill Gauge',
    group: 'Misc',
    summary: 'Plate with a stepped slot for sizing drill bits',
    description: 'A slot that narrows in steps, each etched with its width. Use a burn setting that is tight but needs no force.',
  },
  // boxes.py's own default: the edge grows to fit the mounting holes.
  paramDefaults: { mount_style: 'straight edge, extended' },
  params: [
    {
      key: 'sizes',
      kind: 'sections',
      label: 'Sizes',
      default: DEFAULT_SIZES,
      group: 'dimensions',
      itemLabel: 'size',
      help: 'Widths of the steps in mm, smallest first.',
    },
    { key: 'fontsize', kind: 'length', label: 'Text size', unit: 'mm', default: 8, min: 2, max: 30, step: 0.5, group: 'dimensions' },
    {
      key: 'text_placement',
      kind: 'enum',
      label: 'Text on the',
      default: 'left',
      choices: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ],
      group: 'dimensions',
    },
    {
      key: 'mounting_holes',
      kind: 'enum',
      label: 'Mounting holes',
      default: 'none',
      choices: [
        { value: 'none', label: 'None' },
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
        { value: 'top', label: 'Top' },
        { value: 'bottom', label: 'Bottom' },
      ],
      group: 'dimensions',
    },
    ...MOUNTING_PARAMS.map((spec) => ({ ...spec, showIf: (v: ParamValues) => v['mounting_holes'] !== 'none' })),
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new DrillGauge(
      {
        sizes: parseSections(s(v, 'sizes', DEFAULT_SIZES)),
        fontsize: n(v, 'fontsize', 8),
        textPlacement: s(v, 'text_placement', 'left') as 'left' | 'right',
        mountingHoles: s(v, 'mounting_holes', 'none') as MountingHoles,
      },
      config,
    ),
};
