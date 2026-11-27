"""An enclosed part drawn from its own glyph stays in the room its enclosing part's characters give."""

import sys
from pathlib import Path

import pytest

from han_compose import compose
from han_compose.vocab import cache_root


def test_a_box_inside_its_room_stays() -> None:
    assert compose._moved_into((20, 20, 60, 60), (0, 0, 100, 100)) == (20, 20, 60, 60)


def test_a_box_is_moved_the_least_way_into_its_room() -> None:
    assert compose._moved_into((-10, 20, 30, 60), (0, 0, 100, 100)) == (0, 20, 40, 60)
    assert compose._moved_into((70, 80, 110, 120), (0, 0, 100, 100)) == (60, 60, 100, 100)


def test_a_box_larger_than_its_room_is_shrunk_in_its_proportions() -> None:
    moved = compose._moved_into((-150, -50, 250, 150), (0, 0, 100, 100))
    assert moved == pytest.approx((0, 25, 100, 75))


def test_the_room_of_a_wrapper_holds_its_enclosed_part() -> None:
    style = compose.STYLES["fangsong"]
    if not all((cache_root() / "fonts" / source.file).exists() for source in (style.font, *style.fallbacks)):
        pytest.skip("The Fangsong fonts are not cached.")
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import compose_ids

    composer = compose_ids._composer("fangsong")
    if composer.layout is None:
        pytest.skip("The Fangsong layout is not cached.")
    share = composer._enclosed_share("⿹", "勹")
    assert share is not None and 0 < share[0] < share[2] < 1 and 0 < share[1] < share[3] < 1
    outer, inner = composer.compose("⿹勹龍")
    height = outer.target[3] - outer.target[1]
    # Zhuque's own ⿹勹 characters keep their enclosed part clear of 勹's foot; the network alone
    # set 龍 on it (0.008 of the height above).
    assert inner.target[1] >= outer.target[1] + 0.04 * height
