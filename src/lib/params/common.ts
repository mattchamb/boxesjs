/**
 * Parameters shared by every generator: material, joint tuning and output
 * options. Kept out of the individual generators so each one only declares what
 * makes it different.
 */
import { DEFAULT_CONFIG, type BoxesConfig } from '../boxes';
import { BOLT_SIZES, bedBoltSettingsFor } from '../edges/bolts';
import { anyEdgeIn, type EnumParam, type ParamSpec, type ParamValues } from './schema';

/**
 * Puts a block of tuning into a collapsed section, shown only when it applies.
 * A parameter's own condition, where it has one, is its whole condition.
 */
function inSection(section: string, showIf: ((v: ParamValues) => boolean) | null, specs: ParamSpec[]): ParamSpec[] {
  return specs.map((spec) => ({ ...spec, section, ...(spec.showIf ? {} : showIf ? { showIf } : {}) }));
}

export const COMMON_PARAMS: ParamSpec[] = [
  {
    key: 'thickness',
    kind: 'length',
    label: 'Material thickness',
    unit: 'mm',
    default: 3.0,
    min: 0.5,
    max: 25,
    step: 0.1,
    group: 'material',
    help: 'Every joint is sized from this. Measure your sheet — nominal 3 mm ply is often 2.7 mm.',
  },
  {
    key: 'burn',
    kind: 'length',
    label: 'Kerf compensation',
    unit: 'mm',
    default: 0.1,
    min: 0,
    max: 1,
    step: 0.01,
    group: 'material',
    help: 'Half the width of your laser cut. Larger values give a tighter press fit.',
  },

  {
    key: 'fj_finger',
    kind: 'number',
    label: 'Finger width',
    unit: '× thickness',
    default: 2.0,
    min: 0.5,
    max: 10,
    step: 0.1,
    group: 'joints',
    section: 'Finger joints',
    help: 'Width of each finger, in multiples of material thickness.',
  },
  {
    key: 'fj_space',
    kind: 'number',
    label: 'Finger spacing',
    unit: '× thickness',
    default: 2.0,
    min: 0.5,
    max: 10,
    step: 0.1,
    group: 'joints',
    section: 'Finger joints',
    help: 'Gap between fingers, in multiples of material thickness.',
  },
  {
    key: 'fj_play',
    kind: 'number',
    label: 'Joint play',
    unit: '× thickness',
    default: 0.0,
    min: 0,
    max: 0.5,
    step: 0.01,
    group: 'joints',
    section: 'Finger joints',
    help: 'Extra slack in the joints. Raise this if parts will not go together.',
  },
  {
    key: 'fj_surroundingspaces',
    kind: 'number',
    label: 'Edge margin',
    unit: '× space',
    default: 2.0,
    min: 0,
    max: 5,
    step: 0.5,
    group: 'joints',
    section: 'Finger joints',
    help: 'Space left at each end of a joint before the first finger.',
  },
  {
    key: 'fj_width',
    kind: 'number',
    label: 'Slot width',
    unit: '× thickness',
    default: 1.0,
    min: 0.5,
    max: 3,
    step: 0.05,
    group: 'joints',
    section: 'Finger joints',
    help: 'Width of finger slots cut through a panel.',
  },
  {
    key: 'fj_edge_width',
    kind: 'number',
    label: 'Slot inset',
    unit: '× thickness',
    default: 1.0,
    min: 0,
    max: 5,
    step: 0.1,
    group: 'joints',
    section: 'Finger joints',
    help: 'Material left between finger slots and the edge of the panel.',
  },
  {
    key: 'fj_style',
    kind: 'enum',
    label: 'Finger style',
    default: 'rectangular',
    choices: [
      { value: 'rectangular', label: 'Rectangular' },
      { value: 'springs', label: 'Springs' },
      { value: 'barbs', label: 'Barbs' },
      { value: 'snap', label: 'Snap' },
    ],
    group: 'joints',
    section: 'Finger joints',
    help: 'Rectangular is the standard joint. The others grip without glue.',
  },

  {
    key: 'labels',
    kind: 'bool',
    label: 'Label parts',
    default: true,
    group: 'advanced',
    help: 'Draws part names on the T1 tool layer, which LightBurn never cuts.',
  },
  {
    key: 'spacing',
    kind: 'number',
    label: 'Part spacing',
    unit: '× thickness',
    default: 0.5,
    min: 0,
    max: 5,
    step: 0.1,
    group: 'advanced',
    help: 'Gap left between parts in the layout.',
  },
  {
    key: 'reference',
    kind: 'length',
    label: 'Reference ruler',
    unit: 'mm',
    default: 0,
    min: 0,
    max: 200,
    step: 10,
    group: 'advanced',
    help: 'Draws a rectangle of known length so you can verify scale after import. 0 disables it.',
  },
  {
    key: 'tabs',
    kind: 'length',
    label: 'Holding tabs',
    unit: 'mm',
    default: 0,
    min: 0,
    max: 5,
    step: 0.1,
    group: 'advanced',
    help: 'Small uncut bridges that stop parts falling through the bed. 0 disables them.',
  },
  {
    key: 'inner_corners',
    kind: 'enum',
    label: 'Inner corners',
    default: 'loop',
    choices: [
      { value: 'loop', label: 'Loop' },
      { value: 'corner', label: 'Sharp corner' },
      { value: 'backarc', label: 'Back arc' },
    ],
    group: 'advanced',
    help: 'How the kerf loop at inner corners is resolved. Loop suits most machines.',
  },

  // Where the parts go, not what they are: none of these reach the engine.
  {
    key: 'pack',
    kind: 'bool',
    label: 'Pack onto sheets',
    default: false,
    group: 'layout',
    help: 'Rearranges the parts to fit as few sheets of your stock as possible. LightBurn gets one page per sheet.',
  },
  {
    key: 'sheet_width',
    kind: 'length',
    label: 'Sheet width',
    unit: 'mm',
    default: 300,
    min: 20,
    max: 3000,
    step: 10,
    group: 'layout',
    showIf: (v) => v['pack'] === true,
  },
  {
    key: 'sheet_height',
    kind: 'length',
    label: 'Sheet height',
    unit: 'mm',
    default: 400,
    min: 20,
    max: 3000,
    step: 10,
    group: 'layout',
    showIf: (v) => v['pack'] === true,
  },
  {
    key: 'sheet_margin',
    kind: 'length',
    label: 'Offset from sheet edge',
    unit: 'mm',
    default: 5,
    min: 0,
    max: 50,
    step: 0.5,
    group: 'layout',
    showIf: (v) => v['pack'] === true,
    help: 'Clear border left round every sheet, for rough edges and hold-downs. Measured to the cut line.',
  },
  {
    key: 'pack_gap',
    kind: 'length',
    label: 'Offset between parts',
    unit: 'mm',
    default: 2,
    min: 0,
    max: 50,
    step: 0.5,
    group: 'layout',
    showIf: (v) => v['pack'] === true,
    help: 'Clear space between neighbouring parts, measured between cut lines. Part spacing under Advanced only sets the unpacked layout.',
  },
  {
    key: 'pack_copies',
    kind: 'number',
    label: 'Copies',
    default: 1,
    min: 1,
    max: 20,
    step: 1,
    integer: true,
    group: 'layout',
    showIf: (v) => v['pack'] === true,
    help: 'How many of this design to cut. The copies are packed together, so their parts share sheets.',
  },
  {
    key: 'use_panels',
    kind: 'bool',
    label: 'Plan from stock panels',
    default: false,
    group: 'layout',
    showIf: (v) => v['pack'] === true,
    help: 'Count waste in the panels you buy and cut down into sheets, and suggest sheet sizes that cut them evenly.',
  },
  {
    key: 'panel_width',
    kind: 'length',
    label: 'Panel width',
    unit: 'mm',
    default: 600,
    min: 50,
    max: 3000,
    step: 10,
    group: 'layout',
    showIf: (v) => v['pack'] === true && v['use_panels'] === true,
    help: 'Stock as bought, before it is cut down into sheets for the laser. Waste is counted in whole panels.',
  },
  {
    key: 'panel_height',
    kind: 'length',
    label: 'Panel height',
    unit: 'mm',
    default: 1200,
    min: 50,
    max: 3000,
    step: 10,
    group: 'layout',
    showIf: (v) => v['pack'] === true && v['use_panels'] === true,
    help: 'Stock as bought, before it is cut down into sheets for the laser. Waste is counted in whole panels.',
  },
  {
    key: 'bed_width',
    kind: 'length',
    label: 'Bed width',
    unit: 'mm',
    default: 400,
    min: 50,
    max: 3000,
    step: 5,
    group: 'layout',
    showIf: (v) => v['pack'] === true && v['use_panels'] === true,
    help: 'The largest sheet the laser takes, which limits the sheet sizes suggested.',
  },
  {
    key: 'bed_height',
    kind: 'length',
    label: 'Bed height',
    unit: 'mm',
    default: 415,
    min: 50,
    max: 3000,
    step: 5,
    group: 'layout',
    showIf: (v) => v['pack'] === true && v['use_panels'] === true,
    help: 'The largest sheet the laser takes, which limits the sheet sizes suggested.',
  },
  {
    key: 'pack_rotate',
    kind: 'bool',
    label: 'Allow rotating parts',
    default: true,
    group: 'layout',
    showIf: (v) => v['pack'] === true,
    help: 'Turns parts a quarter turn where that fits better. Switch off to keep the grain running the way each part was designed.',
  },
  {
    key: 'pack_angle_step',
    kind: 'enum',
    label: 'Turn by',
    default: '90',
    choices: [
      { value: '90', label: '90°' },
      { value: '45', label: '45°' },
      { value: '15', label: '15°' },
    ],
    group: 'layout',
    showIf: (v) => v['pack'] === true && v['pack_rotate'] !== false,
    help: 'Finest turn Optimise tries on parts that are not near rectangles. Finer steps can fit round parts closer, but search more slowly.',
  },
];

/**
 * Handle options, for generators that offer the rounded-triangle top edge.
 * Spread into a generator's own params, like the lid options below.
 */
export const HANDLE_PARAMS: ParamSpec[] = [
  {
    key: 'rt_height',
    kind: 'length',
    label: 'Handle height',
    unit: 'mm',
    default: 50.0,
    min: 5,
    max: 300,
    step: 1,
    group: 'top',
    help: 'How far the triangular handle rises above the wall.',
  },
  {
    key: 'rt_radius',
    kind: 'length',
    label: 'Handle tip radius',
    unit: 'mm',
    default: 30.0,
    min: 0,
    max: 200,
    step: 1,
    group: 'top',
  },
  {
    key: 'rt_r_hole',
    kind: 'length',
    label: 'Hanging hole radius',
    unit: 'mm',
    default: 2.0,
    min: 0,
    max: 50,
    step: 0.5,
    group: 'top',
    help: 'Zero leaves the handle solid.',
  },
  {
    key: 'rt_outset',
    kind: 'number',
    label: 'Handle outset',
    unit: '× thickness',
    default: 0.0,
    min: 0,
    max: 5,
    step: 0.5,
    group: 'top',
    help: 'Widens the base of the handle so it clears the walls beside it.',
  },
];

/**
 * Stackable foot options, for generators whose proportions depend on them.
 *
 * Spread into a generator's own params rather than added globally: most
 * generators that offer an `s` bottom edge only pass it through, but a design
 * built around stacking — where the foot height is subtracted from the usable
 * interior — needs these reachable.
 */
export const STACKABLE_PARAMS: ParamSpec[] = inSection('Stackable edges', (v) => anyEdgeIn(v, 'sSšŠ'), [
  {
    key: 'st_height',
    kind: 'number',
    label: 'Foot height',
    unit: '× thickness',
    default: 2.0,
    min: 0.5,
    max: 6,
    step: 0.1,
    group: 'joints',
    help: 'How far the feet stand proud of the bottom edge, and how deep the box above sits onto them.',
  },
  {
    key: 'st_width',
    kind: 'number',
    label: 'Foot width',
    unit: '× thickness',
    default: 4.0,
    min: 1,
    max: 12,
    step: 0.5,
    group: 'joints',
    help: 'Flat length at each end of the edge, outside the feet.',
  },
  {
    key: 'st_holedistance',
    kind: 'number',
    label: 'Foot slot inset',
    unit: '× thickness',
    default: 1.0,
    min: 0,
    max: 3,
    step: 0.1,
    group: 'joints',
    help: 'Material between the feet and the slots the bottom panel sits in.',
  },
  {
    key: 'st_angle',
    kind: 'number',
    label: 'Foot angle',
    unit: '°',
    default: 60,
    // Outside 20–260 the arcs cannot close; StackableSettings rejects them.
    min: 20,
    max: 259,
    step: 5,
    group: 'joints',
  },
  {
    key: 'st_bottom_stabilizers',
    kind: 'number',
    label: 'Stabiliser width',
    unit: '× thickness',
    default: 0.0,
    min: 0,
    max: 10,
    step: 0.5,
    group: 'joints',
    help: 'Adds a separate strip under each foot to spread the load. Zero leaves them off.',
  },
]);

/**
 * Pull-handle options, for generators that put a `y`/`Y` handle edge on a
 * panel. Distinct from HANDLE_PARAMS, which tune the triangular `t` handle.
 */
export const HANDLE_EDGE_PARAMS: ParamSpec[] = [
  {
    key: 'he_height',
    kind: 'length',
    label: 'Handle height',
    unit: 'mm',
    default: 20.0,
    min: 5,
    max: 100,
    step: 1,
    group: 'top',
    help: 'How far the handle stands above the edge it is on.',
  },
  {
    key: 'he_radius',
    kind: 'length',
    label: 'Handle corner radius',
    unit: 'mm',
    default: 10.0,
    min: 0,
    max: 50,
    step: 1,
    group: 'top',
  },
  {
    key: 'he_hole_width',
    kind: 'text',
    label: 'Finger hole widths',
    default: '40:40',
    group: 'top',
    help: 'One percentage per hole, as a share of the handle length. "40:40" cuts two; "0" leaves it solid.',
  },
  {
    key: 'he_hole_height',
    kind: 'number',
    label: 'Finger hole height',
    unit: '%',
    default: 75,
    min: 0,
    max: 100,
    step: 5,
    group: 'top',
    help: 'Share of the handle height the holes take up. Zero leaves it solid.',
  },
  {
    key: 'he_outset',
    kind: 'number',
    label: 'Handle outset',
    unit: '× thickness',
    default: 1.0,
    min: 0,
    max: 5,
    step: 0.5,
    group: 'top',
    help: 'Extends the handle past each end of its edge.',
  },
];

/**
 * Wall-mounting options, for generators built on WallMountedBox. Only the
 * settings for the chosen wall system are read; the rest are ignored.
 */
/** Each wall system's settings show only while that system is chosen. */
const WALL_SYSTEMS: Record<string, string> = {
  slatwall_: 'slatwall',
  dinrail_: 'dinrail',
  frenchcleat_: 'french cleat',
  skadis_: 'skadis',
};
function forWallSystems(specs: ParamSpec[]): ParamSpec[] {
  return specs.map((spec) => {
    const prefix = Object.keys(WALL_SYSTEMS).find((p) => spec.key.startsWith(p));
    if (!prefix) return spec;
    const system = WALL_SYSTEMS[prefix]!;
    return { ...spec, section: 'Wall system', showIf: (v: ParamValues) => v['walltype'] === system };
  });
}

export const WALL_PARAMS: ParamSpec[] = forWallSystems([
  {
    key: 'walltype',
    kind: 'enum',
    label: 'Wall system',
    default: 'plain',
    choices: [
      { value: 'plain', label: 'Plain wall' },
      { value: 'plain reinforced', label: 'Plain, reinforced' },
      { value: 'slatwall', label: 'Slatwall' },
      { value: 'dinrail', label: 'DIN rail' },
      { value: 'french cleat', label: 'French cleat' },
      { value: 'skadis', label: 'IKEA Skådis' },
    ],
    group: 'dimensions',
    help: 'What the back plate hangs on. Plain is screwed to the wall; reinforced adds a second plate.',
  },
  {
    key: 'slatwall_bottom_hook',
    kind: 'enum',
    label: 'Slatwall: lower fixing',
    default: 'hook',
    choices: [
      { value: 'hook', label: 'Hook' },
      { value: 'spring', label: 'Spring' },
      { value: 'stud', label: 'Stud' },
      { value: 'none', label: 'None' },
    ],
    group: 'joints',
  },
  {
    key: 'slatwall_pitch',
    kind: 'length',
    label: 'Slatwall: slot pitch',
    unit: 'mm',
    default: 101.6,
    min: 20,
    max: 300,
    step: 0.1,
    group: 'joints',
    help: 'Distance between slots, centre to centre.',
  },
  {
    key: 'dinrail_bottom',
    kind: 'enum',
    label: 'DIN rail: lower fixing',
    default: 'stud',
    choices: [
      { value: 'stud', label: 'Stud' },
      { value: 'none', label: 'None' },
    ],
    group: 'joints',
  },
  {
    key: 'dinrail_depth',
    kind: 'length',
    label: 'DIN rail: hook depth',
    unit: 'mm',
    default: 8.0,
    min: 5,
    max: 20,
    step: 0.5,
    group: 'joints',
  },
  {
    key: 'frenchcleat_bottom',
    kind: 'enum',
    label: 'French cleat: lower fixing',
    default: 'stud',
    choices: [
      { value: 'stud', label: 'Stud against the wall' },
      { value: 'hook', label: 'Hook onto a second cleat' },
      { value: 'none', label: 'None' },
    ],
    group: 'joints',
  },
  {
    key: 'frenchcleat_depth',
    kind: 'length',
    label: 'French cleat: depth',
    unit: 'mm',
    default: 18.0,
    min: 5,
    max: 50,
    step: 0.5,
    group: 'joints',
  },
  {
    key: 'frenchcleat_angle',
    kind: 'number',
    label: 'French cleat: angle',
    unit: '°',
    default: 45.0,
    min: 0,
    max: 60,
    step: 1,
    group: 'joints',
  },
  {
    key: 'frenchcleat_spacing',
    kind: 'length',
    label: 'French cleat: cleat spacing',
    unit: 'mm',
    default: 200.0,
    min: 50,
    max: 1000,
    step: 1,
    group: 'joints',
    help: 'Distance between cleats, for the "hook" lower fixing.',
  },
  {
    key: 'skadis_style',
    kind: 'enum',
    label: 'Skådis: fixing',
    default: 'hooks',
    choices: [
      { value: 'hooks', label: 'Hooks' },
      { value: 'hook+stud', label: 'Hook and stud' },
      { value: 'single', label: 'Single hook' },
    ],
    group: 'joints',
  },
  {
    key: 'skadis_board_thickness',
    kind: 'length',
    label: 'Skådis: board thickness',
    unit: 'mm',
    default: 5.1,
    min: 2,
    max: 10,
    step: 0.1,
    group: 'joints',
  },
]);

/**
 * Dovetail joint options, for generators that offer the `d`/`D` edges.
 */
export const DOVETAIL_PARAMS: ParamSpec[] = inSection('Dovetails', (v) => anyEdgeIn(v, 'dD'), [
  {
    key: 'dt_angle',
    kind: 'number',
    label: 'Dovetail flare',
    unit: '°',
    default: 50,
    min: 0,
    max: 80,
    step: 1,
    group: 'joints',
    help: 'How much the tails widen towards their ends. Zero gives square tabs.',
  },
  {
    key: 'dt_size',
    kind: 'number',
    label: 'Dovetail pitch',
    unit: '× thickness',
    default: 3,
    min: 1,
    max: 10,
    step: 0.5,
    group: 'joints',
    help: 'Centre-to-centre distance of the tails.',
  },
  {
    key: 'dt_depth',
    kind: 'number',
    label: 'Dovetail depth',
    unit: '× thickness',
    default: 1.5,
    min: 0.5,
    max: 5,
    step: 0.1,
    group: 'joints',
    help: 'How far the tails stick out of the edge.',
  },
  {
    key: 'dt_radius',
    kind: 'number',
    label: 'Dovetail corner radius',
    unit: '× thickness',
    default: 0.2,
    min: 0,
    max: 1,
    step: 0.05,
    group: 'joints',
    help: 'Rounds all four corners of each tail. Never smaller than the kerf.',
  },
]);

/**
 * Wedged through-tenon options (`w`/`W`). Not from boxes.py — see
 * edges/wedgedtenon.ts for the geometry these describe.
 */
export const WEDGED_TENON_PARAMS: ParamSpec[] = inSection('Wedged tenons', (v) => ('assembly' in v ? v['assembly'] === 'wedges' : anyEdgeIn(v, 'wW')), [
  {
    key: 'wt_width',
    kind: 'number',
    label: 'Tenon width',
    unit: '× thickness',
    default: 4.0,
    min: 3,
    max: 8,
    step: 0.5,
    group: 'joints',
  },
  {
    key: 'wt_pitch',
    kind: 'number',
    label: 'Tenon spacing',
    unit: '× thickness',
    default: 25.0,
    min: 8,
    max: 60,
    step: 1,
    group: 'joints',
    help: 'Target distance between tenons. Each edge gets as many as fit, at least one.',
  },
  {
    key: 'wt_gap',
    kind: 'number',
    label: 'Wedge width',
    unit: '× thickness',
    default: 1.5,
    min: 1,
    max: 4,
    step: 0.1,
    group: 'joints',
    help: 'Width of the wedge where it locks, half-way along its length.',
  },
  {
    key: 'wt_end_margin',
    kind: 'number',
    label: 'Material beyond the wedge',
    unit: '× thickness',
    default: 1.5,
    min: 0.5,
    max: 4,
    step: 0.1,
    group: 'joints',
    help: 'Wood left at the tip of each tenon to take the wedge’s push. Too little and it splits.',
  },
  {
    key: 'wt_wedge_length',
    kind: 'number',
    label: 'Wedge length',
    unit: '× thickness',
    default: 8.0,
    min: 5,
    max: 12,
    step: 0.5,
    group: 'joints',
  },
  {
    key: 'wt_taper',
    kind: 'number',
    label: 'Wedge taper',
    unit: '1 :',
    default: 7,
    min: 5,
    max: 12,
    step: 1,
    group: 'joints',
    help: 'Gentler tapers (higher numbers) hold better; steeper ones take up more slack.',
  },
  {
    key: 'wt_slack',
    kind: 'length',
    label: 'Tenon clearance',
    unit: 'mm',
    default: 0.2,
    min: 0,
    max: 1,
    step: 0.05,
    group: 'joints',
    help: 'Added to every tenon hole and wedge slot. Raise it if parts will not go together.',
  },
  {
    key: 'wt_draw',
    kind: 'length',
    label: 'Wedge draw',
    unit: 'mm',
    default: 0.5,
    min: 0,
    max: 2,
    step: 0.1,
    group: 'joints',
    help: 'How far the wedge slot starts inside the mating panel, so the wedge pulls the joint tight.',
  },
]);

export type Assembly = 'glue' | 'wedges' | 'bolts';

const ASSEMBLY_CHOICES: Record<Assembly, { label: string; help: string }> = {
  glue: { label: 'Glue', help: 'Finger joints, glued for good.' },
  wedges: {
    label: 'Wedges',
    help: 'Tenons pass through the sides and are locked by wedges outside them. Knock the wedges out to take it apart.',
  },
  bolts: {
    label: 'Bolts',
    help: 'Finger joints held by bolts into captive nuts. Comes apart with a screwdriver.',
  },
};

/**
 * How the piece is held together, as one choice: the ways are alternatives,
 * and a pair of switches would let both be on. Offered with the ways a
 * generator supports; glue is always the default, so every golden-covered
 * default stays boxes.py's. `note` says what this generator does with the
 * way it offers, and shows with that choice; it is the panel's first field
 * in its group, ahead of the edge choices it overrides.
 */
export function assemblyParam(options: Assembly[], notes: string | Partial<Record<Assembly, string>> = ''): EnumParam {
  const ways: Assembly[] = ['glue', ...options];
  const noteFor = (w: Assembly) => (w === 'glue' ? '' : typeof notes === 'string' ? notes : (notes[w] ?? ''));
  return {
    key: 'assembly',
    kind: 'enum',
    label: 'Held together with',
    default: 'glue',
    choices: ways.map((w) => ({
      value: w,
      label: ASSEMBLY_CHOICES[w].label,
      help: [ASSEMBLY_CHOICES[w].help, noteFor(w)].filter(Boolean).join(' '),
    })),
    group: 'joints',
  };
}

const boltsChosen = (v: ParamValues) => ('assembly' in v ? v['assembly'] === 'bolts' : Number(v['bolts']) > 0);
const customBolt = (v: ParamValues) => boltsChosen(v) && v['bolt_size'] === 'custom';

/** The bolt and its nut, for captive-nut joints. All in mm, not thicknesses. */
export const BOLT_PARAMS: ParamSpec[] = inSection('Bolts and nuts', boltsChosen, [
  {
    key: 'bolt_size',
    kind: 'enum',
    label: 'Bolt size',
    default: 'M3',
    choices: [...Object.keys(BOLT_SIZES).map((k) => ({ value: k, label: k })), { value: 'custom', label: 'Custom' }],
    group: 'joints',
    help: 'Metric bolts with standard hex nuts. Custom takes the dimensions below.',
  },
  {
    key: 'bolt_length',
    kind: 'length',
    label: 'Bolt length',
    unit: 'mm',
    default: 20,
    min: 6,
    max: 80,
    step: 1,
    group: 'joints',
    help: 'Under the head. The slot and nut pocket are placed so the bolt passes through the nut with thread to spare.',
  },
  {
    key: 'bolt_clearance',
    kind: 'length',
    label: 'Clearance',
    unit: 'mm',
    default: 0.2,
    min: 0,
    max: 1,
    step: 0.05,
    group: 'joints',
    help: 'Added to the bolt slot and the nut pocket, so the bolt slides and the nut drops in.',
  },
  {
    key: 'bolt_d',
    kind: 'length',
    label: 'Bolt diameter',
    unit: 'mm',
    default: 3,
    min: 1,
    max: 12,
    step: 0.1,
    group: 'joints',
    showIf: customBolt,
  },
  {
    key: 'bolt_nut_width',
    kind: 'length',
    label: 'Nut width',
    unit: 'mm',
    default: 5.5,
    min: 2,
    max: 20,
    step: 0.1,
    group: 'joints',
    help: 'Across the flats.',
    showIf: customBolt,
  },
  {
    key: 'bolt_nut_height',
    kind: 'length',
    label: 'Nut thickness',
    unit: 'mm',
    default: 2.4,
    min: 0.5,
    max: 10,
    step: 0.1,
    group: 'joints',
    showIf: customBolt,
  },
]);

/**
 * Lid options, for generators that support one. Spread into a generator's own
 * params rather than added globally, since most generators have no lid.
 */
export const LID_PARAMS: ParamSpec[] = [
  {
    key: 'lid_style',
    kind: 'enum',
    label: 'Lid',
    default: 'none',
    choices: [
      { value: 'none', label: 'None' },
      { value: 'flat', label: 'Flat plates' },
      { value: 'chest', label: 'Chest' },
      { value: 'flatbrim', label: 'Flat with brim' },
      { value: 'flatfang', label: 'Flat with corner tabs' },
      { value: 'overthetop', label: 'Over the top' },
      { value: 'ontop', label: 'On top' },
    ],
    group: 'top',
    help:
      'Flat stacks two plates. The brim and corner-tab styles are one plate that locates ' +
      'inside the walls. Over-the-top is a shallow box that slips over the outside; ' +
      'on-top is the same box resting on the walls, located by tabs that hang inside. ' +
      'Chest is a half-round top bent over a living hinge.',
  },
  {
    key: 'lid_handle',
    kind: 'enum',
    label: 'Lid handle',
    default: 'none',
    choices: [
      { value: 'none', label: 'None' },
      { value: 'long_rounded', label: 'Long, rounded' },
      { value: 'long_trapezoid', label: 'Long, trapezoid' },
      { value: 'long_doublerounded', label: 'Long, double rounded' },
      { value: 'knob', label: 'Knob' },
    ],
    group: 'top',
  },
  {
    key: 'lid_height',
    kind: 'number',
    label: 'Lid brim height',
    unit: '× thickness',
    default: 4.0,
    min: 1,
    max: 20,
    step: 0.5,
    group: 'top',
    help: 'How far an over-the-top lid comes down the side of the box.',
  },
  {
    key: 'lid_brim_spacing',
    kind: 'length',
    label: 'Lid inset clearance',
    unit: 'mm',
    default: 0.1,
    min: 0,
    max: 2,
    step: 0.05,
    group: 'top',
    help: 'Gap between the walls and the part of a flat lid that sits inside them.',
  },
  {
    key: 'lid_brim_height',
    kind: 'number',
    label: 'Lid brim depth',
    unit: '× thickness',
    default: 1.0,
    min: 0.5,
    max: 10,
    step: 0.5,
    group: 'top',
    help: 'How far the brim or corner tabs of a flat lid reach down inside the walls.',
  },
  {
    key: 'lid_fang_size',
    kind: 'number',
    label: 'Lid corner tab width',
    unit: '× thickness',
    default: 1.0,
    min: 0.5,
    max: 10,
    step: 0.5,
    group: 'top',
  },
  {
    key: 'flex_distance',
    kind: 'number',
    label: 'Hinge cut spacing',
    unit: '× thickness',
    default: 0.5,
    min: 0.1,
    max: 3,
    step: 0.05,
    group: 'top',
    help: 'Chest lid only: distance between the rows of living-hinge cuts. Closer bends more easily.',
  },
  {
    key: 'flex_connection',
    kind: 'number',
    label: 'Hinge bridge width',
    unit: '× thickness',
    default: 1.0,
    min: 0.2,
    max: 5,
    step: 0.1,
    group: 'top',
    help: 'Chest lid only: material left uncut between the cuts in each row.',
  },
  {
    key: 'flex_width',
    kind: 'number',
    label: 'Hinge cut length',
    unit: '× thickness',
    default: 5.0,
    min: 1,
    max: 20,
    step: 0.5,
    group: 'top',
    help: 'Chest lid only: length of each cut.',
  },
  {
    key: 'lid_play',
    kind: 'number',
    label: 'Lid play',
    unit: '× thickness',
    default: 0.1,
    min: 0,
    max: 1,
    step: 0.05,
    group: 'top',
    help: 'Clearance so the lid slides on without binding.',
  },
];

/** Split the flat form values into the engine configuration. */
export function toBoxesConfig(values: ParamValues): BoxesConfig {
  const num = (k: string, d: number) => (typeof values[k] === 'number' ? (values[k] as number) : d);
  const str = (k: string, d: string) => (typeof values[k] === 'string' ? (values[k] as string) : d);

  // Bolts are sized in mm from the chosen bolt, not scaled with the material.
  const bedBoltSettings =
    'bolt_size' in values
      ? bedBoltSettingsFor(
          {
            size: str('bolt_size', 'M3'),
            length: num('bolt_length', 20),
            clearance: num('bolt_clearance', 0.2),
            custom: [num('bolt_d', 3), num('bolt_nut_width', 5.5), num('bolt_nut_height', 2.4)],
          },
          num('thickness', DEFAULT_CONFIG.thickness),
        )
      : undefined;

  const fingerJoint: Record<string, number | string> = {};
  const map: Record<string, string> = {
    fj_finger: 'finger',
    fj_space: 'space',
    fj_play: 'play',
    fj_surroundingspaces: 'surroundingspaces',
    fj_width: 'width',
    fj_edge_width: 'edge_width',
    fj_style: 'style',
  };
  for (const [formKey, settingKey] of Object.entries(map)) {
    const v = values[formKey];
    if (v !== undefined && typeof v !== 'boolean') fingerJoint[settingKey] = v;
  }

  const lid: Record<string, number | string> = {};
  const lidMap: Record<string, string> = {
    lid_style: 'style',
    lid_handle: 'handle',
    lid_height: 'height',
    lid_play: 'play',
    lid_brim_spacing: 'brim_spacing',
    lid_brim_height: 'brim_height',
    lid_fang_size: 'fang_size',
  };
  for (const [formKey, settingKey] of Object.entries(lidMap)) {
    const v = values[formKey];
    if (v !== undefined && typeof v !== 'boolean') lid[settingKey] = v;
  }

  const stackable: Record<string, number | string> = {};
  const stackableMap: Record<string, string> = {
    st_height: 'height',
    st_width: 'width',
    st_holedistance: 'holedistance',
    st_angle: 'angle',
    st_bottom_stabilizers: 'bottom_stabilizers',
  };
  for (const [formKey, settingKey] of Object.entries(stackableMap)) {
    const v = values[formKey];
    if (v !== undefined && typeof v !== 'boolean') stackable[settingKey] = v;
  }

  const handle: Record<string, number | string> = {};
  const handleMap: Record<string, string> = {
    rt_height: 'height',
    rt_radius: 'radius',
    rt_r_hole: 'r_hole',
    rt_outset: 'outset',
  };
  for (const [formKey, settingKey] of Object.entries(handleMap)) {
    const v = values[formKey];
    if (v !== undefined && typeof v !== 'boolean') handle[settingKey] = v;
  }

  const handleEdge: Record<string, number | string> = {};
  const handleEdgeMap: Record<string, string> = {
    he_height: 'height',
    he_radius: 'radius',
    he_hole_width: 'hole_width',
    he_hole_height: 'hole_height',
    he_outset: 'outset',
  };
  for (const [formKey, settingKey] of Object.entries(handleEdgeMap)) {
    const v = values[formKey];
    if (v !== undefined && typeof v !== 'boolean') handleEdge[settingKey] = v;
  }

  const flex: Record<string, number | string> = {};
  const flexMap: Record<string, string> = {
    flex_distance: 'distance',
    flex_connection: 'connection',
    flex_width: 'width',
  };
  for (const [formKey, settingKey] of Object.entries(flexMap)) {
    const v = values[formKey];
    if (v !== undefined && typeof v !== 'boolean') flex[settingKey] = v;
  }

  // Wall systems: the form key prefix, then the boxes.py settings family.
  const wallFamilies: Record<string, Record<string, number | string>> = {};
  for (const [prefix, family] of [
    ['slatwall_', 'SlatWall'],
    ['dinrail_', 'DinRail'],
    ['frenchcleat_', 'FrenchCleat'],
    ['skadis_', 'Skadis'],
  ] as const) {
    const settings: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (k.startsWith(prefix) && v !== undefined && typeof v !== 'boolean') settings[k.slice(prefix.length)] = v;
    }
    wallFamilies[family] = settings;
  }

  const dovetail: Record<string, number | string> = {};
  const dovetailMap: Record<string, string> = {
    dt_angle: 'angle',
    dt_size: 'size',
    dt_depth: 'depth',
    dt_radius: 'radius',
  };
  for (const [formKey, settingKey] of Object.entries(dovetailMap)) {
    const v = values[formKey];
    if (v !== undefined && typeof v !== 'boolean') dovetail[settingKey] = v;
  }

  const wedgedTenon: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (k.startsWith('wt_') && v !== undefined && typeof v !== 'boolean') wedgedTenon[k.slice(3)] = v;
  }

  return {
    ...DEFAULT_CONFIG,
    thickness: num('thickness', 3.0),
    burn: num('burn', 0.1),
    spacingFactor: num('spacing', 0.5),
    spacingExtra: 0,
    labels: values['labels'] !== false,
    reference: num('reference', 0),
    tabs: num('tabs', 0),
    innerCorners: str('inner_corners', 'loop') as BoxesConfig['innerCorners'],
    debug: false,
    ...(bedBoltSettings ? { bedBoltSettings } : {}),
    edgeSettings: {
      FingerJoint: fingerJoint,
      Lid: lid,
      RoundedTriangleEdge: handle,
      Stackable: stackable,
      HandleEdge: handleEdge,
      Flex: flex,
      DoveTail: dovetail,
      WedgedTenon: wedgedTenon,
      ...wallFamilies,
    },
  };
}
