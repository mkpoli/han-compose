# Data in this package

Everything under `data/` is drawn by the engine. `data/vocab/` is the composer's tables; the rest are
the shapes it draws parts from when no host character has them.

| Path | What |
|---|---|
| `vocab/` | the composer's tables: sequences, radical forms, hand forms, atomic characters, constructs |
| `sources/tangut/outlines.json.gz` | Noto Serif Tangut outlines, and the exact descriptions from the IDS table |
| `sources/bopomofo/outlines.json.gz` | the 75 Bopomofo letters, from Noto Sans CJK JP and Plangothic |
| `sources/new-korean/outlines.json.gz` | the four letters of the New Korean Orthography (1948) |
| `sources/shuishu/outlines.json.gz` | 533 Shuishu outlines at the proposed block's tentative allocations |
| `sources/small-seal/outlines.json.gz` | the Small Seal glyphs at the proposed allocation, and their exact descriptions |
| `sources/palette/outlines.json.gz` | 79 palette components no export's font draws |
| `palette/fallback-characters.json`, `palette/bundled-coverage.json` | the same, listed and indexed |
| `unicode/outlines/*.json.gz`, `unicode/coverage.json`, `unicode/outlines.json` | 56,651 outlines of loose marks and parts no other source draws |
| `licences/` | the OFL, CC0, MIT and Unicode texts the export carries |

Noto Sans CJK JP and Plangothic are SIL OFL 1.1; Noto Serif Tangut too. Unicode data is under the
Unicode License v3 (`licences/Unicode-3.0.txt`). The Small Seal allocation, the New Korean letters and
the Shuishu block are proposals, not assigned code points; nothing here is drawn from a font these
notices do not name.

The shape files were written for a browser port of the composer and moved here, unchanged, with the
port. The scripts that rebuilt them stay in the project that sources and audits the data; each file
records its own font checksums.

## Where drawn shapes are cut along KanjiVG

A part cut along KanjiVG's component groups (`kanjivg` in a drawing) adapts KanjiVG, CC BY-SA 3.0;
a drawing with one is shared alike. The export carries the notice.

## `bench/sets.json`

The characters `bench` runs by default, chosen by this project from its own survey: 3,716 characters
(every jōyō compound and a stratified draw from outside it), each redrawn with nothing taken from it
in the sans, serif and kaisho styles. `hard` holds those in the worst 10% of all three by aligned
overlap. `tracking` is square-root stratified over operator and jōyō membership, seed 2026, less the
hard set. Held out of the choice, the Fangsong style found 21 of the 31 hard characters it draws among
its worst 10%, against 6% of the characters no other style found hard.
