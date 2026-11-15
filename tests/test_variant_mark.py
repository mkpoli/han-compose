CHARS = '木口'
from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose


def fixture():
    glyphs = {}
    for i, ch in enumerate(CHARS):
        points = np.array([[0, 0], [100 + i, 0], [100 + i, 100], [0, 100]], dtype=float)
        glyphs[ch] = compose.Part([compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())])
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    return c


def signature(c, sequence):
    parts = c.compose(sequence)
    return compose.svg_path(parts), [p.origin for p in parts]


@pytest.mark.parametrize("text", ["木", "⿰木口", "⿱木口"])
@pytest.mark.parametrize("wrapper", ["〾{}", "⿱口〾{}", "⿾〾{}", "〾〾{}"])
def test_variant_mark_draws_its_operand_as_it_is(text, wrapper):
    c = fixture()
    assert signature(c, wrapper.format(text)) == signature(c, wrapper.replace("〾", "").format(text))
