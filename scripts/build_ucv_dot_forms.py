"""Build the two registered top-dot orientations of 半 and 肖 in each composer face."""
import argparse
import json
import math
import statistics
from pathlib import Path

import pathops
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.transformPen import TransformPen

from build_grass_comparison import FONTS, Face, TTFont, bounds, fit
from han_compose.compose import EM, STYLES


def moved(contours, frame):
    """`contours` at their own size, centred on `frame`, so a stroke keeps its weight."""
    x, y, right, top = bounds(contours)
    left, bottom, x1, y1 = frame
    dx, dy = (left + x1 - x - right) / 2, (bottom + y1 - y - top) / 2
    result = []
    for contour in contours:
        pen = RecordingPen()
        contour.replay(TransformPen(pen, (1, 0, 0, 1, dx, dy)))
        result.append(pen)
    return result


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


def box(x0, y0, x1, y1):
    path = pathops.Path()
    path.moveTo(x0, y0)
    path.lineTo(x0, y1)
    path.lineTo(x1, y1)
    path.lineTo(x1, y0)
    path.close()
    return path


def japanese_moon(face, contours):
    """TW-Kai's 肖 with the 月 of the Adobe-Japan1 glyphs.

    TW-Kai writes the lower part of 肖 as 肉月, a dot and a tick inside the frame, where the
    Japanese forms have two horizontals. The face's own 月 replaces it, fitted to the frame below
    the bar, and the stem above the bar runs down into the new bar.
    """
    dots = [c for c in contours if bounds([c])[1] > 420]
    rest = [c for c in contours if c not in dots]
    left, bottom, right, _ = bounds(rest)
    points = [point for contour in rest for _, segment in contour.value for point in segment]
    bar = max(y for x, y in points if x > right - 160)
    shape = pathops.Path()
    for contour in rest:
        contour.replay(shape.getPen())
    shape = pathops.op(shape, box(left, bar, right, 1000), pathops.PathOp.INTERSECTION)
    moon = pathops.Path()
    for contour in fit(face.contours("月"), (left, bottom, right, bar)):
        contour.replay(moon.getPen())

    def edges(y):
        inside = [x for x in range(round(left), round(right)) if shape.contains((x, y))]

        def edge(a, b):
            # `a` is inside, `b` outside.
            for _ in range(20):
                a, b = ((a + b) / 2, b) if shape.contains(((a + b) / 2, y)) else (a, (a + b) / 2)
            return a

        return edge(inside[0], inside[0] - 1), edge(inside[-1], inside[-1] + 1)

    (a0, a1), (b0, b1) = edges(bar + 8), edges(bar + 58)
    middle = (a0 + a1) / 2
    top = next(y for y in range(round(bar), round(bottom), -1) if moon.contains((middle, y)))
    under = next(y for y in range(top, round(bottom), -1) if not moon.contains((middle, y)))
    # The stem continues along its own edges into the middle of the new bar.
    end = (top + under) / 2
    k = (bar + 8 - end) / 50
    joined = pathops.Path()
    joined.moveTo(a0 + (a0 - b0) * k, end)
    joined.lineTo(a0, bar + 8)
    joined.lineTo(a1, bar + 8)
    joined.lineTo(a1 + (a1 - b1) * k, end)
    joined.close()
    for part in (moon, joined):
        shape = pathops.op(shape, part, pathops.PathOp.UNION)
    drawn = RecordingPen()
    shape.draw(drawn)
    result, current = [], RecordingPen()
    for op in drawn.value:
        current.value.append(op)
        if op[0] in ("closePath", "endPath"):
            result.append(current)
            current = RecordingPen()
    return result + dots


# The outward pair (left ↙, right ↘ contour) in characters of each built face that write two
# dots or short strokes splayed like 八.
REFERENCES = {
    "fangsong": {
        "小": (1, 2), "六": (0, 1), "只": (1, 2), "兵": (1, 2), "共": (1, 2), "谷": (3, 4), "父": (1, 2),
        "少": (1, 3), "尖": (1, 3), "京": (1, 2), "示": (1, 2), "赤": (1, 2), "糸": (1, 2), "貝": (1, 2),
        "其": (1, 2), "典": (1, 3), "真": (1, 2), "具": (1, 2), "尒": (1, 3),
    },
    "regular": {
        "小": (0, 2), "六": (1, 2), "只": (0, 3), "兵": (2, 3), "共": (2, 3), "谷": (3, 4), "父": (1, 2),
        "少": (1, 3), "尖": (2, 3), "京": (1, 4), "示": (1, 3), "赤": (2, 1), "糸": (2, 1),
        "其": (4, 5), "典": (7, 8), "真": (5, 6), "具": (5, 6), "尒": (3, 2),
    },
    "pen-writing": {
        "小": (1, 2), "六": (1, 2), "只": (3, 2), "兵": (3, 2), "共": (2, 3), "谷": (1, 0), "父": (0, 1),
        "少": (1, 2), "尖": (1, 2), "京": (4, 3), "示": (3, 2), "赤": (2, 1), "糸": (2, 1), "貝": (4, 5),
        "其": (4, 5), "典": (8, 7), "真": (5, 6), "具": (5, 6), "尒": (3, 2),
    },
}
# Pairs that flank an upright, as the dots of 半 and 肖 do.
FLANKING = "小少尖京示赤糸尒"


def length(contour):
    x, y, x1, y1 = bounds([contour])
    return math.hypot(x1 - x, y1 - y)


def outward_pair(face, style):
    """The flanking pair whose dots are closest in length to the median of the face's references,
    with the x of the upright it flanks.

    An outward pair is longer than the inward one: swapping the native dots leaves the right dot
    as short as the native left dot.
    """
    pairs = {char: [face.contours(char)[i] for i in index] for char, index in REFERENCES[style].items()}
    lengths = {char: [length(c) for c in pair] for char, pair in pairs.items()}
    median = [statistics.median(lengths[char][i] for char in pairs) for i in (0, 1)]
    char = min((char for char in FLANKING if char in pairs), key=lambda char: math.dist(lengths[char], median))
    rest = [c for i, c in enumerate(face.contours(char)) if i not in REFERENCES[style][char]]
    return pairs[char], upright(rest, pairs[char])


def upright(body, pair):
    """The middle of the ink between the two dots of `pair`, at the height of their middle."""
    shape = outline(body)
    (_, y0, x0, y1), (x1, y2, _, y3) = bounds([pair[0]]), bounds([pair[1]])
    y = (max(y0, y2) + min(y1, y3)) / 2
    inside = [x for x in range(round(x0), round(x1)) if shape.contains((x, y))]
    return (inside[0] + inside[-1]) / 2


def outline(contours):
    path = pathops.Path()
    for contour in contours:
        contour.replay(path.getPen())
    return path


def clearance(body, dots):
    """How far `dots` can move down before they touch `body`."""
    shape = outline(body)
    x, y, x1, y1 = bounds(dots)
    return next(d for d in range(0, 400) if pathops.op(
        shape, outline(moved(dots, (x, y - d, x1, y1 - d))), pathops.PathOp.INTERSECTION).area > 1)


def composer(contours, face, style):
    """`contours` in the composer's 1000-unit em, placed as `compose.Font` places the face's glyphs.

    TW-Kai draws on 1,024 units with its ascent at 820, so its glyphs shrink and rise to meet the
    other faces.
    """
    scale = EM / face.font["head"].unitsPerEm
    result = []
    for contour in contours:
        pen = RecordingPen()
        contour.replay(TransformPen(pen, (scale, 0, 0, scale, 0, STYLES[style].y_shift)))
        result.append(pen)
    return result


def forms(face, char, style):
    tables = [table for table in face.font["cmap"].tables if table.format == 14]
    if tables:
        names = [dict(tables[0].uvsDict.get(selector, [])) for selector in (0xE0100, 0xE0101)]
        if all(ord(char) in mapping for mapping in names):
            return [encode(composer(face.glyph_contours(mapping[ord(char)] or face.cmap[ord(char)]), face, style))
                    for mapping in names]
    contours = face.contours(char)
    if style == "regular" and char == "肖":
        contours = japanese_moon(face, contours)
    left, right = ([c for c in contours if bounds([c])[1] > 420 and test(bounds([c]))]
                   for test in (lambda b: b[2] < 460, lambda b: b[0] > 510))
    if len(left) != 1 or len(right) != 1:
        raise ValueError(f"Expected one separate dot on each side of {char}")
    body = [c for c in contours if c not in left + right]
    # Identify the native direction by the horizontal displacement of the left
    # dot from its bottom to its top, using the ends of its on-curve segments.
    points = [coords[-1] for op, coords in left[0].value if coords]
    points.sort(key=lambda xy: xy[1])
    n = max(1, len(points) // 4)
    if sum(x for x, _ in points[-n:]) >= sum(x for x, _ in points[:n]):
        raise ValueError(f"Expected the native dots of {char} to point inward")
    # The face's own outward pair, flanking the upright as it does in its own character, level
    # with the native dots and set as close to the body as they are.
    pair, stem = outward_pair(face, style)
    dx = upright(body, left + right) - stem
    _, bottom, _, top = bounds(left + right)
    x, y, x1, y1 = bounds(pair)
    dy = (bottom + top - y - y1) / 2
    pair = moved(pair, (x + dx, y + dy, x1 + dx, y1 + dy))
    x, y, x1, y1 = bounds(pair)
    drop = clearance(body, pair) - clearance(body, left + right)
    pair = moved(pair, (x, y - drop, x1, y1 - drop))
    return [encode(composer(left + right + body, face, style)), encode(composer(pair + body, face, style))]


def translate(contours, dx):
    result = []
    for contour in contours:
        pen = RecordingPen()
        contour.replay(TransformPen(pen, (1, 0, 0, 1, dx, 0)))
        result.append(pen)
    return result


def close_roof(contour, entry, exit_):
    """Bridge the two points where the right dot meets the native roof or bar."""
    commands = contour.value
    pen = RecordingPen()
    if entry > exit_:
        pen.moveTo(commands[exit_][1][-1])
        pen.value.extend(commands[exit_ + 1:entry + 1])
        pen.closePath()
    else:
        pen.value.extend(commands[:entry + 1])
        pen.lineTo(commands[exit_][1][-1])
        pen.value.extend(commands[exit_ + 1:])
    return pen


def fangsong_heads(face, tip, shang, inward):
    straight = tip[1:4]
    # 尔 supplies a detached hooked upright and the two strokes that flank it.
    heads = {"小": face.contours("尔")[:3], "𡭔": straight, "⺌": inward}
    outward_shang = shang[:3] + fit([tip[1]], (181, 511, 361, 707)) + fit([tip[3]], (556, 518, 774, 705))
    encoded = {"尙": encode(outward_shang)}
    ids = {"⿱𡭔冋": encoded["尙"], "⿱&GW-u21b54-03;冋": encoded["尙"]}
    for key in ("⿱⺌冋", "⿱&GW-u2e8c-03;冋"):
        ids[key] = encode(shang)
    hosts = [
        ("学", "⿱⿱{}冖子", 1, (2, 3), (33, 5), (237, 594, 783, 808)),
        ("覚", "⿱⿱{}冖見", 2, (3, 4), (9, 22), (232, 607, 773, 811)),
        ("兴", "⿳{}一八", 0, (3, 4), (7, 19), (189, 352, 807, 754)),
    ]
    for char, template, joined, dots, seam, box in hosts:
        native = face.contours(char)
        body = [close_roof(contour, *seam) if i == joined else contour
                for i, contour in enumerate(native) if i not in dots]
        for shape, head in heads.items():
            drawn = encode(body + fit(head, box))
            ids[template.format(shape)] = drawn
            reference = {"𡭔": "&GW-u21b54-03;", "⺌": "&GW-u2e8c-03;"}.get(shape)
            if reference:
                ids[template.format(reference)] = drawn
        for shape in ("𭕄", "⺍", "⿲丶丶㇒"):
            ids[template.format(shape)] = encode(native)
    return encoded, ids


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("font_dir", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    dots = {}
    components = {}
    ids = {}
    for style, filename in {**FONTS, "regular": "TW-Kai.ttf"}.items():
        with TTFont(args.font_dir / filename) as font:
            face = Face(font)
            dots[style] = {char: forms(face, char, style) for char in "半肖"}
            if style == "fangsong":
                # Keep the native 倘 body, including the centre upright and 亻.
                host = face.contours("倘")
                donor = face.contours("倞")
                dots_at_top = (fit([donor[1]], (402, 491, 533, 653))
                               + fit([donor[3]], (674, 495, 865, 680)))
                ids[style] = {"⿰亻⿱&GW-u21b54-03;冋": encode(host[:4] + dots_at_top)}
                half = face.contours("半")
                tip = face.contours("尖")
                shang = face.contours("尚")
                study = face.contours("学")
                # The final falling stroke of 学 joins its cover. Fit the detached
                # right stroke of 半 beside the two native dots.
                three = encode(study[2:4] + fit([half[2]], (590, 550, 801, 798)))
                inward = translate(shang[3:5], 12) + fit([tip[2]], (447, 472, 541, 808))
                encoded, head_ids = fangsong_heads(face, tip, shang, inward)
                ids[style].update(head_ids)
                components[style] = {
                    **encoded,
                    "丷": encode(half[1:3]),
                    "𡭔": encode(tip[1:4]),
                    "⺌": encode(inward),
                    "𭕄": three, "⺍": three,
                }
    result = {"dots": dots, "components": components, "ids": ids}
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
