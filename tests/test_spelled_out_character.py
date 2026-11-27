"""A character written with an operand spelled out is recognised as that character."""

from types import SimpleNamespace

import numpy as np

from han_compose import compose as C

OPS = [("moveTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False)]


def _composer(sequences: dict[str, str], **options) -> C.Composer:
    points = np.array([[100, 0], [900, 0], [900, 800], [100, 800]], dtype=float)
    glyph = C.Part([C.Contour(OPS, points, points.copy())])
    font = SimpleNamespace(glyph=lambda char: glyph if char in sequences else None, has=lambda char: char in sequences,
                           own=lambda char: char in sequences)
    return C.Composer(font, sequences, weighted=False, hosted=False, **options)


SEQUENCES = {"喃": "⿰口南", "𬞑": "⿱艹喃", "口": "口", "南": "南", "艹": "艹"}


def test_operands_that_spell_a_character_are_joined_from_the_innermost_out() -> None:
    c = _composer(SEQUENCES)
    assert c._joined(C.parse("⿱艹⿰口南")) == ("⿱", "艹", "喃")
    assert c._joined(C.parse("⿱艹⿰口⿱南南")) == ("⿱", "艹", ("⿰", "口", ("⿱", "南", "南")))
    assert c._joined("喃") == "喃"


def test_a_character_spelled_out_is_drawn_as_its_glyph() -> None:
    c = _composer(SEQUENCES)
    assert [p.origin for p in c.compose("⿱艹⿰口南")] == ["glyph 𬞑"]


def test_an_excluded_character_is_not_joined() -> None:
    c = _composer(SEQUENCES, exclude={"喃"})
    assert c._joined(C.parse("⿱艹⿰口南")) == C.parse("⿱艹⿰口南")
