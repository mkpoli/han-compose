"""Build `data/vocab/han-hand-forms.tsv`: which stroke of the hand 𠂇 each character writes first.

右 有 布 write 丿 (㇒) before 一 (㇐); 左 友 write 一 first, and the font draws the two hands
differently. Sequences spell both ⿸𠂇X. KanjiVG records each stroke's type in
writing order, so a character spelled ⿸𠂇X takes the form its first two strokes show, wherever
KanjiVG draws it: as a kanji of its own or as a group inside another (厷 in 雄). Characters
KanjiVG never draws are not listed.

    .venv/bin/python scripts/build_hand_forms.py
"""

from __future__ import annotations

import argparse
import collections
import gzip
import xml.etree.ElementTree as ET
from pathlib import Path

import yaml

from han_compose import compose, kanjivg_cuts

ROOT = Path(__file__).resolve().parents[1]
VOCAB = ROOT / "data" / "vocab"
SOURCES = ROOT / "data" / "sources"
FORMS = {"㇒㇐": "丿", "㇐㇒": "一"}


def votes(path: Path, chars: set[str]) -> dict[str, collections.Counter]:
    """For each of `chars` KanjiVG draws, how often it begins with each pair of stroke types."""
    out: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    root = ET.parse(gzip.open(path)).getroot()
    for kanji in root:
        top = next(iter(kanji), None)
        if top is None:
            continue
        for group in top.iter("g"):
            char = group.get(kanjivg_cuts.KVG + "element")
            # A group holding only part of the character's strokes (kvg:part) does not begin it.
            if char in chars and not group.get(kanjivg_cuts.KVG + "part"):
                first = "".join(p.get(kanjivg_cuts.KVG + "type", "")[:1] for p in list(group.iter("path"))[:2])
                out[char][first] += 1
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=VOCAB)
    args = parser.parse_args(argv)
    hands = {ch for ch, seq in compose.japanese_sequences().items() if seq.startswith("⿸𠂇")}
    found = votes(kanjivg_cuts.kanjivg_file(), hands)
    rows = []
    for char in sorted(found, key=ord):
        (first, n), *rest = found[char].most_common()
        if first in FORMS and not rest:
            rows.append((char, FORMS[first], str(n)))
    record = yaml.safe_load((SOURCES / "kanjivg.yaml").read_text(encoding="utf-8"))
    lines = [
        "# The stroke of the hand 𠂇 each character spelled ⿸𠂇X writes first; see scripts/build_hand_forms.py.",
        f"# source kanjivg: {record['name']}; {record['licence']} ({record['licence_evidence']}); {record['attribution']}",
        f"#   kanjivg: {kanjivg_cuts.KANJIVG_URL} sha256:{kanjivg_cuts.KANJIVG_SHA256[:16]}",
        "# columns: char, first (丿 as in 右, 一 as in 左), groups (KanjiVG groups drawing it, all agreeing)",
        f"# rows: {len(rows)}",
        "char\tfirst\tgroups",
    ]
    (args.out / "han-hand-forms.tsv").write_text("\n".join(lines + ["\t".join(r) for r in rows]) + "\n", encoding="utf-8")
    print(f"{len(rows)} hands -> {args.out / 'han-hand-forms.tsv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
