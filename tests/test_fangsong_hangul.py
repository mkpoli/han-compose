"""Tests that the fangsong style resolves Hangul syllables through Jujak Batang before Jigmo."""

from __future__ import annotations

from han_compose import compose


def test_fangsong_hangul_uses_jujak_batang() -> None:
    font = compose.Font.of("fangsong")
    # Jujak Batang is the first fallback and supplies Hangul syllables Zhuque Fangsong lacks.
    assert font.fallbacks[0].path.name == "JujakBatang-Regular.otf"
    for ch in ("도", "국", "한", "글", "갗"):
        assert ord(ch) in font.fallbacks[0].cmap
        glyph = font.glyph(ch)
        assert glyph is not None and len(glyph.contours) > 0


def test_fangsong_enclosure_with_hangul() -> None:
    composer = compose.Composer(compose.Font.of("fangsong"), compose.drawn_sequences("fangsong"))
    drawn = composer.compose("⿴口도")
    assert drawn is not None
    assert len(drawn) == 2
    assert drawn[1].origin == "glyph 도"
    svg = compose.svg(drawn)
    # Jujak Batang uses smooth curves (Q/C) rather than Jigmo's polygon-only KAGE strokes.
    assert "Q" in svg or "C" in svg
