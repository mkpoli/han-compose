"""Write the sequences of the CJK Extension J ideographs (U+323B0 to U+33479, Unicode 17.0).

BabelStone's IDS.TXT of 2025-06-27 stops at Unicode 16.0, so `data/vocab/han-ids.tsv` describes
none of them. Yi Bai's IDS (MIT) describes all 4,298; the pinned `ids_lv2.txt` is read here. A
row's first description is kept, without its trailing region note (`(T,K)`). A description is left
out, and its character stays a whole glyph, where it uses Yi Bai's extended syntax (a stroke chain
`#(…)`, an unencoded component `{…}`), overlays its operands (⿻) or names a CJK Strokes character
(㇇): none of those names parts a face can cut from its own characters.

Yi Bai writes a radical in full where it stands as its positional form (⿰金 for 釒); BabelStone,
whose table every other ideograph is described by, writes the form. A component at the left,
right, top or foot of a row or column that BabelStone never writes there, and whose positional
form for that place it does, is written as that form, so both tables name a part the same way.

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
#: Operator → the place of each operand a positional form is written in; None for the others.
PLACES = {"⿰": ("L", "R"), "⿲": ("L", None, "R"), "⿱": ("T", "B"), "⿳": ("T", None, "B")}
POSITION = {"left": "L", "right": "R", "top": "T", "bottom": "B"}


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


def placed(text: str) -> list[tuple[int, str | None]]:
    """Each character of a description with the place it is written in, None for an operator, an
    operand of an operator with no such places, or a middle operand."""
    out: list[tuple[int, str | None]] = []
    stack: list[list[str | None]] = []
    for k, ch in enumerate(text):
        place = stack[-1].pop(0) if stack else None
        while stack and not stack[-1]:
            stack.pop()
        if ch in OPERATORS:
            stack.append(list(PLACES.get(ch, (None,) * OPERATORS[ch])))
        else:
            out.append((k, place))
    return out


def conventions() -> dict[tuple[str, str], str]:
    """(place, component) → the positional form BabelStone writes there, for the components it
    never writes there in full: the commonest form the table gives the component for that place."""
    written: dict[tuple[str, str], int] = {}
    for line in (ROOT / "data/vocab/han-ids.tsv").read_text(encoding="utf-8").splitlines():
        if line.startswith(("#", "code_point")):
            continue
        for sequence in line.split("\t")[2].split(" "):
            text = NOTE.sub("", sequence)
            for k, place in placed(text):
                if place:
                    written[place, text[k]] = written.get((place, text[k]), 0) + 1
    out: dict[tuple[str, str], str] = {}
    for line in (ROOT / "data/vocab/han-component-forms.tsv").read_text(encoding="utf-8").splitlines():
        if line.startswith(("#", "form\t")):
            continue
        form, char, source, detail = line.split("\t")
        kind, _, where = detail.partition(" ")
        place = POSITION.get(where)
        if source != "cjkvi-variants" or kind != "radical-variant" or place is None:
            continue
        if written.get((place, char), 0) == 0 and written.get((place, form), 0) > written.get((place, out.get((place, char), "")), 0):
            out[place, char] = form
    return out


def respelled(text: str, forms: dict[tuple[str, str], str]) -> str:
    chars = list(text)
    for k, place in placed(text):
        if place and (place, chars[k]) in forms:
            chars[k] = forms[place, chars[k]]
    return "".join(chars)


def main() -> None:
    data = Path(sys.argv[1]).read_bytes() if len(sys.argv) > 1 else urllib.request.urlopen(URL).read()
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise SystemExit("ids_lv2.txt does not match the pinned digest")
    forms = conventions()
    found = {char: respelled(text, forms) for char, text in sequences(data.decode("utf-8").splitlines()).items()}
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
    print(f"{len(found)} sequences; written as BabelStone does: {sorted(forms.items())}")


if __name__ == "__main__":
    main()
