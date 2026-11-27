"""Cross and T geometry keeps small operands in the operator's open quadrant."""
from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose


def rectangle(box):
    x0, y0, x1, y1 = box
    points = np.array([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], dtype=float)
    return compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())


def composer(outer, inner):
    glyphs = {"\ue000": compose.Part([rectangle(b) for b in outer]),
              "\ue001": compose.Part([rectangle(b) for b in inner])}
    font = SimpleNamespace(glyph=glyphs.get, own=lambda _: True, has=lambda ch: ch in glyphs,
                           stem=((40, 80), (40, 80)))
    c = compose.Composer(font, {}, hosted=False, weighted=True, reuse=False)
    c._faces[None] = ((0, 0, 1000, 1000), set())
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    return c


CROSS = [(450, 0, 550, 1000), (0, 450, 1000, 550)]
INNERS = [[(0, 0, 60, 800)], [(0, 0, 800, 60)],
          [(0, 0, 800, 60), (370, 60, 430, 300)], [(0, 0, 400, 800)]]


@pytest.mark.parametrize("op", ["⿺", "⿸", "⿹", "⿽"])
@pytest.mark.parametrize("inner", INNERS)
@pytest.mark.parametrize("region", [(0, 0, 1000, 1000), (100, 200, 500, 800)])
def test_cross_placement_is_proportional_clear_and_full_size(op, inner, region):
    c = composer(CROSS, inner)
    parts = c._node((op, "\ue000", "\ue001"), region)
    c._balance(parts)
    outer, inside = parts
    expected = c._node("\ue000", region)[0]
    assert outer.target == expected.target
    assert outer.weight == (0, 0)
    room = c._room(op, [outer], region)
    box = compose._ink_box([inside])
    assert box[0] > room[0] and box[1] > room[1]
    assert box[2] < room[2] and box[3] < room[3]
    assert inside.scale[0] == pytest.approx(inside.scale[1])
    assert compose._collision([outer], [inside], region, size=256) == 0
    cx = (outer.target[0] + outer.target[2]) / 2
    cy = (outer.target[1] + outer.target[3]) / 2
    assert (box[0] > cx if op in ("⿺", "⿸") else box[2] < cx)
    assert (box[1] > cy if op in ("⿺", "⿽") else box[3] < cy)


@pytest.mark.parametrize("outer", [
    [(450, 0, 550, 1000), (0, 900, 1000, 1000)],  # T
    [(450, 0, 550, 1000), (0, 0, 1000, 100)],  # inverted T
])
def test_t_junction_uses_its_open_quadrant(outer):
    c = composer(outer, INNERS[2])
    op = "⿸" if outer[1][1] else "⿺"
    result = c._quadrant_surround(op, ["\ue000", "\ue001"], c.face)
    assert result is not None
    assert compose._collision(result[:1], result[1:], c.face, size=256) == 0


@pytest.mark.parametrize("outer", [
    [(0, 0, 100, 1000), (0, 900, 1000, 1000)],  # corner
    [(0, 0, 100, 1000), (0, 0, 1000, 100)],  # sweep
    CROSS + [(0, 0, 1000, 100)],  # second bar
    CROSS + [(0, 0, 300, 300)],  # extra component
])
def test_frames_and_complex_shapes_keep_existing_layout(outer):
    c = composer(outer, INNERS[0])
    for op in ("⿺", "⿸", "⿹", "⿽", "⿻", "⿴"):
        assert c._quadrant_surround(op, ["\ue000", "\ue001"], c.face) is None


@pytest.mark.parametrize("op", ["⿺", "⿸", "⿹", "⿽"])
@pytest.mark.parametrize("turn", ["⿾", "⿿"])
def test_transformed_inner_stays_in_quadrant(op, turn):
    c = composer(CROSS, [(0, 0, 100, 800), (0, 0, 600, 100)])
    parts = c._quadrant_surround(op, ["\ue000", (turn, "\ue001")], c.face)
    room = c._room(op, parts[:1], c.face)
    box = compose._ink_box(parts[1:])
    assert box[0] > room[0] and box[1] > room[1]
    assert box[2] < room[2] and box[3] < room[3]
    assert compose._collision(parts[:1], parts[1:], c.face, size=256) == 0


def test_excluded_cross_keeps_normal_resolution():
    c = composer(CROSS, INNERS[0])
    c.exclude = {"\ue000"}
    assert c._quadrant_surround("⿺", ["\ue000", "\ue001"], c.face) is None


def test_excluded_inner_keeps_normal_resolution(monkeypatch):
    c = composer(CROSS, INNERS[0])
    inner = c._node("\ue001", c.face)
    c.exclude = {"\ue001"}
    calls = []
    monkeypatch.setattr(c, "_node", lambda node, region: calls.append(node) or inner)
    assert c._quadrant_surround("⿺", ["\ue000", "\ue001"], c.face)
    assert calls == ["\ue001"]


def test_cross_overlay_shares_the_em_without_a_teacher(monkeypatch):
    c = composer(CROSS, [(0, 0, 1000, 1000)])
    c.hosted = True
    monkeypatch.setattr(c, "_overlays", lambda *args: [])
    c._faces[None] = ((0, compose.ASCENT - compose.EM, compose.EM, compose.ASCENT), set())
    parts = c._overlay(["\ue000", "\ue001"], c.face)
    assert [p.target for p in parts] == [p.source for p in parts]
