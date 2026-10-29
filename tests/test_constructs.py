import pytest

from han_compose import compose as C, compose_layout
from han_compose.vocab import cache_root


def test_the_construct_table_names_the_host_and_piece():
    spec = C.constructs()["⿳山𠚍禸"]
    assert spec["host"] == "𱵺"
    assert spec["keep"] == "bottom"
    assert spec["keep_parts"] == 1


@pytest.fixture(scope="module")
def composer() -> C.Composer:
    font = cache_root() / "fonts" / C.STYLES["sans"].font.file
    layout = cache_root() / "compose" / compose_layout.LAYOUT_FILE
    if not font.exists() or not layout.exists():
        pytest.skip("The font or the layout model is not cached.")
    c = C.Composer(C.Font(font, C.fallback_files()), C.japanese_sequences())
    c.layout = compose_layout.LayoutModel.load(layout)
    return c


def test_the_bottom_of_the_host_replaces_the_last_operands(composer: C.Composer):
    out = composer.compose("⿳山𠚍禸")
    assert len(out) == 2
    assert out[0].target[1] > out[1].target[1]
    assert out[1].origin.startswith("construct 𱵺 bottom")
    assert out[1].target[2] - out[1].target[0] > 0
