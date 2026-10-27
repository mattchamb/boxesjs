#!/usr/bin/env python3
"""
Regenerate the reference SVGs that `test/golden.test.ts` compares against.

These come from the original boxes.py, which is the whole point: they are an
independent implementation, so matching them is real evidence the TypeScript
port is correct rather than merely self-consistent.

Usage:
    scripts/gen-golden.sh              # sets up the venv, then runs this

Requires a checkout of boxes.py; point BOXES_PY at it if it is not ~/src/boxes.
"""
from __future__ import annotations

import importlib
import json
import os
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOXES_PY = Path(os.environ.get("BOXES_PY", Path.home() / "src" / "boxes"))
CASES = ROOT / "test" / "golden.cases.json"
OUT_DIR = ROOT / "test" / "golden"


# What boxes.py writes to switch its bolts off, in every generator that wires
# them up. Bolted cases run the generator with this line taken out.
BOLTS_OFF = "d2 = d3 = None"

# The port's own keys: how the bolts are chosen is the port's, so boxes.py
# takes the result (`bedBoltSettings` on the case) rather than these.
PORT_ONLY = ("assembly", "bolts", "bolt_")


def load_generator(module_name: str, cls_name: str, bolted: bool):
    module = importlib.import_module(f"boxes.generators.{module_name}")
    if bolted:
        source = Path(module.__file__).read_text()
        if BOLTS_OFF not in source:
            raise SystemExit(f"{module_name}: no '{BOLTS_OFF}' to take out; nothing to switch on")
        patched = types.ModuleType(module.__name__)
        patched.__file__ = module.__file__
        patched.__package__ = module.__package__
        # `pass` keeps the indentation of the line it replaces valid.
        exec(compile(source.replace(BOLTS_OFF, "pass"), module.__file__, "exec"), patched.__dict__)
        module = patched
    return getattr(module, cls_name)


def main() -> int:
    if not (BOXES_PY / "boxes" / "__init__.py").exists():
        print(f"boxes.py not found at {BOXES_PY}. Set BOXES_PY to its checkout.", file=sys.stderr)
        return 1

    sys.path.insert(0, str(BOXES_PY))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    cases = json.loads(CASES.read_text())
    for case in cases:
        cls_name = case["pythonClass"]
        module_name = case.get("pythonModule", cls_name.lower())
        bolted = case["params"].get("assembly") == "bolts"
        box = load_generator(module_name, cls_name, bolted)()

        argv: list[str] = []
        for key, value in case["params"].items():
            if key.startswith(PORT_ONLY):
                continue
            if isinstance(value, bool):
                value = "1" if value else "0"
            # Our flat form keys map onto boxes.py's prefixed settings args.
            if key.startswith("fj_"):
                key = "FingerJoint_" + key[3:]
            elif key.startswith("lid_"):
                key = "Lid_" + key[4:]
            elif key.startswith("rt_"):
                key = "RoundedTriangleEdge_" + key[3:]
            elif key.startswith("st_"):
                key = "Stackable_" + key[3:]
            elif key.startswith("slatwall_"):
                key = "SlatWall_" + key[9:]
            elif key.startswith("dinrail_"):
                key = "DinRail_" + key[8:]
            elif key.startswith("frenchcleat_"):
                key = "FrenchCleat_" + key[12:]
            elif key.startswith("skadis_"):
                key = "Skadis_" + key[7:]
            elif key.startswith("dt_"):
                key = "DoveTail_" + key[3:]
            elif key.startswith("flex_"):
                key = "Flex_" + key[5:]
            elif key.startswith("mount_"):
                key = "Mounting_" + key[6:]
            elif key.startswith("he_"):
                key = "HandleEdge_" + key[3:]
            argv += [f"--{key}", str(value)]
        # Keep the reference geometry pure unless the case says otherwise.
        argv += ["--reference", "0"]
        if "labels" not in case["params"]:
            argv += ["--labels", "0"]

        box.parseArgs(argv)
        # Drops the creation date from the comment and the dc:date tag. Nothing
        # in golden.ts reads either, but without this every regeneration
        # rewrites all of these files and a real change hides in the churn.
        box.metadata["reproducible"] = True
        box.open()
        # After open(), which resets it to boxes.py's own default.
        if "bedBoltSettings" in case:
            box.bedBoltSettings = tuple(case["bedBoltSettings"])
        box.render()
        data = box.close()

        out = OUT_DIR / f"{case['name']}.svg"
        out.write_bytes(data.read())
        print(f"wrote {out.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
