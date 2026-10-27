/**
 * Generator registry. One entry per generator; the common material, joint and
 * output parameters are appended here so each generator only declares its own.
 */
import { COMMON_PARAMS } from '../params/common';
import { defaultValues, type ParamSpec, type ParamValues } from '../params/schema';
import type { GeneratorDef } from './types';

import { aBox } from './abox';
import { bookHolder } from './bookholder';
import { magazineFile } from './magazinefile';
import { jointPanel } from './jointpanel';
import { angledCutJig } from './angledcutjig';
import { display } from './display';
import { flexTest } from './flextest';
import { zBeam } from './zbeam';
import { lBeam } from './lbeam';
import { brickSorter } from './bricksorter';
import { displayCase } from './displaycase';
import { regularStarBox } from './regularstarbox';
import { rack19HalfWidth } from './rack19halfwidth';
import { euroRackSkiff } from './eurorackskiff';
import { electronicsBox } from './electronicsbox';
import { rackBox } from './rackbox';
import { skadisStand } from './skadisstand';
import { skadis } from './skadis';
import { keyHolder } from './keyholder';
import { rollHolder } from './rollholder';
import { wallRack } from './wallrack';
import { gridfinityBase } from './gridfinitybase';
import { penHolderBox } from './penholderbox';
import { smallPartsTray } from './smallpartstray';
import { halfBox } from './halfbox';
import { stackableBin } from './stackablebin';
import { discRack } from './discrack';
import { microRack } from './microrack';
import { binTray } from './bintray';
import { wineRack } from './winerack';
import { breadBox } from './breadbox';
import { flexBook } from './flexbook';
import { folder } from './folder';
import { shutterBox } from './shutterbox';
import { angledBox } from './angledbox';
import { basedBox } from './basedbox';
import { bayonetBox } from './bayonetbox';
import { cardBox } from './cardbox';
import { closedBox } from './closedbox';
import { compartmentBox } from './compartmentbox';
import { consoleBox } from './console';
import { console2 } from './console2';
import { coffin } from './coffin';
import { crate } from './crate';
import { displayShelf } from './displayshelf';
import { dividerTray } from './dividertray';
import { doubleFlexDoorBox } from './doubleflexdoorbox';
import { drillBox } from './drillbox';
import { drillStand, wallDrillBox } from './drillstand';
import { flexBox } from './flexbox';
import { flexBox2 } from './flexbox2';
import { flexBox3 } from './flexbox3';
import { flexBox4 } from './flexbox4';
import { flexBox5 } from './flexbox5';
import { frameLoom } from './frameloom';
import { heartBox } from './heart';
import { notesHolder } from './notesholder';
import { openBox } from './openbox';
import { paintStorage } from './paintstorage';
import { rectangularWall } from './rectangularwall';
import { roundedBox } from './roundedbox';
import { roundedRegularBox } from './roundedregularbox';
import { roundedTrapezoidBox } from './roundedtrapezoidbox';
import { regularBox } from './regularbox';
import { slantedTray } from './slantedtray';
import { spicesRack } from './spicesrack';
import { storageRack } from './storagerack';
import { storageShelf } from './storageshelf';
import { tetris } from './tetris';
import { trayInsert } from './trayinsert';
import { twoPiece } from './twopiece';
import { trayLayout } from './traylayout';
import { typeTray } from './typetray';
import { universalBox } from './universalbox';
import { wallHopper } from './wallhopper';
import { wallEdges } from './walledges';
import { wallConsole } from './wallconsole';
import { wallPlaneHolder } from './wallplaneholder';
import { wallPliersHolder } from './wallpliersholder';
import { wallStairs } from './wallstairs';
import { wallChiselHolder } from './wallchiselholder';
import { wallSlottedHolder } from './wallslottedholder';
import { wallWrenchHolder } from './wallwrenchholder';
import { wallPinRow } from './wallpinrow';
import { wallTypeTray } from './walltypetray';
import { wallStackableBin } from './wallstackablebin';
import { wallCaliper } from './wallcaliperholder';
import { wallHook } from './wallhook';
import { wallRollHolder } from './wallrollholder';

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
  trayLayout,
  trayInsert,
  dividerTray,
  compartmentBox,
  drillBox,
  drillStand,
  displayShelf,
  storageRack,
  storageShelf,
  paintStorage,
  frameLoom,
  wallHopper,
  wallEdges,
  wallConsole,
  wallPlaneHolder,
  wallPliersHolder,
  wallStairs,
  wallChiselHolder,
  wallSlottedHolder,
  wallWrenchHolder,
  wallPinRow,
  wallTypeTray,
  wallStackableBin,
  wallCaliper,
  wallHook,
  wallRollHolder,
  wallDrillBox,
  twoPiece,
  basedBox,
  angledBox,
  crate,
  spicesRack,
  slantedTray,
  coffin,
  roundedTrapezoidBox,
  roundedRegularBox,
  consoleBox,
  heartBox,
  tetris,
  flexBox,
  flexBox2,
  flexBox3,
  flexBox4,
  flexBox5,
  roundedBox,
  doubleFlexDoorBox,
  folder,
  breadBox,
  shutterBox,
  flexBook,
  wineRack,
  binTray,
  microRack,
  discRack,
  stackableBin,
  halfBox,
  smallPartsTray,
  penHolderBox,
  gridfinityBase,
  wallRack,
  rollHolder,
  keyHolder,
  skadis,
  skadisStand,
  rackBox,
  electronicsBox,
  euroRackSkiff,
  rack19HalfWidth,
  regularStarBox,
  displayCase,
  brickSorter,
  lBeam,
  zBeam,
  flexTest,
  display,
  angledCutJig,
  jointPanel,
  magazineFile,
  bookHolder,
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
  const order = ['Box', 'Tray', 'Shelf', 'Wall mounted', 'Misc'];
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
