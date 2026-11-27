"""A character only a fallback of another design draws is composed in the main font."""

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from han_compose import compose
from han_compose.vocab import cache_root


def test_names_stroke_looks_only_for_cjk_strokes_characters() -> None:
    assert compose._names_stroke(compose.parse("⿱𠂆㇇"))
    assert not compose._names_stroke(compose.parse("⿺走馬"))


@pytest.mark.parametrize(("kindred", "own", "foreign"), [(False, False, True), (False, True, False), (True, False, False)])
def test_foreign_is_a_character_only_a_fallback_of_another_design_draws(kindred: bool, own: bool, foreign: bool) -> None:
    font = SimpleNamespace(style=SimpleNamespace(kindred=kindred), own=lambda _: own, glyph=lambda _: None, has=lambda _: True)
    assert compose.Composer(font, {}, weighted=False)._foreign("靇") is foreign


@pytest.fixture(scope="module")
def fangsong() -> compose.Composer:
    style = compose.STYLES["fangsong"]
    if not all((cache_root() / "fonts" / source.file).exists() for source in (style.font, *style.fallbacks)):
        pytest.skip("The Fangsong fonts are not cached.")
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import compose_ids

    return compose_ids._composer("fangsong")


@pytest.mark.parametrize(("sequence", "char"), [("⿱雨龍", "靇"), ("⿺走馬", "𧽙"), ("⿰虫⿱艹魚", "䔡")])
def test_a_character_only_jigmo_draws_is_composed_in_zhuque(fangsong: compose.Composer, sequence: str, char: str) -> None:
    assert fangsong.font.has(char) and not fangsong.font.own(char)
    drawn = fangsong.compose(sequence)
    assert all(fangsong.font.own(part.origin.split()[-1]) for part in drawn)
