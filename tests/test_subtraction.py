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


def two_part_fixture(hosted=True):
    """明 drawn as two outlines, 日 on the left and 月 on the right, with its sequence."""
    def box(x0, x1):
        points = np.array([[x0, 0], [x1, 0], [x1, 100], [x0, 100]], dtype=float)
        return compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())
    left, right = box(0, 40), box(60, 100)
    glyphs = {"明": compose.Part([left, right]), "日": compose.Part([box(0, 100)]), "月": compose.Part([box(0, 101)])}
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {"明": "⿰日月", "語": "⿰言吾", "吾": "⿱五口"}, hosted=hosted, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    return c, left, right


def test_paths_lead_to_every_node_written_as_wanted():
    tree = compose.parse("⿰木⿱口⿰木口")
    assert compose._paths(tree, "木") == [(0,), (1, 1, 0)]
    assert compose._paths(tree, "⿰木口") == [(1, 1)]
    assert compose._paths(tree, "日") == []


def test_a_component_the_sequence_names_is_left_out_of_the_glyph():
    c, left, right = two_part_fixture()
    asked = []

    def host(char, tree, path, strict=True):
        asked.append((char, compose.key(tree), path))
        return compose.Host(char, [compose.Part([left]), compose.Part([right])], (0, 0, 100, 100), 20.0, whole=True)
    c._host_node = host
    c.likeness = lambda part, node: 1.0
    placed = c.compose("㇯明月")
    assert asked[0] == ("明", "⿰日月", ())
    assert [(p.origin, p.cut) for p in placed] == [("glyph 明", False)]
    assert placed[0].part.contours == [left]
    # Its strokes are as dense as the whole glyph drew them.
    assert placed[0].native == c.ink("明")
    assert compose.svg_path(placed, cut=True) == ""
    kept = c.compose("㇯明日")
    assert kept[0].part.contours == [right]


def test_a_glyph_that_does_not_cut_there_is_masked_instead():
    c, _, _ = two_part_fixture()
    c._host_node = lambda char, tree, path, strict=True: None
    assert [(p.origin, p.cut) for p in c.compose("㇯明月")] == [("glyph 明", False), ("glyph 月", True)]


def test_a_component_the_sequence_does_not_name_is_masked_instead():
    c, left, right = two_part_fixture()
    c._host_node = lambda char, tree, path, strict=True: compose.Host(char, [compose.Part([left]), compose.Part([right])], (0, 0, 100, 100), 20.0)
    assert [(p.origin, p.cut) for p in c.compose("㇯明明")] == [("glyph 明", False), ("glyph 明", True)]


def test_an_excluded_character_is_not_cut():
    c, left, right = two_part_fixture()
    c._host_node = lambda char, tree, path, strict=True: compose.Host(char, [compose.Part([left]), compose.Part([right])], (0, 0, 100, 100), 20.0)
    c.exclude = {"明"}
    assert c._without("明", "月") is None


def kanjivg_cutter(owners):
    from han_compose import kanjivg_cuts as K

    def box(x0):
        points = np.array([[x0, 0], [x0 + 10, 0], [x0 + 10, 100], [x0, 100]], dtype=float)
        return compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())
    glyph = compose.Part([box(0), box(20), box(40), box(60)])
    cutter = object.__new__(K.Cutter)
    cutter.c = SimpleNamespace(font=SimpleNamespace(glyph=lambda ch: glyph), bases={})
    cutter._bases_of = {}
    root = K.Group("鹿", None, [], [K.Group("广", "tare", [0, 1]), K.Group("比", None, [2, 3])])
    cutter.entries = {"鹿": K.Entry(root, ["M0 0"] * 4)}
    cutter._owners = {"鹿": owners}
    return cutter, glyph


def test_kanjivg_names_the_strokes_to_leave_out():
    cutter, glyph = kanjivg_cutter([{0}, {1}, {2}, {3}])
    assert cutter.less("鹿", "比").contours == glyph.contours[:2]
    assert cutter.less("鹿", "广").contours == glyph.contours[2:]
    assert cutter.less("鹿", "木") is None
    assert cutter.less("鹿", "鹿") is None
    assert cutter.less("馬", "灬") is None


def test_an_outline_holding_strokes_of_both_sides_is_not_cut():
    cutter, _ = kanjivg_cutter([{0}, {1, 2}, {2}, {3}])
    assert cutter.less("鹿", "比") is None


def test_a_sketch_masks_and_cuts_no_host():
    c, _, _ = two_part_fixture(hosted=False)
    c._host_node = lambda *a, **k: (_ for _ in ()).throw(AssertionError("a sketch cut a host"))
    assert [(p.origin, p.cut) for p in c.compose("㇯明月")] == [("glyph 明", False), ("glyph 月", True)]


def test_a_component_is_found_as_written_before_it_is_written_out():
    c, _, _ = two_part_fixture()
    as_written = compose.parse("⿰言吾")
    assert c._named("語", "吾") == [(as_written, (1,))]
    assert c._named("語", "五") == [(compose.parse("⿰言⿱五口"), (1, 0))]
    assert c._named("語", "木") == []
    assert c._named("日", "一") == []


def test_of_two_pieces_alike_the_later_goes():
    c, left, right = two_part_fixture()
    c.sequences["明"] = "⿰日日"
    c._host_node = lambda char, tree, path, strict=True: compose.Host(char, [compose.Part([left]), compose.Part([right])], (0, 0, 100, 100), 20.0)
    c.likeness = lambda part, node: 1.0
    assert c._without("明", "日").contours == [left]
    c.likeness = lambda part, node: 1.0 if part.contours[0] is left else 0.5
    assert c._without("明", "日").contours == [right]


def test_the_guide_leaves_what_is_left_of_a_glyph_alone():
    from han_compose import compose_guide

    c, left, right = two_part_fixture()
    c._host_node = lambda char, tree, path, strict=True: compose.Host(char, [compose.Part([left]), compose.Part([right])], (0, 0, 100, 100), 20.0)
    c.likeness = lambda part, node: 1.0
    placed = c.compose("㇯明月")
    assert not any(p.cut for p in placed)
    assert compose_guide.Guide([]).fit(c, "㇯明月", placed) is placed


def test_a_component_kanjivg_draws_in_pieces_goes_whole():
    from han_compose import kanjivg_cuts as K

    cutter, glyph = kanjivg_cutter([{0}, {1}, {2}, {3}])
    root = K.Group("哀", None, [], [K.Group("衣", None, [0], part="1"), K.Group("口", None, [1, 2]), K.Group("衣", None, [3], part="2")])
    cutter.entries["哀"] = K.Entry(root, ["M0 0"] * 4)
    cutter._owners["哀"] = [{0}, {1}, {2}, {3}]
    assert cutter.less("哀", "衣").contours == glyph.contours[1:3]
    # One piece sharing an outline with the rest leaves the component uncut, not half removed.
    cutter._owners["哀"] = [{0}, {1}, {2, 3}, {3}]
    assert cutter.less("哀", "衣") is None


def test_of_several_whole_components_the_last_clean_one_goes():
    from han_compose import kanjivg_cuts as K

    cutter, glyph = kanjivg_cutter([{0}, {1}, {2}, {3}])
    root = K.Group("林", None, [], [K.Group("木", None, [0, 1]), K.Group("木", None, [2, 3])])
    cutter.entries["林"] = K.Entry(root, ["M0 0"] * 4)
    cutter._owners["林"] = [{0}, {1}, {2}, {3}]
    assert cutter.less("林", "木").contours == glyph.contours[:2]
    cutter._owners["林"] = [{0}, {1}, {2}, {3, 1}]
    assert cutter.less("林", "木") is None
    cutter._owners["林"] = [{0}, {1}, {2, 9}, {3}]
    assert cutter.less("林", "木").contours == glyph.contours[2:]


def typed_cutter(types, owners=None):
    from han_compose import kanjivg_cuts as K

    cutter, glyph = kanjivg_cutter(owners or [{0}, {1}, {2}, {3}])
    root = K.Group("兵", None, [0, 1, 2, 3])
    cutter.entries["兵"] = K.Entry(root, ["M0 0"] * 4, types)
    cutter._owners["兵"] = owners or [{0}, {1}, {2}, {3}]
    return cutter, glyph


def test_a_lone_stroke_is_the_one_kanjivg_types_so():
    cutter, glyph = typed_cutter(["㇒", "㇐a", "㇑", "㇔/㇏"])
    assert cutter.less("兵", "丶").contours == glyph.contours[:3]
    assert cutter.less("兵", "㇏").contours == glyph.contours[:3]
    assert cutter.less("兵", "一").contours == [glyph.contours[0], *glyph.contours[2:]]
    assert cutter.less("兵", "丿").contours == glyph.contours[1:]
    assert cutter.less("兵", "㇒").contours == glyph.contours[1:]
    assert cutter.less("兵", "乚") is None


def test_a_stroke_type_the_character_has_twice_is_not_guessed():
    cutter, _ = typed_cutter(["㇐", "㇑", "㇐b", "㇑a"])
    assert cutter.less("兵", "一") is None
    assert cutter.less("兵", "丨") is None


def test_a_stroke_sharing_its_outline_is_not_cut():
    cutter, _ = typed_cutter(["㇒", "㇐", "㇑", "㇔"], [{0}, {1}, {2, 3}, {3}])
    assert cutter.less("兵", "丶") is None


def test_stroke_types_read_forms_and_alternatives():
    from han_compose.kanjivg_cuts import _stroke_types

    assert _stroke_types("㇑a") == ["㇑"]
    assert _stroke_types("㇔/㇏") == ["㇔", "㇏"]
    assert _stroke_types("") == [""]


def test_what_a_port_reads_is_every_name_kanjivg_takes_out_and_the_outlines_that_go():
    cutter, glyph = kanjivg_cutter([{0}, {1}, {2}, {3}])
    assert cutter.taken("鹿") == {"广": [0, 1], "比": [2, 3]}
    assert cutter.taken("馬") == {}
    for name, gone in cutter.taken("鹿").items():
        kept = cutter.less("鹿", name).contours
        assert kept == [c for k, c in enumerate(glyph.contours) if k not in gone]


def test_a_stroke_is_listed_by_its_type_and_by_the_character_written_for_it():
    cutter, _ = typed_cutter(["㇒", "㇐a", "㇑", "㇔/㇏"])
    assert cutter.taken("兵") == {"㇐": [1], "一": [1], "㇑": [2], "丨": [2], "㇒": [0], "丿": [0], "㇔": [3], "丶": [3], "㇏": [3]}
    # A type the character has twice, or a stroke sharing its outline, is not listed.
    cutter, _ = typed_cutter(["㇐", "㇑", "㇐b", "㇔"], [{0}, {1}, {2, 3}, {3}])
    assert cutter.taken("兵") == {"㇑": [1], "丨": [1]}


def test_a_component_is_listed_under_the_forms_and_bases_the_table_gives_it():
    cutter, _ = kanjivg_cutter([{0}, {1}, {2}, {3}])
    cutter.c.bases = {"⺇": ["比"]}
    cutter._bases_of = {"庀": {"广"}}
    assert cutter.taken("鹿") == {"广": [0, 1], "庀": [0, 1], "比": [2, 3], "⺇": [2, 3]}
    assert cutter.less("鹿", "⺇").contours == cutter.less("鹿", "比").contours
