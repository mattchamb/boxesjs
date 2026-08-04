# boxesjs

Parametric laser-cut box generators as a static Astro site. The geometry engine
is a TypeScript port of [Boxes.py](https://github.com/florianfesti/boxes),
verified coordinate-for-coordinate against the original.

Everything runs in the browser: there is no backend, no Generate button, and
nothing is uploaded. Change a parameter and the preview updates as you type.

## Why this exists

Boxes.py works, but the workflow is a server round trip — fill in a form of
~40 identical text boxes, submit, get an SVG in a new tab, switch back to the
form to change anything. Its LightBurn export exists but writes cut layers with
no speed or power, so every file still needs the Cuts/Layers panel filled in by
hand.

This rewrite targets those two things:

- **Live preview.** The engine runs in a Web Worker, so the UI never blocks.
  Each layer is drawn as a single merged `<path>`, so a parameter change is four
  attribute writes rather than thousands of DOM nodes. Pan and zoom are a
  composited `transform`, not a viewBox change.
- **LightBurn-first export.** Material presets carry thickness, kerf, and
  per-layer speed/power/passes/air-assist. Exported `.lbrn2` files have named
  layers in cut-priority order (engrave → score → inner → outer) with those
  settings filled in, parts grouped, and labels on tool layer T1 so they are
  never cut.

## Development

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site into dist/
npm test         # 111 tests
npm run check    # typecheck
```

## Verification

The engine is checked against the real Boxes.py rather than only against itself.
`test/golden/` holds SVGs rendered by the Python original; `test/golden.test.ts`
asserts identical sheet size, path count, every coordinate (to 0.01 mm), and
total cut length.

To regenerate the references you need a Boxes.py checkout (`~/src/boxes`, or set
`BOXES_PY`). Python is only needed for this step — nothing in the app or the
normal test run depends on it.

```sh
./scripts/gen-golden.sh
```

Add cases to `test/golden.cases.json`; both sides read it.

`test/generators.test.ts` additionally asserts, for every generator, that it
renders at its defaults, names all its parts, never lays two parts on top of
each other, and survives every edge type, enum option, and numeric extreme the
UI can produce.

## What is and is not here

Ported: the turtle engine with kerf compensation, inner-corner resolution, part
layout, and the edge families these generators need — straight, finger joint
(`f`/`F`/`h`), stackable (`s`/`S`/`š`/`Š`), gripping, rounded-triangle handle,
mounting keyholes, slotted, compound, and finger-access scoops. Plus flat and
over-the-top lids.

Not ported: the flex/living-hinge and cabinet-hinge edge families, gears,
pulleys, servos, wall edges, QR codes, DXF/PostScript output, and the remaining
Boxes.py generators. Options that would need them are absent from the UI rather
than silently falling back to something else.

Generators are one file each in `src/lib/generators/`; adding another is
mechanical.

## Licence

Copyright (C) 2026 Matthew Chambers
Copyright (C) 2013-2024 Florian Festi and the Boxes.py contributors

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. The full text is in [LICENSE](LICENSE).

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU General Public License for more details.

### Modified work notice

This is a modified version of [Boxes.py](https://github.com/florianfesti/boxes)
by Florian Festi, and is not endorsed by or affiliated with that project.

The geometry engine under `src/lib/` — the `Boxes` base class, the edge
families, and the generators — is a TypeScript translation of the corresponding
Python, restructured but behaviourally equivalent, and verified against
reference output from the original (`test/golden/`). The user interface, the
Web Worker render pipeline, the LightBurn `.lbrn2` exporter, and the material
presets are new work. Modifications were made in 2026.
