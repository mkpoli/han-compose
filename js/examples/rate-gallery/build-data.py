# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools"]
# ///
"""Write the gallery's reference outlines into data/.

uv run --script build-data.py <proofs> <fonts>

<proofs> holds the reviewed whole-glyph records: rate-<face>.json for the five
faces, rate-matrix-<face>.json for the host's own centre, and
rate-regional-serif.json for the regional Noto Serif CJK glyphs.
<fonts> holds PlangothicP1-Regular-2.9.5795.ttf and PlangothicP2-Regular-2.9.5795.ttf.
"""

import json
import re
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
FACES = ("sans", "serif", "regular", "fangsong", "pen-writing")
NATIVE = {
    "sans": "Noto Sans CJK JP 2.004",
    "serif": "Noto Serif CJK JP 2.003",
    "regular": "TW-Kai 11510.1",
    "fangsong": "Zhuque Fangsong 0.212",
    "pen-writing": "Kureedo Full 0.5.0",
}
DOTS = {"other": "chevron", "rate-vs18": "strokes"}
REVIEWED = "率蟀摔"  # regional glyphs whose centre and dots were read from the outlines
COMPONENTS = "𰀪⺀𦃃𤣩𧾷"  # parts of the spellings that common system fonts lack
RELEASE = "2.9.5795"
ASCENT = 880  # top of the 1000-unit em above the baseline


def compact(path):
    """One decimal place is a tenth of a unit in a 1000-unit em."""
    return re.sub(r"-?\d+\.\d+", lambda m: f"{float(m[0]):.1f}".removesuffix(".0"), path)


def selectors(numbers):
    return "／".join("VS" + str(n) for n in numbers if n)


def regions(sources):
    """JP／KR for default glyphs, JP VS18 for a glyph reached only by a selector."""
    return "／".join(
        region + ("" if 0 in numbers else " " + selectors(numbers))
        for region, numbers in sources.items()
    )


def originals(proofs, face, regional):
    records = json.loads((proofs / f"rate-{face}.json").read_text())
    centres = json.loads((proofs / f"rate-matrix-{face}.json").read_text())
    out = {}
    for char, record in records.items():
        supplement = record.get("source")
        first = {
            "kind": "supplement" if supplement else "native",
            "source": supplement or NATIVE[face],
            "d": compact(record["d"]),
            "centre": centres[char]["hostCenter"],
            "dots": DOTS.get(record["form"]),
        }
        if record.get("sourceUrl"):
            first["url"] = record["sourceUrl"]
        figures = [first]
        refs = list(regional.get(char, {}).values()) if face == "serif" else []
        primary = next((ref for ref in refs if 0 in ref["sources"].get("JP", [])), None)
        if primary:
            first["source"] = "Noto Serif CJK 2.003 " + regions(primary["sources"])
        for ref in refs:
            if ref is primary:
                continue
            figure = {
                "kind": "native",
                "source": "Noto Serif CJK 2.003 " + regions(ref["sources"]),
                "d": compact(ref["d"]),
            }
            if char in REVIEWED:
                parallel = 18 in ref["sources"].get("JP", [])
                figure["centre"] = "jp" if parallel else "cn"
                figure["dots"] = "strokes" if parallel else "chevron"
            elif ref.get("use"):
                figure["dots"] = DOTS[ref["use"]]
            figures.append(figure)
        if not refs:
            for literal in record.get("registered", {}).values():
                if literal["d"] != record["d"]:
                    number = ord(literal["seq"][-1]) - 0xE0100 + 17
                    figures.append({
                        "kind": "native",
                        "source": f"{NATIVE[face]} VS{number}",
                        "d": compact(literal["d"]),
                    })
        out[char] = [{k: v for k, v in figure.items() if v} for figure in figures]
    return out


def plangothic(fonts, chars):
    glyphs, components, versions = {}, {}, {}
    for plane in ("P1", "P2"):
        with TTFont(fonts / f"Plangothic{plane}-Regular-{RELEASE}.ttf") as font:
            assert font["head"].unitsPerEm == 1000
            versions[plane] = font["name"].getDebugName(5).split(";")[0].removeprefix("Version ")
            cmap, glyph_set = font.getBestCmap(), font.getGlyphSet()
            for group, wanted in ((glyphs, chars), (components, COMPONENTS)):
                for char in wanted:
                    if char in group or ord(char) not in cmap:
                        continue
                    pen = SVGPathPen(glyph_set, lambda v: f"{v:.1f}".removesuffix(".0"))
                    glyph_set[cmap[ord(char)]].draw(TransformPen(pen, (1, 0, 0, -1, 0, ASCENT)))
                    group[char] = {"font": plane, "d": pen.getCommands()}
    assert set(components) == set(COMPONENTS), set(COMPONENTS) - set(components)
    return {
        "name": "Plangothic",
        "release": RELEASE,
        "versions": versions,
        "copyright": "Copyright (c) 2024 by Fitzgerald P. Köeingsegg",
        "license": "SIL OFL 1.1",
        "url": "https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project",
        "glyphs": glyphs,
        "components": components,
    }


def write(name, value):
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    (HERE / "data" / name).write_text(text + "\n")


def main(proofs, fonts):
    (HERE / "data").mkdir(exist_ok=True)
    regional = json.loads((proofs / "rate-regional-serif.json").read_text())
    chars = list(json.loads((proofs / "rate-matrix-serif.json").read_text()))
    for face in FACES:
        write(f"originals-{face}.json", originals(proofs, face, regional))
    write("plangothic.json", plangothic(fonts, chars))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
