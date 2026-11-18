"""Build the two registered top-dot orientations of 半 and 肖 in each composer face."""
import argparse
import json
from pathlib import Path

from build_grass_comparison import FONTS, Face, TTFont, bounds, fit


def encode(contours):
    result = []
    for contour in contours:
        commands, coords = [], []
        for op, points in contour.value:
            if op in ("closePath", "endPath"):
                continue
            commands.append({"moveTo": "M", "lineTo": "L", "curveTo": "C",
                             "qCurveTo": f"Q{len(points)}"}[op])
            coords.extend(round(v, 2) for point in points for v in point)
        result.append(["".join(commands), coords])
    return result


def forms(face, char, style):
    tables = [table for table in face.font["cmap"].tables if table.format == 14]
    if tables:
        names = [dict(tables[0].uvsDict.get(selector, [])) for selector in (0xE0100, 0xE0101)]
        if all(ord(char) in mapping for mapping in names):
            return [encode(face.glyph_contours(mapping[ord(char)] or face.cmap[ord(char)]))
                    for mapping in names]
    contours = face.contours(char)
    left, right = ([c for c in contours if bounds([c])[1] > 420 and test(bounds([c]))]
                   for test in (lambda b: b[2] < 460, lambda b: b[0] > 510))
    if len(left) != 1 or len(right) != 1:
        raise ValueError(f"Expected one separate dot on each side of {char}")
    body = encode([c for c in contours if c not in left + right])
    # Identify the native direction by the horizontal displacement of the left
    # dot from its bottom to its top, using the ends of its on-curve segments.
    points = [coords[-1] for op, coords in left[0].value if coords]
    points.sort(key=lambda xy: xy[1])
    n = max(1, len(points) // 4)
    inward = sum(x for x, _ in points[-n:]) < sum(x for x, _ in points[:n])
    if style == "fangsong":
        # Use the spreading feet of 兵 for 半 and the side strokes of 小 for 肖.
        if char == "半":
            outward = fit(face.contours("兵")[1:3], (172, 493, 772, 706))
        else:
            outward = fit(face.contours("小")[1:3], (194, 545, 782, 742))
        if not inward:
            raise ValueError(f"Unexpected native Zhuque {char} dot direction")
        return [encode(left + right) + body, encode(outward) + body]
    native = encode(left + right)
    swapped = encode(fit(right, bounds(left)) + fit(left, bounds(right)))
    return [(native if inward else swapped) + body, (swapped if inward else native) + body]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("font_dir", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    dots = {}
    eight = {}
    for style, filename in {**FONTS, "regular": "TW-Kai.ttf"}.items():
        with TTFont(args.font_dir / filename) as font:
            face = Face(font)
            dots[style] = {char: forms(face, char, style) for char in "半肖"}
            if style == "fangsong":
                donor = face.contours("叭")
                eight[style] = encode(fit([donor[3], donor[0]], (83, -25, 916, 718)))
            elif style == "regular":
                # 兮 supplies a paired 撇 and 捺 with a shorter gap between their starts.
                donor = face.contours("兮")
                eight[style] = encode(fit([donor[0], donor[2]], (72, -46, 936, 706)))
    result = {"dots": dots, "eight": eight}
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
