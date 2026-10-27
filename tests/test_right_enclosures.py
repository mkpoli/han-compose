from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose as C
from han_compose.compose_guide import Guide


def rectangle(x0, y0, x1, y1):
    points = np.array([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], dtype=float)
    ops = [("moveTo", 1, False)] + [("lineTo", 1, False)] * 3
    return C.Contour(ops, points, points.copy())


def composer(op):
    # Open on the left; ⿽ is open above as well.
    frame = [rectangle(80, 0, 100, 100), rectangle(0, 0, 100, 20)]
    if op == "⿼":
        frame.append(rectangle(0, 80, 100, 100))
    outer = C.Part(frame)
    inner = C.Part([rectangle(0, 0, 30, 30)])
    font = SimpleNamespace(glyph={"A": outer, "B": inner}.get, has=lambda ch: ch in "AB",
                           own=lambda ch: ch in "AB", stem=((4, 8), (4, 8)))
    c = C.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    c._faces[None] = ((0, 0, 100, 100), set())
    return c, outer, inner


@pytest.mark.parametrize("op", ["⿼", "⿽"])
def test_right_enclosure_composes_without_a_whole_glyph(op):
    c, outer, inner = composer(op)
    result = c.compose(op + "AB")
    assert [p.part for p in result] == [outer, inner]
    assert result[0].target == pytest.approx(c.face)
    room = c._room(op, result[:1], c.face)
    assert room is not None
    assert C._within(result[1].target, room) > 0.9
    assert C._collision(result[:1], result[1:], c.face) == 0


@pytest.mark.parametrize("op", ["⿼", "⿽"])
def test_nested_right_enclosure_stays_in_its_region(op):
    c, _, _ = composer(op)
    region = (100, 200, 200, 300)
    result = c._node((op, "A", "B"), region)
    assert len(result) == 2
    assert C._within(result[0].target, region) == pytest.approx(1)
    assert C._within(result[1].target, region) == pytest.approx(1)
    assert C._collision(result[:1], result[1:], region) == 0


def test_lower_right_fallback_places_the_inner_part_above_and_left(monkeypatch):
    c, _, _ = composer("⿽")
    monkeypatch.setattr(c, "_room", lambda *args: None)
    monkeypatch.setattr(C, "_fit_inside", lambda *args: None)
    outer, inner = c.compose("⿽AB")
    assert (inner.target[0] + inner.target[2]) / 2 < 50
    assert (inner.target[1] + inner.target[3]) / 2 > 50


@pytest.mark.parametrize("op", ["⿼", "⿽"])
def test_untrained_guide_leaves_right_enclosures_unchanged(monkeypatch, op):
    c, _, _ = composer(op)
    guide = Guide([])
    monkeypatch.setattr(guide, "ink", lambda *args: pytest.fail("guide has no embedding for this operator"))
    c.guide = guide
    assert len(c.compose(op + "AB")) == 2


@pytest.mark.parametrize("op", ["⿼", "⿽"])
def test_right_enclosure_cut_identifies_the_inner_shape(op):
    _, outer, _ = composer(op)
    inner = rectangle(20, 30, 50, 60)
    frame, inside = C.enclosures(C.Part(outer.contours + [inner]), op)[0]
    assert inside.contours == [inner]
    assert set(map(id, frame.contours)) == set(map(id, outer.contours))
