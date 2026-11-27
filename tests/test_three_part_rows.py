"""A row or column of three is drawn through pairings of its neighbours where that deforms less."""

import sys
from pathlib import Path

import pytest

from han_compose import compose
from han_compose.vocab import cache_root


def _placed(source: compose.Box, target: compose.Box, cut: bool = False) -> compose.Placed:
    return compose.Placed(compose.Part([]), source, target, cut=cut)


def test_evenness_is_the_least_scale_over_the_greatest() -> None:
    whole = _placed((0, 0, 900, 900), (0, 0, 900, 900))
    squeezed = _placed((0, 0, 900, 900), (300, 0, 600, 900))
    assert compose._evenness([whole]) == 1
    assert compose._evenness([whole, squeezed]) == pytest.approx(1 / 3)


def test_evenness_leaves_out_cut_parts_and_the_width_of_a_lone_stroke() -> None:
    whole = _placed((0, 0, 900, 900), (0, 0, 900, 900))
    stroke = _placed((0, 400, 900, 430), (0, 400, 900, 415))
    taken = _placed((0, 0, 900, 900), (0, 0, 90, 90), cut=True)
    assert compose._evenness([whole, stroke, taken]) == 1


@pytest.fixture(scope="module")
def fangsong() -> compose.Composer:
    style = compose.STYLES["fangsong"]
    if not all((cache_root() / "fonts" / source.file).exists() for source in (style.font, *style.fallbacks)):
        pytest.skip("The Fangsong fonts are not cached.")
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import compose_ids

    return compose_ids._composer("fangsong")


@pytest.mark.parametrize("sequence", ["⿲氵木目", "⿳艹日心"])
def test_the_middle_of_three_is_not_a_whole_glyph_squeezed_into_its_slot(fangsong: compose.Composer, sequence: str) -> None:
    tree = compose.parse(sequence)
    region = fangsong.face
    written = fangsong._node(tree, region, at_root=True, regroup=False)
    drawn = fangsong._node(tree, region, at_root=True)
    assert compose._evenness(drawn) > compose._evenness(written)
    assert compose._evenness(drawn) > 0.6


def test_three_of_the_same_part_stay_a_row_of_three(fangsong: compose.Composer) -> None:
    tree = compose.parse("⿲木木木")
    assert fangsong._node(tree, fangsong.face, at_root=True) == fangsong._node(tree, fangsong.face, at_root=True, regroup=False)


def test_a_pairing_only_the_fallback_draws_is_drawn_from_the_main_font(fangsong: compose.Composer) -> None:
    # Zhuque has no 𢗭 (⿱日心); Jigmo does, in a Mincho design.
    assert not fangsong.font.own("𢗭") and fangsong.font.has("𢗭")
    drawn = fangsong._node(compose.parse("⿳艹日心"), fangsong.face, at_root=True)
    assert all(fangsong.font.own(part.origin.split()[-1]) for part in drawn)
    assert "𢗭" not in fangsong.exclude
