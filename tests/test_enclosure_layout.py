from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose


@pytest.mark.parametrize("inner", ["黑", "鬼", "面", "甲", "食"])
def test_yan_enclosure_places_dog_above_inner_part(inner):
    sequences = {"厌": "⿸厂犬"}
    c = compose.Composer(SimpleNamespace(own=lambda _: True), sequences)
    c.__dict__["_index"] = ({("⿸0", "厌"): [("魇", ("⿸", "厌", "鬼"), (), 0)]}, {})
    source = ("⿸", "厌", inner)
    assert c._respelled(source) == ("⿸", "厂", ("⿱", "犬", inner))
    assert source == ("⿸", "厌", inner)
    assert sequences == {"厌": "⿸厂犬"}


def test_a_corner_character_under_a_corner_stacks_its_inner_parts():
    c = compose.Composer(None, {"麻": "⿸广林", "原": "⿸厂泉", "厭": "⿸厂猒"})
    assert c._respelled(compose.parse("⿸麻石")) == ("⿸", "广", ("⿱", "林", "石"))
    assert c._respelled(compose.parse("⿸原心")) == ("⿸", "厂", ("⿱", "泉", "心"))
    tree = compose.parse("⿱厭黑")
    assert c._respelled(tree) == tree


def test_rendering_normalisation_does_not_follow_cyclic_or_malformed_sources():
    c = compose.Composer(None, {"甲": "⿸乙口", "乙": "⿸甲木", "厌": "⿸厂"})
    for source in ("⿸甲日", "⿸厌黑"):
        tree = compose.parse(source)
        assert c._respelled(tree) == tree


def rectangle(box):
    x0, y0, x1, y1 = box
    points = np.array([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], dtype=float)
    return compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())


def test_yan_respelling_preserves_permitted_whole_only_glyph():
    whole = compose.Part([rectangle((0, 0, 100, 100))])
    font = SimpleNamespace(glyph=lambda ch: whole if ch == "魇" else None,
                           has=lambda ch: ch == "魇", own=lambda ch: ch == "魇")
    c = compose.Composer(font, {"魇": "⿸厌鬼", "厌": "⿸厂犬"}, hosted=False, weighted=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    original = compose.parse("⿸厌鬼")
    assert c._node(original, c.face, at_root=True)[0].part is whole
    result = c.compose("⿸厌鬼")
    assert len(result) == 1
    assert result[0].part is whole
    assert result[0].origin == "glyph 魇"


@pytest.mark.parametrize("nested", [False, True])
@pytest.mark.parametrize("mode", ["permitted", "excluded", "spelled"])
def test_yan_identity_and_rendering_with_components(monkeypatch, nested, mode):
    glyphs = {ch: compose.Part([rectangle((0, 0, 100, 100))]) for ch in "魇犬鬼木"}
    glyphs["厂"] = compose.Part([rectangle((0, 0, 10, 100)), rectangle((0, 90, 100, 100))])
    requested = []

    def glyph(ch):
        requested.append(ch)
        if mode == "excluded" and ch == "魇":
            raise AssertionError("excluded target glyph requested")
        return glyphs.get(ch)

    font = SimpleNamespace(glyph=glyph, has=lambda ch: ch in glyphs, own=lambda ch: ch in glyphs,
                           stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {"魇": "⿸厌鬼", "厌": "⿸厂犬"},
                         hosted=False, weighted=False, reuse=False,
                         exclude={"魇"} if mode == "excluded" else set())
    c.__dict__["spelled"] = {"⿸厌鬼"} if mode == "spelled" else set()
    c.__dict__["atomic"] = set()
    instances = []
    monkeypatch.setattr(c, "_instance", lambda node, region: instances.append(compose.key(node)))
    original_respelled = c._respelled
    changed = []

    def respelled(node):
        result = original_respelled(node)
        if result != node:
            changed.append((node, result))
        return result

    monkeypatch.setattr(c, "_respelled", respelled)
    result = c.compose("⿰木⿸厌鬼" if nested else "⿸厌鬼")
    prefix = ["glyph 木"] if nested else []
    assert [p.origin for p in result] == prefix + (
        ["glyph 魇"] if mode == "permitted" else ["glyph 厂", "glyph 犬", "glyph 鬼"])
    if mode == "permitted":
        assert result[-1].part is glyphs["魇"]
        assert changed == []
    else:
        assert changed == [(("⿸", "厌", "鬼"), ("⿸", "厂", ("⿱", "犬", "鬼")))]
    if mode == "excluded":
        assert "魇" not in requested
    if mode == "spelled":
        assert "⿸厌鬼" not in instances
        assert "⿸厂⿱犬鬼" not in instances
    assert c.sequences == {"魇": "⿸厌鬼", "厌": "⿸厂犬"}


def fitting_geometry():
    outer = compose.Part([rectangle((0, 0, 10, 100)), rectangle((0, 90, 100, 100))])
    inner = compose.Part([rectangle((0, 0, 20, 20))])
    return [compose.Placed(outer, outer.box, outer.box)], [compose.Placed(inner, inner.box, (40, 40, 60, 60))]


@pytest.mark.parametrize("room, expected", [
    (None, (34.375, 33.625, 66.375, 65.625)),
    ((20, 20, 80, 80), (34.375, 33.625, 66.375, 65.625)),
    ((40, 40, 60, 60), (40.625, 39.375, 60.625, 59.375)),
])
def test_default_enclosure_fit_preserves_placement(room, expected):
    outer, inner = fitting_geometry()
    compose._fit_inside(outer, inner, (0, 0, 100, 100), 4, room=room)
    assert inner[0].target == pytest.approx(expected)


def test_blocked_anchor_preserves_scale_and_clearance():
    outer, anchored = fitting_geometry()
    _, default = fitting_geometry()
    region = (0, 0, 100, 100)
    room = (40, 40, 60, 60)
    compose._fit_inside(outer, default, region, 4, room=room)
    compose._fit_inside(outer, anchored, region, 4, room=room, anchor=(5, 95))
    a, b = anchored[0].target, default[0].target
    assert (a[2] - a[0], a[3] - a[1]) == pytest.approx((b[2] - b[0], b[3] - b[1]))
    assert a[0] > 10 and a[3] < 90
    assert compose._collision(outer, anchored, region) == 0
    centre = lambda t: np.array([(t[0] + t[2]) / 2, (t[1] + t[3]) / 2])
    assert np.linalg.norm(centre(a) - (5, 95)) < np.linalg.norm(centre(b) - (5, 95))


@pytest.mark.parametrize("nested", [False, True])
@pytest.mark.parametrize("mode", ["bare-refit", "hosted-refit", "missing-host"])
def test_learned_anchor_only_applies_to_hosted_refit_bare_fallback(monkeypatch, nested, mode):
    c = compose.Composer(SimpleNamespace(own=lambda _: False, stem=((4, 4),)), {})
    c._faces[None] = ((0, 0, 100, 100), set())
    boxes = [(0, 0, 100, 100), (0, 0, 25, 25)]
    c.layout = SimpleNamespace(predict=lambda *args: list(boxes))
    source = SimpleNamespace(box=(0, 0, 100, 10) if mode == "bare-refit" else (0, 0, 40, 40))
    host = compose.Host("donor", [source], c.face, 0)
    monkeypatch.setattr(c, "_host", lambda op, i, *args, **kwargs:
                        None if i == 1 and mode == "missing-host" else (host, 0))
    region = (100, 100, 150, 150) if nested else None
    opening = (110, 110, 145, 145) if nested else (20, 20, 90, 90)
    monkeypatch.setattr(c, "_room", lambda *args: opening)
    monkeypatch.setattr(c, "ink", lambda *args: 1.0)
    monkeypatch.setattr(c, "_node", lambda child, box:
                        [compose.Placed(source, source.box, box, origin=f"glyph {child}")])
    calls = []
    monkeypatch.setattr(compose, "_fit_inside", lambda outer, inner, region, stem, **kwargs:
                        calls.append((inner[0].target, kwargs)))
    c._learned("⿸", ["A", "B"], region)
    assert len(calls) == 1
    target, kwargs = calls[0]
    expected = (106.25, 106.25) if nested else (12.5, 12.5)
    assert kwargs.get("anchor") == (expected if mode == "bare-refit" else None)
    if mode == "bare-refit":
        assert target == compose._shrunk(opening, compose.OPENING_SHARE)
        assert kwargs["room"] == target

