#!/usr/bin/env python3
"""
List the boxes.py commits each port has not yet caught up with.

The golden tests catch upstream drift only where a case already exercises it:
a new option, a new lid style or a fix to a path no case reaches changes no
reference file. `scripts/upstream.json` records, per generator and for the
engine, which boxes.py files it was translated from and the commit it was last
checked against. This prints every commit since then that touched those files.

Usage:
    scripts/upstream-drift.py          # everything
    scripts/upstream-drift.py abox     # just these generators

After re-verifying a generator against a newer boxes.py, set its `sha` to that
commit. Needs only git and a checkout of boxes.py (BOXES_PY, default
~/src/boxes); no venv.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOXES_PY = Path(os.environ.get("BOXES_PY", Path.home() / "src" / "boxes"))
SYNC = ROOT / "scripts" / "upstream.json"


def commits_since(sha: str, files: list[str]) -> list[str]:
    out = subprocess.run(
        ["git", "-C", str(BOXES_PY), "log", "--oneline", f"{sha}..HEAD", "--", *files],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return out.splitlines()


def main() -> int:
    if not BOXES_PY.is_dir():
        print(f"boxes.py checkout not found at {BOXES_PY}; set BOXES_PY", file=sys.stderr)
        return 1
    data = json.loads(SYNC.read_text())
    wanted = sys.argv[1:]
    unknown = [g for g in wanted if g not in data["generators"]]
    if unknown:
        print(f"not in {SYNC.name}: {' '.join(unknown)}", file=sys.stderr)
        return 1

    head = subprocess.run(
        ["git", "-C", str(BOXES_PY), "rev-parse", "--short", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    print(f"boxes.py HEAD {head}")

    # The engine is shared, so its drift applies to every generator and is
    # shown once rather than repeated under each.
    entries = [("engine", data["engine"])] + [
        (g, e) for g, e in data["generators"].items() if not wanted or g in wanted
    ]
    behind = 0
    for name, entry in entries:
        log = commits_since(entry["sha"], entry["files"])
        if not log:
            continue
        behind += 1
        print(f"\n{name} ({len(log)} since {entry['sha']}):")
        for line in log:
            print(f"  {line}")
    if not behind:
        print("Everything is up to date.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
