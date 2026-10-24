from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose


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
    return compose.Composer(font, {}), glyphs, reads


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
        c = compose.Composer(original.font, {}, exclude=set(excluded))
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
    fresh = compose.Composer(c.font, c.sequences, exclude=set(c.exclude))
    after = measure(c)
    assert after == measure(fresh)
    assert after != before
    if c.exclude:
        assert "A" not in reads
        assert after == {"ink": 176.0, "aspect": 0.75, "_own_outlines": 2, "_outlines": 2}
    else:
        assert "A" in reads
        assert after == {"ink": 88.0, "aspect": 0.375, "_own_outlines": 1, "_outlines": 1}


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
    fresh = compose.Composer(c.font, {}, exclude=set(c.exclude))
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
