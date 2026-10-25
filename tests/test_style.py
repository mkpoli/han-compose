"""The style dimension: each style's fonts pinned and fetched, its models cached apart, its weight."""

from __future__ import annotations

import hashlib
import io
import re
import zipfile
from pathlib import Path

import numpy as np
import pytest

from han_compose import compose, compose_layout, compose_standalone, web_export


def test_every_style_pins_each_of_its_fonts_by_sha256_and_licence() -> None:
    assert compose.DEFAULT_STYLE == "sans" and set(compose.STYLES) == {"sans", "serif"}
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


def test_models_of_another_style_are_cached_under_their_own_names() -> None:
    assert compose_layout.layout_file("sans") == compose_layout.LAYOUT_FILE
    assert compose_layout.layout_file("serif") == "compose-layout-v4-serif.npz"
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


def test_the_cli_refuses_a_style_it_does_not_know() -> None:
    import sys

    import typer

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import compose_ids

    assert compose_ids._style("serif") == "serif"
    with pytest.raises(typer.BadParameter):
        compose_ids._style("mincho")
