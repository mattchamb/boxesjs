#!/usr/bin/env bash
# Regenerate the boxes.py reference SVGs used by test/golden.test.ts.
#
# boxes.py is only needed to produce these files; nothing in the app or its
# test run depends on Python. The venv is created once and reused.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT/.venv-ref"
BOXES_PY="${BOXES_PY:-$HOME/src/boxes}"

if [ ! -d "$BOXES_PY" ]; then
  echo "boxes.py checkout not found at $BOXES_PY" >&2
  echo "Clone it, or set BOXES_PY to its location." >&2
  exit 1
fi

if [ ! -d "$VENV" ]; then
  echo "Creating reference venv at $VENV"
  python3 -m venv "$VENV"
  # Only the subset boxes.py needs to import and render to SVG.
  "$VENV/bin/pip" install --quiet \
    affine qrcode markdown shapely numpy typing_extensions
fi

BOXES_PY="$BOXES_PY" "$VENV/bin/python" "$ROOT/scripts/gen-golden.py"
