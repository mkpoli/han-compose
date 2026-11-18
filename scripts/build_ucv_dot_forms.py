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
        # 谷 has a spreading pair above 口. Leave a gap around 半’s upright.
        # 尖 already has the three-stroke 小 head required above 肖’s body.
        if char == "半":
            donor = face.contours("谷")
            outward = (fit([donor[3]], (179, 478, 386, 689))
                       + fit([donor[4]], (558, 493, 778, 678)))
        else:
            donor = face.contours("尖")
            outward = fit([donor[1], donor[3]], (182, 553, 783, 752))
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
    eight = None
    for style, filename in {**FONTS, "regular": "TW-Kai.ttf"}.items():
        with TTFont(args.font_dir / filename) as font:
            face = Face(font)
            dots[style] = {char: forms(face, char, style) for char in "半肖"}
            if style == "fangsong":
                # The two strokes above 兮 have level starts and a full sweeping foot.
                cap = face.contours("兮")[1:3]
                eight = encode(fit(cap, (65, -38, 932, 715)))
    result = {"dots": dots, "fangsongEight": eight}
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
