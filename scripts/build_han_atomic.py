"""Build `data/vocab/han-atomic.tsv`: the ideographs drawn whole, never composed from their sequence.

An ideograph is atomic when hfhchan/ids, which leaves every productive component undecomposed (王 is
not ⿱一土, 日 is not ⿴囗一), gives it no description operator: its entry names the ideograph itself,
or a variant that is atomic in turn (丄 as 上). A Japanese form the file maps to a traditional variant
that it decomposes (説 to 說 ⿰言兌) is not atomic.

    .venv/bin/python scripts/build_han_atomic.py

The release file is cached under `cache/components/`; its digest goes into the table header.
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parents[1]
VOCAB = ROOT / "data" / "vocab"
SOURCES = ROOT / "data" / "sources"
URL = "https://github.com/hfhchan/ids/releases/download/v1.0.2/ids-20240112.txt"
OPERATORS = set("⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿㇯")


def entries(text: str) -> dict[str, str]:
    """character → its first entry, region tags dropped."""
    out = {}
    for line in text.splitlines():
        fields = line.rstrip("\r").split("\t")
        if len(fields) >= 3 and fields[1] and not line.startswith("#"):
            out[fields[1]] = fields[2].split("[")[0].strip()
    return out


def atomic(table: dict[str, str]) -> list[tuple[str, str]]:
    """(character, the entry that makes it atomic), in code point order."""

    def whole(char: str, seen: tuple[str, ...] = ()) -> bool:
        entry = table.get(char)
        if entry is None or any(ch in OPERATORS for ch in entry):
            return False
        if entry == char:
            return True
        return len(entry) == 1 and entry not in seen and whole(entry, (*seen, char))

    return [(char, table[char]) for char in sorted(table, key=lambda ch: [ord(x) for x in ch]) if whole(char)]


def fetch(url: str, path: Path, *, refresh: bool = False) -> Path:
    """`url` downloaded to `path`, or `path` as it stands when it is already there."""
    if refresh or not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(httpx.get(url, follow_redirects=True, timeout=300).content)
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=Path, default=ROOT / "cache")
    parser.add_argument("--out", type=Path, default=VOCAB)
    parser.add_argument("--refresh", action="store_true", help="download again even when cached")
    args = parser.parse_args(argv)
    path = fetch(URL, args.cache / "components" / "hfhchan-ids-20240112.txt", refresh=args.refresh)
    rows = atomic(entries(path.read_text(encoding="utf-8")))
    record = yaml.safe_load((SOURCES / "hfhchan-ids.yaml").read_text(encoding="utf-8"))
    lines = [
        "# Ideographs drawn whole, never composed from their sequence; see scripts/build_han_atomic.py.",
        f"# source hfhchan-ids: {record['name']}; {record['licence']} ({record['licence_evidence']}); {record['attribution']}",
        f"#   hfhchan-ids: {URL} sha256:{hashlib.sha256(path.read_bytes()).hexdigest()[:16]}",
        "# columns: char, entry (the file's entry: the character itself, or the variant it is written as)",
        f"# rows: {len(rows)}",
        "char\tentry",
    ]
    (args.out / "han-atomic.tsv").write_text("\n".join(lines + ["\t".join(row) for row in rows]) + "\n", encoding="utf-8")
    print(f"{len(rows)} atomic ideographs -> {args.out / 'han-atomic.tsv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
