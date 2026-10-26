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

@pytest.mark.parametrize("op", ["⿾", "⿿"])
@pytest.mark.parametrize("text", ["木", "⿰木口"])
@pytest.mark.parametrize("wrapper", ["{}", "⿱口{}"])
def test_double_transform(op, text, wrapper):
    c = fixture()
    assert signature(c, wrapper.format(op * 2 + text)) == signature(c, wrapper.format(text))
    if op == "⿾":
        assert signature(c, op * 3 + text) == signature(c, op + text)
    else:
        for count in (1, 3):
            with pytest.raises(LookupError, match="not laid out"):
                c.compose(op * count + text)
    assert signature(c, op * 4 + text) == signature(c, text)

def test_mixed_transform_unchanged():
    c = fixture()
    tree = compose.parse("⿾⿿木")
    assert c._cancel_transforms(tree) == tree
