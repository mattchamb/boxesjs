import type { ParamValues } from '~/lib/params/schema';

/**
 * Options that change the part list but are off at defaults, so the default
 * checks never see them. Add a variant when a generator gains such an option,
 * especially one with no boxes.py golden behind it.
 *
 * Shared by test/generators.test.ts (overlap and naming) and
 * test/snapshots.test.ts (geometry pinned against the port's own output).
 */
export const VARIANTS: { id: string; name: string; values: ParamValues }[] = [
  { id: 'storageshelf', name: 'wedged tenons', values: { assembly: 'wedges', x: 200, sh: '120*3', sy: '150*2' } },
  { id: 'rectangularwall', name: 'wedged tenons', values: { bottom_edge: 'w', right_edge: 'W', top_edge: 'w', left_edge: 'W' } },
  { id: 'displayshelf', name: 'wedged tenons', values: { assembly: 'wedges', include_back: true, include_front: true, include_bottom: true } },
  { id: 'displayshelf', name: 'wedged tenons, sloped', values: { assembly: 'wedges', slope_top: true, include_back: true, include_front: true, include_bottom: true } },
  { id: 'storagerack', name: 'wedged tenons', values: { assembly: 'wedges' } },
  { id: 'storagerack', name: 'wedged tenons, open bottom, stackable top', values: { assembly: 'wedges', bottom_edge: 'e', top_edge: 'S' } },
  { id: 'paintstorage', name: 'wedged tenons', values: { assembly: 'wedges', canheight: 100, additional_bottom: true, additional_top: true } },
  { id: 'wallhopper', name: 'wedged tenons', values: { assembly: 'wedges', sx: '60*2', walltype: 'french cleat' } },
  { id: 'wallhopper', name: 'wedged tenons, no label', values: { assembly: 'wedges', sx: '60*3', label: false } },
  { id: 'closedbox', name: 'bolted', values: { assembly: 'bolts' } },
  { id: 'closedbox', name: 'bolted, M5', values: { assembly: 'bolts', bolt_size: 'M5', bolt_length: 25, x: 200, y: 160, h: 120 } },
  { id: 'universalbox', name: 'bolted', values: { assembly: 'bolts' } },
  { id: 'universalbox', name: 'bolted, finger-jointed bottom', values: { assembly: 'bolts', bottom_edge: 'F', vertical_edges: 'finger holes' } },
  { id: 'rectangularwall', name: 'bolted', values: { bolts: 2, bottom_edge: 'f', right_edge: 'F', top_edge: 'h', left_edge: 'f' } },
  { id: 'storageshelf', name: 'bolted', values: { assembly: 'bolts', thickness: 6, x: 200, sh: '150*3', sy: '150*2', top_edge: 'f' } },
  { id: 'storagerack', name: 'bolted', values: { assembly: 'bolts', thickness: 6, bottom_edge: 'F' } },
  { id: 'storagerack', name: 'bolted, open bottom', values: { assembly: 'bolts', thickness: 6, bottom_edge: 'e' } },
  { id: 'displayshelf', name: 'bolted', values: { assembly: 'bolts', thickness: 6, include_back: true, include_front: true, include_bottom: true } },
  { id: 'displayshelf', name: 'bolted, sloped', values: { assembly: 'bolts', thickness: 6, slope_top: true, include_back: true, include_bottom: true } },
  { id: 'typetray', name: 'bolted', values: { assembly: 'bolts', thickness: 6 } },
  { id: 'typetray', name: 'bolted, tall dividers, closed top', values: { assembly: 'bolts', thickness: 6, hi: 130, top_edge: 'f', bottom_edge: 'F' } },
  { id: 'typetray', name: 'bolted, stackable bottom', values: { assembly: 'bolts', thickness: 6, bottom_edge: 's', fingerholes: 'front-and-back' } },
  { id: 'cam', name: 'knife edge, offset, clockwise', values: { follower: 'knife', offset: 8, direction: 'cw', motion: 'rise 15 90 harmonic\nfall 5 45\nreturn 90 uniform' } },
  { id: 'cam', name: 'flat face, D shaft', values: { follower: 'flat', base_radius: 40, shaft_flat: 1 } },
  { id: 'automaton', name: 'window front, guides on the deck, no index pin', values: { front: 'window', back: 'solid', guides: 'above', index_pin: 0 } },
  { id: 'automaton', name: 'lifts only, labelled', values: { cams: 'rise 15 120\nreturn 120\n---\nphase 180\nrise 10 90 uniform\nreturn 90', labels: true, back: 'open' } },
  { id: 'automaton', name: 'peg wheel', values: { cams: 'output spin 12 8\n---\nrise 10 180\nreturn 180', pitch: 40 } },
  { id: 'automaton', name: 'wedged', values: { assembly: 'wedges' } },
  { id: 'automaton', name: 'bolted', values: { assembly: 'bolts', thickness: 6 } },
];
