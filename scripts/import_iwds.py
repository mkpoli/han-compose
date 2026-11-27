"""Convert the IRG's published IWDS source into a catalogue for ucvFamilies."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def glyph_form(name: str) -> dict[str, str]:
    form = {"glyph": name}
    fields = name.split("-")
    if not re.fullmatch(r"u[0-9a-f]{4,6}", fields[0]):
        return form
    first = chr(int(fields[0][1:], 16))
    operator = 0x2FF0 <= ord(first) <= 0x2FFF or first == "㇯"
    if all(re.fullmatch(r"u[0-9a-f]{4,6}", part) for part in fields):
        text = "".join(chr(int(part[1:], 16)) for part in fields)
        if (
            len(text) == 1
            or operator
            or len(text) == 2
            and (0xFE00 <= ord(text[1]) <= 0xFE0F or 0xE0100 <= ord(text[1]) <= 0xE01EF)
        ):
            return {**form, "text": text}
    if not operator:
        form["of"] = first
    return form


def catalogue(xml: bytes, edition: str) -> dict:
    root = ET.fromstring(xml)
    if root.tag != "ucv":
        raise ValueError(f"Expected <ucv>, found <{root.tag}>")
    entries = []
    groups = []
    for group in root.iter("group"):
        subgroups = group.findall("subgroup")
        groups.append({**group.attrib, "subgroups": [s.attrib for s in subgroups]})
        for container in [group, *subgroups]:
            for entry in container.findall("entry"):
                glyphs = (entry.findtext("glyphs") or "").split(",")
                if any(not name.strip() for name in glyphs):
                    raise ValueError(f"Missing glyph in entry {entry.get('id')}")
                entries.append(
                    {
                        **entry.attrib,
                        "group": container.attrib["id"],
                        "components": entry.findtext("components"),
                        "forms": [glyph_form(name.strip()) for name in glyphs],
                        # Includes mixed text, repeated fields, exclusions and attributed examples.
                        "xml": ET.tostring(entry, encoding="unicode").strip(),
                    }
                )
    if not entries or len(entries) != len(root.findall(".//entry")):
        raise ValueError("Unrecognized IWDS group structure")
    return {
        "source": {
            "name": "IRG IWDS",
            "edition": edition,
            "sha256": hashlib.sha256(xml).hexdigest(),
        },
        "groups": groups,
        "entries": entries,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xml", type=Path)
    parser.add_argument("--edition", required=True, help="Edition of this IWDS source")
    args = parser.parse_args()
    json.dump(
        catalogue(args.xml.read_bytes(), args.edition),
        sys.stdout,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    print()
