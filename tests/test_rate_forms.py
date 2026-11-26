from han_compose.compose import STYLES, key, parse
from han_compose.rate_forms import rate_forms_for, rate_part


def test_rate_choices_round_trip_and_distinguish_both_axes():
    for host in ("率", "蟀", "𳅀"):
        choices = rate_forms_for(host)
        assert len(choices) == 4
        for text in choices.values():
            assert key(parse(text)) == text
            assert rate_forms_for(text) == choices
        for style in STYLES.keys() & {"sans", "serif", "regular", "pen-writing", "fangsong"}:
            parts = [rate_part(text, style, set()) for text in choices.values()]
            assert all(parts)
            assert len({tuple(c.light.tobytes() for c in p.contours) for p in parts}) == 4
    assert not rate_forms_for("木")


def test_composer_draws_each_selected_host_without_a_font_fallback():
    from types import SimpleNamespace
    from han_compose.compose import Composer

    font = SimpleNamespace(style=STYLES["serif"], glyph=lambda char: None, has=lambda char: False)
    composer = Composer(font, {}, weighted=False)
    for host in ("率", "䔞", "蟀", "𳅀"):
        for text in rate_forms_for(host).values():
            placed, = composer.compose(text)
            assert placed.part is rate_part(text, "serif", set())
