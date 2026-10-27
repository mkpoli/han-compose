CHARS = '木口永人大小工土火又水屮㗊燚叕㵘茻林矛彳亍弓𤣩王辛隹亠𧘇方𠂉匕頁𠦝𠆢鬲士冖一殳木日金水火土女子口吉隹魚牛馬羊犬貝毛手耳虫車力森晶鑫淼焱垚姦孨品嚞雥鱻犇驫羴猋贔毳掱聶蟲轟劦夾巫坐'
from types import SimpleNamespace
import numpy as np
import pytest
from han_compose import compose


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

CASES = [('⿰⿱口口⿱口口', '㗊'), ('⿱⿰口口⿰口口', '㗊'), ('⿰⿱火火⿱火火', '燚'), ('⿱⿰火火⿰火火', '燚'), ('⿰⿱又又⿱又又', '叕'), ('⿱⿰又又⿰又又', '叕'), ('⿰⿱水水⿱水水', '㵘'), ('⿱⿰水水⿰水水', '㵘'), ('⿰⿱屮屮⿱屮屮', '茻'), ('⿱⿰屮屮⿰屮屮', '茻')]

@pytest.mark.parametrize("text,char", CASES)
def test_whole_glyph_and_source(text, char):
    c = fixture()
    assert signature(c, text) == signature(c, char)
    assert compose.key(compose.parse(text)) == text

@pytest.mark.parametrize("text,char", CASES)
def test_missing_and_excluded_glyphs(text, char):
    assert len(fixture(missing=char).compose(text)) > 1
    assert all(p.origin != f"glyph {char}" for p in fixture(exclude=[char]).compose(text))

@pytest.mark.parametrize("part", list("口火又水屮"))
@pytest.mark.parametrize("wrapper", ["{}", "⿱木{}"])
def test_row_column_fallback(part, wrapper):
    c = fixture(missing="㗊燚叕㵘茻")
    a, b = f"⿰⿱{part}{part}⿱{part}{part}", f"⿱⿰{part}{part}⿰{part}{part}"
    assert signature(c, wrapper.format(a)) == signature(c, wrapper.format(b))

def test_mixed_grid_unchanged():
    c = fixture()
    for text in ["⿰⿱火口⿱火火", "⿰⿱木木⿱木木"]:
        tree = compose.parse(text)
        assert c._normalize_repeated_grids(tree) == tree


@pytest.mark.parametrize("text,char", CASES)
def test_whole_glyph_selection_respects_excluded_twins(text, char):
    c = fixture(exclude=["甲"])
    c.__dict__["twins"] = {"甲": frozenset([char])}
    tree = compose.parse(text)
    assert c._standalone_repeated_grid(tree) == tree
    assert char in c.exclude
    assert all(p.origin != f"glyph {char}" for p in c.compose(text))
