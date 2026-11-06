from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose


def test_consensus_recuts_when_exclusions_change(monkeypatch):
    c = compose.Composer(SimpleNamespace(own=lambda _: False), {}, weighted=True)
    tree = ("⿰", "木", "木")
    names = list("林森材村枝")
    c.__dict__["_index"] = ({("L", "木"): [(name, tree, (), 0) for name in names]}, {})
    masks = {name: np.full((4, 4), i + 1) for i, name in enumerate(names)}
    calls = []

    def host(char, tree, path, strict):
        assert not strict
        calls.append(char)
        return SimpleNamespace(pieces=[masks[char]])

    monkeypatch.setattr(c, "_host_node", host)
    monkeypatch.setattr(compose, "_square", lambda part: part)
    c.exclude = {"林"}
    first, fellows = c._consensus("L", "木")
    assert fellows and [int(m[0, 0]) for m in first] == [2, 3, 4, 5]
    c.exclude = {"森"}
    second, fellows = c._consensus("L", "木")
    assert fellows and [int(m[0, 0]) for m in second] == [1, 3, 4, 5]
    assert calls == names[1:] + [name for name in names if name != "森"]
    before = calls.copy()
    c._consensus("L", "木")
    assert calls == before
    c.exclude.add("材")
    assert c._consensus("L", "木") is None
    assert calls[len(before):] == list("林村枝")


@pytest.mark.parametrize("first", ["templates", "consensus", "strokes"])
@pytest.mark.parametrize("initially_excluded", [False, True])
def test_reference_context_matches_fresh_cuts(monkeypatch, first, initially_excluded):
    def rectangle(x0, y0, x1, y1):
        points = np.array([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], dtype=float)
        return compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())

    stem = rectangle(0, 0, 4, 64)
    extra = rectangle(12, 24, 24, 28)
    inside = compose.Part([rectangle(40, 0, 64, 64)])
    enclosure = ("⿺", "走", "木")
    cut_tree = ("⿰", "木", "木")

    def make(excluded):
        calls = []
        c = compose.Composer(SimpleNamespace(own=lambda _: False), {}, exclude=set(excluded), weighted=True)
        c.__dict__["_index"] = ({
            (compose.slot("⿺", 0), "走"): [(ch, enclosure, (), 0) for ch in ["target", "a", "b", "c"]],
            ("L", "木"): [(ch, cut_tree, (), 0) for ch in ["target", "d", "e", "f", "g"]],
        }, {})

        def source(char, tree, path):
            assert char not in c.exclude
            calls.append(("template", char))
            outer = compose.Part([stem, extra] if char == "target" else [stem])
            return SimpleNamespace(pieces=[outer, inside])

        c.kvg = SimpleNamespace(host_node=source)

        def cut(char, tree, path, strict):
            assert not strict and char not in c.exclude
            calls.append(("cut", char))
            template = c._enclosing_ink("⿺", "走")
            # Only the target contributes ink this far from the left stem.
            influenced = template[:, template.shape[1] // 4:].any()
            piece = compose.Part([stem, extra] if influenced else [stem])
            return SimpleNamespace(pieces=[piece])

        monkeypatch.setattr(c, "_host_node", cut)
        return c, calls

    def read(c, builder):
        if builder == "templates":
            return c._enclosing_ink("⿺", "走").copy()
        if builder == "strokes":
            return dict(c.strokes("L", "木"))
        masks, fellows = c._consensus("L", "木")
        assert fellows
        return np.stack(masks)

    warm, calls = make({"target"} if initially_excluded else set())
    builders = [first] + [name for name in ("templates", "consensus", "strokes") if name != first]
    for builder in builders:
        read(warm, builder)
    assert set(warm._strokes[("L", "木")][0]) == ({1} if initially_excluded else {2})
    if initially_excluded:
        warm.exclude.clear()
    else:
        warm.exclude.add("target")
    calls.clear()
    fresh, _ = make(warm.exclude)
    for builder in builders:
        actual, expected = read(warm, builder), read(fresh, builder)
        if builder == "strokes":
            assert actual == expected
        else:
            np.testing.assert_array_equal(actual, expected)
    assert set(warm._strokes[("L", "木")][0]) == ({2} if initially_excluded else {1})
    assert warm._reference_exclude == frozenset(warm.exclude)
    assert len(warm._templates) == len(warm._typical) == len(warm._strokes) == 1
    before = calls.copy()
    for builder in builders:
        read(warm, builder)
    assert calls == before


def test_reference_quota_counts_usable_cuts(monkeypatch):
    c = compose.Composer(SimpleNamespace(own=lambda _: False), {}, weighted=True)
    tree = ("⿱", "穴", "木")
    count = compose.TYPICAL_HOSTS
    c.__dict__["_index"] = ({("T", "穴"): [(str(i), tree, (), 0) for i in range(3 * count)]}, {})
    calls = []

    def host(char, tree, path, strict):
        calls.append(char)
        return None if int(char) < count else SimpleNamespace(pieces=[np.ones((4, 4), dtype=bool)])

    monkeypatch.setattr(c, "_host_node", host)
    monkeypatch.setattr(compose, "_square", lambda part: part)
    masks, fellows = c._consensus("T", "穴")
    assert fellows and len(masks) == count
    assert len(calls) == 2 * count


def test_consensus_counts_each_source_character_once(monkeypatch):
    c = compose.Composer(SimpleNamespace(own=lambda _: False), {}, weighted=True)
    tree = ("⿰", "木", "木")
    names = ["森"] * compose.TYPICAL_HOSTS + list("林材村")
    c.__dict__["_index"] = ({("L", "木"): [(name, tree, (), 0) for name in names]}, {})
    calls = []

    def host(char, tree, path, strict):
        calls.append(char)
        return SimpleNamespace(pieces=[np.ones((4, 4), dtype=bool)])

    monkeypatch.setattr(c, "_host_node", host)
    monkeypatch.setattr(compose, "_square", lambda part: part)
    masks, fellows = c._consensus("L", "木")
    assert fellows and len(masks) == 4
    assert calls == list("森林材村")
    c.exclude = set("林材村")
    assert c._consensus("L", "木") is None


def test_consensus_never_uses_excluded_operand_glyph(monkeypatch):
    glyph = np.ones((4, 4), dtype=bool)
    c = compose.Composer(SimpleNamespace(own=lambda _: True, glyph=lambda _: glyph), {}, weighted=True)
    c.__dict__["_index"] = ({}, {})
    monkeypatch.setattr(compose, "_square", lambda part: part)
    assert c._consensus("L", "木")[1] is False
    c.exclude = {"木"}
    assert c._consensus("L", "木") is None


def test_native_reference_filters_extra_stroke_without_changing_native_cuts(monkeypatch):
    c = compose.Composer(SimpleNamespace(own=lambda char: char == "native"), {}, weighted=True)
    clean = np.zeros((64, 64), dtype=bool)
    clean[8:20, 8:20] = True
    extra = clean.copy()
    extra[40:44, :] = True
    rows = [((rank,), SimpleNamespace(char=char, pieces=[mask]), 0)
            for rank, (char, mask) in enumerate((("bad", extra), ("good", clean), ("native", clean)))]
    monkeypatch.setattr(compose, "_square", lambda part, size: part)
    monkeypatch.setattr(compose, "_extra_bar", lambda *args: True)
    assert [host.char for _, host, _ in c._native_shapes(rows)] == ["good", "native"]
    monkeypatch.setattr(compose, "_extra_bar", lambda *args: False)
    assert [host.char for _, host, _ in c._native_shapes(rows)] == ["bad", "good", "native"]
    without_native = rows[:2]
    assert c._native_shapes(without_native) is without_native


def test_extra_bar_requires_unsupported_ink():
    def rectangle(x0, y0, x1, y1):
        points = np.array([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], dtype=float)
        ops = [("moveTo", 1, False)] + [("lineTo", 1, False)] * 3
        return compose.Contour(ops, points, points.copy())

    body = rectangle(0, 0, 8, 64)
    connected = compose.Part([body, rectangle(0, 30, 64, 34)])
    connected_mask = compose._square(connected, 64)
    reference = compose.fill(compose._rings([body], [body.light]), 64, connected.box)
    assert not compose._extra_bar(connected, connected_mask, [compose._grown_mask(reference, 2)])

    bar = rectangle(16, 30, 64, 34)
    part = compose.Part([body, bar])
    mask = compose._square(part, 64)
    reference = compose.fill(compose._rings([body], [body.light]), 64, part.box)
    assert compose._extra_bar(part, mask, [compose._grown_mask(reference, 2)])
    assert not compose._extra_bar(part, mask, [mask])
    assert not compose._extra_bar(part, mask, [])
    assert not compose._extra_bar(part, np.zeros_like(mask), [reference])


def test_loose_kanjivg_cut_does_not_consult_shape_references(monkeypatch):
    tree = ("⿰", "木", "木")
    found = SimpleNamespace(pieces=[object(), object()])
    c = compose.Composer(SimpleNamespace(), {}, kvg=SimpleNamespace(host_node=lambda *args: found), weighted=True)
    monkeypatch.setattr(c, "_kept", lambda *args: True)
    monkeypatch.setattr(c, "_traded", lambda *args: False)

    def recursive_check(*args):
        raise AssertionError("reference collection invoked shape validation")

    monkeypatch.setattr(c, "_like_fellows", recursive_check)
    assert c._host_node("林", tree, (), strict=False) is found


@pytest.fixture
def reference_composer(monkeypatch):
    points = np.array([(0, 0), (12, 0), (12, 32), (0, 32)], dtype=float)
    part = compose.Part([compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3,
                                        points, points.copy())])
    glyphs = {char: part for char in "ABC永"}
    reads = []

    def glyph(char):
        reads.append(char)
        return glyphs.get(char)

    font = SimpleNamespace(glyph=glyph, has=lambda char: char in glyphs, own=lambda char: char in glyphs,
                           stem=((2.0, 3.0), (2.0, 3.0)))
    monkeypatch.setattr(compose.Composer, "atomic", set())
    monkeypatch.setattr(compose.Composer, "spelled", set())
    return compose.Composer(font, {}, weighted=True), glyphs, reads


def test_operand_references_skip_excluded_scalar(reference_composer):
    c, glyphs, reads = reference_composer
    c.exclude.add("A")
    assert c._operand_shape("A") is None
    assert "A" not in reads
    c.exclude.clear()
    assert c._operand_shape("A") is glyphs["A"]


def test_excluded_encoded_tuple_uses_permitted_decomposition(reference_composer):
    c, glyphs, reads = reference_composer
    c.sequences["C"] = "⿰AB"
    node = ("⿰", "A", "B")
    assert c._operand_shape(node) is glyphs["C"]
    c.exclude.add("C")
    reads.clear()
    sketch = c._operand_shape(node)
    assert sketch is not None and len(sketch.contours) == 2
    assert "C" not in reads
    assert {"A", "B"} <= set(reads)
    c.exclude.clear()
    assert c._operand_shape(node) is glyphs["C"]


def test_reference_only_is_private_and_recursive(reference_composer):
    from dataclasses import fields

    c, _, _ = reference_composer
    flag = next(f for f in fields(c) if f.name == "_reference_only")
    assert not flag.init and not flag.repr
    assert not c._reference_only
    assert c._plain._reference_only
    assert c._plain._plain._reference_only
    assert not c._plain.hosted and not c._plain.weighted
    assert c._plain._frames is c._frames
    assert c._plain._plain._frames is c._frames


@pytest.mark.parametrize("op,count", [("⿰", 2), ("⿱", 2), ("⿲", 3), ("⿳", 3)])
@pytest.mark.parametrize("purpose", ["reference", "plain", "hosted", "root"])
def test_reference_shares_keep_baseline_weights_and_gaps(reference_composer, monkeypatch, op, count, purpose):
    c, _, _ = reference_composer
    if purpose == "reference":
        c = c._plain
    else:
        c.hosted = purpose == "hosted"
    children = [("⿰", "A", "B"), "B", "C"][:count]
    inks, crossings = [9.0, 64.0, 25.0][:count], [2.0, 5.0, 3.0][:count]
    boxes = []
    monkeypatch.setattr(c, "ink", lambda n: inks[children.index(n)])
    def crossed(n, axis):
        assert purpose in ("plain", "hosted")
        return crossings[children.index(n)]
    monkeypatch.setattr(c, "crossings", crossed)
    monkeypatch.setattr(c, "_host", lambda *args: None)
    monkeypatch.setattr(c, "_row", lambda n, box, count: boxes.append(box) or [])
    monkeypatch.setattr(c, "_space", lambda *args: None)
    c._shares(op, children, (0, 0, 100, 100), at_root=purpose == "root")
    if purpose in ("reference", "root"):
        power, middle = compose.SHARES_OLD.get((op, count), (0.5, 1.0))
        exponent, gap = 0.0, 0.04
    else:
        power, exponent, middle, gap = compose.SHARES[op, count]
    weights = [ink ** power * cross ** exponent * (middle if 0 < i < count - 1 else 1.0)
               for i, (ink, cross) in enumerate(zip(inks, crossings))]
    axis = compose.AXIS[op]
    lengths = [box[axis + 2] - box[axis] for box in boxes]
    assert lengths == pytest.approx([100 * (1 - gap * (count - 1)) * w / sum(weights) for w in weights])
    spans = sorted((box[axis], box[axis + 2]) for box in boxes)
    assert [b[0] - a[1] for a, b in zip(spans, spans[1:])] == pytest.approx([100 * gap] * (count - 1))


def test_recursive_reference_sketch_matches_baseline_shares(reference_composer, monkeypatch):
    c, _, _ = reference_composer
    c.sequences["X"] = "⿱A⿲B⿰ABC"
    node = ("⿰", "X", ("⿳", "A", ("⿱", "B", "C"), "B"))
    sketch = c._sketch(node)
    assert sketch is not None
    baseline = compose.Composer(c.font, c.sequences, hosted=False, weighted=False)
    plain = baseline._node(node, baseline.face)
    plain_points = [points for p in plain for points in p.contours()]
    assert len(plain_points) == len(sketch.contours)
    assert any(not np.allclose(contour.light, points) for contour, points in zip(sketch.contours, plain_points))
    monkeypatch.setattr(baseline, "_unknown", lambda _: False)
    placed = baseline._node(node, baseline.face)
    expected = compose.Part([compose.Contour(contour.ops, points, points)
                             for p in placed for contour, points in zip(p.part.contours, p.contours())])
    assert len(sketch.contours) == len(expected.contours)
    for actual, wanted in zip(sketch.contours, expected.contours):
        np.testing.assert_allclose(actual.light, wanted.light)


@pytest.mark.parametrize("excluded", [False, True])
def test_guide_operand_sketch_keeps_baseline_mask(reference_composer, monkeypatch, excluded):
    from han_compose import compose_guide

    c, glyphs, reads = reference_composer
    sequence = "⿰⿱A⿰ABC"
    tree = compose.parse(sequence)
    boxes = [(0, 0, 450, 800), (500, 0, 950, 800)]
    def predict(composer, op, operands, tested):
        assert composer is c and op == "⿰"
        assert operands == ["⿱A⿰AB", "C"]
        assert tested == ("A" if excluded else None)
        return boxes
    c.layout = SimpleNamespace(ops={"⿰"}, predict=predict)
    if excluded:
        c.exclude.add("A")
    masks = compose_guide.operands(c, sequence)
    assert c._plain._reference_only
    if excluded:
        assert not masks[0].any()
        assert "A" not in reads
    else:
        baseline = compose.Composer(c.font, {}, hosted=False, weighted=False)
        monkeypatch.setattr(baseline, "_unknown", lambda _: False)
        expected = compose.raster(baseline._node(tree[1], boxes[0]), compose_guide.SIZE)
        assert expected.any()
        np.testing.assert_array_equal(masks[0], expected)
    glyph = glyphs["C"]
    np.testing.assert_array_equal(masks[1], compose.raster(
        [compose.Placed(glyph, glyph.box, boxes[1])], compose_guide.SIZE))


@pytest.mark.parametrize("recursive", [False, True])
def test_sketch_cache_rebuilds_on_exclusion_add_and_remove(reference_composer, recursive):
    c, _, reads = reference_composer
    if recursive:
        # X has no glyph; its sequence is expanded by the plain composer's _node.
        c.sequences["X"] = "⿱A⿰AB"
    node = ("⿰", "X" if recursive else "A", "B")
    first = c._sketch(node)
    assert first is not None
    original_plain = c._plain
    assert original_plain._reference_only
    reads.clear()
    assert c._sketch(node) is first and reads == []
    c.exclude.add("A")
    assert c._sketch(node) is None
    assert "A" not in reads
    assert c._plain is not original_plain
    excluded_plain = c._plain
    assert excluded_plain._reference_only
    reads.clear()
    assert c._sketch(node) is None and reads == []
    c.exclude.remove("A")
    rebuilt = c._sketch(node)
    assert rebuilt is not None and rebuilt is not first
    assert c._plain is not excluded_plain and "A" in reads
    assert c._plain._reference_only
    assert compose._square(first).tolist() == compose._square(rebuilt).tolist()


def test_failed_excluded_tuple_sketch_has_no_likeness(reference_composer):
    c, glyphs, reads = reference_composer
    c.sequences["C"] = "⿰AB"
    c.exclude.update({"A", "C"})
    node = ("⿰", "A", "B")
    assert c._operand_shape(node) is None
    assert c.likeness(glyphs["B"], node) == 0.0
    assert not {"A", "C"}.intersection(reads)


@pytest.mark.parametrize("initially_excluded", [False, True])
@pytest.mark.parametrize("touch_reference_first", [False, True])
def test_cached_overlay_cuts_match_fresh_exclusion_context(reference_composer, monkeypatch,
                                                          initially_excluded, touch_reference_first):
    original, _, _ = reference_composer
    tree = (compose.OVERLAY, "A", "B")

    def make(excluded):
        c = compose.Composer(original.font, {}, exclude=set(excluded), weighted=True)
        c.__dict__["_index"] = ({(compose.slot(compose.OVERLAY, 0), "A"): [("C", tree, (), 0)]}, {})
        calls = []

        def host(char, node, path):
            calls.append(char)
            # C remains permitted; its cut changes with A's reference geometry.
            return SimpleNamespace(pieces=[c._operand_shape("A")])

        monkeypatch.setattr(c, "_host_node", host)
        return c, calls

    def read(c):
        return [(char, host.pieces[0] is not None, written) for char, host, written in c._overlays(None, None)]

    warm, calls = make({"A"} if initially_excluded else set())
    assert read(warm) == [("C", not initially_excluded, ["A", "B"])]
    assert read(warm) == [("C", not initially_excluded, ["A", "B"])]
    assert calls == ["C"]
    if initially_excluded:
        warm.exclude.clear()
    else:
        warm.exclude.add("A")
    if touch_reference_first:
        warm._operand_shape("B")
    fresh, _ = make(warm.exclude)
    assert read(warm) == read(fresh) == [("C", initially_excluded, ["A", "B"])]
    assert calls == ["C", "C"]
    read(warm)
    assert calls == ["C", "C"]


@pytest.mark.parametrize("first", ["ink", "aspect", "_own_outlines", "_outlines"])
@pytest.mark.parametrize("initially_excluded", [False, True])
def test_measurements_rebuild_with_exclusions(reference_composer, first, initially_excluded):
    c, _, reads = reference_composer
    c.sequences["A"] = "⿰BC"
    c.exclude = {"A"} if initially_excluded else set()
    names = [first] + [name for name in ("ink", "aspect", "_own_outlines", "_outlines") if name != first]

    def measure(composer):
        return {name: getattr(composer, name)("A") for name in names}

    before = measure(c)
    if initially_excluded:
        c.exclude.clear()
    else:
        c.exclude.add("A")
    reads.clear()
    fresh = compose.Composer(c.font, c.sequences, exclude=set(c.exclude), weighted=True)
    after = measure(c)
    assert after == measure(fresh)
    assert after != before
    if c.exclude:
        assert "A" not in reads
        assert after == {"ink": 176.0, "aspect": 0.75, "_own_outlines": 2, "_outlines": 2}
    else:
        assert "A" in reads
        assert after == {"ink": 88.0, "aspect": 0.375, "_own_outlines": 1, "_outlines": 1}


def test_excluded_measurements_do_not_cut_hosts_or_read_hidden_glyph(reference_composer, monkeypatch):
    c, _, _ = reference_composer
    c.sequences["A"] = "⿰BC"
    c.exclude.add("A")
    original = c.font.glyph

    def glyph(char):
        assert char != "A"
        return original(char)

    def cut(*args, **kwargs):
        raise AssertionError("measurement attempted host-cut validation")

    monkeypatch.setattr(c.font, "glyph", glyph)
    for helper in ("_host_node", "_consensus", "strokes", "_sketch"):
        monkeypatch.setattr(c, helper, cut)
    assert c.ink("A") == 176
    assert c.aspect("A") == c.aspect(("⿰", "B", "C")) == .75
    assert c._own_outlines("A") == c._outlines("A") == 2
    assert not c.stroked("A")


@pytest.mark.parametrize("sequence", ["⿰AX", "⿰BC", "⿰B", "A"])
def test_cyclic_or_incomplete_counts_remain_unknown(reference_composer, sequence):
    c, glyphs, reads = reference_composer
    c.sequences["A"] = sequence
    glyphs.pop("C")
    c.exclude.update({"A", "永"})
    assert np.isfinite(c.ink("A")) and c.ink("A") > 0
    assert np.isfinite(c.aspect("A")) and c.aspect("A") > 0
    assert c._own_outlines("A") is None
    assert c._outlines("A") == 0
    assert c._outlines(("⿰", "B", "A")) == 0
    assert not {"A", "永"}.intersection(reads)


def test_allowed_missing_encoded_aspect_is_cycle_safe(reference_composer):
    c, _, _ = reference_composer
    c.sequences["X"] = "⿰BX"
    # A sequence can map to a name even when a mocked font's glyph lookup has no outline.
    c.__dict__["by_sequence"] = {"⿰BX": "X"}
    assert c.aspect("X") == 1.375


def test_target_bearing_donor_still_passes_count_validation(reference_composer, monkeypatch):
    c, glyphs, reads = reference_composer
    c.sequences["A"] = "⿰BC"
    c.exclude.add("A")
    target_piece = compose.Part(glyphs["B"].contours + glyphs["C"].contours)
    found = SimpleNamespace(pieces=[glyphs["B"], target_piece])
    c.kvg = SimpleNamespace(host_node=lambda *args: found)
    monkeypatch.setattr(c, "_like_fellows", lambda *args: True)
    assert c._host_node("D", ("⿰", "B", "A"), ()) is found
    assert "A" not in reads


@pytest.mark.parametrize("initially_excluded", [False, True])
@pytest.mark.parametrize("face_first", [False, True])
def test_face_cache_matches_fresh_exclusions(reference_composer, monkeypatch, initially_excluded, face_first):
    c, glyphs, reads = reference_composer
    monkeypatch.setattr(compose, "FULL", "AB")
    base = glyphs["A"].contours[0]
    glyphs["A"] = compose.Part([compose.Contour(base.ops, base.light * 3, base.heavy * 3)])
    c.exclude = {"A"} if initially_excluded else set()
    before = c.face
    assert c.face == before
    if initially_excluded:
        c.exclude.clear()
    else:
        c.exclude.add("A")
    reads.clear()
    if not face_first:
        c.ink("B")
    fresh = compose.Composer(c.font, {}, exclude=set(c.exclude), weighted=True)
    assert c.face == fresh.face and c.face != before
    if c.exclude:
        assert c.face == glyphs["B"].box and "A" not in reads
    reads.clear()
    c.face
    assert reads == []
    c.exclude.update({"A", "B"})
    assert c.face == (0.0, compose.ASCENT - compose.EM, compose.EM, compose.ASCENT)
    assert not reads


def test_explicit_truth_ink_ignores_exclusion_without_reading_glyph(reference_composer):
    c, glyphs, reads = reference_composer
    c.sequences["A"] = "⿰BC"
    c.exclude.add("A")
    assert c.ink("", glyphs["A"]) == 88
    assert reads == []
    assert c.ink("A") == 176


def test_excluding_a_character_excludes_its_twins():
    # 胶 and 㬵 share a sequence and are drawn alike; 甲 and 乙 share one glyph name.
    square = SimpleNamespace(contours=[SimpleNamespace(light=np.array([[0.0, 0.0], [1.0, 1.0]]))])
    other = SimpleNamespace(contours=[SimpleNamespace(light=np.array([[0.0, 0.0], [2.0, 1.0]]))])
    glyphs = {"胶": square, "㬵": square, "膠": other, "甲": other, "乙": square}
    font = SimpleNamespace(own=lambda _: True, has=lambda ch: ch in glyphs, glyph=glyphs.get,
                           cmap={ord("甲"): "g1", ord("乙"): "g1", ord("胶"): "g2", ord("㬵"): "g3", ord("膠"): "g4"})
    c = compose.Composer(font, {"胶": "⿰月交", "㬵": "⿰月交", "膠": "⿰月交", "甲": "⿻日丨", "乙": "乙"}, weighted=True)
    assert c.twins["胶"] == {"㬵"} and c.twins["甲"] == {"乙"} and "膠" not in c.twins
    c.exclude = {"胶"}
    c._reference_context()
    assert set(set.__iter__(c.exclude)) == {"胶", "㬵"}
