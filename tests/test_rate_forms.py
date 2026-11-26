from han_compose.compose import STYLES, key, parse, svg_path
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
            assert svg_path([placed]).startswith("M")


def test_nested_rate_choice_preserves_metrics_and_sibling_box():
    from types import SimpleNamespace
    from han_compose.compose import Composer

    font = SimpleNamespace(style=STYLES["serif"], glyph=lambda char: None, has=lambda char: False)
    composer = Composer(font, {}, weighted=False)
    for host in ("率", "蟀", "𳅀"):
        choices = list(rate_forms_for(host).values())
        metrics = set()
        boxes = set()
        for text in choices:
            node = parse(text)
            metrics.add((composer.ink(node), composer.aspect(node), composer._outlines(node),
                         composer.crossings(node, 0), composer.crossings(node, 1)))
            assert not composer._unknown(node)
            left, right = composer.compose("⿰" + text + choices[0])
            assert left.part is rate_part(text, "serif", set())
            boxes.add(tuple(right.target))
        assert len(metrics) == len(boxes) == 1
