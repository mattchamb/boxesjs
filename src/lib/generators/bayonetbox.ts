/**
 * Bayonet box — ported from boxes.py `boxes/generators/bayonetbox.py`
 * (class `BayonetBox`).
 *
 * A round box cut as five flat discs rather than turned. Two of them carry
 * interlocking lugs, so once the stack is glued up the top twists on and locks.
 * Glue all the outside rings to the bottom and all the inside rings to the top.
 */
import { Bayonet } from '../bayonet';
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

interface BayonetBoxOptions {
  diameter: number;
  lugs: number;
  alignmentPins: number;
  outside: boolean;
}

class BayonetBox extends Boxes {
  constructor(
    private o: BayonetBoxOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const t = this.thickness;
    let d = this.o.diameter;

    // The lock eats three layers of material off the nominal diameter.
    if (!this.o.outside) d = d - 3 * t;

    const bayonet = new Bayonet(this, d, this.o.lugs, this.o.alignmentPins);

    this.parts.disc(d, {
      callback: () => bayonet.alignmentHoles({ outer: true }),
      move: 'right',
      label: 'Bottom',
    });
    this.parts.disc(d, {
      callback: () => {
        bayonet.alignmentHoles({ outer: true });
        this.hole(0, 0, d / 2 - 1.5 * t);
      },
      move: 'right',
      label: 'Wall',
    });
    this.parts.disc(d, { callback: () => bayonet.lowerCB(), move: 'right', label: 'Lock lower' });
    this.parts.disc(d, { callback: () => bayonet.upperCB(), move: 'right', label: 'Lock upper' });
    this.parts.disc(d, {
      callback: () => bayonet.alignmentHoles({ inner: true }),
      move: 'right',
      label: 'Top',
    });
  }
}

export const bayonetBox: GeneratorDef = {
  meta: {
    id: 'bayonetbox',
    name: 'Bayonet Box',
    group: 'Box',
    summary: 'Round layered box with a twist-on lid',
    description:
      'A round box cut as five flat discs instead of turned. Two of them carry ' +
      'interlocking lugs, so once the stack is glued up the lid twists on and ' +
      'locks. Glue all the outside rings to the bottom and all the inside rings ' +
      'to the top; the three pin holes keep the stack concentric while it sets.',
  },
  params: [
    {
      key: 'diameter',
      kind: 'length',
      label: 'Diameter',
      unit: 'mm',
      default: 50,
      min: 20,
      max: 400,
      step: 1,
      group: 'dimensions',
    },
    {
      key: 'lugs',
      kind: 'number',
      label: 'Locking lugs',
      default: 10,
      min: 3,
      max: 30,
      step: 1,
      group: 'dimensions',
      help: 'More lugs lock over a shorter twist but leave less material in each.',
    },
    {
      key: 'alignment_pins',
      kind: 'length',
      label: 'Alignment pin diameter',
      unit: 'mm',
      default: 1.0,
      min: 0.5,
      max: 5,
      step: 0.1,
      group: 'dimensions',
      help: 'Holes for pins that hold the layers concentric while the glue sets.',
    },
    { key: 'outside', kind: 'bool', label: 'Outside measurements', default: true, group: 'dimensions' },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new BayonetBox(
      {
        diameter: n(v, 'diameter', 50),
        lugs: n(v, 'lugs', 10),
        alignmentPins: n(v, 'alignment_pins', 1.0),
        outside: b(v, 'outside', true),
      },
      config,
    ),
};
