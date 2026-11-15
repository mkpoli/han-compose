from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose


def fixture(sequences=None):
    glyphs = {}
    for i, ch in enumerate("木口一束"):
        points = np.array([[0, 0], [100 + i, 0], [100 + i, 100], [0, 100]], dtype=float)
        glyphs[ch] = compose.Part([compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())])
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    c = compose.Composer(font, sequences or {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    return c


def test_a_modifier_after_an_operator_is_kept_on_its_node():
    tree = compose.parse("⿻[1:]木口")
    assert isinstance(tree, compose.Noted) and tree.note == "1:"
    assert tuple(tree) == ("⿻", "木", "口")
    assert compose.key(tree) == "⿻[1:]木口"


@pytest.mark.parametrize("sequence", ["⿻[x_]木口", "⿴[0]口木", "⿵[1]口木", "⿶[-1]口木", "⿷[a,b]口木", "⿼[l|r]口木", "㇯[1]木一", "⿰木⿻[:-1]口一"])
def test_every_operator_that_takes_a_modifier_reads_one_and_writes_it_back(sequence):
    assert compose.key(compose.parse(sequence)) == sequence


@pytest.mark.parametrize("sequence", ["⿰[1]木口", "⿱[1]木口", "⿸[1]木口", "⿾[1]木", "⿻[zz]木口", "⿻[]木口", "⿻[1木口", "⿻[" + "1" * 65 + "]木口"])
def test_brackets_that_are_no_modifier_are_components_and_do_not_fit(sequence):
    with pytest.raises(ValueError):
        compose.parse(sequence)


def test_the_longest_modifier_has_sixty_four_characters():
    assert compose.parse("⿻[" + "1" * 64 + "]木口").note == "1" * 64


def test_a_node_with_a_modifier_is_not_the_node_without_it():
    plain, noted = compose.parse("⿻木口"), compose.parse("⿻[1]木口")
    assert noted != plain and plain != noted
    assert noted == compose.Noted(("⿻", "木", "口"), "1")
    assert noted != compose.Noted(("⿻", "木", "口"), "2")
    assert len({plain, noted, compose.Noted(("⿻", "木", "口"), "1")}) == 2


def test_the_modifier_stays_where_a_tree_is_rebuilt():
    c = fixture()
    tree = compose.parse("⿰⿻[1]木口⿾⿾一")
    for rebuilt in (c._cancel_transforms(tree), c._normalize_repeated_grids(tree), c._normalize_requested_enclosures(tree),
                    c._expanded(tree, "", {}, compose.EXPAND_DEPTH), compose._replaced(tree, (1,), "一")):
        assert compose.key(rebuilt[1]) == "⿻[1]木口"
    assert compose.key(c._cancel_transforms(tree)) == "⿰⿻[1]木口一"
    assert compose.key(compose._replaced(compose.parse("⿻[1]木口"), (1,), "一")) == "⿻[1]木一"


def test_an_operator_with_a_modifier_is_laid_out_as_the_operator_alone():
    c = fixture()
    plain, noted = c.compose("⿴口木"), c.compose("⿴[0]口木")
    assert [(p.origin, p.target) for p in noted] == [(p.origin, p.target) for p in plain]


def test_a_sequence_with_a_modifier_is_not_drawn_as_the_character_of_the_plain_sequence():
    c = fixture({"束": "⿻木口"})
    assert [p.origin for p in c.compose("⿻木口")] == ["glyph 束"]
    assert [p.origin for p in c.compose("⿻[1]木口")] == ["glyph 木", "glyph 口"]


def test_a_node_with_a_modifier_is_copied_and_pickled_whole():
    import copy
    import pickle

    noted = compose.parse("⿰木⿻[1]口一")
    for other in (copy.deepcopy(noted), pickle.loads(pickle.dumps(noted))):
        assert other == noted and compose.key(other) == "⿰木⿻[1]口一"
