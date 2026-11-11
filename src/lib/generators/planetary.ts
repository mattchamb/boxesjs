/**
 * Planetary — ported from boxes.py `boxes/generators/planetary.py` (class `Planetary`).
 *
 * A planetary gear set: a sun gear, as many planets as fit round it, an
 * internal ring gear, a carrier for the planets and a base disc. A non-zero
 * `deltateeth` adds a second ring with that many fewer teeth, meshing with a
 * second layer of planets, for a large reduction between the two rings.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import type { ParamValues } from '../params/schema';
import { meshWarning } from '../gears';
import { n, type GeneratorDef } from './types';

interface PlanetaryOptions {
  sunteeth: number;
  planetteeth: number;
  maxplanets: number;
  deltateeth: number;
  modulus: number;
  shaft: number;
  play: number;
}

/** Python 3's `round()`: halves go to the even neighbour. */
function pyRound(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

class Planetary extends Boxes {
  constructor(
    private o: PlanetaryOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  render(): void {
    const { sunteeth, planetteeth, maxplanets, deltateeth, modulus, shaft, play } = this.o;

    const ringteeth = sunteeth + 2 * planetteeth;
    const spokeWidth = 3 * (shaft + play);

    const [pitch1] = this.gears.sizes({ teeth: sunteeth, dimension: modulus });
    const [pitch2] = this.gears.sizes({ teeth: planetteeth, dimension: modulus });
    const [, size3] = this.gears.sizes({
      teeth: ringteeth,
      internal_ring: true,
      spoke_width: spokeWidth,
      dimension: modulus,
    });

    // As many planets as fit round the sun without their tips touching.
    let planets = Math.trunc(Math.PI / Math.asin((planetteeth + 2) / (planetteeth + sunteeth)));
    if (maxplanets) planets = Math.min(maxplanets, planets);

    // There are sunteeth + ringteeth positions where a planet meshes with
    // both; when the planets cannot be spread evenly over them, each goes to
    // the nearest one.
    const ta = sunteeth + ringteeth;
    const planetpositions: number | number[] =
      ta % planets
        ? Array.from({ length: planets }, (_, i) => (pyRound((i * ta) / planets) * 360) / ta)
        : planets;

    const profileShift = 20;
    const pressureAngle = 20;

    // Sun against planet; the planets' mesh with the ring is not checked.
    const mesh = { dimension: modulus, angle: pressureAngle, profile_shift: profileShift };
    const sunWarn = meshWarning('the sun', 'the planets', sunteeth, planetteeth, mesh);
    if (sunWarn) this.warn(sunWarn, 'sunteeth');
    const planetWarn = meshWarning('the planets', 'the sun', planetteeth, sunteeth, mesh);
    if (planetWarn) this.warn(planetWarn, 'planetteeth');

    this.parts.disc(size3, { callback: () => this.hole(0, 0, (shaft + play) / 2), move: 'up', label: 'base' });
    this.gears.draw({
      teeth: ringteeth,
      dimension: modulus,
      angle: pressureAngle,
      internal_ring: true,
      spoke_width: spokeWidth,
      mount_hole: shaft + play,
      profile_shift: profileShift,
      move: 'up',
      label: 'ring',
    });
    this.gears.gearCarrier(pitch1 + pitch2, spokeWidth, planetpositions, 2 * spokeWidth, shaft / 2, {
      centerHole: (shaft + play) / 2,
      move: 'up',
      label: 'carrier',
    });
    this.gears.draw({
      teeth: sunteeth,
      dimension: modulus,
      angle: pressureAngle,
      mount_hole: shaft,
      profile_shift: profileShift,
      move: 'up',
      label: 'sun',
    });
    let numplanets = planets;

    if (deltateeth) {
      numplanets += planets;
      const deltamodulus = (modulus * ringteeth) / (ringteeth - deltateeth);
      this.gears.draw({
        teeth: ringteeth - deltateeth,
        dimension: deltamodulus,
        angle: pressureAngle,
        internal_ring: true,
        spoke_width: spokeWidth,
        mount_hole: shaft,
        profile_shift: profileShift,
        move: 'up',
        label: 'ring 2',
      });
    }

    for (let i = 0; i < numplanets; i++) {
      this.gears.draw({
        teeth: planetteeth,
        dimension: modulus,
        angle: pressureAngle,
        mount_hole: shaft + play,
        profile_shift: profileShift,
        move: 'up',
        label: `planet ${i + 1}`,
      });
    }
  }
}

export const planetary: GeneratorDef = {
  meta: {
    id: 'planetary',
    name: 'Planetary Gear',
    group: 'Misc',
    summary: 'Sun, planets, ring gear and carrier',
    description:
      'A planetary gear set: a sun gear, as many planet gears as fit round it, an internal ring gear and a carrier that holds the planets on pins. A second ring with a few teeth fewer gives a very large reduction between the two rings.',
  },
  params: [
    // boxes.py starts at 8, which binds against 20-tooth planets (see
    // `meshWarning`); 12 is the fewest that clears.
    { key: 'sunteeth', kind: 'number', label: 'Teeth, sun', default: 12, min: 4, max: 200, step: 1, integer: true, group: 'dimensions' },
    { key: 'planetteeth', kind: 'number', label: 'Teeth, planets', default: 20, min: 4, max: 200, step: 1, integer: true, group: 'dimensions' },
    {
      key: 'maxplanets',
      kind: 'number',
      label: 'Most planets',
      default: 0,
      min: 0,
      max: 50,
      step: 1,
      integer: true,
      group: 'dimensions',
      help: '0 for as many as fit.',
    },
    {
      key: 'deltateeth',
      kind: 'number',
      label: 'Second ring, fewer teeth',
      default: 0,
      min: 0,
      max: 20,
      step: 1,
      integer: true,
      group: 'dimensions',
      help: 'Adds a second ring with this many fewer teeth, and a second set of planets. 0 leaves it out.',
    },
    {
      key: 'modulus',
      kind: 'length',
      label: 'Module',
      unit: 'mm',
      default: 3,
      min: 0.5,
      max: 20,
      step: 0.1,
      group: 'dimensions',
      help: 'Tooth size: pitch diameter divided by the number of teeth.',
    },
    { key: 'shaft', kind: 'length', label: 'Shaft diameter', unit: 'mm', default: 6, min: 1, max: 50, step: 0.1, group: 'dimensions' },
    {
      key: 'play',
      kind: 'length',
      label: 'Shaft play',
      unit: 'mm',
      default: 0.05,
      min: 0,
      max: 30,
      step: 0.01,
      group: 'advanced',
      help: 'Extra in the holes that turn on a shaft. For ball bearings, the outer minus the inner diameter.',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new Planetary(
      {
        sunteeth: n(v, 'sunteeth', 12),
        planetteeth: n(v, 'planetteeth', 20),
        maxplanets: n(v, 'maxplanets', 0),
        deltateeth: n(v, 'deltateeth', 0),
        modulus: n(v, 'modulus', 3),
        shaft: n(v, 'shaft', 6),
        play: n(v, 'play', 0.05),
      },
      config,
    ),
};
