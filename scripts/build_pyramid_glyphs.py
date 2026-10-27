"""Generate attested one-over-two repeated-component glyphs from BabelStone IDS.

Usage: python3 scripts/build_pyramid_glyphs.py [--check]
Only exact IDS and the positional forms 牜/牛 and 釒/金 are accepted.
The lower pair may be written explicitly or as one encoded character.
"""
import argparse
import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/babelstone-ids.tsv.gz"
TARGET = ROOT / "src/han_compose/pyramid-glyphs.json"
FORMS = {"牜": "牛", "釒": "金"}


def catalog(text):
    rows = {}
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        char, sequences = line.split("\t")
        rows[char] = [re.sub(r"\([^)]*\)$", "", s) for s in sequences.split()]
    result = []
    for char, sequences in rows.items():
        for sequence in sequences:
            # A top leaf and either an explicit lower pair or an encoded pair.
            if not sequence.startswith("⿱") or len(sequence) not in (3, 5):
                continue
            part = sequence[1]
            lower = sequence[2:]
            for pair in ([lower] if lower.startswith("⿰") else rows.get(lower, [])):
                if len(pair) != 3 or pair[0] != "⿰":
                    continue
                if all(FORMS.get(c, c) == part for c in pair[1:]):
                    result.append({"char": char, "part": part,
                                   "sequence": sequence, "pair": pair})
                    break
    return sorted(result, key=lambda row: (ord(row["char"]), row["sequence"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--source", type=Path, default=SOURCE, help="BabelStone compact TSV gzip")
    args = parser.parse_args()
    with gzip.open(args.source, "rt", encoding="utf-8") as source:
        text = source.read()
    output = json.dumps({"source": text.splitlines()[0].removeprefix("# "),
                         "entries": catalog(text)}, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if TARGET.read_text(encoding="utf-8") != output:
            raise SystemExit("Pyramid catalog is stale; run scripts/build_pyramid_glyphs.py")
    else:
        TARGET.write_text(output, encoding="utf-8")


if __name__ == "__main__":
    main()
