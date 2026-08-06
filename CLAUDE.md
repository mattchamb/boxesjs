# boxesjs

Static Astro site of parametric laser-cut box generators. The geometry engine is
a TypeScript port of [Boxes.py](https://github.com/florianfesti/boxes), which is
checked out at `~/src/boxes` and is the specification for all engine behaviour.

Everything runs client-side. There is no backend.

## Porting

Every generator on the original list is ported. Adding another from boxes.py, or
changing an existing one, follows the same loop.

**Read `PORTING.md` before touching `src/lib/`.** It covers the verification
loop, the Python→TypeScript translation reference, the mistakes that have
already been made, and what the engine does and does not have (§9).

The rule that matters: a generator is not done until its geometry matches
boxes.py coordinate-for-coordinate. Add a case to `test/golden.cases.json`, run
`./scripts/gen-golden.sh`, and make `test/golden.test.ts` pass. Include at least
one case per generator with `"labels": true` — labels move the drawing cursor,
and a port that gets that wrong looks correct with labels off.

## Commands

```sh
npm run dev              # http://localhost:4321
npm test                 # full suite (should stay green)
npm run check            # tsc --noEmit
npm run build            # static site into dist/
./scripts/gen-golden.sh  # regenerate boxes.py reference SVGs (needs ~/src/boxes)
```

## Layout

- `src/lib/geom/` — affine, extents, path recording, colour→layer mapping
- `src/lib/boxes.ts` — `Boxes` base class: turtle ops, part layout, walls, holes
- `src/lib/edges/` — one file per edge family
- `src/lib/parts.ts` — standalone part shapes (`disc`), hung off the box as `parts`
- `src/lib/generators/` — one file per generator, plus `registry.ts`
- `src/lib/params/` — parameter schema and the shared parameter set
- `src/lib/export/` — SVG and LightBurn `.lbrn2` writers
- `src/lib/render.ts` — the single geometry pass everything else consumes
- `src/components/` — Preact islands (preview, controls, app shell)
- `test/golden/` — reference SVGs rendered by the real boxes.py

## Conventions

- Comments explain **why**, not what. Where behaviour is inherited from boxes.py
  for a non-obvious reason, say so.
- Unsupported options are **removed** from the UI's choices, never silently
  mapped to something else.
- Parameter groups are intent-based (`dimensions`, `material`, `joints`, `top`,
  `advanced`), not argparse groups.
- Pass `label:` to every wall call — labels become preview hover names, export
  group ids, and LightBurn T1 text.

## Licence

Boxes.py is GPL v3+; this is a derivative work under the same licence.
