"""The style dimension: each style's fonts pinned and fetched, its models cached apart, its weight."""

from __future__ import annotations

import hashlib
import io
import re
import zipfile
from pathlib import Path

import numpy as np
import pytest
from fontTools.pens.recordingPen import RecordingPen

from han_compose import compose, compose_layout, compose_standalone, web_export


def test_every_style_pins_each_of_its_fonts_by_sha256_and_licence() -> None:
    assert compose.DEFAULT_STYLE == "sans" and set(compose.STYLES) == {"sans", "serif", "woodblock", "regular", "pen-writing", "fangsong"}
    files = {}
    for name, style in compose.STYLES.items():
        assert style.name == name
        for source in (style.font, *style.fallbacks):
            assert re.fullmatch(r"[0-9a-f]{64}", source.sha256)
            assert source.licence in web_export.LICENCE_URLS and source.licence in web_export.LICENCE_TEXTS
            if source.member is not None:
                assert re.fullmatch(r"[0-9a-f]{64}", source.archive_sha256)
            files.setdefault(source.file, set()).add(source)
    # A cached file name means one pinned font, whichever styles read it.
    assert all(len(sources) == 1 for sources in files.values())
    assert compose.STYLES["serif"].font.file != compose.STYLES["sans"].font.file


def test_styles_are_listed_in_the_switch_order() -> None:
    assert list(compose.STYLES) == ["sans", "serif", "woodblock", "fangsong", "regular", "pen-writing"]


def test_fangsong_indexes_the_right_halves_of_lian_as_jian() -> None:
    fangsong = compose.drawn_sequences("fangsong")
    sans = compose.drawn_sequences("sans")
    assert [fangsong[ch] for ch in "練煉崠"] == ["⿰糹柬", "⿰火柬", "⿰山東"]
    assert [sans[ch] for ch in "練煉崠"] == ["⿰糸東", "⿰火東", "⿰山東"]


def test_only_fallbacks_of_the_main_fonts_design_teach_the_layout() -> None:
    from types import SimpleNamespace

    seen = []

    class Pool:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def imap_unordered(self, f, chars, chunksize=1):
            seen.extend(chars)
            return iter(())

    import multiprocessing as mp

    for style, expected in (("sans", {"一", "𠀀"}), ("serif", {"一"}), ("regular", {"一", "𠀀"}), ("pen-writing", {"一"}), ("fangsong", {"一"}), ("woodblock", {"一"})):
        seen.clear()
        font = SimpleNamespace(style=compose.STYLES[style], has=lambda ch: True, own=lambda ch: ch == "一",
                               open_fallbacks=lambda: None)
        fake = SimpleNamespace(font=font, sequences={"一": "⿱一一", "𠀀": "⿰一一"}, _index=({}, {}))
        context = SimpleNamespace(Pool=Pool)
        original = mp.get_context
        mp.get_context = lambda *_, context=context: context
        try:
            compose_layout.examples(fake)
        finally:
            mp.get_context = original
        assert set(seen) == expected


def test_models_of_another_style_are_cached_under_their_own_names() -> None:
    assert compose_layout.layout_file("sans") == compose_layout.LAYOUT_FILE
    assert compose_layout.layout_file("serif") == "compose-layout-v4-serif.npz"
    assert compose_layout.layout_file("pen-writing") == "compose-layout-v4-pen-writing.npz"
    assert compose_layout.layout_file("regular") == "compose-layout-v4-regular.npz"
    assert compose.styled(compose_standalone.STANDALONE_FILE, "serif") == "compose-standalone-v2-serif.json"
    assert compose.styled(compose_standalone.STANDALONE_FILE, "sans") == compose_standalone.STANDALONE_FILE


def test_a_font_inside_an_archive_is_fetched_checked_and_extracted(tmp_path: Path, monkeypatch) -> None:
    import httpx

    font = b"not really a font"
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("A.ttf", font)
    data = buffer.getvalue()
    monkeypatch.setattr(httpx, "get", lambda *a, **k: type("R", (), {"content": data})())
    source = compose.Source("archive-A.ttf", "https://example.org/a.zip", hashlib.sha256(font).hexdigest(), "CC0 1.0",
                            member="A.ttf", archive_sha256=hashlib.sha256(data).hexdigest())
    assert compose._fetched(source, tmp_path).read_bytes() == font
    # A second member extracts from the kept archive without another download.
    monkeypatch.setattr(httpx, "get", lambda *a, **k: pytest.fail("fetched the archive twice"))
    again = compose.Source("archive-A2.ttf", source.url, source.sha256, source.licence, member="A.ttf",
                           archive_sha256=source.archive_sha256)
    assert compose._fetched(again, tmp_path).read_bytes() == font
    (tmp_path / "fonts" / "a.zip").unlink()
    monkeypatch.setattr(httpx, "get", lambda *a, **k: type("R", (), {"content": data})())
    wrong = compose.Source("archive-B.ttf", source.url, source.sha256, source.licence, member="A.ttf", archive_sha256="0" * 64)
    with pytest.raises(ValueError):
        compose._fetched(wrong, tmp_path)
    assert not (tmp_path / "fonts" / "archive-B.ttf").exists()


def test_a_stem_is_measured_across_its_middle_clear_of_its_serifs() -> None:
    # A bar 30 units tall with a triangle at its right end, as a Mincho 一 ends.
    bar = np.array([[0, 0], [0, 30], [800, 30], [900, 120], [1000, 0]], float)[::-1]
    assert compose._across([bar], 1) == pytest.approx(30)
    stem = np.array([[0, 0], [0, 1000], [80, 1000], [80, 0]], float)
    assert compose._across([stem], 0) == pytest.approx(80)


def _cached(style: str) -> bool:
    from han_compose.vocab import cache_root

    s = compose.STYLES[style]
    return all((cache_root() / "fonts" / source.file).exists() for source in (s.font, *s.fallbacks))


@pytest.fixture(scope="module")
def serif() -> compose.Font:
    if not _cached("serif"):
        pytest.skip("The serif fonts are not cached; `scripts/compose_ids.py draw --style serif` fetches them.")
    return compose.Font.of("serif")


def test_a_fallbacks_glyphs_are_opened_when_one_is_first_drawn() -> None:
    if not _cached("serif"):
        pytest.skip("The serif fonts are not cached; `scripts/compose_ids.py draw --style serif` fetches them.")
    font = compose.Font.of("serif")
    opened = lambda: ["glyphs" in vars(fallback) for fallback in font.fallbacks]
    assert len(font.fallbacks) > 1 and not any(opened()) and "family" not in vars(font)
    # A character of the main font opens none; one a fallback draws opens that fallback alone.
    assert font.glyph("何") is not None and not any(opened())
    char = "\U00031350"  # Extension H: Jigmo3
    drawn = [ord(char) in fallback.cmap for fallback in font.fallbacks]
    part = font.glyph(char)
    assert opened() == drawn and sum(drawn) == 1 and "family" not in vars(font)
    # Weighing it measures the fallbacks' strokes against the main font's.
    assert part.contours[0].width is not None and font.family is not None
    # Before workers fork every fallback is opened, so that they share the glyphs.
    font.open_fallbacks()
    assert all(opened())


def test_a_forked_process_opens_a_fallbacks_glyphs_from_a_file_of_its_own(monkeypatch: pytest.MonkeyPatch) -> None:
    if not _cached("sans"):
        pytest.skip("The sans fonts are not cached; `scripts/compose_ids.py draw` fetches them.")
    here, there = (compose.Fallback(compose.fallback_files()[-1], 1000) for _ in range(2))
    assert here.glyphs.font is here.font
    monkeypatch.setattr(compose.os, "getpid", lambda: there.opener + 1)
    assert there.glyphs.font is not there.font
    assert there.glyphs[there.cmap[0x30000]].width == here.glyphs[here.cmap[0x30000]].width


def test_serif_horizontals_grow_toward_heavy_as_its_verticals_do(serif: compose.Font) -> None:
    (x_light, x_heavy), (y_light, y_heavy) = serif.stem
    # Noto Serif CJK draws its horizontals about 30 units wide at every weight; its verticals grow.
    assert 25 < y_light < 40 and x_heavy > 2 * x_light
    assert serif.grow_y > 0 and y_heavy / y_light == pytest.approx(x_heavy / x_light)
    one = serif.glyph("一")
    heavy = np.concatenate([c.heavy for c in one.contours])
    light = np.concatenate([c.light for c in one.contours])
    assert np.ptp(heavy[:, 1]) > np.ptp(light[:, 1])


def test_a_serif_fallback_glyph_is_brought_to_the_main_fonts_em(serif: compose.Font) -> None:
    char = "\U00031350"  # Extension H: Jigmo3, drawn on 1,024 units to the em
    assert not serif.own(char) and serif.has(char)
    part = serif.glyph(char)
    x0, y0, x1, y1 = part.box
    assert 0 <= x0 < x1 <= compose.EM and compose.ASCENT - compose.EM <= y0 < y1 <= compose.ASCENT
    assert part.contours[0].width is not None


def test_a_contour_that_closes_on_its_first_point_closes_at_heavy_too(serif: compose.Font) -> None:
    # Noto Serif writes the round glyphs' closing return as a copy of their first point.
    for char in ("o", "6"):
        contours = serif.glyph(char).contours
        closing = [c for c in contours if np.array_equal(c.light[0], c.light[-1])]
        assert len(closing) == len(contours)
        for c in closing:
            assert np.array_equal(c.heavy[0], c.heavy[-1])


def test_a_fallback_ring_that_closes_on_its_first_point_closes_at_heavy_too(serif: compose.Font) -> None:
    char = "\U0003136E"  # Extension H: Jigmo3, drawn on 1,024 units to the em
    assert not serif.own(char)
    rings = [c for c in serif.glyph(char).contours if np.array_equal(c.light[0], c.light[-1])]
    assert rings
    for c in rings:
        assert np.array_equal(c.heavy[0], c.heavy[-1])


def test_a_duplicated_corner_grows_once_for_both_its_copies(serif: compose.Font) -> None:
    # Fonts write a corner as two points in the same place; grown one by one, the first copy stayed
    # put and the second shot out 2.6 times too far, so the corner split.
    for char in ("日", "何"):
        for c in serif.glyph(char).contours:
            copies = np.all(np.diff(c.light, axis=0) == 0, axis=1)
            for k in np.flatnonzero(copies):
                assert np.array_equal(c.heavy[k], c.heavy[k + 1])
                # Both copies carry the vertex's growth; a zero here is the old spike's other half.
                assert c.heavy[k][1] - c.light[k][1] > 0
                assert c.heavy[k][1] - c.light[k][1] <= serif.grow_y / 0.35 * 1.02


def test_heavy_points_away_from_a_duplicate_stay_as_drawn(serif: compose.Font) -> None:
    kept = 0
    for char in ("日", "一", "何"):
        drawn = RecordingPen()
        serif.heavy[serif._name(char)].draw(drawn)
        for c, (_, q) in zip(serif.glyph(char).contours, compose._contours(drawn)):
            # x is the font's own at heavy; y is grown from the light, which serif also does.
            grown = compose._grown(c.light, (0.0, serif.grow_y))[:, 1]
            paired = np.zeros(len(c.light), bool)
            paired[:-1] |= np.all(np.diff(c.light, axis=0) == 0, axis=1)
            paired[1:] |= np.all(np.diff(c.light, axis=0) == 0, axis=1)
            single = ~paired
            assert np.array_equal(c.heavy[single, 0], q[single, 0])
            assert np.allclose(c.heavy[single, 1], grown[single])
            kept += int(single.sum())
    assert kept


def test_the_serif_o_counter_stays_a_hole_at_heavy(serif: compose.Font) -> None:
    o = serif.glyph("o")
    size, box = 96, (0.0, compose.ASCENT - compose.EM, compose.EM, compose.ASCENT)
    mask = compose.raster([compose.Placed(o, o.box, o.box, weight=(1.0, 1.0))], size)
    # Flood the white outside; a counter torn open to it fills with the flood.
    seen, edge = {(x, 0) for x in range(size)} | {(0, y) for y in range(size)} | {(size - 1, y) for y in range(size)}, None
    edge = [(x, 0) for x in range(size)] + [(x, size - 1) for x in range(size)]
    edge += [(0, y) for y in range(size)] + [(size - 1, y) for y in range(size)]
    while edge:
        x, y = edge.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < size and 0 <= ny < size and not mask[ny, nx] and (nx, ny) not in seen:
                seen.add((nx, ny))
                edge.append((nx, ny))
    (x0, y0, x1, y1), (bx, by, bw, bh) = o.box, box
    counter = (int(((x0 + x1) / 2 - bx) / bw * size), int((by + bh - (y0 + y1) / 2) / bh * size))
    assert not mask[counter[1], counter[0]] and counter not in seen

def test_a_contour_left_for_later_is_weighed_with_its_glyph_when_first_read() -> None:
    import dataclasses

    points = np.zeros((3, 2))
    first, second = (compose.Contour([], points, compose.LATER, compose.LATER) for _ in range(2))
    weighed = []

    def weigh() -> None:
        weighed.append(1)
        for contour in (first, second):
            contour.weigh = None
            contour.heavy, contour.width = points + 1, (80.0, 75.0)

    first.weigh = second.weigh = weigh
    # Whether a width is measured on it is known without measuring.
    assert first.measured and second.measured and weighed == []
    assert second.width == (80.0, 75.0) and np.array_equal(first.heavy, points + 1) and weighed == [1]
    assert dataclasses.replace(first, light=points + 2).width == (80.0, 75.0) and weighed == [1]
    plain = compose.Contour([], points, points)
    assert plain.width is None and not plain.measured and plain.weigh is None and plain.heavy is points
    # What is set on a contour left for later stays: its glyph is weighed first.
    third = compose.Contour([], points, compose.LATER, compose.LATER)
    third.weigh = lambda: (setattr(third, "weigh", None), setattr(third, "heavy", points + 1), setattr(third, "width", (80.0, 75.0)))
    third.heavy = points + 5
    assert np.array_equal(third.heavy, points + 5) and third.width == (80.0, 75.0)


def test_a_glyph_is_read_at_one_weight_until_one_of_its_contours_is_weighed(monkeypatch) -> None:
    from fontTools.pens.recordingPen import DecomposingRecordingPen

    if not _cached("sans"):
        pytest.skip("The sans fonts are not cached; `scripts/compose_ids.py draw` fetches them.")
    font = compose.Font.of("sans")
    heavy, read, measured = font.heavy, [], []

    class Counted:
        def __getitem__(self, name: str):
            read.append(name)
            return heavy[name]

    stems = compose.stems
    monkeypatch.setattr(font, "heavy", Counted())
    monkeypatch.setattr(compose, "stems", lambda mask, unit: measured.append(1) or stems(mask, unit))
    assert font.own("何") and not font.own("𡉵") and font.has("𡉵")
    own, fallback = font.glyph("何"), font.glyph("𡉵")
    # Which font draws a glyph is told without weighing it.
    assert not own.contours[0].measured and fallback.contours[0].measured
    assert read == [] and measured == []

    drawn = DecomposingRecordingPen(heavy)
    heavy[font._name("何")].draw(drawn)
    assert all(np.array_equal(c.heavy, points) for c, (_, points) in zip(own.contours, compose._contours(drawn), strict=True))
    assert read == [font._name("何")] and own.contours[0].width is None

    width = fallback.contours[-1].width
    grow = tuple(width[axis] * (font.stem[axis][1] / font.stem[axis][0] - 1) / 2 for axis in (0, 1))
    assert all(c.width == width and np.array_equal(c.heavy, compose._grown(c.light, grow)) for c in fallback.contours)
    # Once for the whole glyph.
    assert read == [font._name("何")] and measured == [1]


def test_the_cli_refuses_a_style_it_does_not_know() -> None:
    import sys

    import typer

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import compose_ids

    assert compose_ids._style("serif") == "serif"
    assert compose_ids._style("pen-writing") == "pen-writing"
    with pytest.raises(typer.BadParameter):
        compose_ids._style("mincho")


@pytest.fixture(scope="module")
def pen_writing() -> compose.Font:
    if not _cached("pen-writing"):
        pytest.skip("The Wen Kai fonts are not cached; `scripts/compose_ids.py draw --style pen-writing` fetches them.")
    return compose.Font.of("pen-writing")


def test_a_composite_glyph_is_read_through_its_components() -> None:
    if not _cached("fangsong"):
        pytest.skip("The Fangsong fonts are not cached.")
    font = compose.Font.of("fangsong")
    accented, plain = font.glyph("é"), font.glyph("e")
    assert accented is not None and len(accented.contours) > len(plain.contours)


def test_fangsong_keeps_its_hosts_in_zhuque_and_takes_the_rest_from_jigmo() -> None:
    style = compose.STYLES["fangsong"]
    assert style.heavy == 400 and style.own_hosts and not style.kindred
    assert style.fallbacks == compose.STYLES["serif"].fallbacks
    assert compose_layout.layout_file("fangsong") == "compose-layout-v4-fangsong.npz"
    assert "fangsong" in web_export.OUTLINE_NOTES
    assert "Alegreya Project Authors" in style.font.also


def test_woodblock_reads_nom_na_tong_and_no_other_font() -> None:
    style = compose.STYLES["woodblock"]
    assert style.heavy == 400 and style.own_hosts and not style.kindred
    assert style.fallbacks == ()
    assert style.font.licence == compose.MIT and style.font.member is None
    assert compose_layout.layout_file("woodblock") == "compose-layout-v4-woodblock.npz"
    assert "woodblock" in web_export.OUTLINE_NOTES
    licence = Path(__file__).resolve().parents[1] / "data" / "licences" / web_export.LICENCE_TEXTS[compose.MIT][1]
    assert "Copyright (c) 2019 nomfoundation" in licence.read_text(encoding="utf-8")


def test_woodblock_lifts_its_full_ideographs_into_the_em() -> None:
    if not _cached("woodblock"):
        pytest.skip("The woodblock fonts are not cached.")
    font = compose.Font.of("woodblock")
    boxes = [font.glyph(char).box for char in compose.FULL]
    centre = sorted((box[1] + box[3]) / 2 for box in boxes)[len(boxes) // 2]
    assert abs(centre - (compose.ASCENT - compose.EM / 2)) < 5
    assert font.family is None
    assert font.has("𡨸") and font.own("喃")
    assert not font.fallbacks and not font.has("\U00031350")


def test_regular_reads_tw_kai_and_its_extension_faces() -> None:
    style = compose.STYLES["regular"]
    assert style.heavy == 400 and style.kindred and style.own_hosts
    assert style.y_shift > 0
    assert [source.member for source in (style.font, *style.fallbacks)] == ["TW-Kai.ttf", "TW-Kai-Ext-B.ttf", "TW-Kai-Ext-G.ttf"]
    assert style.font.licence == compose.OGL and "cns11643.gov.tw" in style.font.also
    assert compose_layout.layout_file("regular") == "compose-layout-v4-regular.npz"
    assert "regular" in web_export.OUTLINE_NOTES


def test_regular_brings_its_1024_unit_em_to_the_composers_1000() -> None:
    if not _cached("regular"):
        pytest.skip("The TW-Kai fonts are not cached.")
    font = compose.Font.of("regular")
    assert font.scale < 1
    part = font.glyph("口")
    assert part is not None and 0 < part.box[2] - part.box[0] < 1000
    assert font.stem[0][0] > 0 and font.has("𠀀")


def test_pen_writing_reads_a_static_face(pen_writing: compose.Font) -> None:
    assert pen_writing.static and "fvar" not in pen_writing.font
    assert pen_writing.stem[0][0] > 0 and pen_writing.stem[1][0] > 0
    part = pen_writing.glyph("口")
    assert part is not None and part.contours
    # GenZui Sans supplies what Klee One lacks.
    assert pen_writing.own("口") and pen_writing.has("㐆")


def _ring(points: list[tuple[float, float]]) -> compose.Contour:
    array = np.array(points, dtype=float)
    return compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * (len(points) - 1), array, array.copy())


def test_ink_lies_left_of_an_anticlockwise_outer_contour() -> None:
    clockwise = [(0, 0), (0, 100), (100, 100), (100, 0)]
    hole = [(40, 40), (60, 40), (60, 60), (40, 60)]
    assert not compose._ink_on_left([_ring(clockwise), _ring(hole)])
    assert compose._ink_on_left([_ring(clockwise[::-1]), _ring(hole[::-1])])
    assert not compose._ink_on_left([])


@pytest.mark.parametrize("style", ["woodblock", "fangsong", "regular", "pen-writing"])
def test_a_static_faces_heavy_master_is_wider_whichever_way_it_is_wound(style: str) -> None:
    if not _cached(style):
        pytest.skip(f"The {style} fonts are not cached.")
    font = compose.Font.of(style)
    for char in "一國":
        contour = max(font.glyph(char).contours, key=lambda c: np.ptp(c.light, axis=0).prod())
        light, heavy = contour.light, np.asarray(contour.heavy)
        assert (heavy.min(axis=0) < light.min(axis=0)).all() and (heavy.max(axis=0) > light.max(axis=0)).all()


def test_a_part_weighted_by_scale_takes_the_stem_its_scale_calls_for() -> None:
    from types import SimpleNamespace

    points = np.array([[0, 0], [0, 800], [800, 800], [800, 0]], dtype=float)
    square = compose.Part([compose.Contour([("moveTo", 1, False)] + [("lineTo", 1, False)] * 3, points, points.copy())])
    style = SimpleNamespace(part_stems=(0.25, 0.5), weighted=True)
    font = SimpleNamespace(style=style, stem=((60.0, 100.0), (30.0, 50.0)), glyph=lambda _: None, has=lambda _: False,
                           width=lambda density, axis: 1.0)
    composer = compose.Composer(font, {}, weighted=True)
    composer.ink = lambda *_: 1.0
    whole = compose.Placed(square, square.box, square.box)
    half = compose.Placed(square, square.box, (0.0, 0.0, 400.0, 400.0))
    composer._balance([whole, half])
    ratio = (100 / 60 - 1, 50 / 30 - 1)
    assert whole.weight == (0.0, 0.0)
    assert half.weight == pytest.approx(((0.5 ** -0.75 - 1) / ratio[0], (0.5 ** -0.5 - 1) / ratio[1]))


def test_every_style_weights_its_parts_by_the_powers_measured_on_its_own_font() -> None:
    for style in compose.STYLES.values():
        assert style.part_stems is not None and all(0 < power < 1 for power in style.part_stems), style.name


def test_a_static_face_counts_a_parts_weight_against_its_own_stem_and_holds_the_law_at_its_least_scale() -> None:
    from types import SimpleNamespace

    def frame(stroke: float) -> compose.Part:
        outer = np.array([[200, 200], [200, 700], [700, 700], [700, 200]], dtype=float)
        a, b = 200 + stroke, 700 - stroke
        inner = np.array([[a, a], [b, a], [b, b], [a, b]], dtype=float)
        ops = [("moveTo", 1, False)] + [("lineTo", 1, False)] * 3
        return compose.Part([compose.Contour(ops, outer, outer.copy(), (stroke, stroke)), compose.Contour(ops, inner, inner.copy(), (stroke, stroke))])

    real = compose.Font.__new__(compose.Font)
    real.stem = ((60.0, 100.0), (40.0, 80.0))
    font = SimpleNamespace(style=SimpleNamespace(part_stems=(0.25, 0.5)), stem=real.stem, static=True, glyph=lambda _: None,
                           has=lambda _: False, width=lambda density, axis: 1.0, _measured=real._measured)
    composer = compose.Composer(font, {})
    composer.ink = lambda *_: 1.0
    part = frame(50.0)
    whole = compose.Placed(part, part.box, part.box)
    half = compose.Placed(part, part.box, (200.0, 200.0, 450.0, 450.0))
    tiny = compose.Placed(part, part.box, (200.0, 200.0, 250.0, 250.0))
    composer._balance([whole, half, tiny])
    # The frame's strokes are 50 wide and the heavy master 40 wider: grown by 40 / 50 at weight 1.
    assert whole.weight == (0.0, 0.0)
    assert half.weight == pytest.approx(((0.5 ** -0.75 - 1) / 0.8, (0.5 ** -0.5 - 1) / 0.8))
    assert tiny.weight == pytest.approx(((compose.PART_SCALE_LEAST ** -0.75 - 1) / 0.8, (compose.PART_SCALE_LEAST ** -0.5 - 1) / 0.8))
