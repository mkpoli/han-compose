from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose

H, A, N, D, ARAEA, L, O, K, S, EO = "\u1112", "\u1161", "\u11ab", "\u1103", "\u119e", "\u11af", "\u1169", "\u11a8", "\u11ba", "\u1165"
SSANG = "\u1100\u1100"
#: An initial no modern syllable has (U+1140): its runs stay runs.
Z = "\u1140"


def fixture():
    glyphs = {}
    for i, ch in enumerate(["木", "한", H, A, N, D, ARAEA, L, O, K, S, EO, "\u1100", Z]):
        size = 90 if ch == ARAEA else 400 + i
        points = np.array([[0, 0], [size, 0], [size, size], [0, size]], dtype=float)
        glyphs[ch] = compose.Part([compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())])
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs, own=lambda ch: ch in glyphs,
                           stem=((60, 120), (60, 120)), width=lambda density, axis: 60.0)
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    return c


def share(c, part):
    """A part's box as shares of the face, y up."""
    x0, y0, x1, y1 = c.face
    box = part.target
    return ((box[0] - x0) / (x1 - x0), (box[1] - y0) / (y1 - y0), (box[2] - x0) / (x1 - x0), (box[3] - y0) / (y1 - y0))


def test_a_syllable_written_as_jamo_is_the_syllable_where_a_code_point_spells_it():
    assert compose.parse(H + A + N) == "한"
    assert compose.parse("⿰木" + H + A + N) == ("⿰", "木", "한")
    assert [p.origin for p in fixture().compose(H + A + N)] == ["glyph 한"]


def test_a_run_no_code_point_spells_is_one_component():
    assert compose.parse(D + ARAEA) == D + ARAEA
    assert compose.parse("⿰木" + D + ARAEA + L) == ("⿰", "木", D + ARAEA + L)
    assert compose.is_jamo_run(D + ARAEA) and compose.is_jamo_run(H + A + K + S)
    assert not compose.is_jamo_run(D) and not compose.is_jamo_run("한") and not compose.is_jamo_run(D + "木")


@pytest.mark.parametrize("text", [D, A, N, "\u115f" + A, D + "\u1160"])
def test_a_lone_jamo_or_a_filler_starts_no_run(text):
    assert not compose.is_jamo_run(text)
    assert compose.jamo_class("\u115f") is None and compose.jamo_class("\u1160") is None


def test_a_run_followed_by_a_variation_selector_is_kept_as_written():
    assert compose.parse(H + A + N + "\ufe00") == H + A + N + "\ufe00"
    assert compose.parse(D + ARAEA + "\ufe00") == D + ARAEA + "\ufe00"


def test_a_medial_written_beside_its_initial_stands_right_of_it():
    c = fixture()
    initial, medial, final, second = c.compose(H + A + K + S)
    assert [p.origin for p in (initial, medial, final, second)] == [f"glyph {ch}" for ch in (H, A, K, S)]
    assert share(c, initial)[2] <= 0.50 + 1e-9 and share(c, medial)[0] >= 0.50 - 1e-9
    # The finals share the foot of the block, left to right.
    assert share(c, final)[3] <= 0.32 + 1e-9 and share(c, second)[3] <= 0.32 + 1e-9
    assert share(c, final)[2] <= share(c, second)[0] + 1e-9
    assert share(c, initial)[1] >= 0.24 - 1e-9


def test_a_medial_written_under_its_initial_stands_below_it():
    c = fixture()
    initial, medial = c.compose(Z + O)
    assert share(c, medial)[3] <= share(c, initial)[1] + 0.2
    assert share(c, medial)[1] < share(c, initial)[1]
    initial, medial, final = c.compose(Z + O + N)
    assert share(c, initial)[1] >= 0.54 - 1e-9
    assert 0.34 - 1e-9 <= share(c, medial)[1] and share(c, medial)[3] <= 0.56 + 1e-9
    assert share(c, final)[3] <= 0.32 + 1e-9


def test_araea_is_a_dot_of_its_own_size_under_the_initial():
    c = fixture()
    for run, foot in ((D + ARAEA, 0.04), (D + ARAEA + L, 0.40)):
        dot = c.compose(run)[1]
        x0, y0, x1, y1 = c.face
        side = min(x1 - x0, y1 - y0) * 0.15
        assert dot.origin == f"glyph {ARAEA}" and dot.fixed
        assert dot.target[2] - dot.target[0] == pytest.approx(side) and dot.target[3] - dot.target[1] == pytest.approx(side)
        assert (dot.target[0] + dot.target[2]) / 2 == pytest.approx((x0 + x1) / 2)
        assert share(c, dot)[1] == pytest.approx(foot)


def test_the_weight_pass_leaves_a_fixed_part_as_it_was_placed():
    c = fixture()
    c.weighted = True
    side = min(c.face[2] - c.face[0], c.face[3] - c.face[1]) * 0.15
    dot = c.compose(D + ARAEA)[1]
    assert dot.fixed and dot.weight == (0.0, 0.0)
    assert dot.target[2] - dot.target[0] == pytest.approx(side)
    # The same part unfixed is brought to a stroke's width.
    loose = compose.Placed(dot.part, dot.source, dot.target)
    c._balance([loose])
    assert loose.target[2] - loose.target[0] != pytest.approx(side)
    fixed = compose.Placed(dot.part, dot.source, dot.target, fixed=True)
    c._balance([fixed])
    assert fixed.target == dot.target and fixed.weight == (0.0, 0.0)


def test_the_guide_leaves_a_fixed_part_as_it_was_placed():
    from han_compose import compose_guide

    c = fixture()
    placed = c.compose(D + ARAEA)
    guide = object.__new__(compose_guide.Guide)
    guide.ink = lambda composer, sequence, parts: np.ones((compose_guide.SIZE, compose_guide.SIZE))
    fitted = guide.fit(c, D + ARAEA, placed)
    assert fitted[-1] is placed[1]
    assert not any(part.fixed for part in fitted[:-1])


def test_two_medials_share_the_medials_place():
    c = fixture()
    initial, first, second = c.compose(Z + A + EO)
    assert share(c, initial)[2] <= share(c, first)[0] + 0.03
    assert share(c, first)[2] <= share(c, second)[0] + 1e-9
    assert share(c, second)[2] <= 0.98 + 1e-9


def test_two_initials_share_the_initials_place():
    c = fixture()
    first, second, medial = c.compose(SSANG + EO)
    assert share(c, first)[2] <= share(c, second)[0] + 1e-9
    assert share(c, second)[2] <= 0.52 + 1e-9 <= share(c, medial)[0] + 0.03


def test_a_run_inside_a_sequence_is_drawn_in_its_operands_region():
    c = fixture()
    tree, placed = compose.parse("⿰木" + D + ARAEA), c.compose("⿰木" + D + ARAEA)
    assert tree == ("⿰", "木", D + ARAEA)
    assert [p.origin for p in placed] == ["glyph 木", f"glyph {D}", f"glyph {ARAEA}"]
    assert placed[0].target[2] <= placed[1].target[0] + 1 and placed[0].target[2] <= placed[2].target[0] + 1
