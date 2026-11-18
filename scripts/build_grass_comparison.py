# /// script
# requires-python = ">=3.12"
# dependencies = ["fonttools>=4.55", "skia-pathops>=0.9,<1"]
# ///
"""Draw the gallery's connected and four-stroke grass heads in the named source fonts.

Run with uv run scripts/build_grass_comparison.py --fonts cache/fonts --output faces.json.
Each character maps to four styles, each holding two SVG paths in a 1000-unit viewBox.
"""

import argparse
import json
import math
from pathlib import Path

import pathops
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen, RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

CHARACTERS = "菜草落葉蘇蘭藏萬艾華茰𦴯"
FONTS = {
    "sans": "NotoSansCJKjp-VF-2.004.ttf",
    "serif": "NotoSerifCJKjp-VF-2.003.ttf",
    "fangsong": "ZhuqueFangsong-v0.212-Regular.ttf",
    "pen-writing": "KureedoFull-Regular.ttf",
}


class Face:
    def __init__(self, font):
        self.font = font
        self.cmap = font.getBestCmap()
        self.glyphs = (
            font.getGlyphSet(location={"wght": 400})
            if "fvar" in font
            else font.getGlyphSet()
        )
        self.locales = {}
        if "GSUB" in font:
            gsub = font["GSUB"].table
            hani = next(
                (
                    s.Script
                    for s in gsub.ScriptList.ScriptRecord
                    if s.ScriptTag == "hani"
                ),
                None,
            )
            for record in hani.LangSysRecord if hani else ():
                mappings = []
                for index in record.LangSys.FeatureIndex:
                    feature = gsub.FeatureList.FeatureRecord[index]
                    if feature.FeatureTag == "locl":
                        for lookup in feature.Feature.LookupListIndex:
                            for table in gsub.LookupList.Lookup[lookup].SubTable:
                                mappings.append(
                                    getattr(
                                        getattr(table, "ExtSubTable", table),
                                        "mapping",
                                        {},
                                    )
                                )
                self.locales[record.LangSysTag] = mappings

    def contours(self, char, lang="ZHS "):
        name = self.cmap[ord(char)]
        for mapping in self.locales.get(lang, ()):
            name = mapping.get(name, name)
        pen = DecomposingRecordingPen(self.glyphs)
        self.glyphs[name].draw(pen)
        contours = []
        contour = RecordingPen()
        for op in pen.value:
            contour.value.append(op)
            if op[0] in ("closePath", "endPath"):
                contours.append(contour)
                contour = RecordingPen()
        return contours


def bounds(contours):
    pen = BoundsPen(None)
    for contour in contours:
        contour.replay(pen)
    return pen.bounds


def fit(contours, frame):
    x, y, right, top = bounds(contours)
    left, bottom, x1, y1 = frame
    sx, sy = (x1 - left) / (right - x), (y1 - bottom) / (top - y)
    fitted = []
    for contour in contours:
        pen = RecordingPen()
        contour.replay(
            TransformPen(pen, (sx, 0, 0, sy, left - x * sx, bottom - y * sy))
        )
        fitted.append(pen)
    return fitted


def svg(contours):
    pen = SVGPathPen(None, ntos=lambda x: f"{x:.1f}".rstrip("0").rstrip("."))
    flipped = TransformPen(pen, (1, 0, 0, -1, 0, 880))
    for contour in contours:
        contour.replay(flipped)
    return pen.getCommands()


def head_and_body(contours):
    # The 藏 dot reaches into the head's band. Its contour stays with 臧.
    head = [c for c in contours if bounds([c])[1] > 360 and bounds([c])[3] > 700]
    return head, [c for c in contours if c not in head]


def head_halves(head):
    left = [c for c in head if bounds([c])[2] < 520]
    right = [c for c in head if bounds([c])[0] > 480 and c not in left]
    return (
        (left, right)
        if left and right and len(left) + len(right) == len(head)
        else None
    )


def split_donors(face, style):
    if style == "pen-writing":
        # Kureedo draws both complete crossed strokes in U+2EBF.
        pair = head_halves(face.contours("⺿"))
        if pair is None:
            raise ValueError("Expected two separate crossed strokes in Kureedo ⺿")
        return [pair]
    donors = []
    for ch in "草苑艾蘭蘇苗":
        head, _ = head_and_body(face.contours(ch, "ZHT "))
        halves = head_halves(head)
        if halves:
            donors.append(halves)
    if not donors:
        raise ValueError("No contextual four-stroke grass head in font")
    return donors


def split_head(head, donors):
    x, y, right, top = bounds(head)
    w, h = right - x, top - y

    def stretch(pair):
        l, b, r, t = bounds(pair[0] + pair[1])
        return math.hypot(math.log(w / (r - l)), math.log(h / (t - b)))

    left, other = min(donors, key=stretch)
    # Keep each genuine half, including its terminal. Set a minimum clear interval
    # of 6% so the nearly touching Wen Kai strokes remain distinct at gallery size.
    x0, _, x1, _ = bounds(left + other)
    scale = w / (x1 - x0)
    mapped = fit(left + other, (x, y, right, top))
    l, r = mapped[: len(left)], mapped[len(left) :]
    gap = max(w * 0.06, (bounds(other)[0] - bounds(left)[2]) * scale)
    middle = (bounds(l)[2] + bounds(r)[0]) / 2
    lb, rb = bounds(l), bounds(r)
    return fit(l, (lb[0], lb[1], middle - gap / 2, lb[3])) + fit(
        r, (middle + gap / 2, rb[1], rb[2], rb[3])
    )


def fangsong_split(contours):
    # 草, 蘭 and 藏 join the head to body contours. Open only the stroke between
    # the two uprights. The small oblique cuts follow Zhuque's brush terminals.
    drawing = pathops.Path()
    pen = drawing.getPen()
    for contour in contours:
        contour.replay(pen)
    center = 495
    rows = [y for y in range(860, 520, -1) if drawing.contains((center, y))]
    if not rows:
        raise ValueError("Missing Zhuque grass bar at the center of the head")
    top = rows[0]
    bottom = next(
        (y for y in range(top, 519, -1) if not drawing.contains((center, y))), 520
    )
    if not 8 <= top - bottom <= 100:
        raise ValueError(f"Unexpected Zhuque grass bar at {bottom}–{top}")
    y0, y1 = bottom - 12, top + 12
    cut = pathops.Path()
    cut.moveTo(center - 35, y0)
    cut.lineTo(center - 27, y1)
    cut.lineTo(center + 36, y1)
    cut.lineTo(center + 28, y0)
    cut.close()
    opened = pathops.op(drawing, cut, pathops.PathOp.DIFFERENCE)
    result = RecordingPen()
    opened.draw(result)
    return [result]


def compact_operand(face, char, frame):
    # 宂 and 友 occupy short rows. Vertical fitting alone thins their horizontal
    # strokes to a fraction of the weight in the grass. Measure the face's 一 at
    # midspan and restore the lost weight mainly along the compressed axis.
    source = face.contours(char)
    slots = fit(source, frame)
    stem = pathops.Path()
    for contour in face.contours("一"):
        contour.replay(stem.getPen())
    width = sum(stem.contains((500, y)) for y in range(-120, 880))
    _, bottom, _, top = bounds(source)
    sy = (frame[3] - frame[1]) / (top - bottom)
    extra = width * max(0, 0.79 - sy)
    if extra < 1:
        return slots
    shape = pathops.Path()
    for contour in slots:
        contour.replay(shape.getPen())
    outline = shape.transform(scaleX=5)
    outline.stroke(extra, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 4)
    outline.convertConicsToQuads(0.05)
    thickened = pathops.op(shape, outline.transform(scaleX=0.2), pathops.PathOp.UNION)
    out = RecordingPen()
    thickened.draw(out)
    return [out]


def rare_body(face, char, head):
    left, base, right, _ = bounds(head)
    width = right - left
    if char == "𦴯":
        # U+26D2F's T form has 宂 above 友. Their boxes follow the stacked
        # components in TW-Kai Ext-B, expressed relative to this face's head.
        join = base - (base + 75) * 0.34
        mid = compact_operand(
            face,
            "宂",
            (left + 0.035 * width, join + 3, right - 0.01 * width, base - 10),
        )
        foot = compact_operand(face, "友", (left + 0.025 * width, -75, right, join))
        return mid + foot
    # Zhuque lacks 茰. Its body is 更 without the uppermost horizontal.
    # This edition joins that horizontal to the central stem in one outline.
    body = face.contours("更")
    outline = body[0].value
    if outline[28][1][-1] != (464, 652) or outline[46][1][-1] != (497, 652):
        raise ValueError("Unrecognized Zhuque 更 outline")
    del outline[29:46]
    return fit(body, (left - 0.025 * width, -85, right + 0.025 * width, base + 6))


def generate(font_dir):
    result = {ch: {} for ch in CHARACTERS}
    for style, filename in FONTS.items():
        with TTFont(font_dir / filename) as font:
            face = Face(font)
            donors = split_donors(face, style) if style != "fangsong" else []
            for char in CHARACTERS:
                if ord(char) in face.cmap:
                    full = face.contours(char)
                    head, body = head_and_body(full)
                elif char == "𦴯" or (char == "茰" and style == "fangsong"):
                    head, _ = head_and_body(face.contours("薹" if char == "𦴯" else "菜"))
                    body = rare_body(face, char, head)
                    full = head + body
                else:
                    raise ValueError(f"Missing native {char} in {filename}")
                if style == "fangsong":
                    split = fangsong_split(full)
                else:
                    split = split_head(head, donors) + body
                result[char][style] = {"connected": svg(full), "split": svg(split)}
    return result


def component_forms(font_dir):
    """One contextual four-stroke radical per face, in the composer's contour format."""
    forms = {}
    for style, filename in {**FONTS, "regular": "TW-Kai.ttf"}.items():
        with TTFont(font_dir / filename) as font:
            face = Face(font)
            if style == "fangsong":
                head, _ = head_and_body(face.contours("菜"))
                head = fangsong_split(head)
            elif style == "regular":
                head, _ = head_and_body(face.contours("草"))
            else:
                head, _ = head_and_body(face.contours("菜"))
                head = split_head(head, split_donors(face, style))
            contours = []
            for recording in head:
                for op, points in recording.value:
                    if op == "moveTo":
                        commands, coords = [], []
                    if op in ("closePath", "endPath"):
                        contours.append(["".join(commands), coords])
                        continue
                    commands.append({"moveTo": "M", "lineTo": "L", "curveTo": "C",
                                     "qCurveTo": f"Q{len(points)}"}[op])
                    coords.extend(round(v, 2) for point in points for v in point)
            forms[style] = [contours]
    return forms


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--fonts", type=Path, required=True)
    cli.add_argument("--output", type=Path, required=True)
    cli.add_argument("--component-forms", action="store_true")
    args = cli.parse_args()
    args.output.write_text(
        json.dumps((component_forms if args.component_forms else generate)(args.fonts), ensure_ascii=False, separators=(",", ":"))
        + "\n"
    )
