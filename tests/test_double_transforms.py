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
    assert signature(c, op * 3 + text) == signature(c, op + text)
    assert signature(c, op * 4 + text) == signature(c, text)

def test_mixed_transform_unchanged():
    c = fixture()
    tree = compose.parse("⿾⿿木")
    assert c._cancel_transforms(tree) == tree


@pytest.mark.parametrize("text", ["木", "⿰木口", "⿱木口"])
def test_half_turn_rotates_all_outlines_in_the_node_region_without_mutating_fonts(text):
    c = fixture()
    region = (120, 210, 620, 910)
    original = c._node(compose.parse(text), region)
    original_points = [[points.copy() for points in p.contours()] for p in original]
    rotated = c._node(compose.parse("⿿" + text), region)
    assert len(original) == len(rotated)
    centre = np.array([region[0] + region[2], region[1] + region[3]])
    for before, after in zip(original_points, rotated):
        for points, turned in zip(before, after.contours()):
            np.testing.assert_allclose(turned, centre - points)
    again = c._node(compose.parse(text), region)
    for before, part in zip(original_points, again):
        for points, unchanged in zip(before, part.contours()):
            np.testing.assert_allclose(unchanged, points)


@pytest.mark.parametrize("op", ["⿾", "⿿"])
def test_cancellation_precedes_pyramid_lookup(op):
    c = fixture()
    assert signature(c, op * 2 + "⿱木⿰木木") == signature(c, "森")


@pytest.mark.parametrize("op", ["⿾", "⿿"])
def test_cancellation_precedes_overlay_lookup(op):
    c = fixture()
    assert signature(c, op * 2 + "⿻大⿰人人") == signature(c, "夾")


@pytest.mark.parametrize("op", ["⿾", "⿿"])
@pytest.mark.parametrize("expanded,whole", [
    ("⿱木⿰木木", "森"), ("⿻大⿰人人", "夾"), ("⿱⿰口口⿰口口", "㗊"),
])
def test_transformed_whole_uses_the_same_standalone_glyph(op, expanded, whole):
    c = fixture()
    assert signature(c, op + expanded) == signature(c, op + whole)
