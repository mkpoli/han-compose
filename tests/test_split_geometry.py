from collections import Counter
from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose


def rectangle(x0, y0, x1, y1, clockwise=False):
    points = np.array([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], dtype=float)
    if clockwise:
        points = points[::-1].copy()
    return compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())


def identities(parts):
    return [tuple(map(id, part.contours)) for part in parts]


def composer(references):
    return compose.Composer(SimpleNamespace(glyph=references.get), {})


@pytest.mark.parametrize("strict", [False, True])
@pytest.mark.parametrize("compound_top", [False, True])
def test_binary_boundary_keeps_both_subparts(monkeypatch, strict, compound_top):
    if compound_top:
        # The true boundary grazes the sibling; the component's internal seam is completely clear.
        expected = [compose.Part([rectangle(0, 60, 24, 68), rectangle(0, 30, 24, 38)]),
                    compose.Part([rectangle(0, 0, 24, 28)])]
    else:
        # Both seams are clear; lowest-y tie breaking would leave only the bottom bar below the cut.
        expected = [compose.Part([rectangle(0, 60, 24, 68)]),
                    compose.Part([rectangle(0, 30, 24, 38), rectangle(0, 0, 24, 8)])]
    whole = compose.Part([c for part in expected for c in part.contours])
    c = composer(dict(zip("AB", expected)))
    monkeypatch.setattr(c, "_counted", lambda *args: True)
    assert identities(compose.split(whole, 1, 2)) != identities(expected)
    result, _ = c._cut(whole, ("⿱", "A", "B"), strict=strict)
    assert identities(result) == identities(expected)
    assert Counter(id(outline) for part in result for outline in part.contours) == Counter(map(id, whole.contours))


@pytest.mark.parametrize("operator", ["⿲", "⿳"])
def test_ternary_boundaries_follow_each_operand(operator):
    groups = [[rectangle(x, 0, x + 8, 24) for x in (base, base + 30)] for base in (0, 60, 120)]
    if operator == "⿳":
        for group in groups:
            for contour in group:
                contour.light[:] = contour.light[:, ::-1]
                contour.heavy[:] = contour.heavy[:, ::-1]
        groups.reverse()
    expected = list(map(compose.Part, groups))
    c = composer(dict(zip("ABC", expected)))
    whole = compose.Part([outline for group in groups for outline in group])
    result, _ = c._cut(whole, (operator, "A", "B", "C"), strict=False)
    assert identities(result) == identities(expected)


def test_linear_group_scores_are_memoised_per_call(monkeypatch):
    bars = [rectangle(x, 0, x + 8, 24) for x in range(0, 180, 30)]
    references = {name: compose.Part([bars[i]]) for i, name in enumerate("ABC")}
    c = composer(references)
    calls = []

    def likeness(part, reference):
        calls.append((id(reference), tuple(map(id, part.contours))))
        return 1.0

    monkeypatch.setattr(c, "_shape_likeness", likeness)
    whole = compose.Part(bars)
    assert c._linear(whole, ("⿲", "A", "B", "C")) is not None
    assert len(calls) == len(set(calls))
    first = calls.copy()
    calls.clear()
    c._linear(whole, ("⿲", "A", "B", "C"))
    assert calls == first


@pytest.mark.parametrize("axis,operator", [(0, "⿲"), (1, "⿳")])
def test_unknown_operands_keep_geometric_fallback(axis, operator):
    bars = [rectangle(x, 0, x + 8, 24) if axis == 0 else rectangle(0, x, 24, x + 8)
            for x in range(0, 150, 30)]
    whole = compose.Part(bars)
    c = composer({})
    expected = compose.split(whole, axis, 3)
    for _ in range(2):
        result, _ = c._cut(whole, (operator, "A", "B", "C"), strict=False)
        assert identities(result) == identities(expected)


@pytest.mark.parametrize("strict", [False, True])
def test_failed_compound_sketch_rejects_linear_cut(monkeypatch, strict):
    bars = [rectangle(0, 0, 8, 24), rectangle(30, 0, 38, 24)]
    c = composer({"C": compose.Part([bars[1]])})
    compound = ("⿱", "A", "B")
    monkeypatch.setattr(c, "_sketch", lambda _: None)
    monkeypatch.setattr(c, "_counted", lambda *args: True)
    assert c.likeness(compose.Part([bars[0]]), compound) == 0.0
    assert c._cut(compose.Part(bars), ("⿰", compound, "C"), strict=strict) is None
    # An unknown scalar retains the geometric fallback in both modes.
    result, _ = c._cut(compose.Part(bars), ("⿰", "A", "C"), strict=strict)
    assert identities(result) == identities([compose.Part([bars[0]]), compose.Part([bars[1]])])


def test_one_known_operand_controls_its_boundary():
    bars = [rectangle(0, y, 24, y + 8) for y in (0, 30, 60)]
    expected = [compose.Part([bars[2]]), compose.Part(bars[:2])]
    c = composer({"B": expected[1]})
    result, _ = c._cut(compose.Part(bars), ("⿱", "A", "B"), strict=False)
    assert identities(result) == identities(expected)


def test_peer_validation_cannot_select_a_worse_boundary(monkeypatch):
    bars = [rectangle(0, y, 24, y + 8) for y in (0, 30, 60)]
    expected = [compose.Part([bars[2]]), compose.Part(bars[:2])]
    c = composer(dict(zip("AB", expected)))
    # A bad peer population accepts only the truncated bottom part.
    monkeypatch.setattr(c, "_counted", lambda piece, op, index, node: index == 0 or len(piece.contours) == 1)
    whole = compose.Part(bars)
    assert identities(c._cut(whole, ("⿱", "A", "B"), strict=False)[0]) == identities(expected)
    assert c._cut(whole, ("⿱", "A", "B"), strict=True) is None


def test_geometry_keeps_counters_and_sided_limit():
    outer = rectangle(0, 0, 30, 30)
    counter = rectangle(10, 10, 20, 20, clockwise=True)
    right = rectangle(40, 0, 70, 30)
    expected = [compose.Part([outer, counter]), compose.Part([right])]
    c = composer(dict(zip("AB", expected)))
    result, _ = c._cut(compose.Part([outer, counter, right]), ("⿰", "A", "B"), strict=False)
    assert identities(result) == identities(expected)
    across = rectangle(0, 10, 70, 20)
    assert c._cut(compose.Part([outer, counter, right, across]), ("⿰", "A", "B"), strict=False) is None


def test_overlay_fallback_remains_available(monkeypatch):
    left, right, across = rectangle(0, 0, 30, 80), rectangle(40, 0, 90, 80), rectangle(0, 35, 90, 45)
    whole = compose.Part([left, right, across])
    node = ("⿰", ("⿻", "A", "B"), "C")
    expected = [compose.Part([left, across]), compose.Part([right])]
    c = composer({})
    calls = []
    monkeypatch.setattr(c, "_operand_shape", lambda _: None)

    def matched(part, tree):
        calls.append((part, tree))
        return expected

    monkeypatch.setattr(c, "_matched", matched)
    assert c._cut(whole, node, strict=False)[0] is expected
    assert calls == [(whole, node)]


def test_a_cut_beside_the_midpoint_clears_an_outline_the_midpoint_passes_through():
    # 𰟵 (⿰火默) in Plangothic: the midpoint between 火's right dot and 灬's first dot leaves 79.7%
    # of that 火 dot on its left, short of SIDED; a cut a few units left leaves 80% or more.
    fire = [rectangle(38, 0, 324, 900), rectangle(228, 400, 339, 600)]
    ink = [rectangle(305, 0, 394, 150), rectangle(328, 200, 668, 900)]
    whole = compose.Part(fire + ink)
    expected = identities([compose.Part(fire), compose.Part(ink)])
    # A glyph of the style's own font keeps the midpoint.
    assert expected not in [identities(parts) for _, _, parts in compose._linear_partitions(whole, 0, 2)]
    for contour in whole.contours:
        contour.kindred = True
    assert expected in [identities(parts) for _, _, parts in compose._linear_partitions(whole, 0, 2)]


def test_a_kindred_fallback_piece_is_not_held_to_the_stroke_count_of_the_variable_font():
    # Plangothic draws 火 on the left in three outlines where Noto's hosts have four.
    piece = compose.Part([rectangle(0, 0, 10, 10), rectangle(20, 0, 30, 10), rectangle(40, 0, 50, 10)])
    for contour in piece.contours:
        contour._width = (80.0, 80.0)
    c = composer({})
    c._own_outlines = lambda node: 3
    c._like_fellows = lambda *args: True
    c.strokes = lambda place, node: Counter({4: 60})
    assert not c._counted(piece, "⿰", 0, "火")
    for contour in piece.contours:
        contour.kindred = True
    assert c._counted(piece, "⿰", 0, "火")


def test_a_clean_stretch_between_two_outlines_is_found_whatever_the_rounding_of_its_marks():
    # Between 80% of the first outline (34.4) and 20% of the second (35.0) a cut crosses neither,
    # though both marks round to a share that counts as crossing.
    first, second = rectangle(0, 0, 43, 100), rectangle(22, 0, 87, 100)
    first.kindred = second.kindred = True
    found = [identities(parts) for _, _, parts in compose._linear_partitions(compose.Part([first, second]), 0, 2)]
    assert found == [identities([compose.Part([first]), compose.Part([second])])]
