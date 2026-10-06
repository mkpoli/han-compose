"""Where the composer finds its tables and its cache.

The vocab tables are the CJKVI radical variants and BabelStone IDS listings the composer reads to
know what a sequence means and where a part stands. `cache/` holds what is built or fetched: the
fonts, the layout and standalone models, and any guide networks.
"""

from __future__ import annotations

import os
from pathlib import Path

#: The project root: `src/han_compose/` is two levels below it.
ROOT = Path(__file__).resolve().parents[2]
VOCAB = ROOT / "data" / "vocab"
ENV_CACHE = "HAN_COMPOSE_CACHE"

#: The description operators, by how many operands they take.
BINARY = set("⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯")
TERNARY = set("⿲⿳")
UNARY = set("⿾⿿〾")


def read_rows(name: str) -> list[list[str]]:
    """The rows of a vocab table, past its `#` header and its column names."""
    lines = [
        line
        for line in (VOCAB / name).read_text(encoding="utf-8").splitlines()
        if line and not line.startswith("#")
    ]
    return [line.split("\t") for line in lines[1:]]


def cache_root() -> Path:
    """The directory that holds fonts and models: `$HAN_COMPOSE_CACHE`, or `cache/` of the project."""
    override = os.environ.get(ENV_CACHE)
    return Path(override) if override else ROOT / "cache"
