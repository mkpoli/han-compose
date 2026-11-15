"""Loose marks drawn after a description: a voicing dot, an accent, a tone letter or a superscript.

The shapes come from the bundled Unicode outlines (`data/unicode/outlines`), which the browser
composer draws them from too, then from the composer's fonts; where a mark sits follows what it is.
A combining mark sits over or under the whole drawing, centred. A kana voicing mark, a spacing accent,
a tone letter and a superscript sit beside the drawing, at the upper right. Marks beside the drawing
reserve a margin: `mark_face` shrinks the character into the rest of the box, so the mark stands
outside it instead of over its strokes. `js/src/marks.js` places them the same way."""

from __future__ import annotations

import base64
import gzip
import json
import re
import unicodedata
from functools import lru_cache
from typing import TYPE_CHECKING

import numpy as np

from .compose import Box, Contour, Part, Placed, _signed_area
from .vocab import ROOT

if TYPE_CHECKING:
    from .compose import Composer

KANA = "゙゚"
KANA_SPACING = "゛゜"
#: The em height the marks' sizes are written against.
DESIGN = 900
#: A mark's size against the character box, by kind; the share of the box a run of marks may take.
SIZE, SIZE_KANA_SPACING, SIZE_ATTACHED = 0.68, 0.75, 0.85
ROW_SHARE, STACK_SHARE = 0.3, 0.34
INSET, ROW_GAP, MARGIN = 0.02, 0.02, 0.06
#: The least a character shrinks to beside its marks.
SHRINK = 0.5


OUTLINES = ROOT / "data" / "unicode"
_OPS = {"M": "moveTo", "L": "lineTo", "Q": "qCurveTo"}


@lru_cache(maxsize=8)
def _shard(name: str) -> dict:
    path = OUTLINES / "outlines" / f"{name}.json.gz"
    return json.loads(gzip.decompress(path.read_bytes())) if path.exists() else {}


@lru_cache(maxsize=1)
def _quantum() -> float:
    return float(json.loads((OUTLINES / "outlines.json").read_text(encoding="utf-8"))["build"]["quantization"])


def bundled(char: str) -> Part | None:
    """A character's outline in the bundled Unicode outlines, at 1,000 units an em; None where
    they hold none."""
    record = _shard(f"{ord(char) >> 8:03x}").get(char, {}).get("G")
    if not record:
        return None
    contours = []
    for ops, light, delta in record["p"]:
        points = np.frombuffer(base64.b64decode(light), dtype="<i2").astype(float).reshape(-1, 2) / _quantum()
        heavy = points + np.frombuffer(base64.b64decode(delta), dtype="<i2").astype(float).reshape(-1, 2) / _quantum()
        read = [(_OPS[op], int(n or 1), bool(star)) for op, n, star in re.findall(r"([MLQ])(\d*)(\*?)", ops)]
        contours.append(Contour(read, points, heavy, None))
    return Part(contours) if contours else None


def _reversed(contour: Contour) -> Contour:
    """The contour drawn the other way round, from the same starting point."""
    def turned(points: np.ndarray) -> tuple[list, np.ndarray]:
        if contour.ops[0][0] != "moveTo":
            # No point on the curve: the control points alone, in the other order.
            return list(contour.ops), points[::-1]
        ops, at, runs = [], 1, []
        for op, count, _ in contour.ops[1:]:
            runs.append((op, count, points[at:at + count]))
            at += count
        start, ends = points[0], [points[0], *(run[-1] for _, _, run in runs)]
        out = [start]
        ops.append(contour.ops[0])
        if not np.array_equal(ends[-1], start):
            ops.append(("lineTo", 1, False))
            out.append(ends[-1])
        for k in range(len(runs) - 1, -1, -1):
            op, count, run = runs[k]
            ops.append((op, count, False))
            out.extend([*run[:-1][::-1], ends[k]])
        return ops, np.array(out)

    ops, light = turned(contour.light)
    return Contour(ops, light, turned(contour.heavy)[1], contour.width)


def _wound(part: Part, like: Part | None) -> Part:
    """`part` with its contours wound the way `like`'s are, so that where it lies over ink drawn
    from `like`'s font the two fill as one shape."""
    if like is None:
        return part
    way = lambda p: np.sign(max((_signed_area(c.light) for c in p.contours), key=abs))
    return part if way(part) == way(like) else Part([_reversed(c) for c in part.contours])


def glyph(composer: Composer, char: str) -> Part | None:
    """A mark's outline: the bundled one, else the composer's fonts', wound as those fonts wind."""
    part = bundled(char) or composer.font.glyph(char)
    return _wound(part, composer.font.glyph("一")) if part is not None and part.contours else None


def kind(char: str) -> str:
    """How a loose mark is drawn: `attached` sits over or under the drawing, `kana` and `spacing`
    beside it. A combining mark is one by the running Python's Unicode tables."""
    if char in KANA:
        return "kana"
    if char in KANA_SPACING:
        return "spacing"
    return "attached" if unicodedata.category(char).startswith("M") else "spacing"


def outbound(char: str) -> bool:
    """Whether a mark sits beside the drawing, in the margin the character leaves for it."""
    return kind(char) != "attached"


def _size(char: str, base: float) -> float:
    return base if char in KANA else base * (SIZE_KANA_SPACING if char in KANA_SPACING else SIZE)


def _width(part: Part) -> float:
    return part.box[2] - part.box[0]


def _height(part: Part) -> float:
    return part.box[3] - part.box[1]


def mark_face(frame: Box, box: Box) -> Box:
    """The box a description draws in when the marks beside it, lying in `box`, take a margin: the
    character shrinks toward the lower left, by the least that clears the marks on one side."""
    x0, y0, x1, y1 = frame
    width, height = x1 - x0, y1 - y0
    if width <= 0 or height <= 0:
        return frame
    gap = min(width, height) * MARGIN
    scale = max(SHRINK, min(1.0, max((box[0] - gap - x0) / width, (box[1] - gap - y0) / height)))
    return (x0, y0, x0 + width * scale, y0 + height * scale) if scale < 1 else frame


def mark_parts(composer: Composer, marks: str, frame: Box, attached: Box | None = None) -> list[Placed]:
    """The loose marks of a description as placed parts, origin `mark <char>`. `frame` is the
    character box the marks beside the drawing use; `attached` is the box the combining marks sit
    over, smaller when the character makes room for the others. A mark with no outline is left out."""
    attached = attached or frame
    x0, y0, x1, y1 = frame
    width, height = x1 - x0, y1 - y0
    glyphs = [(char, part) for char in marks if (part := glyph(composer, char)) is not None]
    out: list[Placed] = []

    def place(char: str, part: Part, x: float, y: float, scale: float) -> None:
        out.append(Placed(part, part.box, (x, y, x + _width(part) * scale, y + _height(part) * scale), origin=f"mark {char}"))

    # A row of marks at the upper right, top aligned.
    row = [(char, part) for char, part in glyphs if outbound(char)]
    if row:
        natural = min(_size(char, height / DESIGN) for char, _ in row)
        gap = width * ROW_GAP
        across = sum(_width(part) for _, part in row) + gap * (len(row) - 1)
        tallest = max(_height(part) for _, part in row)
        scale = min(natural, width * ROW_SHARE / max(across, 1), height * ROW_SHARE / max(tallest, 1))
        gap *= scale / natural
        inset = height * INSET
        x = x1 - inset - sum(_width(part) * scale for _, part in row) - gap * (len(row) - 1)
        for char, part in row:
            place(char, part, x, y1 - inset - _height(part) * scale, scale)
            x += _width(part) * scale + gap

    # Combining marks over the drawing and under it, centred; a run stacks away from the drawing.
    ax0, ay0, ax1, ay1 = attached
    tall = ay1 - ay0
    for below in (False, True):
        run = [(char, part) for char, part in glyphs if not outbound(char) and (part.box[3] <= 0) == below]
        if not run:
            continue
        scale = tall / DESIGN * SIZE_ATTACHED
        total = sum(_height(part) for _, part in run) * scale
        if total > tall * STACK_SHARE:
            scale *= tall * STACK_SHARE / total
            total = tall * STACK_SHARE
        y = ay0 + tall * INSET if below else ay1 - tall * INSET - total
        for char, part in reversed(run) if below else run:
            place(char, part, (ax0 + ax1) / 2 - _width(part) * scale / 2, y, scale)
            y += _height(part) * scale
    return out


def face_beside(composer: Composer, marks: str, frame: Box) -> Box:
    """The face a character takes beside the marks that sit outside it: `frame` where none needs room."""
    beside = mark_parts(composer, "".join(char for char in marks if outbound(char)), frame)
    if not beside:
        return frame
    box = (min(p.target[0] for p in beside), min(p.target[1] for p in beside),
           max(p.target[2] for p in beside), max(p.target[3] for p in beside))
    return mark_face(frame, box)


def marked(composer: Composer, sequence: str, marks: str) -> list[Placed]:
    """`sequence` drawn in the face its marks leave it, with the marks."""
    frame = composer.face
    face = face_beside(composer, marks, frame)
    composer._beside = None if face == frame else face
    try:
        placed = composer.compose(sequence)
    finally:
        composer._beside = None
    return type(placed)([*placed, *mark_parts(composer, marks, frame, face)])
