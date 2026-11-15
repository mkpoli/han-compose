from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose, marks

ACUTE, GRAVE, DOT_BELOW, VOICED, SUPERSCRIPT_ONE = "́", "̀", "̣", "゛", "¹"


def fixture():
    glyphs = {}
    for i, ch in enumerate("木口一"):
        points = np.array([[0, 0], [100 + i, 0], [100 + i, 100], [0, 100]], dtype=float)
        glyphs[ch] = compose.Part([compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())])
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    return c


def body(placed):
    return [p for p in placed if not p.origin.startswith("mark ")]


def box(placed):
    return (min(p.target[0] for p in placed), min(p.target[1] for p in placed),
            max(p.target[2] for p in placed), max(p.target[3] for p in placed))


def test_marks_after_a_description_are_read_apart_from_it():
    assert compose.described("⿰木口" + ACUTE) == (("⿰", "木", "口"), ACUTE)
    assert compose.described("⿰木口" + VOICED + ACUTE) == (("⿰", "木", "口"), VOICED + ACUTE)
    assert compose.described("木" + ACUTE) == ("木", ACUTE)
    assert compose.described("⿰木口") == (("⿰", "木", "口"), "")


def test_a_mark_where_an_operand_is_due_is_that_operand():
    assert compose.described("⿰木" + ACUTE) == (("⿰", "木", ACUTE), "")
    assert compose.described("⿰木" + ACUTE + GRAVE) == (("⿰", "木", ACUTE), GRAVE)
    assert compose.described(ACUTE) == (ACUTE, "")


def test_text_after_a_description_that_is_no_mark_is_refused():
    with pytest.raises(ValueError):
        compose.described("⿰木口一" + ACUTE)
    # A tone mark names the tone of one Hangul syllable, not of a description.
    with pytest.raises(ValueError):
        compose.described("⿰木口〮")
    with pytest.raises(ValueError):
        compose.parse("⿰木口" + ACUTE)


def test_a_combining_mark_sits_over_the_drawing_and_leaves_it_as_it_was():
    c = fixture()
    plain, placed = c.compose("⿰木口"), c.compose("⿰木口" + ACUTE)
    assert [p.origin for p in placed] == ["glyph 木", "glyph 口", "mark " + ACUTE]
    assert [p.target for p in body(placed)] == [p.target for p in plain]
    mark, face = placed[-1], c.face
    assert not mark.cut and mark.weight == (0.0, 0.0)
    assert (mark.target[0] + mark.target[2]) / 2 == pytest.approx((face[0] + face[2]) / 2)
    assert mark.target[3] == pytest.approx(face[3] - (face[3] - face[1]) * marks.INSET)
    assert mark.target[1] > (face[1] + face[3]) / 2


def test_a_mark_under_the_baseline_sits_under_the_drawing():
    c = fixture()
    mark, face = c.compose("⿰木口" + DOT_BELOW)[-1], c.face
    assert mark.target[1] == pytest.approx(face[1] + (face[3] - face[1]) * marks.INSET)
    assert mark.target[3] < (face[1] + face[3]) / 2


def test_a_run_of_combining_marks_stacks_away_from_the_drawing():
    c = fixture()
    first, second = c.compose("⿰木口" + ACUTE + GRAVE)[-2:]
    assert (first.origin, second.origin) == ("mark " + ACUTE, "mark " + GRAVE)
    assert first.target[3] == pytest.approx(second.target[1])
    assert second.target[3] == pytest.approx(c.face[3] - (c.face[3] - c.face[1]) * marks.INSET)


@pytest.mark.parametrize("mark", [VOICED, SUPERSCRIPT_ONE])
def test_a_mark_beside_the_drawing_takes_a_margin_the_character_shrinks_out_of(mark):
    c = fixture()
    plain, placed = c.compose("⿰木口"), c.compose("⿰木口" + mark)
    face, ink, at = c.face, box(body(placed)), placed[-1].target
    assert placed[-1].origin == "mark " + mark
    # The mark stands at the upper right of the whole face.
    assert at[2] == pytest.approx(face[2] - (face[3] - face[1]) * marks.INSET)
    assert at[3] == pytest.approx(face[3] - (face[3] - face[1]) * marks.INSET)
    # The character keeps the lower left of the face and stays clear of the mark on one side.
    beside = marks.face_beside(c, mark, face)
    assert beside[:2] == face[:2] and beside[2] < face[2] and beside[3] < face[3]
    assert beside[2] < at[0] or beside[3] < at[1]
    assert ink[0] >= beside[0] - 1 and ink[1] >= beside[1] - 1 and ink[2] <= beside[2] + 1 and ink[3] <= beside[3] + 1
    assert ink[2] - ink[0] < box(plain)[2] - box(plain)[0]
    assert not (compose.raster(body(placed)) & compose.raster(placed[-1:])).any()


def test_the_face_is_whole_again_after_a_drawing_with_marks():
    c = fixture()
    face = c.face
    c.compose("⿰木口" + VOICED)
    assert c.face == face
    with pytest.raises(LookupError):
        c.compose("⿰木丙" + VOICED)
    assert c.face == face


def test_the_guide_fits_a_character_only_in_the_whole_face():
    c = fixture()
    fitted = []
    c.guide = SimpleNamespace(fit=lambda composer, sequence, placed: fitted.append(sequence) or placed)
    c.compose("⿰木口" + ACUTE)
    assert fitted == ["⿰木口"]
    c.compose("⿰木口" + VOICED)
    assert fitted == ["⿰木口"]
    assert c._beside is None


def test_a_mark_with_no_outline_is_left_out():
    c = fixture()
    unassigned = "͸"
    assert marks.glyph(c, unassigned) is None
    assert marks.mark_parts(c, unassigned, c.face) == []


def test_the_marks_are_part_of_the_document_and_the_raster():
    c = fixture()
    plain, placed = c.compose("⿰木口"), c.compose("⿰木口" + ACUTE)
    assert compose.svg_path(placed).startswith(compose.svg_path(plain))
    assert len(compose.svg_path(placed)) > len(compose.svg_path(plain))
    assert compose.raster(placed).sum() > compose.raster(plain).sum()


def test_a_bundled_outline_is_read_at_a_thousand_units_an_em():
    acute = marks.bundled(ACUTE)
    assert acute is not None and len(acute.contours) == 1
    assert acute.box == pytest.approx((-325.0, 606.0, -124.0, 766.0))
    assert marks.bundled("͸") is None


def test_a_mark_is_wound_as_the_font_winds():
    c = fixture()
    way = lambda part: np.sign(compose._signed_area(part.contours[0].light))
    acute = marks.bundled(ACUTE)
    turned = marks._wound(acute, compose.Part([marks._reversed(c.font.glyph("一").contours[0])]))
    assert way(marks._wound(acute, c.font.glyph("一"))) == way(c.font.glyph("一"))
    assert way(turned) == -way(marks._wound(acute, c.font.glyph("一")))
    # Turned round, a contour draws the same shape.
    place = lambda part: [compose.Placed(part, part.box, (0.0, 0.0, 800.0, 800.0))]
    assert (compose.raster(place(turned)) == compose.raster(place(acute))).all()
    assert len(turned.contours[0].light) >= len(acute.contours[0].light)
