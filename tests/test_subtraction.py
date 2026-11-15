CHARS = '木口一'
from types import SimpleNamespace

import numpy as np

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


def test_subtraction_draws_the_first_operand_and_cuts_the_second_where_it_lies():
    c = fixture()
    placed = c.compose("㇯木口")
    assert [(p.origin, p.cut) for p in placed] == [("glyph 木", False), ("glyph 口", True)]
    assert compose.svg_path(placed) == compose.svg_path(c.compose("木"))
    assert compose.svg_path(placed, cut=True) == compose.svg_path(c.compose("口"))


def test_a_drawing_without_subtraction_has_no_cut():
    c = fixture()
    placed = c.compose("⿰木口")
    assert compose.svg_path(placed, cut=True) == ""
    assert "mask" not in compose.svg(placed)


def test_subtraction_is_masked_out_of_the_document_and_the_raster():
    c = fixture()
    placed = c.compose("⿰木㇯口一")
    ink, taken = compose.svg_path(placed), compose.svg_path(placed, cut=True)
    assert compose.svg(placed) == (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">'
        '<mask id="cut"><rect x="0" y="0" width="1000" height="1000" fill="#fff"/>'
        f'<path d="{taken}" fill="#000"/></mask><path d="{ink}" mask="url(#cut)"/></svg>')
    kept = [p for p in placed if not p.cut]
    cut = [compose.Placed(p.part, p.source, p.target, p.weight) for p in placed if p.cut]
    assert cut and kept
    assert (compose.raster(placed) == (compose.raster(kept) & ~compose.raster(cut))).all()
    assert compose.raster(placed).sum() < compose.raster(kept).sum()


def test_a_cut_inside_a_row_stays_in_its_own_half():
    c = fixture()
    placed = c.compose("⿰木㇯口一")
    assert [(p.origin, p.cut) for p in placed] == [("glyph 木", False), ("glyph 口", False), ("glyph 一", True)]
    centre = lambda p: (p.target[0] + p.target[2]) / 2
    assert centre(placed[0]) < 500 < centre(placed[1])
    assert centre(placed[2]) > 500


def test_a_subtraction_has_no_reference_sketch():
    c = fixture()
    assert c._sketch(compose.parse("⿰木口")) is not None
    assert c._sketch(compose.parse("㇯木口")) is None


def test_the_guide_leaves_a_drawing_with_a_cut_as_the_layout_placed_it():
    from han_compose import compose_guide

    c = fixture()
    placed = c.compose("㇯木口")
    assert compose_guide.Guide([]).fit(c, "㇯木口", placed) is placed


def test_the_bench_measures_ink_less_the_cut():
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location("compose_ids", Path(__file__).parents[1] / "scripts" / "compose_ids.py")
    script = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(script)
    c = fixture()
    placed = c.compose("㇯木口")
    kept = [p for p in placed if not p.cut]
    assert script._aligned_overlap(placed, kept, 64) < script._aligned_overlap(kept, kept, 64) == 1.0
