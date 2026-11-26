"""Neighbouring parts keep a least gap at their closest strokes, whatever their median gap."""

from types import SimpleNamespace

import numpy as np

from han_compose import compose as C

OPS = [("moveTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False)]


def _placed(*rects: tuple[float, float, float, float]) -> C.Placed:
    contours = []
    for x0, y0, x1, y1 in rects:
        points = np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], dtype=float)
        contours.append(C.Contour(OPS, points, points.copy()))
    part = C.Part(contours)
    return C.Placed(part, part.box, part.box)


def _composer() -> C.Composer:
    return C.Composer(SimpleNamespace(glyph=lambda _: None, has=lambda _: False), {}, weighted=False)


def test_one_stroke_reaching_its_neighbour_is_moved_clear() -> None:
    # A wide gap along most of the facing edges, and one bar of the left part touching the right.
    left = _placed((100, 0, 300, 800), (300, 380, 500, 420))
    right = _placed((500, 0, 800, 800))
    gaps = C._facing_gaps([left], [right], 0)
    # Touching strokes read as one raster cell, 4 units.
    assert np.median(gaps) >= C.FACING[0] and gaps.min() <= 4
    _composer()._space(0, [[left], [right]])
    assert C._facing_gaps([left], [right], 0).min() >= C.FACING_LEAST


def test_parts_already_clear_of_each_other_stay_where_they_are() -> None:
    left, right = _placed((100, 0, 300, 800)), _placed((500, 0, 800, 800))
    before = left.target, right.target
    _composer()._space(0, [[left], [right]])
    assert (left.target, right.target) == before


def test_the_median_gap_is_still_the_median_of_the_facing_gaps() -> None:
    left, right = _placed((100, 0, 300, 800)), _placed((500, 0, 800, 800))
    assert C._facing([left], [right], 0) == float(np.median(C._facing_gaps([left], [right], 0)))
