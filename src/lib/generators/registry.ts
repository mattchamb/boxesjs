/**
 * Generator registry. One entry per generator; the common material, joint and
 * output parameters are appended here so each generator only declares its own.
 */
import { COMMON_PARAMS } from '../params/common';
import { defaultValues, type ParamSpec, type ParamValues } from '../params/schema';
import type { GeneratorDef } from './types';

import { aBox } from './abox';
import { bayonetBox } from './bayonetbox';
import { cardBox } from './cardbox';
import { closedBox } from './closedbox';
import { console2 } from './console2';
import { displayShelf } from './displayshelf';
import { drillBox } from './drillbox';
import { notesHolder } from './notesholder';
import { openBox } from './openbox';
import { paintStorage } from './paintstorage';
import { rectangularWall } from './rectangularwall';
import { regularBox } from './regularbox';
import { typeTray } from './typetray';
import { universalBox } from './universalbox';

const DEFS: GeneratorDef[] = [
  aBox,
  closedBox,
  openBox,
  cardBox,
  console2,
  universalBox,
  regularBox,
  bayonetBox,
  notesHolder,
  typeTray,
  drillBox,
  paintStorage,
  displayShelf,
  rectangularWall,
];

export const GENERATORS: GeneratorDef[] = DEFS;

const BY_ID = new Map(DEFS.map((g) => [g.meta.id, g]));

export function getGenerator(id: string): GeneratorDef {
  const g = BY_ID.get(id);
  if (!g) throw new Error(`Unknown generator: ${id}`);
  return g;
}

export function listGenerators(): GeneratorDef[] {
  return DEFS;
}

/** Full parameter list for a generator: its own, then the shared ones. */
export function paramsFor(id: string): ParamSpec[] {
  const gen = getGenerator(id);
  const overrides = gen.paramDefaults ?? {};
  // Shared param blocks are spread into a generator's own list too (lid and
  // handle options), so overrides have to reach both halves.
  const apply = (spec: ParamSpec) =>
    spec.key in overrides ? ({ ...spec, default: overrides[spec.key] } as ParamSpec) : spec;
  return [...gen.params.map(apply), ...COMMON_PARAMS.map(apply)];
}

export function defaultsFor(id: string): ParamValues {
  return defaultValues(paramsFor(id));
}

/** Generators grouped for the gallery, in a stable order. */
export function generatorsByGroup(): { group: string; items: GeneratorDef[] }[] {
  const order = ['Box', 'Tray', 'Shelf', 'Part'];
  const groups = new Map<string, GeneratorDef[]>();
  for (const g of DEFS) {
    const list = groups.get(g.meta.group) ?? [];
    list.push(g);
    groups.set(g.meta.group, list);
  }
  return [...groups.entries()]
    .sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a[0].localeCompare(b[0]);
    })
    .map(([group, items]) => ({ group, items }));
}
