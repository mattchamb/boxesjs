# Porting guide

How to continue porting Boxes.py generators into this codebase, written for
whoever picks this up next.

The engine port is done and verified. What remains is mostly mechanical:
translating one generator file at a time and proving each one matches the
original. This document is about doing that faithfully.

---

## 1. The one rule

**Never consider a generator done until it matches boxes.py numerically.**

The Python original at `~/src/boxes` is the specification. Not the docs, not
your reading of the algorithm — the actual coordinates it emits. Kerf
compensation and finger arithmetic are exactly the places where a plausible
translation is silently wrong, and "silently wrong" here means a box whose
parts do not fit together, discovered after cutting a sheet of plywood.

Two bugs already got through review and were caught only by this check:

- **TypeTray overrides a shared setting.** `addSettingsArgs(FingerJointSettings,
  surroundingspaces=0.5)` changes the finger count on every wall. Missing it
  produced geometry that looked completely reasonable and was wrong everywhere.
- **`text()` needs `@restore`.** boxes.py decorates it; the first port did not.
  Drawing a part label left the cursor displaced and shifted the layout of every
  subsequent part. The golden tests missed it because they ran with labels off.

Both were invisible by eye. Both were obvious the moment coordinates were
compared.

---

## 2. The verification loop

### Setup (once)

`./scripts/gen-golden.sh` creates `.venv-ref/` and installs the subset of
boxes.py's dependencies needed to render SVG (`affine qrcode markdown shapely
numpy typing_extensions`). It expects a boxes.py checkout at `~/src/boxes`; set
`BOXES_PY` otherwise.

Python is needed **only** to regenerate reference files. Nothing in the app or
the normal test run touches it.

### Adding a case

Add to `test/golden.cases.json` — both the Python script and the TypeScript test
read this one file:

```json
{
  "name": "ref_drillbox",
  "generator": "drillbox",
  "pythonClass": "DrillBox",
  "params": { "sx": "25*3", "sy": "60*4", "h": 50, "thickness": 3, "burn": 0.1 }
}
```

- `name` — golden file basename and the test title.
- `generator` — id in our registry.
- `pythonClass` — class name in boxes.py.
- `pythonModule` — only when the module name is not the lowercased class name
  (e.g. `RectangularWall` lives in `rectangularWall.py`).

Then `./scripts/gen-golden.sh && npx vitest run test/golden.test.ts`.

### Parameter name mapping

`scripts/gen-golden.py` rewrites our flat form keys into boxes.py's prefixed
settings arguments:

| our key | boxes.py argument |
| --- | --- |
| `fj_*` | `--FingerJoint_*` |
| `lid_*` | `--Lid_*` |
| `rt_*` | `--RoundedTriangleEdge_*` |
| `st_*` | `--Stackable_*` |
| everything else | `--<key>` verbatim |

If you expose a new settings family in the UI, add its prefix to that map or the
golden run will pass an argument boxes.py rejects. That is three parallel edits:
a `xx_*` block in `common.ts`, an entry in `toBoxesConfig`'s `edgeSettings`, and
the prefix here. `st_*` was added this way for PaintStorage.

### What to cover

Per generator, aim for **three or four cases**:

1. Defaults, or close to them.
2. A different thickness *and* kerf — these scale everything and catch
   proportional errors.
3. Each structurally distinct option that changes the part list (a lid style, a
   bottom edge that adds a panel, a top edge that closes the box).
4. **At least one with `"labels": true`.** Labels move the cursor; a port that
   gets this wrong looks fine with labels off. `gen-golden.py` only passes
   `--labels 0` when the case does not mention `labels`.

### Reading a failure

The test reports the first differing token:

```
path 8 token 4: expected 17, got 23
```

`test/helpers/golden.ts` tokenises both sides, so numeric formatting differences
are already normalised — a mismatch is a real geometry difference. Useful
follow-ups:

- **Wrong number of paths** — a part is missing, or paths are merging
  differently. Compare part counts and per-part path counts against the `<g
  id="p-N">` groups in the golden SVG.
- **A coordinate off by a multiple of `space + finger`** — finger count is
  wrong. Nearly always a missing generator-level setting override (see §5).
- **Everything after part *n* is shifted** — a cursor was left displaced.
  Look for a missing `savedContext` or `withRestore`.

Write a throwaway `test/_probe.test.ts` that prints part names, bboxes and path
counts side by side with the golden file; delete it when done. That is how both
bugs above were found. Note that `renderPreview` gives you names and boxes only
— use `buildDrawing` when the probe needs the actual path commands.

### The other test file

`test/generators.test.ts` enrols every registered generator automatically: it
renders at defaults, requires every part to be named, and sweeps the extremes of
every numeric parameter and every choice of every `edge` and `enum` parameter,
asserting only that nothing throws. **A new generator is covered by these the
moment you add it to the registry** — including parameter combinations you did
not think about, which is the point. If one of the sweeps fails, the fix is
usually in the generator, not the test.

Its overlap check is path-level, not bounding-box level: boxes overlapping is
only a prefilter, and a pair is reported only when their cut outlines actually
intersect or nest. Finger tabs interleave routinely, so boxes.py packs layouts
whose part boxes touch at a corner while the outlines stay millimetres apart —
CardBox at defaults is one.

---

## 3. Architecture

```
src/lib/
  geom/
    affine.ts     2x3 matrix, same element order as Python `affine`
    extents.ts    bounding boxes
    context.ts    Context / Surface / Part / Path — path recording,
                  arc→bézier, fasterEdges (inner-corner cleanup)
    colors.ts     colour → layer mapping; layer metadata incl. LightBurn indices
  boxes.ts        the Boxes base class: turtle ops, move(), walls, holes, text
  edges/          one file per edge family
  generators/     one file per generator + registry.ts
  params/         schema.ts (ParamSpec types), common.ts (shared params),
                  sections.ts ("50*3" mini-language)
  lids.ts         lid styles
  topedge.ts      top-edge → four edges, and which lid parts to draw
  export/         svg.ts, lbrn2.ts
  render.ts       params → Drawing (the single geometry pass)
  preview.ts      Drawing → PreviewData (worker payload)
```

`render.ts` runs the engine once; the preview, the SVG writer and the LightBurn
writer all consume its output. Anything you add to a generator flows to all
three automatically.

**Dependency direction:** `edges/*` import `Boxes` as `import type` only.
`boxes.ts` imports edge classes at runtime. Keep it that way or you get a cycle.

---

## 4. Porting a generator, step by step

Take `src/lib/generators/typetray.ts` as the reference — it is the most involved
one done so far and exercises nearly everything.

**1. Read the whole Python file first.** Including the tail. The first TypeTray
port missed the last 40 lines, which draw the side walls and the second set of
dividers, and got the divider slot direction backwards as a result.

**2. Check what it needs that does not exist yet.** Grep the Python for
`addSettingsArgs`, `edges.`, `self.parts.`, `polygonWall`, `partsMatrix`,
`CompoundEdge`. If it needs an unported edge family, port that first (§7).

**3. Write the class.** Constructor takes plain typed parameters, not a values
bag; `create()` in the export does the unpacking. Implement `render()`.

**4. Write the `GeneratorDef`.** Meta, `params`, and `paramDefaults` for any
shared setting the Python overrides (§5).

**5. Register it** in `src/lib/generators/registry.ts`. This automatically
enrolls it in `test/generators.test.ts`, which asserts it renders at defaults,
names every part, never overlaps parts, and survives every edge type, enum
option and numeric extreme the UI can produce.

**6. Add golden cases** (§2) and make them pass.

**7. Check the UI.** `npm run dev`, open `/b/<id>`, confirm the parameter panel
reads sensibly and the preview looks like the thing it claims to be.

---

## 5. Generator-level setting overrides

This is the single easiest thing to get wrong.

```python
self.addSettingsArgs(edges.FingerJointSettings, surroundingspaces=0.5)
```

means "this generator's default edge margin is 0.5, not the library default of
2.0". Users can still change it. In our schema:

```ts
export const typeTray: GeneratorDef = {
  // Tray dividers are short walls; the standard edge margin would leave many of
  // them with no fingers at all, so this generator starts with a smaller one.
  paramDefaults: { fj_surroundingspaces: 0.5 },
  params: [ ... ],
  ...
};
```

`registry.paramsFor()` applies these over both `COMMON_PARAMS` and the
generator's own list, because the shared blocks (`LID_PARAMS`, `HANDLE_PARAMS`)
are spread into that list rather than added globally. The keys are the **form
keys** (`fj_finger`, `fj_space`, `lid_height`, `rt_outset`…), see
`src/lib/params/common.ts`.

Grep every `addSettingsArgs(...)` call in the Python file for keyword arguments
and translate all of them.

---

## 6. Python → TypeScript reference

### Calls

| boxes.py | here |
| --- | --- |
| `self.rectangularWall(x, y, "ffff", move="up", label="Top")` | `this.rectangularWall(x, y, 'ffff', { move: 'up', label: 'Top' })` |
| `..., callback=[a, b], ignore_widths=[1, 6]` | `..., { callback: [a, b], ignoreWidths: [1, 6] }` |
| `self.trapezoidSideWall(w, h0, h1, e, radius=r, move=...)` | `this.trapezoidSideWall(w, h0, h1, e, { radius: r, move: ... })` |
| `self.regularPolygonWall(corners=n, r=r, edges='F', move=...)` | `this.regularPolygonWall(n, { r, edges: 'F', move: ... })` |
| `self.edges["f"](length)` | `this.getEdge('f').call(length)` |
| `self.edges.get(c, c)` | `this.getEdge(c)` |
| `with self.saved_context():` | `this.savedContext(() => { ... })` |
| `self.mirrorX(f, offset)` | `this.mirrorX(f, offset)` |
| `edges.CompoundEdge(self, "fe", [a, b])` | `new CompoundEdge(this, [this.getEdge('f'), this.getEdge('e')], [a, b])` |
| `edges.SlottedEdge(self, sx, "A", slots=n)` | `new SlottedEdge(this, sx, 'A', n)` |
| `self.lid(x, y, top_edge)` | `this.lid(x, y, topEdge)` |
| `self.topEdges(e)` / `self.drawLid(...)` | `topEdges(this, e)` / `drawLid(this, x, y, e)` from `../topedge` |

### Idioms

| Python | TypeScript |
| --- | --- |
| `self.polyline(0, (90, r), l)` | `this.polyline(0, [90, r], l)` — angle/radius and length/tabs pairs become arrays |
| `sx[::-1]` | `[...sx].reverse()` — never `.reverse()` on the original, it mutates |
| `list(reversed(poly))` | `[...poly].reverse()` |
| `sum(sx) + (len(sx) - 1) * t` | `sx.reduce((a, b) => a + b, 0) + (sx.length - 1) * t` |
| `math.radians(a)` / `math.degrees(a)` | `a * DEG` / `a / DEG` where `const DEG = Math.PI / 180` |
| `int(x // y)` | `Math.floor(x / y)` — both floor toward −∞ |
| `for l in self.sections[:-1]:` | `for (const l of sections.slice(0, -1))` |

### Settings classes

No `__getattr__`, so every value needs an explicit getter. The base accessors
are `getNum` / `getStr` / `getBool` — deliberately prefixed, because subclasses
expose properties called `num`, `width`, `style`.

```ts
export class FooSettings extends Settings {
  static override absoluteParams = {
    style: ['a', 'b'] as const,   // tuple default = enum, first entry is default
    count: 2,
  };
  static override relativeParams = { depth: 0.3 };  // multiples of thickness

  angle = 90;   // plain class field: settable via setValues, like Python

  get style(): string { return this.getStr('style'); }
  get count(): number { return this.getNum('count'); }
  get depth(): number { return this.getNum('depth'); }

  override checkValues(): void { /* throw on impossible combinations */ }

  edgeObjects(boxes: Boxes, chars = 'x', add = true): BaseEdge[] { ... }
}
```

### Edge classes

`__call__` becomes `call(length: number, opts: EdgeCallOptions = {})`.
`BaseEdge` provides protected forwarders for the common turtle ops
(`edge`, `corner`, `polyline`, `moveTo`, `hole`, `thickness`, `burn`); anything
else goes through `this.boxes.*`.

Register the family in `Boxes.buildObjects()` (`src/lib/boxes.ts`).

---

## 7. Adding an edge family

1. New file in `src/lib/edges/`.
2. Settings class + edge classes, following the shapes above.
3. Instantiate in `Boxes.buildObjects()`.
4. Add an entry to `EDGE_INFO` in `src/lib/params/schema.ts` (name and
   description — this is what the picker shows instead of a bare letter).
5. Add a glyph to `EDGE_GLYPHS` in `src/components/controls.tsx`, a small SVG
   path on a `0 0 48 26` viewBox showing the profile.
6. If it is a valid top or bottom edge, add its char to `TOP_EDGE_CHOICES` /
   `BOTTOM_EDGE_CHOICES` in `src/lib/topedge.ts`, and handle it in `topEdges()`
   and `drawLid()` if it implies extra parts.

Edge chars are single characters and some are non-ASCII (`š`, `Š`). Keep the
original characters — permalinks and golden cases use them.

### Generator-local edges

Steps 4-6 only apply to edges the user can pick. Several generators define edge
classes in their own file that are never registered and exist only to be passed
to a `rectangularWall` call — CardBox's `InsetEdge` and `CardFingerHoleEdge`,
NotesHolder's `USlotEdge` and `HalfStackableEdge`. boxes.py does the same. Keep
them in the generator file rather than `src/lib/edges/`, even when they share a
name with a library edge, because they do not share its geometry.

Watch for boxes.py passing something other than a `Settings` object as the
`settings` argument — it relies on duck typing where we cannot. `USlotEdge`'s
"settings" is the opening percentage as a bare float, and `OutSetEdge`'s is the
outset distance. For the latter, `OutSetEdge` takes an explicit optional
`width: number | null` in our port; when translating a similar case, add a real
constructor argument rather than widening the `settings` type.

---

## 8. Gotchas

**Check for Python decorators before porting any method.** `@restore` saves and
restores the coordinate system *and* resets the cursor to the origin;
`@holeCol` switches to the inner-cut colour. In `Boxes` these are the protected
helpers `withRestore` and `withHoleColor`, so a generator can wrap its own
methods the same way (see Console2's `latchHole`).

`withRestore` is not the same as `savedContext` — it additionally does
`ctx.moveTo(0, 0)` at the end. Using the wrong one leaves a stale cursor.

The full `@restore` list in `boxes/__init__.py`:

```
circle  dHole  fillHoles  fingerHoleRectangle  flatHole  hole  mountingHole
NEMA  polygonWalls  rectangularHole  regularPolygonAt  regularPolygonHole
showBorderPoly  text  TX
```

plus `NutHole.__call__`. Of these, the ported ones all use `withRestore`; if you
port any of the rest, check the decorator first. A missing `@restore` shifts
everything drawn afterwards — which is exactly the `text()` bug from §1.

To find them: `grep -B3 "    def " boxes/__init__.py | grep -A3 "@restore"`.

**Port `move()`-adjacent code literally.** `Boxes.move()` interacts with the
save/restore stack in a way that looks redundant and is not. Do not tidy it.

**`move="right only"` still needs correct dimensions.** It advances the cursor
by the part's size, so passing different dimensions than the Python does moves
everything after it. TypeTray's `rectangularWall(x, hi, "ffff", move="right
only")` is a real example — `hi` and `"ffff"`, not the front wall's parameters.

**Watch for name shadowing in the Python.** `SlottedEdge.__init__` assigns
`self.edge = ...`, shadowing the inherited `edge()` method; subsequent
`self.edge(l)` calls the edge object, not the method. Here it is
`sectionEdge`. Read carefully when a generator assigns to an attribute that is
also a method.

**Egg-crate dividers slot in opposite directions.** One set slots down from the
top, the other up from the bottom. Getting both the same way produces geometry
that assembles in the preview and not in reality.

**Do not silently degrade unsupported options.** If a generator offers a top
edge needing an unported family, remove it from the `choices` string rather than
mapping it to something else. A UI that only offers what works is honest; one
that quietly substitutes is not.

**boxes.py is the specification, but it is not always right.** `notesholder.py:161`
writes `font_edge = back_edge = outer_edge` where it means `front_edge`, so
`front_edge` is unbound and `--opening 0` raises `NameError` upstream. Our port
assigns the name the author meant, which is a deliberate divergence recorded in
`notesholder.ts`. When you find one of these: fix it only where the intent is
unambiguous, comment it at the site, and remember you cannot write a golden case
for a configuration boxes.py refuses to render — so the fixed path is covered by
the invariant tests only.

**Part bounding boxes exclude the label.** `renderBox` sizes the page from the
surface extents, which include text just as boxes.py's do, but a *part's* box
covers only its drawn geometry. Otherwise a name that overhangs its part reports
neighbouring parts as colliding when only their labels overlap.

**Labelling a part boxes.py leaves unlabelled can change the sheet size.** Every
part needs a label — an unnamed part is named `default`, which the invariant
tests reject — but the text counts towards the page extents on both sides, so a
label wider than its part will fail a golden case with `"labels": true` on sheet
size alone. Keep such labels short, or pick case parameters that make the part
wide enough (NotesHolder's labelled case uses a small `opening` for exactly
this reason).

---

## 9. Remaining generators

CardBox, Console2, UniversalBox, DrillBox and NotesHolder are **done** — four
golden cases each, all matching boxes.py. PaintStorage (`paintbox.py`) is done
too, with five. Two remain: **DisplayShelf** and **RegularBox**.

PaintStorage brought two pieces of shared machinery with it: `hexHolesRectangle`
and `HexHolesSettings` (`src/lib/hexholes.ts`), and the `st_*` parameter block
that exposes `StackableSettings`. Note that its module is `paintbox.py` while
its class is `PaintStorage`, so its golden cases need an explicit
`"pythonModule": "paintbox"`.

### `polygonWall` blocks both of them

This is the thing to understand before planning anything else, and an earlier
version of this document got it wrong.

`polygonWall` is not a DisplayShelf-only concern. **RegularBox draws every one
of its side walls through it** — both the `n % 2` branch and the even-`n`
branch, `regularbox.py:145-165`. There is no configuration of RegularBox that
avoids it. DisplayShelf needs it only for `slope_top`
(`displayshelf.py:generate_sloped_sides`); everything else in that file is
`rectangularWall`, angled `fingerHolesAt` and `CompoundEdge`, all of which
already work.

So `polygonWall` is the shared prerequisite for the rest of the port, not an
optional extra.

| Piece | Python | Status |
| --- | --- | --- |
| `polygonWall` | `__init__.py:2917`, ~40 lines | **missing** |
| `_closePolygon` | `__init__.py:2872`, ~45 lines | **missing** |
| `_polygonWallExtend` | `__init__.py:2795`, ~75 lines | **missing** — the awkward one |
| `parts.disc` | `parts.py:34` | **missing** (`disc` at `boxes.ts:589` is only a comment on `circle()`) |
| `regularPolygonAt` | | **missing** |
| `regularPolygonWall`, `regularPolygon` | | ported |
| `FingerJointSettings` cloned at an angle | | **ported — see below** |

`_polygonWallExtend` is where the difficulty is. It computes the part's bounding
box before drawing, which means walking the border list twice: once to expand
each edge's `margin()` into extra segments, and once to trace the path. It has
to handle borders whose angle entry is an `(angle, radius)` tuple rather than a
plain number, and for those it works out which of the four compass directions
the arc sweeps past (`_angle_in_sweep`) to find the extremes. Port it literally;
it is not a good candidate for improvement.

### What RegularBox does *not* need

This document previously called the per-angle finger-joint settings RegularBox's
hard part. It is not — that already works. `FingerJointSettings` carries an
`angle` (`fingerjoint.ts:59`), `fingerLength()` computes from it
(`fingerjoint.ts:119`), and `setValues` and `edgeObjects` are both ported. The
Python

```python
fingerJointSettings = copy.deepcopy(self.edges["f"].settings)
fingerJointSettings.setValues(self.thickness, angle=phi)
fingerJointSettings.edgeObjects(self, chars="gGH")
```

should translate directly: `FingerJointSettings.edgeObjects(boxes, chars, add)`
takes the same `chars` argument (`fingerjoint.ts:77`).

It registers new edge characters on the box mid-render — `gGH`, then `yYH`,
then `zZH`. `addPart` overwrites `this.edges[char]` unconditionally, exactly as
boxes.py does (its guard is commented out at `__init__.py:655`), so `H` ends up
bound three times and only the last survives. That is harmless here because
RegularBox's border strings only ever reference `g`, `G`, `y` and `z` — but it
does mean these edges are box state, not local values, and anything drawn after
them sees the redefinition.

The one thing to get right is `copy.deepcopy`. Each clone must be an independent
settings object; sharing one would make the three angles overwrite each other.

### RegularBox scope

`top` has eight styles and `bottom` seven. `bayonet mount` additionally needs
the `BayonetBox` base class for `lowerCB`/`upperCB` — under §8's
no-silent-degradation rule, leave it out of the choices rather than substituting
something else, and say so in the generator's help text.

### Suggested order

1. `polygonWall` + `_closePolygon` + `_polygonWallExtend` as engine work, with
   its own golden coverage. Easiest way to test it in isolation is a generator
   that already uses it in boxes.py — or add cases once DisplayShelf lands.
2. DisplayShelf, complete, including `slope_top`. It is otherwise pure
   transcription, so it should go quickly once step 1 is in.
3. RegularBox: `parts.disc`, `regularPolygonAt`, then the `top`/`bottom` matrix.

Doing DisplayShelf first *without* `slope_top` is possible and carries no engine
risk, but it ships a generator with an option removed that you would then add
back, which means changing its UI choices and regenerating its goldens.

### Not ported, and not needed by the above

Flex / living hinge, `CabinetHinge`, `ChestHinge`, `Click`, `SlideOnLid`,
`DoveTail`, `Grooved`, `HandleEdge`, gears, pulleys, servos, wall edges, QR
codes, `fillHoles`, DXF and PostScript output.

`hexHolesRectangle` is ported; `hexHolesPlate`, `hexHolesCircle` and
`hexHolesHex` are not, and neither is `rectangularWall`'s `holesMargin`
argument, which is the only caller of `hexHolesRectangle` inside the engine.

---

## 10. Conventions

- **Comments explain why, not what.** The codebase leans on this; match it.
  Where behaviour is inherited from boxes.py for a non-obvious reason, say so.
- **Parameter groups are intent-based** — `dimensions | material | joints | top
  | advanced` — not argparse groups. Joint tuning belongs in `joints`,
  collapsed.
- **Every parameter gets a real control.** `kind` drives it: `length`/`number` →
  slider + box, `sections` → compartment editor, `edge` → illustrated picker,
  `enum` → segments or select, `bool` → switch, `text` → input/textarea.
- **Part labels matter.** Pass `label:` to every wall call. They become part
  names in the preview hover, group ids in the export, and T1 text in LightBurn.
- Use `this.warn(message, paramKey)` for recoverable problems; the UI shows them
  inline on the offending field.

## Commands

```sh
npm run dev              # http://localhost:4321
npm test                 # full suite
npm run check            # typecheck
npm run build            # static site
./scripts/gen-golden.sh  # regenerate boxes.py reference SVGs
```
