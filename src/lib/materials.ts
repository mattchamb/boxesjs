/**
 * Material presets.
 *
 * Thickness and kerf are the two values you retype on every job in boxes.py,
 * and speed/power are the ones you retype in LightBurn. Keeping all four in one
 * named preset means picking "3mm Birch Ply" is the only setup step: the model
 * regenerates with the right joint sizes and the exported file opens with the
 * layers already dialled in.
 */
import { LAYERS, type Layer } from './geom/colors';

export interface LayerMachineSettings {
  /** mm/s */
  speed: number;
  /** percent */
  power: number;
  passes: number;
  airAssist: boolean;
  /** Skip this layer entirely when exporting. */
  enabled: boolean;
}

export interface Material {
  id: string;
  name: string;
  /** mm — drives every relative joint dimension. */
  thickness: number;
  /** mm — half the beam width, applied as burn compensation. */
  kerf: number;
  layers: Record<Layer, LayerMachineSettings>;
  /** True for the shipped presets, which cannot be deleted. */
  builtin?: boolean;
}

const cut = (speed: number, power: number, passes = 1): LayerMachineSettings => ({
  speed,
  power,
  passes,
  airAssist: true,
  enabled: true,
});

const engrave = (speed: number, power: number): LayerMachineSettings => ({
  speed,
  power,
  passes: 1,
  airAssist: true,
  enabled: true,
});

/** The annotation layer is a tool layer: it exists to be looked at, not run. */
const toolLayer: LayerMachineSettings = {
  speed: 0,
  power: 0,
  passes: 1,
  airAssist: false,
  enabled: false,
};

function makeLayers(
  cutSetting: LayerMachineSettings,
  innerSetting: LayerMachineSettings,
  engraveSetting: LayerMachineSettings,
  scoreSetting: LayerMachineSettings,
): Record<Layer, LayerMachineSettings> {
  return {
    engrave: engraveSetting,
    score: scoreSetting,
    inner: innerSetting,
    cut: cutSetting,
    annotate: toolLayer,
  };
}

/**
 * Starting points, not gospel — every machine differs. These assume a mid-range
 * 50-60 W CO2 tube; dial them in on scrap and save your own preset.
 */
export const BUILTIN_MATERIALS: Material[] = [
  {
    id: 'ply-3',
    name: '3mm Birch Ply',
    thickness: 3.0,
    kerf: 0.1,
    layers: makeLayers(cut(12, 85), cut(14, 80), engrave(280, 20), engrave(120, 40)),
    builtin: true,
  },
  {
    id: 'mdf-6',
    name: '6mm MDF',
    thickness: 6.0,
    kerf: 0.12,
    layers: makeLayers(cut(5, 95, 2), cut(6, 90, 2), engrave(250, 25), engrave(100, 45)),
    builtin: true,
  },
  {
    id: 'acrylic-3',
    name: '3mm Acrylic',
    thickness: 3.0,
    kerf: 0.08,
    layers: makeLayers(cut(10, 70), cut(11, 68), engrave(300, 18), engrave(140, 35)),
    builtin: true,
  },
  {
    id: 'card-2',
    name: '2mm Greyboard',
    thickness: 2.0,
    kerf: 0.06,
    layers: makeLayers(cut(35, 45), cut(38, 42), engrave(400, 12), engrave(200, 22)),
    builtin: true,
  },
];

const STORAGE_KEY = 'boxesjs.materials.v1';
const SELECTED_KEY = 'boxesjs.material.selected.v1';

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Built-in presets plus anything the user has saved. */
export function loadMaterials(): Material[] {
  if (!hasStorage()) return [...BUILTIN_MATERIALS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...BUILTIN_MATERIALS];
    const custom = JSON.parse(raw) as Material[];
    if (!Array.isArray(custom)) return [...BUILTIN_MATERIALS];
    return [...BUILTIN_MATERIALS, ...custom.filter(isMaterial).map((m) => ({ ...m, builtin: false }))];
  } catch {
    return [...BUILTIN_MATERIALS];
  }
}

export function saveCustomMaterials(materials: Material[]): void {
  if (!hasStorage()) return;
  const custom = materials.filter((m) => !m.builtin);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

export function upsertMaterial(material: Material): Material[] {
  const all = loadMaterials();
  const idx = all.findIndex((m) => m.id === material.id);
  if (idx >= 0 && !all[idx]!.builtin) all[idx] = material;
  else if (idx < 0) all.push(material);
  saveCustomMaterials(all);
  return all;
}

export function deleteMaterial(id: string): Material[] {
  const all = loadMaterials().filter((m) => m.builtin || m.id !== id);
  saveCustomMaterials(all);
  return all;
}

export function getSelectedMaterialId(): string | null {
  if (!hasStorage()) return null;
  return localStorage.getItem(SELECTED_KEY);
}

export function setSelectedMaterialId(id: string): void {
  if (!hasStorage()) return;
  localStorage.setItem(SELECTED_KEY, id);
}

export function findMaterial(id: string | null | undefined): Material | undefined {
  if (!id) return undefined;
  return loadMaterials().find((m) => m.id === id);
}

/** Duplicate a preset so a built-in can be used as a starting point. */
export function cloneMaterial(source: Material, name: string): Material {
  return {
    ...structuredClone(source),
    id: `custom-${Date.now().toString(36)}`,
    name,
    builtin: false,
  };
}

export function exportMaterials(materials: Material[]): string {
  return JSON.stringify(
    { version: 1, materials: materials.filter((m) => !m.builtin) },
    null,
    2,
  );
}

export function importMaterials(json: string): Material[] {
  const parsed = JSON.parse(json) as { materials?: unknown };
  const list = Array.isArray(parsed.materials) ? parsed.materials : [];
  const valid = list.filter(isMaterial).map((m) => ({ ...m, builtin: false }));
  if (valid.length === 0) throw new Error('No valid materials found in that file');
  const all = [...loadMaterials().filter((m) => !m.builtin), ...valid];
  saveCustomMaterials(all);
  return loadMaterials();
}

function isMaterial(v: unknown): v is Material {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Partial<Material>;
  return (
    typeof m.id === 'string' &&
    typeof m.name === 'string' &&
    typeof m.thickness === 'number' &&
    typeof m.kerf === 'number' &&
    typeof m.layers === 'object' &&
    m.layers !== null &&
    LAYERS.every((l) => typeof (m.layers as Record<string, unknown>)[l] === 'object')
  );
}

/** Rough job time from cut length and the preset's feed rates, in seconds. */
export function estimateSeconds(
  lengthByLayer: Record<Layer, number>,
  material: Material,
): number {
  let seconds = 0;
  for (const layer of LAYERS) {
    const settings = material.layers[layer];
    if (!settings.enabled || settings.speed <= 0) continue;
    seconds += (lengthByLayer[layer] / settings.speed) * settings.passes;
  }
  return seconds;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  const h = Math.floor(m / 60);
  if (h === 0) return `${m}m ${s}s`;
  return `${h}h ${m % 60}m`;
}
