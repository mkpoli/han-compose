from types import SimpleNamespace

import numpy as np

from han_compose import compose
from han_compose import kanjivg_cuts as K


def rect(x0, y0, x1, y1):
    points = np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], dtype=float)
    return compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())


def cutter(characters):
    """A cutter over `characters`: each a KanjiVG root and one outline for each of its strokes."""
    made = object.__new__(K.Cutter)
    glyphs = {char: compose.Part(outlines) for char, (_, outlines) in characters.items()}
    made.c = SimpleNamespace(font=SimpleNamespace(glyph=glyphs.get), bases={})
    made._bases_of = {}
    made.entries = {char: K.Entry(root, ["M0 0"] * len(outlines)) for char, (root, outlines) in characters.items()}
    made._owners = {char: [{k} for k in range(len(outlines))] for char, (_, outlines) in characters.items()}
    return made, glyphs


#: 木 drawn through 口 (束), 口 above 木 (呆) and 木 beside 口, each inside a character of its own.
THROUGH = [rect(40, 0, 60, 100), rect(0, 20, 100, 40), rect(20, 30, 80, 70)]
STACKED = [rect(20, 60, 80, 100), rect(40, 0, 60, 50), rect(0, 20, 100, 40)]
BESIDE = [rect(0, 0, 40, 100), rect(60, 20, 100, 80)]


def test_an_overlay_is_drawn_from_a_group_whose_operands_cross():
    made, glyphs = cutter({
        "速": (K.Group("速", None, [], [K.Group("束", None, [], [K.Group("木", None, [0, 1]), K.Group("口", None, [2])])]), THROUGH)})
    found = K.groups_like(made, ("⿻", "木", "口"), set())
    assert [(char, part.contours) for char, part in found] == [("速", glyphs["速"].contours)]


def test_a_stack_or_a_row_of_the_same_components_is_no_overlay():
    made, _ = cutter({
        "褒": (K.Group("褒", None, [], [K.Group("呆", None, [], [K.Group("口", "top", [0]), K.Group("木", "bottom", [1, 2])])]), STACKED),
        "杏": (K.Group("杏", None, [], [K.Group(None, None, [], [K.Group("木", "left", [0]), K.Group("口", "right", [1])])]), BESIDE)})
    assert K.groups_like(made, ("⿻", "木", "口"), set()) == []


def test_operands_that_only_touch_do_not_cross():
    # 口 resting on 木's bar: a fifth of 口's height lies inside 木's box, under `CROSS`.
    touching = [rect(20, 32, 80, 72), rect(40, 0, 60, 40), rect(0, 20, 100, 40)]
    made, _ = cutter({"褒": (K.Group("褒", None, [], [K.Group("呆", None, [], [K.Group("口", None, [0]), K.Group("木", None, [1, 2])])]), touching)})
    assert K.CROSS > 8 / 40
    assert K.groups_like(made, ("⿻", "木", "口"), set()) == []


def test_a_bar_resting_on_the_other_operand_does_not_cross_it():
    # 一 on 内 (丙): two fifths of the bar's thickness lie inside 内's box, its middle outside.
    resting = [rect(0, 96, 100, 106), rect(10, 0, 90, 100)]
    through = [rect(0, 45, 100, 55), rect(10, 0, 90, 100)]
    group = lambda: K.Group("病", None, [], [K.Group("丙", None, [], [K.Group("一", None, [0]), K.Group("内", None, [1])])])
    assert K.groups_like(cutter({"病": (group(), resting)})[0], ("⿻", "一", "内"), set()) == []
    assert len(K.groups_like(cutter({"病": (group(), through)})[0], ("⿻", "一", "内"), set())) == 1


def test_pieces_inside_an_unnamed_subgroup_are_the_same_component():
    # 哀 as KanjiVG groups it: 衣 above 口 and, inside an unnamed group, below it.
    root = K.Group("哀", None, [], [K.Group("衣", None, [0], part="1"),
                                     K.Group(None, None, [], [K.Group("口", None, [1]), K.Group("衣", None, [2], part="2")])])
    assert K._parts(root) == ["衣", "口"]


def test_a_component_drawn_in_pieces_is_one_component():
    # 束 as KanjiVG groups it: 木 above 口 and below it, the two pieces of one 木.
    root = K.Group("整", None, [], [K.Group("束", None, [], [
        K.Group("木", None, [0], part="1"), K.Group("口", None, [2]), K.Group("木", None, [1], part="2")])])
    made, _ = cutter({"整": (root, [rect(0, 20, 100, 40), rect(40, 0, 60, 100), rect(20, 30, 80, 70)])})
    assert K._parts(root.groups[0]) == ["木", "口"]
    found = K.groups_like(made, ("⿻", "木", "口"), set())
    assert [(char, len(part.contours)) for char, part in found] == [("整", 3)]


def test_a_piece_of_a_component_is_not_the_component():
    # 柬 as KanjiVG groups it: the two pieces of 束 with 丷 between them, each made of 木 and 口.
    root = K.Group("闌", None, [], [K.Group("柬", None, [4], [
        K.Group("束", None, [], [K.Group("木", None, [0], part="1"), K.Group("口", None, [1], part="1")], part="1"),
        K.Group("束", None, [], [K.Group("口", None, [2], part="2"), K.Group("木", None, [3], part="2")], part="2")])])
    outlines = [rect(0, 80, 100, 90), rect(20, 40, 80, 70), rect(20, 30, 80, 40), rect(40, 0, 60, 60), rect(30, 45, 70, 55)]
    made, _ = cutter({"闌": (root, outlines)})
    assert K.groups_like(made, ("⿻", "木", "口"), set()) == []


def test_a_group_of_a_component_both_operands_name_is_kept_untested():
    made, _ = cutter({"林": (K.Group("林", None, [], [K.Group(None, None, [], [K.Group("木", "left", [0]), K.Group("木", "right", [1])])]), BESIDE)})
    assert [char for char, _ in K.groups_like(made, ("⿻", "木", "木"), set())] == ["林"]


def test_an_excluded_character_gives_no_group():
    made, _ = cutter({
        "速": (K.Group("速", None, [], [K.Group("束", None, [], [K.Group("木", None, [0, 1]), K.Group("口", None, [2])])]), THROUGH)})
    assert K.groups_like(made, ("⿻", "木", "口"), {"速"}) == []
