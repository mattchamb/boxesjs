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
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOXES_PY = Path(os.environ.get("BOXES_PY", Path.home() / "src" / "boxes"))
CASES = ROOT / "test" / "golden.cases.json"
OUT_DIR = ROOT / "test" / "golden"


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
        module = importlib.import_module(f"boxes.generators.{module_name}")
        box = getattr(module, cls_name)()

        argv: list[str] = []
        for key, value in case["params"].items():
            if isinstance(value, bool):
                value = "1" if value else "0"
            # Our flat form keys map onto boxes.py's prefixed settings args.
            if key.startswith("fj_"):
                key = "FingerJoint_" + key[3:]
            elif key.startswith("lid_"):
                key = "Lid_" + key[4:]
            elif key.startswith("rt_"):
                key = "RoundedTriangleEdge_" + key[3:]
            argv += [f"--{key}", str(value)]
        # Keep the reference geometry pure unless the case says otherwise.
        argv += ["--reference", "0"]
        if "labels" not in case["params"]:
            argv += ["--labels", "0"]

        box.parseArgs(argv)
        box.open()
        box.render()
        data = box.close()

        out = OUT_DIR / f"{case['name']}.svg"
        out.write_bytes(data.read())
        print(f"wrote {out.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
