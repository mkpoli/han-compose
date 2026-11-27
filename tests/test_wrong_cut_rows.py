"""Host cuts listed as wrong in a style's font are not taken."""

import sys
from pathlib import Path

import pytest

from han_compose import compose
from han_compose.vocab import cache_root


def _composer(style: str) -> compose.Composer:
    s = compose.STYLES[style]
    if not all((cache_root() / "fonts" / source.file).exists() for source in (s.font, *s.fallbacks)):
        pytest.skip(f"The {style} fonts are not cached.")
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import compose_ids

    composer = compose_ids._composer(style)
    if composer.layout is None:
        pytest.skip(f"The {style} layout is not cached.")
    return composer


@pytest.mark.parametrize(("style", "sequence", "host"), [
    # 畐's first 一 is one outline with 勹 in Zhuque's 匐.
    ("fangsong", "⿹勹龍", "匐"),
    # The lower 龖 of Kureedo's 𪚥 is cut below the first strokes of its two 龍.
    ("pen-writing", "⿱雲⿰龍龍", "𪚥"),
])
def test_a_listed_host_gives_no_part(style: str, sequence: str, host: str) -> None:
    composer = _composer(style)
    assert composer.wrong_cut(host)
    assert all(part.origin.split()[-1] != host for part in composer.compose(sequence))
