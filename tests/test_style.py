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
    assert compose.DEFAULT_STYLE == "sans" and set(compose.STYLES) == {"sans", "serif", "kaisho"}
    files = []
    for name, style in compose.STYLES.items():
        assert style.name == name
        for source in (style.font, *style.fallbacks):
            assert re.fullmatch(r"[0-9a-f]{64}", source.sha256)
            assert source.licence in web_export.LICENCE_URLS and source.licence in web_export.LICENCE_TEXTS
            if source.member is not None:
                assert re.fullmatch(r"[0-9a-f]{64}", source.archive_sha256)
            files.append(source.file)
    # No two styles share a cached font file.
    assert len(files) == len(set(files))
    assert compose.STYLES["serif"].font.file != compose.STYLES["sans"].font.file


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

    for style, expected in (("sans", {"一", "𠀀"}), ("serif", {"一"}), ("kaisho", {"一"})):
        seen.clear()
        font = SimpleNamespace(style=compose.STYLES[style], has=lambda ch: True, own=lambda ch: ch == "一")
        fake = SimpleNamespace(font=font, sequences={"一": "⿱一一", "𠀀": "⿰一一"}, _index=None)
        context = SimpleNamespace(Pool=Pool)
        original = mp.get_context
        mp.get_context = lambda *_: context
        try:
            compose_layout.examples(fake)
        finally:
            mp.get_context = original
        assert set(seen) == expected


def test_models_of_another_style_are_cached_under_their_own_names() -> None:
    assert compose_layout.layout_file("sans") == compose_layout.LAYOUT_FILE
    assert compose_layout.layout_file("serif") == "compose-layout-v4-serif.npz"
    assert compose_layout.layout_file("kaisho") == "compose-layout-v4-kaisho.npz"
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

def test_the_cli_refuses_a_style_it_does_not_know() -> None:
    import sys

    import typer

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import compose_ids

    assert compose_ids._style("serif") == "serif"
    assert compose_ids._style("kaisho") == "kaisho"
    with pytest.raises(typer.BadParameter):
        compose_ids._style("mincho")


@pytest.fixture(scope="module")
def kaisho() -> compose.Font:
    if not _cached("kaisho"):
        pytest.skip("The Kaisho fonts are not cached; `scripts/compose_ids.py draw --style kaisho` fetches them.")
    return compose.Font.of("kaisho")


def test_kaisho_reads_a_static_face_and_keeps_its_brush_weight(kaisho: compose.Font) -> None:
    assert kaisho.static and "fvar" not in kaisho.font
    assert kaisho.style.weighted is False
    assert kaisho.stem[0][0] > 0 and kaisho.stem[1][0] > 0
    part = kaisho.glyph("口")
    assert part is not None and part.contours
    # GenZui Sans supplies what Klee One lacks.
    assert kaisho.own("口") and kaisho.has("㐆")
