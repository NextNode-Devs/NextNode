"""Fail if any backend source file exceeds 500 lines (architecture rule)."""

import sys
from pathlib import Path

LIMIT = 500
ROOT = Path(__file__).resolve().parent.parent
SKIP = {".venv", "migrations", "__pycache__"}

too_long = [
    (path.relative_to(ROOT), count)
    for path in ROOT.rglob("*.py")
    if not SKIP.intersection(path.parts)
    and (count := len(path.read_text(encoding="utf-8").splitlines())) > LIMIT
]
for path, count in too_long:
    print(f"{path}: {count} lines (limit {LIMIT})")
sys.exit(1 if too_long else 0)
