# han-compose

Draws an Ideographic Description Sequence as outlines in GenZui Sans, or in a serif (明朝) style
from Noto Serif CJK JP. Parts come from characters the font already draws, laid out where its designers put parts like these and brought to one
stroke weight. The result is a set of outlines in the font's 1000-unit em, written out as an SVG
path.

## Run

```sh
uv sync
uv run scripts/compose_ids.py draw ⿰亻哥 > 亻哥.svg
uv run scripts/compose_ids.py bench --chars joyo
uv run scripts/compose_ids.py draw --style serif ⿰亻哥 > 亻哥-serif.svg
```

Every command takes `--style sans` (the default) or `--style serif`. Each style has its own fonts,
stroke-width fit and models: a serif model is cached as `<name>-serif.<ext>` beside the sans one, and
`learn --style serif` and `learn-alone --style serif` build it.

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

`export-web` writes what a browser port of the composer reads: the learned layout, the records of
every character and sequence and the host lists of every place and operand, a manifest with the
composer's version, its constants and the licence notices, and the licence texts. Records and host
lists are packed into gzipped shards named by the first three hex digits of their SHA-256
(`g/<hhh>.json`, `p/<hhh>.json`, at most 4,096 each), each a JSON object from the full hash to the
record or list, so a page loads only the shards a sequence names. `--parity N` adds N reference
drawings of compound jōyō kanji whose hosts join the export, and `--held-out M` M more whose hosts
do not, for the port's parity test.

Workers write one file per record and host list under `out/.work/`, which a stopped run resumes
from, and the export builds the shards from them at the end. `export-web-pack` builds the shards
again from a finished folder's `.work/`, and brings its manifest, parity files and `.export` stamp
to format 5, so a format-4 folder whose `g/` and `p/` are moved under `.work/` becomes the folder
a format-5 export writes. A rerun resumes from `.work/` only under the same version, which names
the commit: from another commit `export-web` starts afresh.

Records hold every letter and digit of an alphabet or syllabary the style's fonts draw (Latin,
IPA, Greek, Cyrillic, kana, Hangul, the full- and half-width forms), so a sequence such as
`⿸广⿰KO` draws in a port. `export-web OUT --add letters` writes those records into a finished
folder made before they were part of the export, after checking that the folder's fonts, layout and
KanjiVG are the ones in use and that this commit records 40 of the folder's characters exactly as
the folder holds them. `export-web-pack` then rebuilds only the shards the new records fall in;
`--changed-list FILE` lists those whose bytes changed, with the manifest, for
`rclone copy --files-from`. The version stays, since no record the folder held changes; the
manifest's `added` names the commit, the set, the count and the shards changed. `--dry-run` reports
how many keys and shards an addition would take and writes nothing.

`.work/` must never be uploaded: each of its files would be one more object written. Exclude it
when copying the folder out:

```sh
uv run scripts/compose_ids.py export-web out/ --parity 500 --held-out 300 --workers 4
uv run scripts/compose_ids.py export-web-pack out/
rclone copy out/ <remote>:<bucket>/<version>/ --exclude '.work/**'
```

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
| `src/han_compose/web_export.py` | the layout and drawing data for a browser port |
| `scripts/compose_ids.py` | `draw`, `bench`, `calibrate`, `learn`, `learn-alone`, `export-web`, `export-web-pack` |
| `tests/` | tests over cutting, layout, drawn output and the web export |
| `docs/design/ids-composer.md` | the method, its measurements, and what did not help |

## Sources

`docs/licensing.md` states what the code, the fonts and the tables are under. In short: Noto Sans CJK
JP and Plangothic (SIL OFL 1.1) supply every sans outline, Noto Serif CJK JP (SIL OFL 1.1) and Jigmo
(CC0 1.0) every serif one; BabelStone IDS and cjkvi-variants supply the
sequences and the radical forms; hfhchan/ids (MIT) supplies the list of ideographs left
undecomposed; KanjiVG (CC BY-SA 3.0) supplies component ownership when a host is cut. Glyphs drawn
from KanjiVG-assisted cuts are shared alike, with its notice kept. The `export-web` manifest carries
the same notices for the data it writes.
