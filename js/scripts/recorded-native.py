#!/usr/bin/env python3
"""Export attested whole glyphs absent from the format-7 drawing records."""

import argparse
import hashlib
import json
from pathlib import Path

from fontTools.ttLib import TTFont

from han_compose import compose as composer
from han_compose.web_export import part_record

GLYPHS = {
    "sans": "凫卍𠒎𡷊",
    "serif": "凫卍𠒎𡷊",
    "regular": "𠒎𡷊",
    "pen-writing": "凫卍凸裊鳬",
}


def checked(cache, source):
    path = cache / "fonts" / source.file
    with path.open("rb") as file:
        sha = hashlib.file_digest(file, "sha256").hexdigest()
    if sha != source.sha256:
        raise ValueError(f"{source.file} differs from the style's pinned font")
    return path


def metadata(source, path):
    with TTFont(path, lazy=True) as font:
        attribution = font["name"].getDebugName(0)
        version = font["name"].getDebugName(5)
    return {
        "file": source.file, "url": source.url, "sha256": source.sha256,
        "license": source.licence, "copyright": attribution,
        "version": version, "notice": source.also,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True, help="cache holding the pinned fonts")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    sources, entries = {}, {}
    for style, chars in GLYPHS.items():
        spec = composer.STYLES[style]
        # TW-Kai's Extension B is the same family. Other fallbacks are distinct designs.
        supplemental = spec.fallbacks[:1] if style == "regular" else ()
        primary = checked(args.cache, spec.font)
        extensions = [checked(args.cache, source) for source in supplemental]
        font = composer.Font(primary, extensions, style)
        sources[style] = [metadata(source, path)
                          for source, path in zip((spec.font, *supplemental), (primary, *extensions))]
        glyphs = {}
        for char in chars:
            part = font.glyph(char)
            if not part:
                raise ValueError(f"{char} absent from the pinned {style} font")
            if font.static:
                part = composer.Part([composer.Contour(c.ops, c.light, c.light)
                                      for c in part.contours])
            glyphs[char] = part_record(part)
        entries[style] = glyphs
    args.output.write_text(json.dumps({"sources": sources, "entries": entries},
                                      ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
