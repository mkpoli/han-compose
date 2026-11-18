from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose


@pytest.mark.parametrize("inner", ["黑", "鬼", "面", "甲", "食"])
def test_yan_enclosure_places_dog_above_inner_part(inner):
    sequences = {"厌": "⿸厂犬"}
    c = compose.Composer(SimpleNamespace(own=lambda _: True), sequences)
    c.__dict__["_index"] = ({("⿸0", "厌"): [("魇", ("⿸", "厌", "鬼"), (), 0)]}, {})
    source = ("⿸", "厌", inner)
    assert c._respelled(source) == ("⿸", "厂", ("⿱", "犬", inner))
    assert source == ("⿸", "厌", inner)
    assert sequences == {"厌": "⿸厂犬"}


def test_a_corner_character_under_a_corner_stacks_its_inner_parts():
    c = compose.Composer(None, {"麻": "⿸广林", "原": "⿸厂泉", "厭": "⿸厂猒"})
    assert c._respelled(compose.parse("⿸麻石")) == ("⿸", "广", ("⿱", "林", "石"))
    assert c._respelled(compose.parse("⿸原心")) == ("⿸", "厂", ("⿱", "泉", "心"))
    tree = compose.parse("⿱厭黑")
    assert c._respelled(tree) == tree


def test_rendering_normalisation_does_not_follow_cyclic_or_malformed_sources():
    c = compose.Composer(None, {"甲": "⿸乙口", "乙": "⿸甲木", "厌": "⿸厂"})
    for source in ("⿸甲日", "⿸厌黑"):
        tree = compose.parse(source)
        assert c._respelled(tree) == tree


def rectangle(box):
    x0, y0, x1, y1 = box
    points = np.array([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], dtype=float)
    return compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())


def test_yan_respelling_preserves_permitted_whole_only_glyph():
    whole = compose.Part([rectangle((0, 0, 100, 100))])
    font = SimpleNamespace(glyph=lambda ch: whole if ch == "魇" else None,
                           has=lambda ch: ch == "魇", own=lambda ch: ch == "魇")
    c = compose.Composer(font, {"魇": "⿸厌鬼", "厌": "⿸厂犬"}, hosted=False, weighted=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    original = compose.parse("⿸厌鬼")
    assert c._node(original, c.face, at_root=True)[0].part is whole
    result = c.compose("⿸厌鬼")
    assert len(result) == 1
    assert result[0].part is whole
    assert result[0].origin == "glyph 魇"


@pytest.mark.parametrize("nested", [False, True])
@pytest.mark.parametrize("mode", ["permitted", "excluded", "spelled"])
def test_yan_identity_and_rendering_with_components(monkeypatch, nested, mode):
    glyphs = {ch: compose.Part([rectangle((0, 0, 100, 100))]) for ch in "魇犬鬼木"}
    glyphs["厂"] = compose.Part([rectangle((0, 0, 10, 100)), rectangle((0, 90, 100, 100))])
    requested = []

    def glyph(ch):
        requested.append(ch)
        if mode == "excluded" and ch == "魇":
            raise AssertionError("excluded target glyph requested")
        return glyphs.get(ch)

    font = SimpleNamespace(glyph=glyph, has=lambda ch: ch in glyphs, own=lambda ch: ch in glyphs,
                           stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {"魇": "⿸厌鬼", "厌": "⿸厂犬"},
                         hosted=False, weighted=False, reuse=False,
                         exclude={"魇"} if mode == "excluded" else set())
    c.__dict__["spelled"] = {"⿸厌鬼"} if mode == "spelled" else set()
    c.__dict__["atomic"] = set()
    instances = []
    monkeypatch.setattr(c, "_instance", lambda node, region: instances.append(compose.key(node)))
    original_respelled = c._respelled
    changed = []

    def respelled(node):
        result = original_respelled(node)
        if result != node:
            changed.append((node, result))
        return result

    monkeypatch.setattr(c, "_respelled", respelled)
    result = c.compose("⿰木⿸厌鬼" if nested else "⿸厌鬼")
    prefix = ["glyph 木"] if nested else []
    assert [p.origin for p in result] == prefix + (
        ["glyph 魇"] if mode == "permitted" else ["glyph 厂", "glyph 犬", "glyph 鬼"])
    if mode == "permitted":
        assert result[-1].part is glyphs["魇"]
        assert changed == []
    else:
        assert changed == [(("⿸", "厌", "鬼"), ("⿸", "厂", ("⿱", "犬", "鬼")))]
    if mode == "excluded":
        assert "魇" not in requested
    if mode == "spelled":
        assert "⿸厌鬼" not in instances
        assert "⿸厂⿱犬鬼" not in instances
    assert c.sequences == {"魇": "⿸厌鬼", "厌": "⿸厂犬"}


def fitting_geometry():
    outer = compose.Part([rectangle((0, 0, 10, 100)), rectangle((0, 90, 100, 100))])
    inner = compose.Part([rectangle((0, 0, 20, 20))])
    return [compose.Placed(outer, outer.box, outer.box)], [compose.Placed(inner, inner.box, (40, 40, 60, 60))]


@pytest.mark.parametrize("room, expected", [
    (None, (34.375, 33.625, 66.375, 65.625)),
    ((20, 20, 80, 80), (34.375, 33.625, 66.375, 65.625)),
    ((40, 40, 60, 60), (40.625, 39.375, 60.625, 59.375)),
])
def test_default_enclosure_fit_preserves_placement(room, expected):
    outer, inner = fitting_geometry()
    compose._fit_inside(outer, inner, (0, 0, 100, 100), 4, room=room)
    assert inner[0].target == pytest.approx(expected)


def test_blocked_anchor_preserves_scale_and_clearance():
    outer, anchored = fitting_geometry()
    _, default = fitting_geometry()
    region = (0, 0, 100, 100)
    room = (40, 40, 60, 60)
    compose._fit_inside(outer, default, region, 4, room=room)
    compose._fit_inside(outer, anchored, region, 4, room=room, anchor=(5, 95))
    a, b = anchored[0].target, default[0].target
    assert (a[2] - a[0], a[3] - a[1]) == pytest.approx((b[2] - b[0], b[3] - b[1]))
    assert a[0] > 10 and a[3] < 90
    assert compose._collision(outer, anchored, region) == 0
    centre = lambda t: np.array([(t[0] + t[2]) / 2, (t[1] + t[3]) / 2])
    assert np.linalg.norm(centre(a) - (5, 95)) < np.linalg.norm(centre(b) - (5, 95))


@pytest.mark.parametrize("nested", [False, True])
@pytest.mark.parametrize("mode", ["bare-refit", "hosted-refit", "missing-host"])
def test_learned_anchor_only_applies_to_hosted_refit_bare_fallback(monkeypatch, nested, mode):
    c = compose.Composer(SimpleNamespace(own=lambda _: False, stem=((4, 4),)), {})
    c._faces[None] = ((0, 0, 100, 100), set())
    boxes = [(0, 0, 100, 100), (0, 0, 25, 25)]
    c.layout = SimpleNamespace(predict=lambda *args: list(boxes))
    source = SimpleNamespace(box=(0, 0, 100, 10) if mode == "bare-refit" else (0, 0, 40, 40))
    host = compose.Host("donor", [source], c.face, 0)
    monkeypatch.setattr(c, "_host", lambda op, i, *args, **kwargs:
                        None if i == 1 and mode == "missing-host" else (host, 0))
    region = (100, 100, 150, 150) if nested else None
    opening = (110, 110, 145, 145) if nested else (20, 20, 90, 90)
    monkeypatch.setattr(c, "_room", lambda *args: opening)
    monkeypatch.setattr(c, "ink", lambda *args: 1.0)
    monkeypatch.setattr(c, "_node", lambda child, box:
                        [compose.Placed(source, source.box, box, origin=f"glyph {child}")])
    calls = []
    monkeypatch.setattr(compose, "_fit_inside", lambda outer, inner, region, stem, **kwargs:
                        calls.append((inner[0].target, kwargs)))
    c._learned("⿸", ["A", "B"], region)
    assert len(calls) == 1
    target, kwargs = calls[0]
    expected = (106.25, 106.25) if nested else (12.5, 12.5)
    assert kwargs.get("anchor") == (expected if mode == "bare-refit" else None)
    if mode == "bare-refit":
        assert target == compose._shrunk(opening, compose.OPENING_SHARE)
        assert kwargs["room"] == target


CORNER_FACE = (0, 0, 100, 100)
COMPOUND_OUTER = ("⿱", "A", "B")


def compound_corner_fixture(monkeypatch, inner_top=50.4, spy_fit=True):
    outer = compose.Part([rectangle((0, 0, 10, 100)), rectangle((0, 50, 100, 60))])
    inner = compose.Part([rectangle((20, 40, 80, inner_top))])
    c = compose.Composer(SimpleNamespace(own=lambda _: False, stem=((4, 4),)), {})
    c._faces[None] = (CORNER_FACE, set())
    c.layout = SimpleNamespace(predict=lambda *args: [outer.box, inner.box])
    hosts = [compose.Host("outer", [outer], CORNER_FACE, 0), compose.Host("inner", [inner], CORNER_FACE, 0)]
    monkeypatch.setattr(c, "_host", lambda op, i, *args, **kwargs: (hosts[i], 0))
    monkeypatch.setattr(c, "_room", lambda op, outer, region: region)
    monkeypatch.setattr(c, "ink", lambda *args: 1.0)
    fits = []
    if spy_fit:
        monkeypatch.setattr(compose, "_fit_inside", lambda outer, inner, region, stem, **kwargs:
                            fits.append((inner[0].target, region, stem, kwargs)))
    return c, outer, inner, fits


def test_thin_overlap_uses_predicted_box_and_256px_fitter(monkeypatch):
    c, outer, inner, fits = compound_corner_fixture(monkeypatch)
    a = [compose.Placed(outer, outer.box, outer.box)]
    b = [compose.Placed(inner, inner.box, inner.box)]
    assert compose._collision(a, b, CORNER_FACE, size=64) == 0
    assert compose._collision(a, b, CORNER_FACE, size=256) > compose.COLLIDE
    c._learned("⿸", [COMPOUND_OUTER, "C"])
    assert fits == [(inner.box, CORNER_FACE, 4, {"size": 256, "room": inner.box})]


def test_real_fit_clears_thin_overlap_without_enlarging_predicted_box(monkeypatch):
    c, _, inner, _ = compound_corner_fixture(monkeypatch, spy_fit=False)
    result = c._learned("⿸", [COMPOUND_OUTER, "C"])
    assert compose._collision(result[:1], result[1:], CORNER_FACE, size=256) == 0
    assert [p.origin for p in result] == ["learned outer", "learned inner"]
    assert result[1].part is inner
    for axis in (0, 1):
        assert result[1].target[axis + 2] - result[1].target[axis] <= inner.box[axis + 2] - inner.box[axis] + 1e-9


@pytest.mark.parametrize("nested", [False, True])
def test_compound_corner_fit_uses_local_predicted_box(monkeypatch, nested):
    c, _, inner, fits = compound_corner_fixture(monkeypatch)
    monkeypatch.setattr(compose, "_collision", lambda *args, **kwargs: 0.1)
    region = (100, 100, 150, 150) if nested else None
    c._learned("⿸", [COMPOUND_OUTER, "C"], region)
    expected = compose.mapped(inner.box, CORNER_FACE, region) if nested else inner.box
    assert fits == [(expected, region or CORNER_FACE, 4, {"size": 256, "room": expected})]


@pytest.mark.parametrize("op, outer_node, expected_size", [
    ("⿸", COMPOUND_OUTER, 256), ("⿸", "A", None),
    ("⿴", COMPOUND_OUTER, 64), ("⿵", COMPOUND_OUTER, 64), ("⿶", COMPOUND_OUTER, 64),
    ("⿷", COMPOUND_OUTER, 64), ("⿺", COMPOUND_OUTER, 64), ("⿹", COMPOUND_OUTER, None),
])
@pytest.mark.parametrize("collision", [0.0, compose.COLLIDE, compose.COLLIDE + 0.001])
def test_compound_corner_scope_resolution_threshold_and_existing_fit(monkeypatch, op, outer_node, expected_size, collision):
    c, _, inner, fits = compound_corner_fixture(monkeypatch)
    samples = []
    def measure(outer, inner, region, size=64):
        samples.append(size)
        return collision
    monkeypatch.setattr(compose, "_collision", measure)
    c._learned(op, [outer_node, "C"])
    assert samples == ([] if expected_size is None else [expected_size])
    assert len(fits) == int(expected_size is not None and collision > compose.COLLIDE)
    if fits:
        assert fits[0][3] == ({"size": 256, "room": inner.box} if expected_size == 256
                              else {"room": compose._shrunk(CORNER_FACE, compose.OPENING_SHARE)})


def test_clear_compound_corner_keeps_direct_placement(monkeypatch):
    c, outer, inner, fits = compound_corner_fixture(monkeypatch, inner_top=49)
    result = c._learned("⿸", [COMPOUND_OUTER, "C"])
    assert fits == []
    assert [p.target for p in result] == [outer.box, inner.box]


def test_hand_forms_follow_kanjivg_stroke_order():
    forms = compose.hand_forms()
    assert forms["右"] == forms["有"] == forms["布"] == "丿"
    assert forms["左"] == forms["友"] == "一"


@pytest.mark.parametrize("inner", ["氵", "⬚", ("⿱", "木", "口")])
def test_xing_enclosure_opens_around_inner_operand(inner):
    c = compose.Composer(None, {})
    source = ("⿴", "行", inner)
    assert c._respelled(source) == ("⿲", "彳", inner, "亍")
    assert source == ("⿴", "行", inner)
    for other in (("⿵", "行", inner), ("⿴", "囗", inner), "行"):
        assert c._respelled(other) == other


@pytest.mark.parametrize("nested", [False, True])
def test_xing_enclosure_draws_as_three_columns(nested):
    glyphs = {ch: compose.Part([rectangle((0, 0, 100, 100))]) for ch in "彳亍氵木"}
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    prefix = "⿱木" if nested else ""
    actual = c.compose(prefix + "⿴行氵")
    expected = c.compose(prefix + "⿲彳氵亍")
    assert [p.origin for p in actual] == [p.origin for p in expected]
    if not nested:
        assert [p.target for p in actual] == [p.target for p in expected]
    # A parent still measures its original operand (行); its allocation can differ.
    left, middle, right = actual[-3:]
    assert left.target[0] < middle.target[0] < right.target[0]


@pytest.mark.parametrize("outer,rendered", [
    ("⿸𭤨", "⿰方⿱𠂉{inner}"),
    ("⿴衣", "⿳亠{inner}𧘇"),
    ("⿴弜", "⿲弓{inner}弓"),
    ("⿴玨", "⿲𤣩{inner}王"),
    ("⿴辡", "⿲辛{inner}辛"),
    ("⿴雔", "⿲隹{inner}隹"),
    ("⿴𨺅", "⿲𨸏{inner}⿾𨸏"),
    ("⿴⿰𨸏⿾𨸏", "⿲𨸏{inner}⿾𨸏"),
    ("⿹頃", "⿰⿱匕{inner}頁"),
    ("⿴㗊", "⿳吅{inner}吅"),
    ("⿸倝", "⿰𠦝⿱𠆢{inner}"),
    ("⿶𩰲", "⿱⿲弓{inner}弓鬲"),
    ("⿹𣪊", "⿰⿱⿳士冖一{inner}殳"),
    ("⿶𲻋", "⿳⿴𦥑{inner}一八"),
    ("⿶⿳𦥑一八", "⿳⿴𦥑{inner}一八"),
])
@pytest.mark.parametrize("inner", ["米", "几", "⬚", "⿱木口"])
def test_disconnected_enclosures_keep_source_description(outer, rendered, inner):
    c = compose.Composer(None, {})
    source = compose.parse(outer + inner)
    assert c._respelled(source) == compose.parse(rendered.format(inner=inner))
    assert compose.key(source) == outer + inner


@pytest.mark.parametrize("source,explicit", [
    ("⿸𭤨其", "⿰方⿱𠂉其"), ("⿴衣果", "⿳亠果𧘇"),
    ("⿴弜米", "⿲弓米弓"), ("⿴玨文", "⿲𤣩文王"),
    ("⿴辡言", "⿲辛言辛"), ("⿴雔言", "⿲隹言隹"),
    ("⿴𨺅木", "⿲𨸏木⿾𨸏"), ("⿴⿰𨸏⿾𨸏木", "⿲𨸏木⿾𨸏"),
    ("⿹頃禾", "⿰⿱匕禾頁"), ("⿴㗊犬", "⿳吅犬吅"),
    ("⿸倝羽", "⿰𠦝⿱𠆢羽"),
    ("⿶𩰲米", "⿱⿲弓米弓鬲"), ("⿹𣪊几", "⿰⿱⿳士冖一几殳"),
])
def test_disconnected_enclosure_rendering(source, explicit):
    glyphs = {ch: compose.Part([rectangle((0, 0, 100, 100))]) for ch in "弓米鬲士冖一几殳方𠂉其亠𧘇果𤣩王文辛言隹木𨸏匕頁吅𠦝𠆢羽犬禾"}
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    actual, expected = c.compose(source), c.compose(explicit)
    assert [p.origin for p in actual] == [p.origin for p in expected]
    assert [p.target for p in actual] == [p.target for p in expected]


def test_mirror_reflects_both_masters_without_mutating_cached_glyph():
    contour = rectangle((0, 0, 100, 100))
    contour.light[1, 0] = 70
    contour.heavy = contour.light + np.array([3, 4])
    original = contour.light.copy(), contour.heavy.copy()
    glyph = compose.Part([contour])
    font = SimpleNamespace(glyph=lambda _: glyph, has=lambda _: True, own=lambda _: True)
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    region = (120, 20, 520, 620)
    plain = c._node("𨸏", region)[0]
    mirrored = c._node(("⿾", "𨸏"), region)[0]
    plain.weight = mirrored.weight = (0.3, 0.6)
    expected = plain.contours()[0].copy()
    expected[:, 0] = region[0] + region[2] - expected[:, 0]
    np.testing.assert_allclose(mirrored.contours()[0], expected)
    np.testing.assert_array_equal(contour.light, original[0])
    np.testing.assert_array_equal(contour.heavy, original[1])
    twice = c._node(("⿾", ("⿾", "𨸏")), region)[0]
    twice.weight = plain.weight
    np.testing.assert_allclose(twice.contours()[0], plain.contours()[0])


@pytest.mark.parametrize("wrapper", ["{}", "⿱木{}", "⿴{}木", "⿴{}⿱木口"])
def test_four_mouth_grid_has_one_rendering_layout(wrapper):
    glyphs = {ch: compose.Part([rectangle((0, 0, 100, 100))]) for ch in "木口㗊"}
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    columns, rows = "⿰⿱口口⿱口口", "⿱⿰口口⿰口口"
    a, b = c.compose(wrapper.format(columns)), c.compose(wrapper.format(rows))
    assert compose.svg_path(a) == compose.svg_path(b)
    if wrapper == "{}":
        assert compose.svg_path(a) == compose.svg_path(c.compose("㗊"))
        assert [p.origin for p in a] == ["glyph 㗊"]
    source = compose.parse(columns)
    assert c._respelled(source) == compose.parse(rows)
    assert compose.key(source) == columns
    other = compose.parse("⿰⿱木口⿱口口")
    assert c._respelled(other) == other


@pytest.mark.parametrize("wrapper", ["{}", "⿱木{}"])
def test_grid_equivalence_precedes_encoded_lookup(wrapper):
    columns, rows = "⿰⿱口口⿱口口", "⿱⿰口口⿰口口"
    glyphs = {ch: compose.Part([rectangle((0, 0, width, 100))]) for ch, width in [("木", 80), ("口", 100), ("㗊", 90)]}
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    sequences = {"木": wrapper.format(columns), "口": wrapper.format(rows)}
    c = compose.Composer(font, sequences, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    a, b = c.compose(wrapper.format(columns)), c.compose(wrapper.format(rows))
    assert [p.origin for p in a] == ["glyph 㗊" if wrapper == "{}" else "glyph 口"]
    assert compose.svg_path(a) == compose.svg_path(b)
    assert sequences == {"木": wrapper.format(columns), "口": wrapper.format(rows)}


def test_grid_guide_receives_the_same_canonical_sequence():
    glyph = compose.Part([rectangle((0, 0, 100, 100))])
    font = SimpleNamespace(glyph=lambda _: glyph, has=lambda _: True,
                           own=lambda _: True, stem=((4, 8), (4, 8)))
    seen = []
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    c.guide = SimpleNamespace(fit=lambda composer, sequence, parts: (seen.append(sequence), parts)[1])
    for wrapper in ["{}", "⿴{}木"]:
        c.compose(wrapper.format("⿰⿱口口⿱口口"))
        c.compose(wrapper.format("⿱⿰口口⿰口口"))
        assert seen[-2:] == ["㗊" if wrapper == "{}" else wrapper.format("⿱⿰口口⿰口口")] * 2


def test_standalone_grid_without_encoded_glyph_falls_back_to_components():
    glyph = compose.Part([rectangle((0, 0, 100, 100))])
    font = SimpleNamespace(glyph=lambda ch: glyph if ch == "口" else None,
                           has=lambda ch: ch == "口", own=lambda ch: ch == "口",
                           stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    a = c.compose("⿰⿱口口⿱口口")
    assert len(a) == 4
    assert compose.svg_path(a) == compose.svg_path(c.compose("⿱⿰口口⿰口口"))


FOUR_ENCLOSURES = [
    ("⿹須", "⿹⿰彡頁", "⿰⿱彡{inner}頁", "此"),
    ("⿸攸", "⿸⿲亻丨攵", "⿲亻丨⿱攵{inner}", "羽"),
    ("⿸𪧇", "⿸⿱宀爿", "⿱宀⿰爿{inner}", "丙"),
    ("⿸朕", "⿸⿰月关", "⿰月⿱关{inner}", "氺"),
]


@pytest.mark.parametrize("host,literal,rendered,example", FOUR_ENCLOSURES)
@pytest.mark.parametrize("inner", ["木", "⬚", "⿱木⬚"])
def test_four_enclosure_hosts_preserve_source_and_insert_arbitrary_contents(host, literal, rendered, example, inner):
    c = compose.Composer(None, {})
    expected = compose.parse(rendered.format(inner=inner))
    for spelling in (host, literal):
        source = compose.parse(spelling + inner)
        assert c._respelled(source) == expected
        assert compose.key(source) == spelling + inner
        wrong_operator = "⿸" if spelling[0] == "⿹" else "⿹"
        unrelated = compose.parse(wrong_operator + spelling[1:] + inner)
        assert c._respelled(unrelated) == unrelated
    # The same component remains intact outside the supported enclosure.
    ordinary = compose.parse("⿱" + host[1:] + inner)
    assert c._respelled(ordinary) == ordinary


@pytest.mark.parametrize("host,literal,rendered,example", FOUR_ENCLOSURES)
@pytest.mark.parametrize("nested", [False, True])
def test_four_enclosure_hosts_draw_their_opened_components(host, literal, rendered, example, nested):
    glyphs = {ch: compose.Part([rectangle((0, 0, 100, 100))])
              for ch in "彡頁亻丨攵宀爿月关此羽丙氺木"}
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    prefix = "⿱木" if nested else ""
    expected = c.compose(prefix + rendered.format(inner=example))
    for spelling in (host, literal):
        actual = c.compose(prefix + spelling + example)
        assert [part.origin for part in actual] == [part.origin for part in expected]
        assert [part.target for part in actual] == [part.target for part in expected]
        inner = next(part for part in actual if part.origin == "glyph " + example)
        above = "彡" if host == "⿹須" else "攵" if host == "⿸攸" else "宀" if host == "⿸𪧇" else "关"
        upper = next(part for part in actual if part.origin == "glyph " + above)
        assert inner.target[3] <= upper.target[1]
        if host == "⿸𪧇":
            left = next(part for part in actual if part.origin == "glyph 爿")
            assert left.target[2] <= inner.target[0]


@pytest.mark.parametrize("wrapper", ["{}", "⿱木{}"])
@pytest.mark.parametrize("mode", ["permitted", "excluded", "spelled"])
def test_requested_enclosure_lookup_matches_native_expansion(wrapper, mode):
    expanded = "⿲亻丨⿱攵羽"
    # A whole glyph has distinctive geometry; drawing the same leaves is insufficient.
    glyphs = {ch: compose.Part([rectangle((0, 0, 100, 100))]) for ch in "木亻丨攵羽"}
    glyphs["翛"] = compose.Part([rectangle((10, 15, 90, 75))])
    glyphs["甲"] = compose.Part([rectangle((5, 25, 85, 80))])
    target = "翛" if wrapper == "{}" else "甲"
    calls = []

    def glyph(ch):
        calls.append(ch)
        assert mode != "excluded" or ch != target
        return glyphs.get(ch)

    font = SimpleNamespace(glyph=glyph, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    sequences = {"翛": expanded, "甲": "⿱木" + expanded}
    c = compose.Composer(font, sequences, hosted=False, weighted=False, reuse=False,
                         exclude={target} if mode == "excluded" else set())
    c.__dict__["spelled"] = {wrapper.format(expanded)} if mode == "spelled" else set()
    c.__dict__["atomic"] = set()
    expected = c.compose(wrapper.format(expanded))
    if mode == "permitted":
        assert [part.origin for part in expected] == ["glyph " + target]
    else:
        assert all(part.origin != "glyph " + target for part in expected)
    for alias in ["⿸攸羽", "⿸⿲亻丨攵羽"]:
        source = wrapper.format(alias)
        actual = c.compose(source)
        assert compose.svg_path(actual) == compose.svg_path(expected)
        assert [part.origin for part in actual] == [part.origin for part in expected]
        assert [part.target for part in actual] == [part.target for part in expected]
        assert compose.key(compose.parse(source)) == source


def test_requested_enclosure_normalization_keeps_nested_slots_and_unrelated_layouts():
    c = compose.Composer(None, {})
    assert compose.key(c._normalize_requested_enclosures(compose.parse("⿹須⿸攸⬚"))) == "⿰⿱彡⿲亻丨⿱攵⬚頁"
    for text in ["⿸須羽", "⿴攸羽", "⿱𪧇木", "⿹朕氺", "⿴行水", "⿸厌鬼"]:
        tree = compose.parse(text)
        assert c._normalize_requested_enclosures(tree) == tree


@pytest.mark.parametrize("inner", ["米", "⬚", "⿱木口"])
def test_mountain_enclosure_opens_below_the_middle_bar(inner):
    c = compose.Composer(None, {})
    source = compose.parse("⿵⿲彳⿱山一攵" + inner)
    assert c._respelled(source) == compose.parse("⿲彳⿱⿱山一" + inner + "攵")
    assert compose.key(source) == "⿵⿲彳⿱山一攵" + inner
    for other in ("⿴⿲彳⿱山一攵" + inner, "⿵⿲彳⿱山一文" + inner, "⿲彳⿱山一攵"):
        tree = compose.parse(other)
        assert c._respelled(tree) == tree


@pytest.mark.parametrize("nested", [False, True])
def test_mountain_enclosure_draws_between_sides_below_the_bar(nested):
    glyphs = {ch: compose.Part([rectangle((0, 0, 100, 100))]) for ch in "彳山一攵米木"}
    font = SimpleNamespace(glyph=glyphs.get, has=lambda ch: ch in glyphs,
                           own=lambda ch: ch in glyphs, stem=((4, 8), (4, 8)))
    c = compose.Composer(font, {}, hosted=False, weighted=False, reuse=False)
    c.__dict__["spelled"] = set()
    c.__dict__["atomic"] = set()
    prefix = "⿰木" if nested else ""
    actual = c.compose(prefix + "⿵⿲彳⿱山一攵米")
    expected = c.compose(prefix + "⿲彳⿱⿱山一米攵")
    assert [p.origin for p in actual] == [p.origin for p in expected]
    # A parent measures the original enclosure before its child is respelled.
    if not nested:
        assert [p.target for p in actual] == [p.target for p in expected]
    left, mountain, bar, inner, right = actual[-5:]
    assert left.target[0] < inner.target[0] < right.target[0]
    # Font coordinates increase upwards.
    assert inner.target[3] <= bar.target[1]
    assert bar.target[3] <= mountain.target[1]


def test_a_swept_foot_moves_both_masters_alike():
    # A block pressed left and a stroke that runs down, along the foot and up into a hook. The
    # heavy stem and hook are twice as wide, so their inner edges lie where the foot is drawn out.
    def outline(stem, foot, hook):
        return np.array([(400, 900), (400 + stem, 900), (400 + stem, foot), (1000 - hook, foot),
                         (1000 - hook, 300), (1000, 300), (1000, 0), (400, 0)], dtype=float)

    ops = [("moveTo", 1, False)] + [("lineTo", 1, False)] * 7
    sweep = compose.Contour(ops, outline(80, 80, 80), outline(160, 160, 160))
    # The case needs the heavy stem's and hook's inner edges inside the drawn-out span.
    assert 400 + compose.STEM_SPAN < 560 and 840 < 1000 - compose.SWEEP_END * 1000 < 920
    part = compose.Part([rectangle((0, 200, 450, 900)), sweep])
    swept = compose._swept(compose.Placed(part, part.box, part.box, origin="glyph 几"), 300)

    assert swept is not None
    foot = swept[1].part.contours[0]
    assert np.allclose(foot.heavy - foot.light, sweep.heavy - sweep.light)
    # The light hook stands right of the drawn-out span and keeps its place.
    assert np.allclose(foot.light[3:6], sweep.light[3:6])



def test_a_described_enclosing_part_takes_the_sweep_of_kin_kanjivg_writes_over_the_same_lower():
    # 麦 is written over 夊 and KanjiVG names its lower group 夂: ⿱𡗗夂 round 面 is 麦's sweep, cut
    # from 麺, with 𡗗 drawn in 龶's place.
    group = lambda element, position=None: SimpleNamespace(element=element, position=position, groups=[])
    entries = {"麦": SimpleNamespace(root=SimpleNamespace(groups=[group("龶", "top"), group("夂", "bottom")])), "麺": None}
    top, lower = compose.Part([rectangle((0, 500, 400, 900))]), compose.Part([rectangle((0, 0, 1000, 500))])
    cuts = []

    def host_node(char, tree, path):
        cuts.append((char, tree, path))
        return compose.Host(char, [top, lower], (0, 0, 1000, 900), 0)

    c = compose.Composer(SimpleNamespace(own=lambda _: True), {"麦": "⿱龶夊", "麺": "⿺麦面"})
    c.kvg = SimpleNamespace(entries=entries, host_node=host_node)
    host = ("麺", ("⿺", "麦", "面"), (), 0)
    c.__dict__["_index"] = ({(compose.slot(op, 0), "麦"): [host] * compose.KIN_OUTER_HOSTS for op in "⿺⿸"}, {})
    c._ranked = lambda *args, **kwargs: []
    c.ink = lambda _: 1.0
    drawn = []
    c._node = lambda node, box: drawn.append((node, box)) or []

    kin = c._kin("⿺", ("⿱", "𡗗", "夂"))
    assert kin is not None and kin[0] == "麦"
    assert c._kin("⿸", ("⿱", "𡗗", "夂")) is None
    placed = c._kin_outer("⿺", ("⿱", "𡗗", "夂"), kin, "面", (0, 0, 1000, 900), (500, 0, 1000, 500))

    assert cuts == [("麺", ("⿺", ("⿱", "龶", "夊"), "面"), (0,))]
    assert [p.origin for p in placed] == ["kin 麺"] and placed[0].part is lower
    assert drawn == [("𡗗", (0, 500, 400, 900))]


def test_an_enclosure_drawn_as_its_kin_is_laid_out_as_the_kin():
    # ⿱𡗗夂 round 面 stands as 麥 round it: 面 low in the opening, as in 麵.
    asked = []
    unknown, kin_boxes = [(0, 0, 1000, 1000), (400, 300, 900, 800)], [(0, 0, 1000, 1000), (480, 60, 950, 790)]
    square = compose.Part([rectangle((0, 0, 1000, 1000))])
    c = compose.Composer(SimpleNamespace(own=lambda _: True, has=lambda _: True, glyph=lambda _: square, stem=((80, 80), (80, 80))), {})
    c.layout = SimpleNamespace(predict=lambda _c, op, keys, tested: asked.append(keys) or list(kin_boxes if keys[0] == "麥" else unknown))
    c._host = lambda *args, **kwargs: None
    c._kin = lambda op, outer: ("麥", ("⿱", "來", "夊"), outer)
    outer_boxes, inner_boxes = [], []
    c._kin_outer = lambda op, outer, kin, inner, box, inner_box: outer_boxes.append(box) or [
        compose.Placed(compose.Part([rectangle(box)]), box, box, origin="kin 麭")]
    c._node = lambda node, box: inner_boxes.append(box) or [compose.Placed(compose.Part([rectangle(box)]), box, box, origin="glyph 面")]
    c._room = lambda *args: None

    c._learned("⿺", [("⿱", "𡗗", "夂"), "面"])

    assert asked == [["⿱𡗗夂", "面"], ["麥", "面"]]
    assert outer_boxes == [kin_boxes[0]] and inner_boxes == [kin_boxes[1]]


def test_an_upper_part_in_a_kin_room_is_lowered_to_stand_as_close_as_the_kin_upper():
    # 𡗗's 人 ends 100 units above the sweep where 來's legs come within 50 of it in 麥.
    c = compose.Composer(SimpleNamespace(own=lambda _: True), {})
    place = lambda box: compose.Placed(compose.Part([rectangle(box)]), box, box)
    lower = [place((0, -100, 600, 300))]
    upper = [place((0, 400, 500, 800))]
    settled = c._settled(upper, place((0, 350, 500, 800)), lower)
    assert settled[0].target[3] == 800 and abs(settled[0].target[1] - 350) < 8
    assert c._settled([place((0, 340, 500, 800))], place((0, 350, 500, 800)), lower)[0].target[1] == 340
    # Of two parts ending at different heights, the lower one stops where the kin's upper part does.
    pair = c._settled([place((0, 400, 200, 800)), place((300, 600, 500, 800))], place((0, 350, 500, 800)), lower)
    assert abs(pair[0].target[1] - 350) < 8


def test_a_listed_kin_cut_whose_split_stands_off_the_middle_yields_to_one_near_it():
    # Zhuque's 麩 keeps 來's legs in the sweep: its upper box is 150 high in a 900-unit frame,
    # where 麪 and 麭 split it near the middle. The export lists them unranked.
    c = compose.Composer(SimpleNamespace(own=lambda _: True), {})
    c.kvg = SimpleNamespace(entries={ch: None for ch in ("麩", "麪", "麭")})
    c.font = SimpleNamespace(own=lambda _: True)
    c._ranked = lambda *args, **kwargs: []
    c.ink = lambda _: 1.0
    part = lambda box: compose.Part([rectangle(box)])
    hosts = {
        "麩": compose.Host("麩", [part((0, 750, 1000, 900)), part((0, 0, 1000, 900))], (0, 0, 1000, 900), 0),
        "麪": compose.Host("麪", [part((0, 500, 1000, 900)), part((0, 0, 1000, 400))], (0, 0, 1000, 900), 0),
        "麭": compose.Host("麭", [part((0, 450, 1000, 900)), part((0, 0, 1000, 450))], (0, 0, 1000, 900), 0),
    }
    c._kin_cut = lambda entry, tree: hosts[entry[0]]
    c.__dict__["_index"] = ({(compose.slot("⿺", 0), "麥"): [(ch, ("⿺", "麥", "夫"), (), 0) for ch in hosts] * compose.KIN_OUTER_HOSTS}, {})
    c._node = lambda node, box: []

    placed = c._kin_outer("⿺", ("⿱", "𡗗", "夂"), ("麥", ("⿱", "來", "夊"), ("⿱", "𡗗", "夂")), "面",
                          (0, 0, 1000, 900), (500, 0, 1000, 500))

    assert [p.origin for p in placed] == ["kin 麪"]


def test_a_narrow_kin_cut_leaves_the_upper_room_for_the_enclosed_part():
    # A cut holding only the outer's left half is carried across the enclosing box, but the upper
    # part stops short of the enclosed part's box: 面 keeps the right side instead of shrinking.
    c = compose.Composer(SimpleNamespace(own=lambda _: True), {})
    c.kvg = SimpleNamespace(entries={"麩": None})
    c.font = SimpleNamespace(own=lambda _: True)
    c._ranked = lambda *args, **kwargs: []
    c.ink = lambda _: 1.0
    part = lambda box: compose.Part([rectangle(box)])
    c._kin_cut = lambda entry, tree: compose.Host("麩", [part((0, 500, 500, 900)), part((0, 0, 500, 500))], (0, 0, 500, 900), 0)
    c.__dict__["_index"] = ({(compose.slot("⿺", 0), "麥"): [("麩", ("⿺", "麥", "夫"), (), 0)] * compose.KIN_OUTER_HOSTS}, {})
    drawn = []
    c._node = lambda node, box: drawn.append((node, box)) or []

    placed = c._kin_outer("⿺", ("⿱", "𡗗", "夂"), ("麥", ("⿱", "來", "夊"), ("⿱", "𡗗", "夂")), "面",
                          (0, 0, 1000, 900), (500, 0, 1000, 500))

    assert [p.origin for p in placed] == ["kin 麩"]
    assert drawn == [("𡗗", (0, 500, 428, 900))]


def test_two_listed_kin_cuts_tie_on_the_midpoint_and_take_the_even_split():
    # With two cuts each is as far from their midpoint; the one nearer an even upper/lower split
    # is the safer choice (麪's 0.67 over 麩's 0.69).
    c = compose.Composer(SimpleNamespace(own=lambda _: True), {})
    c.kvg = SimpleNamespace(entries={ch: None for ch in ("麩", "麪")})
    c.font = SimpleNamespace(own=lambda _: True)
    c._ranked = lambda *args, **kwargs: []
    c.ink = lambda _: 1.0
    part = lambda box: compose.Part([rectangle(box)])
    hosts = {
        "麩": compose.Host("麩", [part((0, 180, 1000, 900)), part((0, 0, 1000, 100))], (0, 0, 1000, 900), 0),
        "麪": compose.Host("麪", [part((0, 360, 1000, 900)), part((0, 0, 1000, 100))], (0, 0, 1000, 900), 0),
    }
    c._kin_cut = lambda entry, tree: hosts[entry[0]]
    c.__dict__["_index"] = ({(compose.slot("⿺", 0), "麥"): [(ch, ("⿺", "麥", "夫"), (), 0) for ch in hosts] * compose.KIN_OUTER_HOSTS}, {})
    c._node = lambda node, box: []

    placed = c._kin_outer("⿺", ("⿱", "𡗗", "夂"), ("麥", ("⿱", "來", "夊"), ("⿱", "𡗗", "夂")), "面",
                          (0, 0, 1000, 900), (500, 0, 1000, 500))

    assert [p.origin for p in placed] == ["kin 麪"]


@pytest.mark.parametrize(("style", "sweep"), [("fangsong", "处"), ("regular", "麵")])
def test_wheat_face_cuts_from_native_fonts(style, sweep):
    from han_compose.vocab import cache_root

    path = cache_root() / "fonts" / compose.STYLES[style].font.file
    if not path.exists():
        pytest.skip("native font is not cached")
    font = compose.Font(path, style=style)
    composer = compose.Composer(font, {}, weighted=False)
    region = (0, 0, 1000, 1000)
    pieces = composer._node(compose.parse("⿺⿱𡗗夂面"), region)
    assert [p.origin for p in pieces] == ["construct 榛 𡗗", f"construct {sweep} 夂", "construct 麺 面"]
    assert pieces[2].target[3] - pieces[2].target[1] > 700
    composer.exclude.add("榛")
    assert composer._wheat_face(region) == []
