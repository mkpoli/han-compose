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

CASES = [('⿴⿰彳亍', '⿲彳{inner}亍'), ('⿴⿰弓弓', '⿲弓{inner}弓'), ('⿴⿰𤣩王', '⿲𤣩{inner}王'), ('⿴⿰辛辛', '⿲辛{inner}辛'), ('⿴⿰隹隹', '⿲隹{inner}隹'), ('⿴⿱亠𧘇', '⿳亠{inner}𧘇'), ('⿸⿰方𠂉', '⿰方⿱𠂉{inner}'), ('⿹⿰匕頁', '⿰⿱匕{inner}頁'), ('⿸⿰𠦝𠆢', '⿰𠦝⿱𠆢{inner}'), ('⿶⿱⿰弓弓鬲', '⿱⿲弓{inner}弓鬲'), ('⿹⿰⿳士冖一殳', '⿰⿱⿳士冖一{inner}殳')]

@pytest.mark.parametrize("prefix,layout", CASES)
@pytest.mark.parametrize("inner", ["木", "⿱木口"])
def test_enclosure_rendering(prefix, layout, inner):
    c = fixture()
    assert signature(c, prefix + inner) == signature(c, layout.format(inner=inner))
    assert compose.key(compose.parse(prefix + inner)) == prefix + inner

@pytest.mark.parametrize("text", ["⿵⿰彳亍木", "⿴⿰火木口", "⿵林木", "⿱林木"])
def test_other_hosts_unchanged(text):
    c = fixture()
    tree = compose.parse(text)
    assert c._respelled(tree) == tree
