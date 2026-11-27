"""Write the sequences of the CJK Extension J ideographs (U+323B0 to U+33479, Unicode 17.0).

BabelStone's IDS.TXT of 2025-06-27 stops at Unicode 16.0, so `data/vocab/han-ids.tsv` describes
none of them. Yi Bai's IDS (MIT) describes all 4,298; the pinned `ids_lv2.txt` is read here. A
row's first description is kept, without its trailing region note (`(T,K)`). A description is left
out, and its character stays a whole glyph, where it uses Yi Bai's extended syntax (a stroke chain
`#(…)`, an unencoded component `{…}`), overlays its operands (⿻) or names a CJK Strokes character
(㇇): none of those names parts a face can cut from its own characters.

    uv run python scripts/build_extension_j_ids.py [ids_lv2.txt]
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

PIN = "2597437b928e8d530b7ae09cf53fe5ec7868569c"
URL = f"https://raw.githubusercontent.com/yi-bai/ids/{PIN}/ids_lv2.txt"
SHA256 = "b728e92679a9cb18a8f67f55f654f03875791dc34f6bab41ed1d4b4116bea7d6"
FIRST, LAST = 0x323B0, 0x33479
OPERATORS = {**dict.fromkeys("⿰⿱⿴⿵⿶⿷⿸⿹⿺⿼⿽", 2), **dict.fromkeys("⿲⿳", 3), "⿾": 1, "⿿": 1}
NOTE = re.compile(r"\([^()]*\)$")
ROOT = Path(__file__).resolve().parents[1]


def well_formed(text: str) -> bool:
    """Whether `text` is one description of operators and encoded characters alone."""
    need = 1
    for ch in text:
        if need == 0 or ord(ch) < 0x2E80 or ch == "⿻" or 0x31C0 <= ord(ch) <= 0x31EF:
            return False
        need += OPERATORS.get(ch, 0) - 1
    return need == 0 and text[:1] in OPERATORS


def sequences(lines: list[str]) -> dict[str, str]:
    out = {}
    for line in lines:
        char, _, rest = line.partition("\t")
        if len(char) != 1 or not FIRST <= ord(char) <= LAST:
            continue
        text = NOTE.sub("", rest.split("\t")[0].split(";")[0])
        if well_formed(text) and char not in text:
            out[char] = text
    return out


def main() -> None:
    data = Path(sys.argv[1]).read_bytes() if len(sys.argv) > 1 else urllib.request.urlopen(URL).read()
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise SystemExit("ids_lv2.txt does not match the pinned digest")
    found = sequences(data.decode("utf-8").splitlines())
    header = [
        "# Ideographic Description Sequences of CJK Extension J, one row per ideograph; see scripts/build_extension_j_ids.py.",
        "# source yi-bai-ids: Yi Bai, IDS (ids_lv2.txt); MIT, Copyright (c) 2021 Yi Bai (data/licences/yi-bai-ids-MIT.txt)",
        f"#   yi-bai-ids: {URL}, sha256:{SHA256}",
        "char\tsequence",
    ]
    (ROOT / "data/vocab/han-ids-extension-j.tsv").write_text(
        "\n".join(header + [f"{char}\t{text}" for char, text in found.items()]) + "\n", encoding="utf-8")
    (ROOT / "js/src/extension-j-ids.json").write_text(
        json.dumps({"source": URL, "sequences": found}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(found)} sequences")


if __name__ == "__main__":
    main()
