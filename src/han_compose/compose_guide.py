"""A last pass over a composition: each stroke group nudged toward where a learned guide puts ink.

The guide is a U-Net that has seen, for thousands of compound characters the font draws, the
composer's draft of the character (made without its own glyph), its two operands' glyphs in the
boxes the learned layout gives them, and the operator, and learned to draw the real glyph. Its image
is a better map of where strokes go than the draft, but blurred, so it is never drawn. Each group of
outlines that moves together (a stroke and its counters, `compose._units`) is moved at most
`MOVE` of its own size and `MOVE_UNITS` units, and scaled by at most `SCALE` about its own centre,
to the place where it covers most of the guide's ink: every outline stays the font's own.

The guide runs through ONNX Runtime from three networks trained with different seeds, averaged. A
character the guide was trained on is not a fair test of it; the jōyō kanji were held out.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from . import compose as C

#: The operators, in the order the guide's operator embedding reads them.
OPS = "⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻"
#: The guide's image size, and the box it covers: the em.
SIZE = 128
EM_BOX = (0.0, C.ASCENT - C.EM, C.EM, C.ASCENT)
#: How far a stroke group may move: at most this share of its own extent along each axis, and at
#: most this many units, tried in `STEPS` steps each way.
MOVE = 0.25
MOVE_UNITS = 24.0
STEPS = 3
#: The scales tried about a group's centre, along each axis.
SCALE = (0.85, 0.925, 1.0, 1.075, 1.15)
GUIDE_DIR = "guide-v1"
#: What moves as one: each placed part with its strokes joined ("part"), or each stroke group ("stroke").
LEVEL = "stroke"


@dataclass
class Guide:
    """Guide networks, averaged."""

    sessions: list

    @classmethod
    def load(cls, folder: Path) -> Guide:
        import onnxruntime as ort

        paths = sorted(folder.glob("guide-*.onnx"))
        if not paths:
            raise FileNotFoundError(f"No guide-*.onnx in {folder}.")
        options = ort.SessionOptions()
        # One thread per network: compositions are drawn in parallel by worker processes.
        options.intra_op_num_threads = 1
        return cls([ort.InferenceSession(str(p), options, providers=["CPUExecutionProvider"]) for p in paths])

    def ink(self, composer: C.Composer, sequence: str, placed: list[C.Placed]) -> np.ndarray:
        """Where the guide puts ink for `sequence`, drawn as `placed`: a SIZE × SIZE map of 0 to 1."""
        x = np.stack([C.raster(placed, SIZE), *operands(composer, sequence)]).astype(np.float32)[None]
        op = np.array([OPS.index(sequence[0]) if sequence[0] in OPS else 0], dtype=np.int64)
        return np.mean([s.run(None, {"draft": x, "op": op})[0][0] for s in self.sessions], axis=0)

    def fit(self, composer: C.Composer, sequence: str, placed: list[C.Placed]) -> list[C.Placed]:
        """`placed` with each stroke group moved toward the guide's ink."""
        # These enclosures have no guide embedding or operand boxes. Leave their
        # composition alone until a guide trained on them is available.
        if sequence and sequence[0] in ("⿼", "⿽"):
            return placed
        gain = self.ink(composer, sequence, placed) - 0.5
        if LEVEL == "part":
            return [_fitted(item, item.part.contours, gain) for item in placed]
        out = []
        for item in placed:
            for group in C._units(item.part.contours):
                out.append(_fitted(item, group, gain))
        return out


def operands(composer: C.Composer, sequence: str) -> list[np.ndarray]:
    """The root's two operands, each its own glyph (or, with none, its plain drawing) in the box the
    learned layout gives it; blank where the layout does not cover the root."""
    blank = [np.zeros((SIZE, SIZE), bool), np.zeros((SIZE, SIZE), bool)]
    try:
        tree = C.parse(sequence)
    except ValueError:
        return blank
    if not isinstance(tree, tuple) or len(tree) != 3 or composer.layout is None or tree[0] not in composer.layout.ops:
        return blank
    tested = next(iter(composer.exclude)) if len(composer.exclude) == 1 else None
    boxes = composer.layout.predict(composer, tree[0], [C.key(n) for n in tree[1:]], tested)
    out = []
    for node, box in zip(tree[1:], boxes):
        k = C.key(node)
        name = k if len(k) == 1 else composer.by_sequence.get(k)
        glyph = composer.font.glyph(name) if name else None
        try:
            parts = [C.Placed(glyph, glyph.box, tuple(box))] if glyph is not None else composer._plain._node(node, tuple(box))
        except LookupError:
            parts = []
        out.append(C.raster(parts, SIZE))
    return out


def _fitted(item: C.Placed, group: list[C.Contour], gain: np.ndarray) -> C.Placed:
    """One stroke group of `item`, moved and scaled where it covers most of the guide's ink."""
    part = C.Part(group)
    # The group's own box, in the source and where `item` puts it.
    src = part.box
    scale = np.array(item.scale)
    centre = np.array([(item.source[0] + item.source[2]) / 2, (item.source[1] + item.source[3]) / 2])
    goal = np.array([(item.target[0] + item.target[2]) / 2, (item.target[1] + item.target[3]) / 2])
    lo = (np.array(src[:2]) - centre) * scale + goal
    hi = (np.array(src[2:]) - centre) * scale + goal
    base = C.Placed(part, src, (lo[0], lo[1], hi[0], hi[1]), item.weight, item.native, item.origin)
    rings = C._rings(part.contours, base.contours())
    if not rings:
        return base
    middle = (lo + hi) / 2
    reach = np.minimum(MOVE * (hi - lo), MOVE_UNITS)

    def score(d: np.ndarray, s: np.ndarray) -> float:
        moved = [(r - middle) * s + middle + d for r in rings]
        return float((C.fill(moved, SIZE, EM_BOX) * gain).sum())

    steps = np.linspace(-1, 1, 2 * STEPS + 1)
    best, kept = score(np.zeros(2), np.ones(2)), (np.zeros(2), np.ones(2))
    for a, b in itertools.product(steps, steps):
        d = np.array([a, b]) * reach
        value = score(d, np.ones(2))
        if value > best:
            best, kept = value, (d, np.ones(2))
    for sx, sy in itertools.product(SCALE, SCALE):
        s = np.array([sx, sy])
        value = score(kept[0], s)
        if value > best:
            best, kept = value, (kept[0], s)
    d, s = kept
    new_lo, new_hi = (lo - middle) * s + middle + d, (hi - middle) * s + middle + d
    return C.Placed(part, src, (new_lo[0], new_lo[1], new_hi[0], new_hi[1]), item.weight, item.native, item.origin)
