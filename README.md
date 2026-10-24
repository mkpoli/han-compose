# han-compose

Draws an Ideographic Description Sequence as outlines in GenZui Sans. Parts come from characters
Noto Sans CJK JP already draws, laid out where its designers put parts like these and brought to one
stroke weight. The result is a set of outlines in the font's 1000-unit em, written out as an SVG
path.

## Run

```sh
uv sync
uv run scripts/compose_ids.py draw ⿰亻哥 > 亻哥.svg
uv run scripts/compose_ids.py bench --chars joyo
```

`bench` redraws every compound jōyō kanji from its own sequence with nothing taken from the
character, and scores each against the font's real glyph: the overlap of their ink (intersection
over union, at 96 px), how many come out with their outline length within 15% of the real glyph's,
and the ratio of their stroke widths. `draw` accepts any sequence, including one no character is
encoded for.

Drawing needs two models under `cache/`, which `learn` and `learn-alone` build from the font itself
and need `uv sync --extra train`:

```sh
uv run --extra train scripts/compose_ids.py learn
uv run --extra train scripts/compose_ids.py learn-alone
```

Drawing with the guide needs `onnxruntime`, and training needs `torch`. `uv sync --all-extras --group dev`
keeps both: syncing one extra alone drops the other.

Fonts download to `cache/fonts/` on first use. `$HAN_COMPOSE_CACHE` points the cache elsewhere.
`COMPOSE_GUIDE` points at a folder of `guide-*.onnx`.

## Layout

| Path | |
|---|---|
| `src/han_compose/compose.py` | the composer: hosts, cuts, layout, weight |
| `src/han_compose/compose_layout.py` | where a character's two operands go, learned from the font |
| `src/han_compose/compose_standalone.py` | the size a part takes when it stands alone |
| `src/han_compose/kanjivg_cuts.py` | cutting a host along KanjiVG's component groups |
| `src/han_compose/vocab.py` | the vocab tables and the cache |
| `scripts/compose_ids.py` | `draw`, `bench`, `calibrate`, `learn`, `learn-alone` |
| `tests/` | 26 tests over cutting, layout and drawn output |
| `docs/design/ids-composer.md` | the method, its measurements, and what did not help |

## Sources

`docs/licensing.md` states what the code, the fonts and the tables are under. In short: Noto Sans CJK
JP and Plangothic (SIL OFL 1.1) supply every outline; BabelStone IDS and cjkvi-variants supply the
sequences and the radical forms; hfhchan/ids (MIT) supplies the list of ideographs left
undecomposed; KanjiVG (CC BY-SA 3.0) supplies component ownership when a host is cut. Glyphs drawn
from KanjiVG-assisted cuts are shared alike, with its notice kept.
