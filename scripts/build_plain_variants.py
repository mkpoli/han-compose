"""Write the variation sequences each Noto CJK JP face registers with its base character's own glyph.

An export records only the sequences a font draws with a glyph of their own. Noto registers many
more, such as 丑 U+E0100, with the plain glyph; `js/src/plain-variants.js` draws those as the
base character.

    uv run --with fonttools python scripts/build_plain_variants.py FONT_DIR js/src/plain-variants.json
"""
import argparse
import json
from pathlib import Path

from fontTools.ttLib import TTFont

FONTS = {
    "sans": "NotoSansCJKjp-VF-2.004.ttf",
    "serif": "NotoSerifCJKjp-VF-2.003.ttf",
}


def plain(path):
    """Each selector with the base characters the font draws plain under it."""
    with TTFont(path, lazy=True) as font:
        cmap = font.getBestCmap()
        by_selector = {}
        for table in font["cmap"].tables:
            if table.format != 14:
                continue
            for selector, pairs in table.uvsDict.items():
                bases = {base for base, name in pairs if name is None or name == cmap.get(base)}
                if bases:
                    by_selector.setdefault(selector, set()).update(bases)
    return {f"{selector:X}": "".join(chr(base) for base in sorted(bases))
            for selector, bases in sorted(by_selector.items())}


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("font_dir", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = {style: plain(args.font_dir / filename) for style, filename in FONTS.items()}
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
