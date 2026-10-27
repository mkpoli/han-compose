import json
from pathlib import Path
from types import SimpleNamespace
import numpy as np
import pytest
from han_compose import compose

CATALOG = json.loads(Path(compose.__file__).with_name("pyramid-glyphs.json").read_text())["entries"]
CHARS = "木口永人" + "".join(r["char"] + r["part"] + r["sequence"] + r["pair"] for r in CATALOG)


def fixture(missing="", exclude=()):
    glyphs = {}
    for i, ch in enumerate(dict.fromkeys(CHARS)):
        if ch in missing:
            continue
        points = np.array([[0, 0], [100 + i, 0], [100 + i, 100], [0, 100]], dtype=float)
        glyphs[ch] = compose.Part([compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())])
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False, exclude=set(exclude))
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    return c


def signature(c, sequence):
    parts = c.compose(sequence)
    return compose.svg_path(parts), [p.origin for p in parts]

CASES = list({sequence: row["char"] for row in CATALOG
              for sequence in (row["sequence"], f"⿱{row['part']}{row['pair']}",
                               f"⿱{row['part']}⿰{row['part']}{row['part']}")}.items())


@pytest.mark.parametrize("text,char", CASES)
def test_whole_glyph_and_source(text, char):
    c = fixture()
    assert signature(c, text) == signature(c, char)
    assert compose.key(compose.parse(text)) == text

@pytest.mark.parametrize("text,char", CASES)
def test_missing_and_excluded_glyphs(text, char):
    assert len(fixture(missing=char).compose(text)) > 1
    assert all(p.origin != f"glyph {char}" for p in fixture(exclude=[char]).compose(text))


@pytest.mark.parametrize("text,char", CASES)
def test_whole_glyph_selection_respects_excluded_twins(text, char):
    c = fixture(exclude=["甲"])
    c.__dict__["twins"] = {"甲": frozenset([char])}
    tree = compose.parse(text)
    assert c._standalone_pyramid(tree) == tree
    assert char in c.exclude
    assert all(p.origin != f"glyph {char}" for p in c.compose(text))

@pytest.mark.parametrize("part,char", [("鹿", "麤"), ("龍", "龘"), ("石", "磊"), ("金", "鑫"), ("牛", "犇"), ("鳥", "𪈼")])
def test_previously_missing_pyramids(part, char):
    c = fixture()
    assert signature(c, f"⿱{part}⿰{part}{part}") == signature(c, char)

@pytest.mark.parametrize("text", ["⿱⿰木木木", "⿲木木木", "⿱木⿰木口", "⿱口⿰木木"])
def test_other_shapes_are_not_pyramids(text):
    c = fixture()
    node = compose.parse(text)
    assert c._standalone_pyramid(node) == node
