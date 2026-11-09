# Data

Each file keeps its own licence; the MIT licence of the code does not cover them.

## `open-data/`

The release served at <https://ids.mkpo.li/open-data>: the descriptions this project transcribed
or read, one row per description, each citing its source. JSON, TSV, the numbered components and a
README with the fields and the source list; CC0 1.0. Built by `bun scripts/build_open_ids.mjs`
from the starter catalogue in `demo/lib/examples.js`, its source records and
`data/ids-components.tsv`.

## `yi-bai-ids.tsv.gz`

Standard IDS descriptions from Yi Bai's level-1 IDS dataset at commit
`da1e9f8a09e2ec8faaf176bac99203f978282041`, <https://github.com/yi-bai/ids>.
The source file's SHA-256 is `51f78d7d84f52fd73e5bc155c2239b737c58ce627d446894a809f1a36547ae18`.
The compiled table contains 64,110 entries, in the same format as `babelstone-ids.tsv.gz` but
without region tags. Rebuild it with `bun scripts/build_yi_bai_ids.mjs`.

Descriptions carrying an operator modifier are kept: `⿻[1:]丨日` for 甲 reads and writes back with
its modifier, so the description keeps the meaning the modifier gives it. Descriptions carrying
glyph-variant notes or stroke chains are excluded until those can be represented; what the parser
reads of that notation is measured by `bun scripts/audit_zi_ids.mjs` and recorded in
[the coverage note](../docs/zi-tools-coverage.md). Both primary and alternative descriptions are
retained. The workshop adds them after BabelStone's descriptions, keeping existing descriptions and
their region tags when the two sources agree.


Licence: MIT, Copyright (c) 2021 Yi Bai; see `data/licences/yi-bai-ids-MIT.txt`.

## `zi-tools-chains.tsv.gz`

zi.tools descriptions that carry a stroke chain this package cannot draw, and the character each
names, one per line: `description<TAB>character` (乌 for `⿱丿⿹#(-𠃌㇉)一`). 839 descriptions from
Yi Bai's level-1 dataset at commit `da1e9f8a09e2ec8faaf176bac99203f978282041`, the same source as
`yi-bai-ids.tsv.gz`, both with and without their trailing glyph-variant note. The workshop passes it
as `chains`; a pasted description that fails to parse and matches resolves to its character. Rebuild
it with `bun scripts/build_zi_tools_chains.mjs`.

Licence: MIT, Copyright (c) 2021 Yi Bai; see `data/licences/yi-bai-ids-MIT.txt`.

## `babelstone-ids.tsv.gz`

BabelStone IDS (Ideographic Description Sequences for CJK Unified Ideographs) by Andrew West (魏安),
<https://www.babelstone.co.uk/CJK/IDS.TXT>, File Date 2025-06-27 (Unicode 16.0 edition), SHA-256
`cc2a0a97e6a51ed6ebe59870ef2af66e83f3c3c27387d79b4441bb2d791d78b1`. 97,680 ideographs and the
6,145 Tangut records (103,825 lines), 798 KB gzipped, 2.2 MB as text.

- Licence: public domain. Note 2 of the file's header states that IDS sequences are facts not
  eligible for copyright and that "anyone is free to make use of the IDS data provided in this file
  for personal or commercial purposes without asking permission or providing attribution". It is
  credited all the same.
- Format: one line per ideograph, `char<TAB>sequences`, every alternative the file gives,
  space-separated, each with the source regions it describes (`⿰氵骨(GHTJKPV)`). The maintainer's `*`
  notes are left out. `{n}` is BabelStone's numbered component n, kept as the source writes it;
  `data/ids-components.tsv` gives the fragments that write out the ones note 6 knows, and the adapter
  applies them. `？` is an unrepresentable one.
- The header warns that a sequence describes a character's form in the regions tagged, not an
  absolute glyph; every alternative is kept with its regions.
- The file draws on Kawabata Taichi's IDS data (<https://github.com/kawabata/ids>), itself descended
  from CHISE, and on IRG submissions, edited by its maintainer. This table is built from BabelStone's file.
- Built by `scripts/build_ids_data.py`.

## `ids-components.tsv`

BabelStone's numbered components: for each `{n}` IDS.TXT's note 6 names, the shape it describes and
the IDS fragment that writes it out (`{22}`, outside of 与, as `⿺㇉一`). 121 components, 52 with a
fragment, 4.6 KB; a component the note leaves `？` keeps its number in the descriptions that use it.
The parts palette carries all 121 as rows, marked with their fragment, description, PUA glyph and
whether they are read-only; the 52 with a fragment take the fragment's stroke count and first stroke,
and the 69 without one take the PUA glyph BabelStone Han PUA draws for the code point note 6 gives.
`{12}`, the right of 龍, is `⿷己三` here: the note leaves it unrepresentable, and 龍's description
names its two halves, 𦚏 and ⿷己三.

`{82}`, the top of 書, is 聿. The note writes that shape as `⿱𦘒一`, which is 說文解字's own analysis
of 聿 (「从𦘒一聲」, <https://www.shuowen.org/view/1932>); the file uses the encoded 聿 for the same
shape elsewhere — 㶳 is `⿱{82}火` in G and `⿱聿火` in TP, 衋 is `⿱⿻聿皕血` in GHTKP and `⿳{82}皕血`
in J, and 𤱪 was `⿱聿田` before Unicode 6.0 — and CHISE's IDS writes 書 `⿱聿曰`, 畫 `⿳聿田一` and
晝 `⿱聿旦` (<https://gitlab.chise.org/CHISE/ids>). 書 then reads `⿱聿日` (`⿱聿曰` in H), 畫's X form
`⿳聿田一` and 晝's `⿱聿旦`; the G forms of 畫 and 晝 reach the same 聿 through 𤱪 `⿱聿田` and 書.

The fragments are BabelStone's own (IDS.TXT note 6), public domain; the two above are editorial. The
adapter reads the file with `babelStoneAdapter({ components })`; the descriptions it answers and
searches name the parts rather than BabelStone's numbers. Built by
`scripts/build_ids_components.py`, which fetches IDS.TXT and leaves the `{12}` and `{82}` entries in
its own header note.

## `numbered-pua-outlines.json.gz`

The 69 numbered components IDS.TXT note 6 leaves `？` have a PUA code point in the same note 6 line
but no IDS fragment. BabelStone Han PUA 1.472 draws them; this file records their outlines, and
`fonts/IDSNumbered.woff2` cuts the same 69 from the font for the palette's text. The document records
the font name, Arphic Public License and source SHA-256; the PUA code points are not stable across
font versions, so the palette's `glyph` column is tied to that version. Built by
`uv run scripts/build_numbered_pua.py`; the outlines are merged by
`scripts/build_palette_outlines.py`, and the font is under the Arphic Public License
(`fonts/LICENSE-BabelStoneHanPUA.txt`).

## `numbered-forms.json` and `numbered-sans-outlines.json.gz`

The 69 numbered components with no IDS fragment have two faces. `numbered-forms.json` holds their
component forms: the Sans forms are cut from the host characters' Noto Sans CJK JP 2.004 and Plangothic
V2.9.5795 glyphs, using the component's BabelStone PUA glyph as the shape to match; the Serif and
Kaisho forms are the PUA glyph itself. 60 have a clean host cut. The other 9 (`{23}`, `{27}`,
`{65}`, `{79}`, `{90}`, `{92}`, `{103}`, `{111}`, `{118}`) have no clean cut and use the PUA
glyph in Sans too; the file lists them in `fallback`.
`numbered-sans-outlines.json.gz` carries the same 69 Sans outlines for the palette source, so a
description draws the cut in the Sans face and the PUA glyph in Serif. The contextual Sans `{5}`
variant in `numbered-five-context.json` uses the native left portion of 葭 in Noto Sans CJK JP 2.004,
centred without reshaping; regenerate it with `scripts/build_numbered_five.py`. The cuts use han-compose
`fec2847` and record their font versions and digests in `numbered-forms.json`; the PUA glyphs are
under the Arphic Public License, the Noto and Plangothic cuts under their own SIL OFL terms.

## `ids-project.tsv.gz`

This project's own IDS descriptions: characters newer than BabelStone's Unicode 16.0 edition and
Yi Bai's set, and curated corrections of a source description that writes a base character where the
glyph's left column uses its positional form (𣲍's ⿰水兀 read as ⿰氵兀). The source is
`data/ids-project.tsv`, one line per description, `char<TAB>IDS<TAB>source`;
`scripts/build_ids_project.py` checks each description and writes the compact
`char<TAB>sequences` table the adapter reads with `babelStoneAdapter({ additionalIds })`. The
adapter puts these rows before the sources', so the curated reading is the one read first; the
source's own spelling stays in the table as an alternative.

The table is currently empty. The newer character this project knows, 𳑳 (U+33473), is a 獨體字 with
no IDS decomposition; it is listed in `ids-characters.tsv` instead. Add a line here only for a
character that decomposes.

The descriptions are this project's, not a copy of CHISE's or BabelStone's. The built table is
downloadable at <https://github.com/mkpoli/ids-input/raw/main/data/ids-project.tsv.gz>, and its
source at <https://github.com/mkpoli/ids-input/raw/main/data/ids-project.tsv>.

## `ids-characters.tsv`

Characters this project draws from their own outline rather than an IDS composition. One line per
character, `char<TAB>source`; `scripts/build_project_outlines.py` and
`scripts/build_project_font.py` read it.

`𳑳` (U+33473) is CJK Extension J (U+323B0–U+33479), Unicode 17.0, released 2025-09-09. Unihan
18.0.0 gives `kIRG_VSource` VN-F0BEA, `kRSUnicode` 212.-9, `kTotalStrokes` 7 and `kStrange` I:U+9F8D.
It is a 獨體字; its outline and UI glyph come from Plangothic P2 (SIL OFL 1.1).

## `ids-overwrites.tsv`

Descriptions drawn as an encoded character (an overwrite) instead of a composition. One line per description,
`sequence<TAB>char<TAB>source`; `babelStoneAdapter({ overwrite })` answers the character, and the
preview draws that character's glyph in the chosen face before composing the parts.

`⿰𦚏𳳳` (JYutnet JYN00025, CSK1939 p.4) is a variant form of 龍. Its right side, 𳳳 (U+33473), is a
獨體字 with its own outline when it stands alone; inside 龍 the encoded 龍 glyph supplies the side
form, so the variant draws as 龍.

`⿷⿺己一三` is zi.tools' stroke-level decomposition of 𳳳, not an IDS decomposition. Drawing it
overwrites the operands with 𳳳's own outline, so the composition does not invent a form.

## `donor-parts.json`

A character written as a vertical stack standing on 山, with the font's drawing of it cut into the
parts its description names. 117 of the 138 characters BabelStone describes that way, 654 KB. Each
entry holds the character, its description, the face that drew it, the untouching outlines the font
draws, those outlines labelled with the element each belongs to, and the description read back as
layers:

```json
{"format":"ids-input/donor-parts","version":1,
 "faces":[{"name":"Noto Sans CJK JP","version":"…","file":"…","sha256":"…"}],
 "candidates":138,
 "entries":[{"char":"㞪","ids":"⿱{42}山","face":"Noto Sans CJK JP","likeness":0.591,"ownFace":true,
   "parts":[{"leaf":"{42} 彐","path":[["M",164,791],["L",164,728],["Z"]]}],
   "first":["{42} 彐","山"],"terminal":["{42} 彐","山"],
   "pieces":[[["M",164,791],["Z"]]],
   "recursive":[{"leaf":"{42} 彐","children":[]}]}],
 "skipped":[{"char":"𰎧","ids":"⿱阜山","reason":"…"}]}
```

Paths are command lists in glyph units on a 1000-unit em, `["M",x,y] ["L",x,y] ["Q",…4] ["C",…6]
["Z"]`, one contour per list or a list of contours where a part has counters. `parts` and `pieces`
cover the same ink: a part is one or more whole pieces, never a piece cut in two, so no boundary
appears that the font does not already draw. `first` is the outer operator's operands written back
out, `terminal` the elements the description ends in, and `recursive` each of those elements spelled
out by its own first sequence, to the bottom. A numbered component is labelled `{42} 彐`, the
reference with the fragment `ids-components.tsv` writes for it, and bare where that table has none.
Where one element occurs twice, each part carries its position: 岀's two 山 are 山上 and 山下.

Rebuild with `uv run scripts/build_donor_parts.py`, or add `--check` to verify the committed file;
two runs write the same bytes. The script draws each character from the faces pinned in
[`unicode-fonts.json`](unicode-fonts.json) — Noto Sans CJK JP 2.004 first, then Jigmo, Jigmo2 and
Jigmo3 2025-09-12 for the extension blocks Noto leaves out — checking each against its pinned
SHA-256 and fetching it into `cache/` when it is not already there. Pass `--font PATH` for a copy
already on disk.

A piece is one outline and everything its counters enclose is read with it, so a glyph that draws an
island inside a counter — 回, or Jigmo's 母 — gives up that island as a piece of its own. Two pieces
that meet at a single point are one piece, because the outline joins them there; that usually shows
up as a piece count below the number of elements, and the character is skipped.

Which element a piece belongs to is decided by shape. The pieces of a stack are sorted by height and
cut into runs; each run is fingerprinted — the ink read as coverage over a 16×16 grid of its own
bounding box — and compared with the element it would belong to as the font draws that element
alone. The reading whose groups agree best wins, and it has to win by a margin. `likeness` records
the weakest reading any element of the character was accepted at, borrowed or not, and runs from
0.26 to 0.84 across the file.

A Jigmo face draws none of the common elements its characters stand on, so those rows are recognised
against another pinned face and marked `ownFace: false`. How closely two faces agree about one
element is not a thing to hold a face to, so the floor on agreement is held only against elements
the character's own face also draws; where it draws none of them, the floor falls to all of them.
That is why a row can ship with a `likeness` under the floor: 峃 reads 0.26, on a 𰃮 that only Jigmo
draws. Normalising a shape to its own box also means a single stroke carries no shape to recognise —
Noto's 一 and 丨 fingerprint identically — so such an element is placed by the order of the stack
and the floor says nothing about it.

The 21 skipped characters are in `skipped`, each with its reason: a group of pieces does not look
like the element it would belong to (18, all drawn by a Jigmo face, their top element heavily
squashed), the glyph draws fewer pieces than the description has elements (𡸭 and 𰎧), or two
readings fit the pieces equally well (𱻚). A character no pinned face draws would be skipped too;
none is. Nothing is guessed at.

Where a face refuses a character the next one is tried, so 岳, 嵍 and 嵆 — which Noto draws with the
top element touching 山, leaving nothing to cut — ship from Jigmo, which draws them apart.

`demo/donor-review.html` draws every row for checking, served by `bun run dev` at
`/donor-review.html`; it stays out of the published demo, which has no use for the drawings.
`tests/donor-parts.test.js` holds the
invariants, and `tests/fixtures/donor-parts-reviewed.json` the 25 characters a reader has already
signed off. The shapes derive from those fonts; Noto's SIL OFL 1.1 and Jigmo's CC0-1.0 terms apply
(see `fonts/README.md`). The descriptions are public-domain facts from BabelStone IDS.

## `ids-parts.json`

The parts palette (難輸入部件): every component BabelStone IDS names, with how many ideographs use
each, its stroke count, the class of its first stroke, and whether it is common, hard to type or a
CJK stroke. 10,805 Han entries (2,935 common, 7,832 hard to type, 38 strokes; 121 of the hard
entries are BabelStone's numbered components) plus 768 Tangut components; 293 KB, 57 KB gzipped.
Built by `scripts/build_ids_parts.py` followed by `bun run build:subtrees`; see the rules below.

The panel's Common view lists the parts 50 or more ideographs use, judged by real IDS use rather than
the kind column; a host part without a use count falls back to its c kind. BabelStone's numbered
components stay out of Common and appear under their stroke counts. Its stroke groups list every
common and hard-to-type part of the chosen count, with counts from 23 strokes up sharing one chip.

- Licence: **LGPL-3.0** for the Rime-derived `first` column. The source authors and the LGPL/GPL
  texts are in `data/licences/`. The other columns use public-domain sequences, MIT-licensed
  decomposition choices, Unicode data and explicit radical counts.
- Format: `columns` `[part, uses, strokes, derived, first, kind, fragment, description, readonly,
  glyph]` and one row per part, most used first; `kind` is `c` (common), `d` (hard to type) or `s`
  (CJK stroke). `fragment`, `description`, `readonly` and `glyph` belong to the numbered components:
  the IDS fragment note 6 gives, where it occurs, whether the palette lists it without inserting it,
  and the PUA character BabelStone Han PUA draws for it. The 69 components note 6 leaves `？` have a
  glyph and no stroke count, so they sit under `?`; the 52 with a fragment have a count and no glyph.
- `uses`: the ideographs whose descriptions name the part, counted from the descriptions with
  BabelStone's numbered components written out as `data/ids-components.tsv` gives them, so 書 counts
  聿. The three components only the write-out names, ⺂, ⺕ and 彐, are parts too. A numbered
  component's own `uses` counts the source spelling, so `{42}` counts the descriptions that name it,
  not the 彐 those descriptions read as.

The displayed Common palette places traditional, simplified and positional forms
from `component-forms.tsv` next to one another. Each family starts where its
first member appeared in frequency order; forms remain separate selectable
entries. Contextual search substitutions such as 田/由/甲/申/电, 己/已/巳,
用/甩 and 斗/鬥 remain separate. Stroke-count and first-stroke groups keep their boundaries, and Recent
keeps selection order. The data file itself remains frequency-sorted.

Sources:

- BabelStone IDS, as above: which components the sequences use, how many ideographs use each, and
  which split only into strokes.
- hfhchan/ids v1.0.2, `ids-20240112.txt`, Copyright (c) 2021 Henry Chan, MIT licence
  (<https://github.com/hfhchan/ids>, SHA-256
  `7466c8bd9151f1db5ef247fcbf84d7de4b36a6ec741e793c54972aa3dcbc0af4`): which components are left
  undecomposed (王 is not ⿱一土).
- Unihan 18.0.0 (Unicode Han Database, UAX #38), Copyright Unicode, Inc., Unicode License v3
  (<https://www.unicode.org/license.txt>, `Unihan.zip` SHA-256
  `4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`): stroke counts
  (`kTotalStrokes`), the one-stroke ideographs counted as strokes, and the common set (`kJoyoKanji`
  for 常用漢字; `kTGH` positions 1–3500 for the first level of the 通用规范汉字表).
- Rime five-stroke dictionary, revision `1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48`,
  LGPL-3.0, <https://github.com/rime/rime-stroke>. Authors: 四季的風, 雪齋, Kunki Chou and 宋天.
  The table credits CNS11643, 北大中文論壇 and 宋天's extension data.
  SHA-256: `b3e93dce89c185f45c3d6e189b86b3a8626913352cc85e1094c786579a665791`.

Notes on the columns:

- Rime codes supply the first-stroke class: h/s/p/n/z → 横/豎/撇/點/折.
  The first listed code is used unless the alternatives start only with s and z; those entries
  use 豎 so vertical hooks in 小 and 水 agree with the palette's CJK stroke table.
  Unicode equivalents of individual CJK strokes use that table directly, including
  亅 → 豎, 乀 → 點 and 𠃍/𠃎 → 折. The equivalents come from `component-forms.tsv` below.
  Other stroke-order differences follow the first Rime code and can differ from Japanese order.
  All 10,613 single-character Han components have a first-stroke class; the 32 compound parts
  have none and group under the unknown heading. ⻀, the four-stroke grass radical, starts 横.
  Circular ㇣ appears under “Other stroke”.
- A stroke count is Unihan's first `kTotalStrokes` value, which Unihan gives for the zh-Hans form
  where forms differ. The radical forms absent from Unihan have explicit counts:
  ⺊ 2, ⺌ 3, ⺗ 4, ⺼ 4, ⺈ 2, ⺶ 6, ⺄ 1, ⺝ 4, ⺀ 2, ⺆ 2, ⺻ 5, ⻀ 4, ⺂ 1, ⺕ 3.
  A CJK stroke counts 1 and is marked derived; other missing counts use the sum over the leaves
  of the first fully counted decomposition. All Han palette entries have a count.

## `sketch-parts.json.gz`

The drawing search's prepared glyph shapes: the 11,417 parts the sketch builder prepares, each fitted to the 40×40
square twice (stretched and with its own proportions) and packed as 200 bytes of bits; 1.8 MB
gzipped. Format:

```json
{"format":"ids-input/sketch-parts","version":1,"size":40,"font":"…","fonts":{"file":"sha256"},
 "parts":[["木",4,3348,"<base64 stretched>","<base64 kept>"]]}
```

Rebuild with `uv run scripts/build_sketch_parts.py` (or `bun run build:sketch-parts`). The script
draws each part with Noto Sans CJK JP 2.004 at `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`
(override with `NOTO_SANS_CJK`), then GenZui Sans 0.105, Kureedo 0.4.3, the Plangothic P1/P2
palette subset and Noto Serif Tangut for Tangut parts. If none of those faces has a glyph, it uses
the `IDS Fallback` shards in `fonts/unicode/`, selected by `fonts/unicode.css`, whose hashes and
provenance are recorded in
`fonts/unicode.json`; it skips a part drawn as the notdef box. The script checks Noto's SHA-256
against the build it came from and records the primary font hashes and the `unicode.json` manifest
hash in the file. The shapes derive from those fonts and fallback shards; their SIL OFL 1.1 terms
apply (see `fonts/README.md`). `src/core/sketch-data.js` decodes the file and describes each mask for
matching;
`babelStoneAdapter({ sketches })` serves it, and the pad falls back to drawing the page's fonts when
a host has no prepared file.

## component-forms.tsv

Component forms that stand for another character (⺡ for 氵, 氵 for 水), which the description search
folds together. Copied from han-compose (<https://github.com/mkpoli/han-compose>, MIT)
`data/vocab/han-component-forms.tsv` at commit efb5acb, its first header line changed to say so;
SHA-256 of this copy `7e12d79da41b18f5fbf8fb0eae2adc31aa9f57e6e2eabe79836804c072008c38`. Its rows come from Unicode's EquivalentUnifiedIdeograph.txt 18.0.0
(Unicode License v3, <https://www.unicode.org/license.txt>; 348 rows) and cjkvi-variants'
`radical-variants.txt` at e4f1da2 (public domain, <https://github.com/cjkvi/cjkvi-variants>; 219
rows), each row naming its source.

## component-names.tsv

The names, words and readings people use for components, for the parts finder's search: 絞絲 and
绞丝 for 糸, ノ文 and のぶん for 攵, ノ木 and のぎ for 禾, 宝盖 and 寶蓋 for 宀, 倒八 for 丷,
卷字头 for 龹, and water, silk, みず, shui, mizu, jiaosipang, 수, thủy, Bộ Thủy, Kangxi radical 120
for the same components. 6,642 rows, 298 KB (58 KB gzipped), built by
`scripts/build_component_names.py`. Format: `name`, `char`, `source`, `detail`, one name for one
component per row; comments start with `#`.

The search folds a query and a name (NFKC, katakana as hiragana, Latin accents off, spaces and
punctuation out, Chinese scripts through `component-name-folds.tsv`) and takes a name that is the
whole query, then one it starts, then one it stands inside; a Latin query matches whole words and
their starts, and a word of five letters or more may stand inside a longer name. The adapter opens
the component a name found into its forms from `component-forms.tsv`, keeping the forms the palette
holds, so 絞絲 offers 纟, 糹 and 糸.

- Licence: **CC BY-SA 4.0** for the file as a whole, because its KANJIDIC2 and Wikipedia rows are
  (<https://creativecommons.org/licenses/by-sa/4.0/>). The code stays MIT; the file's header carries
  every notice.

Sources:

- anzumura/kanji-tools `data/radicals.txt` at c3e52cb (`https://github.com/anzumura/kanji-tools`),
  MIT, Copyright (c) 2022 Dan H: the Japanese names and readings of the 214 radicals (のぎ, のぶん,
  うかんむり).
- KANJIDIC2, file version 4, database version 2026-301, created 2026-10-28
  (`https://www.edrdg.org/kanjidic/kanjidic2.xml.gz`), CC BY-SA 4.0, Electronic Dictionary Research
  and Development Group: further Japanese radical names (`rad_name`), and the English meanings,
  Japanese, Korean and Vietnamese readings and pinyin of the radicals (みず, 수, thủy).
- The redirects to the Japanese Wikipedia articles on the 214 radicals, read 2026-10-26, CC BY-SA
  4.0 (`https://ja.wikipedia.org/`): ノ文 and のぶん to 攴部, ノ木偏 to 禾部, 草冠 to 艸部.
- catusf/tudien `dict/radical_name.txt` at a214ee3 (`https://github.com/catusf/tudien`), CC0 1.0: the
  Chinese names of the radicals (宝盖头, 绞丝旁, 反文旁).
- amzxyz/rime-wanxiang `lua/data/others.txt` at 275c61b (`https://github.com/amzxyz/rime-wanxiang`),
  CC BY 4.0, by amzxyz: its radical-nickname block (宝盖, 绞丝, 秃宝盖) and the names it gives
  non-radical parts (倒八, 卷字头, 石字头, 仓字底).
- Mararsh/MyBox `docs/data2d/ChineseRadicals_example_zh.csv` at 107ddc3
  (`https://github.com/Mararsh/MyBox`), Apache 2.0: one Chinese name for each radical (鱼字旁,
  鸟字旁, 门字框, 骨字旁).
- The article titles and redirects to the Chinese Wikipedia articles on the 214 radicals, read
  2026-10-26, CC BY-SA 4.0 (`https://zh.wikipedia.org/`): 絞絲旁, 三點水, 寶蓋頭.
- Unihan 18.0.0 (`https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip`, Unicode License v3,
  Copyright Unicode, Inc.; SHA-256 `4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`):
  kDefinition, kMandarin, kJapaneseOn, kJapaneseKun, kHangul and kVietnamese of each radical
  (water, silk, shui, sui, mizu, 수, thủy).
- Wikidata labels and aliases for the 214 radicals, read 2026-10-27, CC0 1.0
  (`https://www.wikidata.org/`): English (Kangxi radical 120), Japanese (いとがしら), Chinese,
  Korean (실사) and Vietnamese (Bộ Thủy) names. The exact values are kept in
  `data/component-name-wikidata.json`; Latin aliases in other languages are left out.
- pypinyin 0.55.0 (`https://github.com/mozillazg/python-pinyin`), MIT: the pinyin of each Chinese
  name (baogaitou, jiaosipang, sandianshui), derived from the name.
- A Hepburn and Kunrei table in the build script, after the kana names and readings: nobun, sanzui,
  ukanmuri, nogihen, and the Kunrei spellings si, ti, tu, hu. These rows are romanizations, not
  another dictionary's names.
- OpenCC 1.4.2 (`https://github.com/BYVoid/OpenCC`), Apache 2.0, by BYVoid: the traditional
  or simplified spelling of a Chinese name where it differs, marked in `detail`. Characters that are
  radicals in their own right (几, 厂, 干, 尸, 里, 凶, 虫, 斗, 鬥) are kept as they are, since 几
  must not become 幾 and 斗 must not become 鬥. A redirect naming another radical than the article
  it points to (男部 to 女部, 鳥偏 to 酉部) is left out.

The kanji-tools, tudien, rime-wanxiang, MyBox, KANJIDIC2 and Unihan files are pinned by revision or
SHA-256 in the script. The exact Wikipedia redirects used are kept in
`data/component-name-redirects.json`, read 2026-10-26 (CC BY-SA 4.0), and Wikidata's labels and
aliases in `data/component-name-wikidata.json`, read 2026-10-27 (CC0 1.0); `--refresh` fetches both
again and rewrites them, and also rebuilds the folds.

## component-name-wikidata.json

The labels and aliases of the 214 radicals' Wikidata items, in English, Japanese, Chinese (all three
variants), Korean and Vietnamese, read 2026-10-27. The build keeps a value when it is a name of the
radical: an English `Kangxi radical N`, a Japanese or Chinese spelling, a Korean radical name
(실사, 사람인) or a Vietnamese `Bộ …` name. Values that are only the radical character, namespace
page paths, Latin aliases in other languages and values over 40 characters are left out. CC0 1.0,
214 items, 131 KB.

## component-name-folds.tsv

The characters folded together before a component name is compared: the traditional and simplified
spellings of a character, the positional forms of a component, and the Japanese shinjitai forms the
other tables leave apart. 593 folds, 15 KB, built by `scripts/build_component_names.py`. Format:
`form`, `char`, `source`; comments start with `#`.

- Source `component-forms`: `component-forms.tsv`, so 氵, 氺 and 水 fold together, as do 糹 and 纟
  with 糸, and 阝 with both 阜 and 邑.
- Source `opencc`: OpenCC 1.4.2, Apache 2.0, by BYVoid, for the traditional and simplified spellings
  (寶 to 宝, 龍 to 龙).
- Source `ja-variants`: the Japanese shinjitai forms 竜, 亀, 斉 and 歯, read with the forms they
  stand for (龍, 龜, 齊, 齒).
- Licence: **CC BY-SA 4.0** for the file as a whole
  (<https://creativecommons.org/licenses/by-sa/4.0/>); the component forms and OpenCC rows keep their
  own notices.

## character-vocabulary.tsv.gz

The readings and meanings of characters, for the parts finder's Find tab: water, shui, mizu, みず,
수 and thủy for 水; person for 人; silk for 糸. 214,533 rows, 1.7 MB gzipped. Format: `name`, `char`,
`source`, `detail`, `rank`, one name for one character per row; comments start with `#`.

The characters are every IDS character with a Unihan or KANJIDIC2 name, 48,966 in all, so a result
can be opened in the workshop. `rank` is lower for more common characters: KANJIDIC2's newspaper
frequency where it has one, otherwise 3000 plus Unihan's `kGradeLevel`. It orders equally close
names in the search.

- Unihan 18.0.0 (`https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip`, Unicode License v3,
  Copyright Unicode, Inc.; SHA-256 `4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`):
  kDefinition, kMandarin, kJapaneseOn, kJapaneseKun, kHangul and kVietnamese, and kIICore for the
  character set.
- KANJIDIC2, file version 4, database version 2026-301, created 2026-10-28
  (`https://www.edrdg.org/kanjidic/kanjidic2.xml.gz`), CC BY-SA 4.0, Electronic Dictionary Research
  and Development Group: English meanings, Japanese kana readings, pinyin, Korean and Vietnamese
  readings, nanori and frequency.
- Licence: **CC BY-SA 4.0** for the file as a whole, because its KANJIDIC2 rows are
  (<https://creativecommons.org/licenses/by-sa/4.0/>); the Unihan rows keep Unicode License v3.

## Character information panels

`character-info.json.gz` (format `ids-character-info-2`) contains meanings for 23,310 Han
characters and 6,144 Tangut ideographs. A Tangut record carries its English, Japanese and
Chinese meanings, its reconstructions (up to eight systems) and two sound glosses where the
source has them.

`scripts/build_character_info.py` builds it from:

- **Unihan 18.0.0**, `kDefinition`, Copyright Unicode, Inc., Unicode License v3.
  [Source archive](https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip), SHA-256
  `4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`.
- **[Open Tangut](https://github.com/imlooh/open-tangut)**, Copyright (c) 2026 Leah, at
  commit `f523fd524003d83ec91c7ba1e76f60808a6be6f9`. Its
  [`final_dict.json`](https://github.com/imlooh/open-tangut/blob/f523fd524003d83ec91c7ba1e76f60808a6be6f9/final_dict.json)
  has SHA-256 `8b5ed40d93e9cb82fdc5743b30090d31fdc1c24f9654b0958c9290ce360a4d0d`.
  The builder keeps the meanings in each language a record has, and the reconstructions and
  sound glosses it carries (up to eight and two); a reading the record lacks stays out. It
  also drops Chinese rows that only say 暫無解釋, point to another entry, or are editorial
  notes. Open Tangut merges CCAMC and Wiktionary entries and states that its vocabulary is not all
  verified; the panel repeats what it records rather than checking it against the dictionaries.
  The builder fetches the pinned file into `cache/` and verifies its digest.

Open Tangut publishes its compilation under MIT (`COPYING-open-tangut.txt`). Its records
merge English, Japanese and Chinese [Wiktionary](https://en.wiktionary.org/) entries (CC
BY-SA 4.0) and [CCAMC](http://ccamc.org/) data (no licence stated), so the combined Tangut
data is not MIT alone; the source line and this note carry that attribution. The Unihan
records keep Unicode License v3.

The card and the search read these meanings and readings. A Tangut reconstruction finds the
characters that carry it, with or without diacritics and tone; a query without a tone accepts
every tone. A reading can belong to several characters, and the list shows them together.

`character-meaning-aids.json` contains 57 editorial translations of selected English
senses into Han characters, with emoji mnemonics. Tangut matches require a complete
recorded English sense; no links are inferred from glyph shape or a shared component.
The reverse Han-to-Tangut links retain the matched sense. These translations describe
one meaning, not interchangeability in every context or historical descent. Han emoji
use explicitly selected characters, independently of the wording of their definitions.

The horse association for component 𘥇 is paraphrased from
[Andrew West, @TangutSea, 2020-04-21](https://www.babelstone.co.uk/TangutSea/1252582046343536641.html#Status_1252590258019094528).
This is a semantic association observed in horse-related characters, not a standalone
word definition. Other Tangut components can show glossed characters whose recorded
[BabelStone Tangut IDS](https://www.babelstone.co.uk/Tangut/TangutIDS.txt) explicitly
contain them. These are usage examples, not inferred component meanings.

The association's explicit `sense` field scopes its search links to the horse meaning;
the displayed label retains the source's qualification.

Small Seal links use the direct modern correspondences in `small-seal.json.gz`,
from the CHISE and Unicode sources described above. The MOE-derived 𠙵→口 search alias
is omitted from historical-form links. Only forms in the bundled font's
`table ∪ parts` coverage are displayed. A Tangut translation does not imply a Small
Seal ancestor. Missing meanings stay unspecified.

Rebuild with `python3 scripts/build_character_info.py`. The builder verifies both
source digests. The character-information file is fetched only when a panel is used;
hovering does not send the character to a dictionary service.

## Tangut

The same IDS table also includes 6,145 records from Andrew West's
[BabelStone Tangut IDS](https://www.babelstone.co.uk/Tangut/TangutIDS.txt).
The pinned source digest is recorded in the table header and `scripts/tangut.py`.
These factual decompositions carry no regional tags. Eight malformed source sequences
are preserved verbatim (𗆽 𗈫 𗈬 𗌜 𗓜 𗱋 𗽉 𗽧); they cannot be loaded as complete editor trees.
Single-component descriptions are also preserved.

The palette adds 768 Tangut components (U+18800–U+18AFF), ordered by code point,
with `kind: "t"` and usage counts from those records. Stroke counts and first-stroke
classes are unknown. Components Supplement is accepted by the parser but is absent
from this source edition and the palette. Both data builders include Tangut through
`scripts/tangut.py`; the Han totals above describe the Han portion only.

## `tangut-parts.json.gz`

The keys of the bundled Tangut outline records, used to browse the full Tangut palette without loading the outlines. Regenerate with `node scripts/build_tangut_parts.mjs` after updating the outline source.

## `tangut-strokes.json.gz`

The stroke count of every Tangut character in the list. The ideographs come from Unicode 18.0.0's
`TangutSources.txt`: `kTGT_RSUnicode` gives the radical number and the total stroke count, so
`1.6` is six strokes, and 6,177 ideographs have one, from 4 to 22 strokes. The 768 Tangut components
in U+18800–U+18AFF were counted from their glyphs and live in `tangut-component-strokes.tsv`, one
`U+18800<TAB>1` line per component, 1 to 13 strokes. Each description's count is the sum of its
parts', which covers the 6,107 descriptions in 4 to 22 strokes. Rebuild with
`node scripts/build_tangut_strokes.mjs`, which pins the Unicode file's SHA-256
(`ae440bd9bba89b2610cfe6b498ac462d2763dd32bfead8ac30d32988b5b67a27`). Unicode data is
distributed under the Unicode License v3.

## `tangut-layers.json.gz`

The largest character split of 2,408 Tangut descriptions, 16 KB gzipped. BabelStone describes every
Tangut ideograph with Tangut components, one layer deep. Many of those component trees spell another
ideograph whole, and 28 components are a one-component ideograph's whole glyph. This file rewrites
each description top-down: a maximal proper subtree whose text is another ideograph's complete
BabelStone description becomes that ideograph, a component that is a one-component ideograph becomes
it, a description shared by two characters is left alone, and the root is kept. Only rewritten descriptions are listed; every other Tangut character keeps
its BabelStone description as it is.

Format: `source`, `method`, `counts`, `characters` (character → layered description), and
`ambiguous` (a description shared by two characters, with both; it is not rewritten). Counts: 6,145 Tangut records, 6,137 parsed, 8 malformed source records skipped,
2,408 layered, 2,190 with a character in the first layer, 28 one-component ideographs, 1 ambiguous
description.

The reading is editorial: it follows the shapes BabelStone records, not a dictionary's semantic or
phonetic analysis, and an identical description does not prove that the part is that character or
that either descends from the other. The editor marks the character-first description as derived.
Expanding its characters reconstructs each of the 6,137 readable source descriptions exactly;
the eight malformed descriptions remain as source text. The source remains in
`babelstone-ids.tsv.gz` and both forms remain searchable. Built by
`node scripts/build_tangut_layers.mjs` from the table, which carries the pinned source digest.

## `tangut-outlines.json.gz`

Noto Serif Tangut 2.168 outlines, exported from the bundled WOFF2 by
`uv run scripts/build_tangut_outlines.py`. The file records the font checksum and
licence (SIL OFL 1.1; see `fonts/OFL-NotoSerifTangut.txt`). It includes the font's Tangut
characters and components, plus exact-description mappings from the IDS table.
Malformed descriptions and descriptions naming missing glyphs are excluded from those mappings.

Tangut previews load these outlines locally. Exact descriptions use the corresponding
character's glyph; edited descriptions use the composition engine's geometric layout.
Mixed Han–Tangut descriptions also load the host's Han export. The shared layout
constants in `src/composer/constants.json` come from han-compose at bd0829b (MIT),
previously used by the composer's test fixture. Tangut Components Supplement glyphs
are absent from this font version and report a missing glyph.

## Bopomofo outlines

`bopomofo-outlines.json.gz` holds U+3105–U+312F and U+31A0–U+31BF (75 letters).
Noto Sans CJK JP 2.004 at weight 400 supplies 71 glyphs; Plangothic P1 V2.9.5795
supplies U+31BC–U+31BF. Both are SIL OFL 1.1; licence texts are in `fonts/`.
The compressed document records each source URL and SHA-256. Rebuild with
`uv run scripts/build_bopomofo_outlines.py FONT_DIR`, using the pinned fonts
listed in `fonts/README.md`. Outlines use the same packed records as Tangut.

## Shuishu

`shuishu.json.gz` is the palette index for the Shuishu (水書) characters and radicals, and
`shuishu-outlines.json.gz` holds their 533 outlines. Both sit at the tentative allocations of the
proposed block in the ISO/IEC 10646 Amendment 2.2 charts (PDAM 2.2, WG2 N4922, 2017-11-22): logograms
U+1B300–U+1B4E5 (486) and radicals U+1B500–U+1B52E (47). Unicode 18.0.0 leaves the block unassigned, so the text is not claimed to be
assigned Unicode, and the code points can still move with the amendment.

| Coverage | Count |
| --- | ---: |
| Proposed characters and radicals | 486 + 47 |
| Palette entries | 533 |
| Logograms the WSF dictionary numbers | 207 |
| Logograms it does not number | 279 |
| Rows in `Shuishu.xlsx` | 772 |

The outline of each entry is the glyph of `Uni1B300Shuishu`, the font the amendment's code charts
embed, reached through the PDF's own ToUnicode map. Logogram names come from the spreadsheet's name
column with its `SHUISHU LOGOGRAM` prefix dropped, radical names from the chart's with `SHUISHU
RADICAL` dropped, and the `-A` names are the chart's variants. The readings, meanings and English
glosses are from Andrew West's
[`Shuishu.xlsx`](https://www.babelstone.co.uk/Shuishu/Shuishu.xlsx) (BabelStone), which indexes the
characters by the proposal's N4922 code point.

The example readings are cross-checked against the
[水族水书文字数据库](https://shuishu.ihanzi.net/shuishu) (孙治弘 et al., 『数字人文研究』6(1), 2026,
94–109), through its `POST /api/words/search` with a `prefix` of the meaning. Readings vary from text
to text there; the single reading kept here is the spreadsheet's. Its glyph images are not bundled.

BabelStone's four private-use Shuishu fonts (WSF, WZL, ZJR and Nishida) draw many more entries than
the proposal covers; their site marks them "Not currently explicitly licensed", so they are not the
glyph source here. Neither the chart font nor the spreadsheet states a separate licence. The glyphs
are used as an aid inside the amendment's own outline set, the names, readings and meanings are
facts, and `fonts/LICENSE-IDSShuishu.txt` records the position in the font.

Sources are pinned with SHA-256 digests in [`shuishu/sources.json`](shuishu/sources.json); they are
the charts PDF (read 2026-10-29), its extracted glyph subset (`Uni1B300Shuishu-subset.ttf`), the
PDF's `cid-map.json` and `radical-names.json`, and the spreadsheet. Rebuild `shuishu/` from them with
`uv run --python 3.12 scripts/build_shuishu_sources.py`, then the index, outlines and font with
`uv run --python 3.12 scripts/build_shuishu.py`.

JSON format 1 has `parts`, each with `part`, `kind` (`shui`), `shuiGroup` (`dictionary`, `logogram`
or `radical`), `shuiName`, `shuiReading`, `shuiMeaning`, `shuiGloss`, `modern`, `ids` and `strokes`
(always null, since no source counts them). `shuiGroup` is `dictionary` for the 207 logograms the WSF
dictionary numbers, `logogram` for the other 279 and `radical` for the 47 radicals. The groups follow
dictionary coverage, not frequency; the spreadsheet also lists 286 further forms that the proposal
does not cover.

`ids` is an editorial decomposition, written by hand in [`shuishu/ids.json`](shuishu/ids.json) and
carried with `sources: ['project']` for
the characters whose parts are all in the block and whose arrangement is plain. No source states
one: the charts give a `→` cross reference to a radical for 41 of the 533 characters and nothing
else, the spreadsheet has no structure column, and the chart font carries no ligature or IDS glyph
names. Each entry has one operator (`⿰`, `⿱`, `⿴`, `⿵` and `⿶`, which the count does not yet reach)
and two parts of the block, written left before right, top before bottom, outer before inner.
Shuishu writing order is undocumented in these sources, so the order follows the glyph. The entries
aid display and search and sit outside the encoding proposal, and the count keeps to the unambiguous
cases. A search finds a character by its whole description, and a typed part also lists the
characters written with it. The adapter reads the entries as the characters' descriptions, with no
source region, so the structure search, the component panel and the tree reach them; a failed
decomposition file costs those descriptions only.
`scripts/build_shuishu.py` refuses an entry with another operator shape, a part outside the block
or the character itself.


## Jurchen

`jurchen.json.gz` is the palette index for Unicode 18.0's 914 Jurchen characters and 51 radicals, and
`jurchen-outlines.json.gz` holds their 965 outlines.

| Field | Source |
| --- | --- |
| `jurRadical`, `strokes`, `jurSource`, `jurReading`, `jurNumeric` | [`JurchenSources.txt`](https://www.unicode.org/Public/18.0.0/ucd/JurchenSources.txt), [Unicode Terms of Use](https://www.unicode.org/terms_of_use.html). The readings are 金啓孮, 『女真文辞典』 (文物出版社, 1984), one entry per character; 806 characters have one. |
| `jurCode` | Alari Jurchen Rime table `Alari_jurc.dict.yaml`, version 2026.05.29, by Yehenara Ayasala, Sulfa and Tunggiya Uju, [朝花·夕拾 電子藏書閣](https://dorontu.com/#/cloud), folder 女真文资料/女真文rime输入法. It states no licence and is published for readers to download and use. Its header says Jurchen has no common stroke order and its codes may not be unique. |
| Outlines | Alari Xuwasun Jurchen, public beta of 2026-10-12, by Sulfa, Dooran and Raxon7, same site, folder 女真文资料/女真文字体, SIL OFL 1.1. |

Unicode gives a radical no stroke count, so `strokes` is null on the 51 radicals; a radical's number
is its place in the block. Radical and stroke values come from `kJURC_RSUnicode`, whose second number
is the total stroke count.

The stroke definitions are from Sulfa and Ayasala's article
[「没人给女真文做字体和输入法？那我们自己来」](https://mp.weixin.qq.com/s/YaUP6bq4xt_18ywlRxCQpA) (WeChat, read
from a copy of its text; date not seen), which also says the font is a Fangsong restyling of the
encoding proposal's forms, so it does not reproduce an inscription or manuscript. The site was found
through 柳突破's [Bilibili video](https://www.bilibili.com/video/BV1odec6pEqp/) of 2026-09-16.

The 537 parts with `jurGroup: 'variant'` are the table's and the font's variant sequences through
U+FE00–U+FE04. They are Alari's convention: `StandardizedVariants.txt` of Unicode 18.0 records none
for Jurchen, so another font may draw the base form. Each carries its base character's Unicode record
and its own stroke code. The build reads the row for U+18FF3 U+FE01 without the stray U+FE00 at the
end of its code, and drops the table's placeholder row for U+25A1.

`ids` is an editorial decomposition, written in [`jurchen/ids.json`](jurchen/ids.json) and carried
with `sources: ['project']` for 44
characters. No source states one, so each is a reading of the Alari glyph: it describes the shape
and makes no claim about how the character arose. `scripts/build_jurchen.py` refuses an entry with an
operator other than ⿰, ⿱, ⿷ and ⿸, a part outside the block, or strokes that do not add up; a radical's
count is read from its stroke code, since Unicode gives none.

Sources are pinned with SHA-256 digests in [`jurchen/sources.json`](jurchen/sources.json). Rebuild the
index, outlines and font with `uv run --python 3.12 scripts/build_jurchen.py`, then
`uv run --python 3.12 python scripts/build_bundled_coverage.py`.

## New Korean Orthography outlines

`new-korean-outlines.json.gz` holds the four letters the New Korean Orthography
(조선어 신철자법, 1948) added to Hangul, in seven proposed positions:

- U+A97D / U+D7FC: 여린리을 (soft rieul), `HANGUL CHOSEONG RIEU` / `HANGUL JONGSEONG RIEU`
- U+A97E / U+D7FD: 된리을 (strong rieul), `HANGUL CHOSEONG LIEUL` / `HANGUL JONGSEONG LIEUL`
- U+A97F / U+D7FE: 위읍 (wi-eup), `HANGUL CHOSEONG UEUB` / `HANGUL JONGSEONG UEUB`
- U+D7C7: 여린이 (soft i), `HANGUL JUNGSEONG BANMOEUM-I`

Unicode 18.0.0 leaves these code points unassigned. They are the positions in
OBAYASHI Muneaki, [L2/19-230R](https://www.unicode.org/L2/L2019/19230r-six-hangul-letters.pdf)
(2019-06-24); [L2/19-233](https://www.unicode.org/L2/L2019/19233-hangul-cmts.pdf)
answered the proposal. The editor treats the range as a bundled allocation, as it
does U+3D000–U+3FC3F for Small Seal; the text is not claimed to be assigned Unicode.

The drawings are [Nanuun-saram](https://commons.wikimedia.org/wiki/User:Nanuun-saram)'s
SVGs on Wikimedia Commons, made 2016-02-08, CC BY-SA 4.0. Their files and digests,
the proposal and the Wikipedia articles are recorded in
[`new-korean/sources.json`](new-korean/sources.json); `new-korean/README.md` explains
the letters. Rebuild the `IDS New Korean` font and these outlines with
`uv run scripts/build_new_korean.py`. The script checks the SVG digests and derives
the outline records from the same quadratic curves as the font.

## Subtree frequencies and compound palette entries

Run `bun run build:subtrees` after rebuilding `ids-parts.json` or the bundled IDS
corpus. This reads the shipped corpus without downloading a newer edition and
writes `ids-subtrees.json.gz` plus the compound entries in `ids-parts.json`.

The frequency report contains every exact subtree, including leaves, complete
roots, numbered unknown components and variation selectors. Its columns are
`[part, uses, occurrences, nestedUses, strokes]`: `uses` counts distinct source
characters, `occurrences` counts tree positions across distinct IDS alternatives,
and `nestedUses` counts characters using the tree below the root. The palette's
counts for single-character entries follow the corpus with BabelStone's numbered
components written out, so they can exceed the report's `uses`, which keep the
source spellings. Identical regional alternatives count once. Characters are not
recursively expanded for the report and variant glyphs are not merged. The report
records malformed sequences under `rejected`; the current corpus has eight, all
Tangut.

Common also shows hard-to-type components used by at least 50 characters
(287 in this corpus), while keeping them available in their stroke groups.
Compound IDS use a lower cutoff of 30 distinct characters below the root. The
current corpus supplies 28 frequent trees: sixteen remain as compound shortcuts
and twelve normalize to ten encoded characters. The sixteen manual entries
bring the compound total to thirty-two. Exact regional spellings remain searchable aliases
and appear in hover text. An encoded entry counts each source character once
across its literal spelling and all selected IDS aliases; the raw report retains
separate exact counts. Single-character promotion keeps its existing cutoff of 50.

The requested compound `⿲彳⿱山一攵` is available as a single palette candidate,
with an estimated eleven strokes. Its exact sequence has no uses in the bundled
corpus, so it is retained as a manual entry. As an enclosure host,
`⿵⿲彳⿱山一攵⬚` places the slot below 一, between 彳 and 攵; the composer
renders it as `⿲彳⿱⿱山一⬚攵` while preserving the source leaves for editing.

The manual shortcut `⿰冫⿱丿丶` is included with
113 corpus uses and an estimated four strokes. BabelStone’s source component
`{11}` (bottom of 軣, `⿰⿱丶㇀⿱㇒丶`) supplies those uses; its exact source
spelling remains in the raw report. The shortcut count deduplicates characters
across the source placeholder and literal spelling. Its dedicated four-dot outline
also renders the equivalent spelling `⿰冫⿾冫`, both alone and inside larger IDS.
The Sans form uses the four detached contours of Noto Sans CJK JP 氺; the Serif
form takes the dots from Noto Serif CJK JP 塁, detaching the upper-right stroke
from 田. Both retain an open centre without the central hook. The outlines are
under SIL OFL 1.1 (see `fonts/OFL-NotoSansCJK.txt` and `fonts/OFL-NotoSerifCJK.txt`). Compound cells show a rendered
icon with an `IDS` marker; hovering reveals the sequence and stroke count.
Picking or dragging one inserts its complete tree. Stroke counts are searchable
with the existing numeric filter. The dotted `⿻者丶` is explicitly counted as nine strokes to avoid counting
the regional dot twice. Other counts are additive estimates from the existing palette's
stroke metadata, recursively resolving other leaves where possible. They are
marked `derived` and displayed with `≈`; overlapping strokes can make the true
count differ. Subtraction, unresolved leaves and cycles retain an unknown count.
The generated report uses the same stroke calculation for every subtree.

The report derives from the public-domain BabelStone Han and Tangut IDS and the
stroke-count sources listed above. It contains no Rime stroke-order column.

`src/composer/component-forms.json` contains selected Noto CJK JP outlines in
Sans 2.004 and Serif 2.002. `scripts/build_component_forms.py` verifies the source
TTC hashes recorded in the JSON before exporting them. Rebuild with
`uv run scripts/build_component_forms.py <sans-ttc> <serif-ttc>`.
Detached forms retain their source position in the native em instead of being
enlarged to fill the cell, preserving their stroke thickness and spacing. Palette icons share the surrounding
text’s em size. The six-stroke `⿳士冖一` has a dedicated two-level layout:
the intact `⿱士冖` crown from 壱 above the short 一 from 壹. The line moves
vertically without scaling its strokes. `⿱⿱士冖一` uses the same layout. `⿻者丶` uses the glyph shared by
者 + U+E0101 and U+FA5B, verified in both fonts' variation tables.
Exact 塁 and 疂 descriptions use their complete native JP glyphs.
`⿱宀儿` uses 宂 (U+5B82), whose source regions are HTKP; `⿻三丨` uses
丰 (U+4E30), whose exact source regions are GJKPV. Explicit IDS typed in the
editor remain unchanged; palette selection inserts the encoded counterparts.
Bundled styles affect only these selected forms; other composed outlines still
come from the configured Han export. Whole glyphs fall back to their operands
in adjustment mode when the export supplies them.

The 35–49 usage band adds `⿻日丿` (49), `⿴𦥑同` (41), `⿱丶丶` (39),
`⿱甶儿` (37), and `⿻口丿` (35). New aliases normalize to 𦭝, 犮, 敖, 蒦,
丰, 辱 and 包; both 艹/卝 spellings of 𦭝 contribute to one union count.
The specialized `⿴𦥑同` outlines preserve 興's native upper component in both
fonts, omitting 一八 below it. The outer 𦥑 is cropped at y=222 (Sans) or
y=197 (Serif), with 同's contours unchanged and two editable operands retained.
The Serif bottom stroke's rising terminal is removed before cropping.

The 30–34 usage band adds `⿰丿丨` (33), `⿱左⺝` (33), `⿸耳又` (33),
`⿱㇒⿻日丿` (32), `⿰二二` (30), and `⿸⿻口丿乚` (30).
`⿱⿱㇒⿻日丿十` and `⿻九丶` normalize to existing 卑 and 丸 entries,
with union counts of 122 and 125.
The upper-卑 shortcut uses Noto's connected-stroke U+FA35 glyph with 十 removed:
Sans retains the four counters and reconstructs the outer contour above the
bottom 十; Serif omits its separate 十 contour. It floats at native em size.
`⿰二二` places two native 二 columns side by side, contracting horizontal
length only and translating the bars vertically to retain their stroke thickness.
Both forms have Sans/Serif outlines. The four-bar form keeps two editable columns;
the atomic upper-卑 drawing falls back to individual operands in adjustment mode
when the configured export supplies them.

The shared enclosures of 彥/產 and 彦/産 are manual literal shortcuts:
`⿳亠㐅厂` (also rendered/searched as `⿱文厂`) and `⿳亠丷厂`.
Both have an estimated six strokes and appear in Common and Stroke count.
The latter deliberately remains IDS despite its encoded equivalent 产 (`U+4EA7`),
so selecting it preserves the component spelling. Its 29 direct corpus uses
combine the literal IDS and 产; the former has zero exact subtree matches
because descriptions such as `⿳亠㐅⿸厂彡` distribute its strokes across nodes.
This count does not assert that the visible component is absent from 彥 or 產.
The traditional outline is extracted from Noto 產 with 生 removed; the other
uses Noto 产. Both preserve the native em, stroke weight and long 厂 stroke,
with separate Sans/Serif outlines. The traditional enclosure with 彡 or 生
uses the complete native 彥 or 產 glyph, respectively. Other enclosed operands
are placed within a font-specific opening based on the native 產 proportions;
the 产 opening is shorter to leave space below its lower crossbar. These are atomic native previews;
adjustment mode uses operand outlines when available. Native compound previews use
outline-based layout rather than extrapolating the learned glyph layout model;
Kaisho keeps its export layout. Source aliases remain
searchable and visible in tooltips, without changing the inserted IDS.
When 儿 begins the enclosed vertical stack, its native 元-derived legs meet the
enclosure bar; their stroke weight is adjusted continuously as the available
height changes. The remaining operand is laid out below. A neighbouring left 朱
uses its full-height cut from 鴸 in both Sans and Serif, with the spacing of a
native side-by-side character. For 昌 or ⿱日日 below 儿, the preview uses the
native 昌 cut from 菖 in either face, keeping their displayed proportions consistent.
Its counters and gaps are shortened more than its horizontal bars so that the
strokes remain visible in the compact placement. The 朱 spacing is checked for
collisions against the actual right-hand outline.

These curated components were suggested by परवद💙💛
([@zoenshiueh_lieu](https://x.com/zoenshiueh_lieu)). The zi.tools stroke-chain
and overlap notation is recorded as a search alias; selected items insert the
standard Unicode IDS shown below, without adding a second parser dialect.

| Shortcut | Direct source uses | Estimated strokes | Host examples |
| --- | ---: | ---: | --- |
| `⿻𢆶戈` | 9 | 10 | 幾、畿 |
| `⿸尸彳` | 0 | 6 | 屐、履 |
| `㇯鹿比` | 27 | 7 | 鹿、慶 |
| `㇯馬灬` | 13 | 6 | 馬、𩡧 |
| `㇯鳥灬` | 25 | 7 | 鳥、島 |
| `⿳亠口冖` | 28 | 7 | 亭、亮 |
| `⿸尸氺` | 1 | 8 | 犀、𣺳 |
| `⿳𰀉冖木` | 0 | 11 | 橐、櫜 |
| `⿳卝罒冖` | 2 | 11 | 夢、𮒽 |
| `⿱丿乚` | 5 | 2 | 𦨊、𠝉 |

The three zi.tools spellings correspond to the outside of 鹿, 馬 without 灬,
and 鳥 without 灬, as confirmed by the host entries in
[Yi Bai's IDS data](https://github.com/yi-bai/ids/blob/da1e9f8a09e2ec8faaf176bac99203f978282041/ids_lv0.txt):
`⿸广⿻[:-1]〢コ`, `⿷#(-一丨b𠃌)𰀁`, and
`⿱丿⿷⿴#(一-𠃍丨b𠃌)一一`. Their original strings remain searchable.
BabelStone placeholders `{29}`, `{55}`, `{51}`, `{47}`, and `{87}` supply
counts for the corresponding native forms. `{29}` names the outside of 幾/畿;
its approximate replacement uses 弋, while this requested drawing preserves 戈.
The three reviewed subtractions have explicit stroke estimates. Other
subtractions still have unknown stroke counts.

Nine previews use pinned Noto native host outlines: 畿 without 田, 屐 without
支, 鹿 without 比, 馬/鳥 without 灬, 亭 without 丁, 犀 without 牛, 橐 without
石, and 夢 without 夕. The TC font face supplies 氺 in 犀 and the separated
four-stroke 卝 in 夢. The Serif 夢 preview combines its crown with the native
冖 from 亭, translated down 70 font units. Removed connected outlines are
reconstructed at existing path points; remaining strokes keep native thickness
and placement. `⿱丿乚` and its source alias `⿱㇒乚` share a dedicated
Sans/Serif drawing made from 毛's shallow sweep and hooked stem, with the two
intervening horizontal strokes removed. The retained strokes meet at their
native junction and remain two editable groups. The five direct source
occurrences are 𠝉 (T), 𡜞 (G), 𥟯 (G), 𦨊 (GT), and 𩣛 (GT).

Frequency alone cannot select every useful visual part. The raw report counts
exact written subtrees, not recursive expansions through encoded characters,
regroupings across node boundaries, or all Unicode-equivalent spellings.
For example, 履 is recorded as `⿸尸復`; 橐 uses `{38}` above 䂞; and 夢's
crown is usually split across a ternary root. The current automatic cutoff is
30 distinct characters below the root. Curated entries and reviewed aliases
therefore supplement that ranking. The counts above are direct corpus counts,
not estimates of how often the visible shapes occur after expansion. The raw
frequency report and automatic cutoff are unchanged.

## Small Seal

`small-seal.json.gz` contains the Jiguge (汲古閣) edition's IDS from
[CHISE-IDS](https://gitlab.chise.org/CHISE/ids), maintained by MORIOKA Tomohiko and
contributors. It is GPL-2.0-or-later; see `COPYING-chise-ids.txt`. The complete input
IDS and the 540 Shuowen mapping files are in `small-seal-sources.tar.gz`.

| Coverage | Count |
| --- | ---: |
| Source character records | 11,114 |
| Explicit, unambiguous entity-to-Unicode mappings | 816 |
| Editor-ready descriptions / head characters | 49 |
| Seal components used by those descriptions | 31 |
| Drawable palette forms | 1,383 |
| Selected basic parts | 138 |
| Compound forms | 1,172 |
| Other forms, including 49 curated crosswalks | 73 |
| Empty descriptions | 337 |
| Descriptions with an unmapped head character | 10,010 |
| Descriptions with unresolved component identifiers | 747 |

There are 29 additional apparent-form descriptions, so the description statuses total
11,143. An empty field does not distinguish an atomic character from unfinished data.
The editor's 49 descriptions are machine-validated imports, without a separate
palaeographic review. The palette also carries 49 curated crosswalks from
`scripts/data/small-seal/supplements.json`; they mark a Unicode SealSources value
and one CHISE record, and ship with pinned glyphs and checksums.

Sources, pinned in `scripts/build_small_seal.py` and the output's `sources` field:

- [`IDS-SW-JIGUGE.txt`](https://gitlab.chise.org/CHISE/ids/-/blob/ac35413635608512f5e10187812cfab3b6ea47c1/IDS-SW-JIGUGE.txt),
  CHISE-IDS revision `ac35413635608512f5e10187812cfab3b6ea47c1`.
- [`ShuoWen-SR001.el` through `ShuoWen-SR540.el`](https://gitlab.chise.org/CHISE/xemacs-chise/-/tree/0dc65c74293d3b74eda1a9861273675a5b26fd99/lisp/utf-2000),
  XEmacs CHISE revision `0dc65c74293d3b74eda1a9861273675a5b26fd99`.

The importer reads Lisp as data. A seal code point must occur as a direct `=ucs`
property on the same record as the exact `=shuowen-jiguge` identifier (or an explicitly
named edition identifier). Nested properties, glyph inheritance, modern Han equivalents,
and ambiguous mappings cannot establish identity. Unresolved references remain literal
`&…;` strings. Only complete, supported Unicode IDS enters `table`.

The palette is independent of the 49 complete descriptions. It includes mapped
CHISE heads and the Unicode Shuowen radical heads for which a pinned SVG exists.
`seal-sources.txt.gz` preserves the pinned Unicode mapping from the Kaiyuan source
archive; its license is in `COPYING-seal-sources.txt`. `paletteSources` records the
Unicode digest, the BabelStone IDS digest, the reference for the 𠙵/口 lookup alias,
and each curated crosswalk entry.

`parts` entries carry `modern` lookup names, `sealGroup`, and `sealBasis`:

- `basic` / `selected`: an editorial starter selection of familiar radical heads.
  Membership does not establish historical indivisibility.
- `compound` / `seal-ids`: the source has a structural or apparent IDS, including
  unresolved operands and extended operators.
- `compound` / `cjk-ids`: a modern equivalent has a compound IDS. Its `modernIds`
  are retained for inspection and the UI marks the grouping with `≈`.
- `other` / `unknown`: no classification is established. An empty source field
  never establishes that a character is atomic.
- `other` / `crosswalk`: a curated Unicode SealSources and CHISE crosswalk from
  `scripts/data/small-seal/supplements.json`. It supplies modern lookup names and a
  pinned glyph, and never adds a `table` entry.

Modern IDS inference affects palette grouping only. It never supplies a seal
`table` entry or changes exact encoding lookup. Palette usage counts include mapped
components in unresolved source descriptions, counted once per source head.

Rebuild the palette offline with `python3 scripts/build_small_seal_palette.py`.
To refresh the bundled SVG subset from the same pinned Kaiyuan revision, pass
`--upstream path/to/kaiyuan.tar.gz`; its SHA-256 is checked before extraction.
Rebuild the font and outlines afterward with `uv run scripts/build_small_seal_font.py`.

JSON format 1 has `table` (seal character to descriptions), `parts`, `modern` (search
labels), `sources`, `paletteSources`, `license`, and `records`. Each source record has its ID, mapped
character or null, original structural description, and a `descriptions` list. Each
description preserves `original`, `kind` (`structural` or `apparent`), resolved `text`,
`status`, and any `unresolved` identifiers. `unsupported` covers resolved expressions
that the editor cannot parse. These audit records remain available even when the
character has no usable description.

Rebuild with `python3 scripts/build_small_seal.py`, then `python3 scripts/build_small_seal_palette.py`,
which merges the curated supplements and is not optional: without it the output lacks the 49 crosswalk
entries its test expects. Downloads are cached and checked against pinned SHA-256 digests.
`--cache` and `--out` select their locations. The source archive is written beside the output.
Test mapping safeguards with `python3 -m unittest discover -s scripts -p test_small_seal.py`.

`small-seal-outlines.json.gz` holds the supported glyphs and unambiguous exact-description
mappings. The glyph sources depict the Chen Changzhi edition; they are a rendering aid
for the Jiguge descriptions. See [the font notes](../fonts/README.md#ids-seal) for source
quality, licensing and rebuilding.

## Unicode fallback outlines

`unicode-outlines/*.json.gz` contains 56,657 glyph outlines in 590 chunks, each covering at most
256 code points. The full set is 26,511,873 compressed bytes; the composer fetches only chunks
needed for glyphs missing from the selected export. An export's own glyphs retain priority.
`unicode-coverage.json` lists exact covered ranges; `unicode-outlines.json` records chunk hashes,
counts, source fonts, source digests and copyright notices.

The original sources are Noto Sans CJK JP 2.004 and the regular Noto fonts from Ubuntu's
`fonts-noto-core` and `fonts-noto-extra` 20201225-2 packages, under SIL OFL 1.1.
The pinned file names, SHA-256s and source URLs are in [`unicode-fonts.json`](unicode-fonts.json).
Full copyright notices and the license are in [`OFL-NotoUnicode.txt`](../fonts/OFL-NotoUnicode.txt).
[Noto](https://github.com/notofonts/noto-fonts) supplies the script-specific designs;
[Noto CJK](https://github.com/notofonts/noto-cjk/tree/Sans2.004) supplies the CJK marks and kana.

Rebuild with `uv run scripts/build_unicode_outlines.py FONT_DIR [FONT_DIR ...]`, using the extracted
package font directories plus every Noto CJK, Jigmo, Noto Emoji, Unifont, UniHieroglyphica and Iosevka file listed in
`unicode-fonts.json`. The builder checks every source digest, selects the first
available glyph in the lock file's order, and normalizes coordinates to 1000 units per em.
[FontTools Cu2QuPen](https://fonttools.readthedocs.io/en/latest/pens/cu2quPen.html) converts cubic
curves with a maximum error of 0.5 normalized units; packed coordinates use quarter-unit precision.
Unicode acceptance uses the bundled Unicode 18.0.0 properties, matching the editor's rules. The gzip OS header is
normalized so supported Python versions produce the same shard bytes.

After the main build, `uv run scripts/build_project_outlines.py` replaces the fallback outlines of the
characters in `ids-characters.tsv` with Plangothic P2 glyphs (SIL OFL 1.1), a Source Han Sans design, so
Extension J characters such as 𳑳 match the Sans face instead of Jigmo's serif. The script updates the
shard hashes and adds the Plangothic source to `unicode-outlines.json`.

These are individual monochrome glyphs, without contextual shaping or color-emoji layers.
A variation selector needs an explicit glyph in the selected export; it is not silently dropped.
Unassigned and private-use characters without a source outline remain unavailable.

## Pyramid glyph catalog

`src/composer/pyramid-glyphs.json` contains all 146 one-over-two repeated-component
characters found in the pinned BabelStone data above (147 attested descriptions).
Run `python3 scripts/build_pyramid_glyphs.py` to regenerate it, or add `--check`
to verify it. The generator accepts an explicit lower pair or an encoded pair
such as 林 in 森 and 𱋁 in 麤. Only the positional equivalents 牜/牛 and 釒/金
are folded, retaining 犇 and 鑫. Approximate IDS are excluded.

Each entry records its character, repeated part, source description and lower
pair. The composer recognizes the source description, its expanded pair, and
its three equal full components. Missing or excluded glyphs retain component
composition. This catalog covers the pinned Unicode 16.0 source, rather than
claiming coverage of unencoded characters or later Unicode additions.

### Gongche notation components

Suggested by परवद💙💛 ([@zoenshiueh_lieu](https://x.com/zoenshiueh_lieu)):

| Literal IDS | Strokes | Direct corpus uses |
|---|---:|---:|
| `⿰氵氵` | 6 | 0 |
| `⿱𰀪亻` | 4 | 0 |

Both are curated shortcuts in Common and their stroke-count groups. Counts are
additive (3 + 3 and 2 + 2). Neither sequence occurs in the pinned BabelStone
corpus, so these entries retain zero usage counts and their literal IDS.
The `⿱𰀪亻` preview uses native Noto Sans/Serif 彳 outlines with an extra
upper sweep; the sweeps retain their original stroke weight. Its two IDS leaves
remain editable. This supplies the form even when the Serif export lacks 𰀪.
The `⿰氵氵` drawing repeats the same native water-radical outline by translation,
so both columns have matching proportions and remain separated in either style.

The 工尺譜 tab in `IdsParts` reads its 72 entries from `gongche-parts.json`.
The catalogue records source URLs and locations for each group. It includes
complete single-person and double-person register rows from the Kunqu proposal,
the additional Cantonese and Beiguan forms, all eight staccato forms illustrated
in CCLI 2022/03, regional note variants, components and notation marks.

Encoded compound notes have searchable IDS aliases and insert their code point.
For example, `⿰亻凡` selects 𠆩, `⿰彳上` selects 𱝫, and `⿰氵上` selects 𰛈.
The source's `⿰氵士` and `⿰氵六` remain editable IDS: 汢 contains 土 and must
not replace the 士 form. Stroke counts follow Unihan 17.0, except the palette's
existing four-stroke 艹 convention and additive counts marked as derived.
Notation punctuation has no stroke count.

The panel retains compact buttons and a collapsed input guide. Group names use
component shapes rather than universal register labels, because Cantonese and
Kunqu conventions differ. The catalogue is independent of remote palette loading;
its supplementary text font and composer fallback audits read the same inventory.
See [the coverage audit](../docs/gongche-coverage.md) for the source tables,
code points, transcriptions and limits.

### Palette fallback outlines

`palette-outlines.json.gz` contains 148 glyphs whose palette entries are missing from the
pinned default composer export. `palette-fallback-characters.json` lists them.
`palette-remote-glyphs.json` records the other palette leaves supplied by that export;
`node scripts/audit_palette_outlines.mjs` verifies and refreshes the index. The outlines
come from the included Plangothic parts/Gongche and Noto CJK stroke subsets, plus Noto Sans CJK Regular
(Japanese face) for the remaining BMP characters, and BabelStone Han PUA for the numbered components
with no fragment; their SIL OFL and Arphic notices are in `fonts/`.
Rebuild with `uv run scripts/build_palette_outlines.py NOTO_CJK_TTC`, using the Noto Sans
CJK Regular TTC from Debian `fonts-noto-cjk` `1:20230817+repack1-3`, with SHA-256 `b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a`.
The 69 PUA outlines are built first by `uv run scripts/build_numbered_pua.py`; see
`numbered-pua-outlines.json.gz`.

## Unicode character properties

`unicode-properties.json` pins component acceptance, letter classification and loose marks to Unicode
18.0.0, independent of the JavaScript engine's Unicode version. `unicode-18.0.0/` contains compressed UCD
snapshots and a source manifest with original URLs and SHA-256s. Rebuild with
`python3 scripts/build_unicode_properties.py`; the builder verifies those digests.

Graphic categories L, M, N, P, S and Co are eligible, except default-ignorable characters, IDS
operators and draft markers. The existing Small Seal allocation remains supported. Ideographic and
Radical properties distinguish ideographs from alphabetic letters. The `marks` property holds what
may follow a whole description: categories M and Lm, the Sk accents and tone letters of
U+00A8, U+00AF, U+00B4, U+00B8, U+02D2–02DF, U+02E5–02ED, U+309B–309C and U+A700–A71F, and
superscript or subscript digits (No in U+00B2–B3, U+00B9 and U+2070–209F). Source: the
[Unicode 18.0.0 Character Database](https://www.unicode.org/Public/18.0.0/ucd/), under the
[Unicode License v3](licences/Unicode-3.0.txt).

### Extended fallback sources

The fallback order retains existing Noto outlines, then uses Jigmo3 2025-09-12 (CC0-1.0),
Noto Emoji (SIL OFL 1.1), and GNU Unifont 18.0.01 (under its SIL OFL 1.1 option).
Jigmo supplies CJK Extension J, except the project's own characters, which
`build_project_outlines.py` takes from Plangothic P2 (a sans design); Noto Emoji supplies monochrome
emoji contours. Unifont fills remaining published glyphs, including recent kana, Cyrillic, phonetic
letters and ideographic marks. Its pixel-based outlines retain their original design. The host
export's glyphs take precedence.

- [Jigmo](https://kamichikoichi.github.io/jigmo/): source file and digest in `unicode-fonts.json`;
  [CC0 text](../fonts/LICENSE-Jigmo.txt).
- [Plangothic](https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project): P2 V2.9.5795,
  SIL OFL 1.1, for the project's Extension J fallback glyphs; source URL and digest in
  `unicode-outlines.json`.
- [Noto Emoji](https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoemoji):
  pinned font revision, SIL OFL 1.1; copyright notices in `unicode-outlines.json`.
- [GNU Unifont 18.0.01](https://unifoundry.com/pub/unifont/unifont-18.0.01/font-builds/):
  [upstream license](../fonts/LICENSE-Unifont.txt), including its OFL option.
- [Iosevka 34.9.1](https://github.com/be5invis/Iosevka/releases/tag/v34.9.1):
  48 Latin modifier letters, [SIL OFL 1.1](../fonts/OFL-Iosevka.md).
- [UniHieroglyphica](https://github.com/thesaurus-linguae-aegyptiae/unihieroglyphica/tree/9375eba4e2b626658e57e3a526118b8225c0581e):
  3,995 Egyptian Hieroglyphs Extended-A outlines, designed by Michel Suignard;
  copyright Regents of the University of California, [SIL OFL 1.1](../fonts/OFL-UniHieroglyphica.txt).

`unicode-outline-gaps.json` lists assigned fallback candidates still lacking an outline in these
sources, grouped by Unicode block. These are missing glyphs, not parser restrictions. It excludes
exact dedicated-bundle outlines and CJK outlines in the pinned default export
(`host-glyph-coverage.json`), but includes holes within those ranges that the previous range-based
report omitted. This is an outline-source inventory; the worker audit described below measures
rendering, including composition from other records. Jurchen has [its own bundle](#jurchen). Private-use
characters require a host-supplied mapping and never inherit Unifont's private allocations.

### Other script parts

`script-parts.json.gz` groups the symbols and additional scripts that bundled Unicode outlines
draw, plus palette entries, by Unicode Script. Symbols and mixed-script descriptions have no other
palette view, so the Other scripts selector offers them alongside the named scripts. `script-parts-index.json`
holds group sizes, and `script-parts-metadata.json` pins the sources. Existing Han, Latin,
Cyrillic, Hangul, Bopomofo, Tangut, Small Seal and stroke groups are excluded.

To rebuild, run `node scripts/build_script_parts.mjs`. The builder uses Unicode 18.0 `Scripts.txt` and `PropertyValueAliases.txt`, checked against pinned SHA-256
hashes. Unicode data is distributed under the Unicode License v3; see
[`Unicode-3.0.txt`](licences/Unicode-3.0.txt).

`script-ranges.json` holds the same pinned Unicode Script ranges for grouping parts supplied by a
host adapter. These parts remain available in their script group, including when the bundled
catalog cannot be loaded. A configured composer export or font can have different coverage.

## `kana-strokes.json.gz`

The stroke count of every kana KanjiVG draws, and of the forms it leaves to other sources: 247 keys
in code-point order, hiragana U+3041–U+3096, katakana U+30A1–U+30FA, the Ainu small katakana
U+31F0–U+31FF, then halfwidth katakana U+FF66–U+FF9D, with a count for each (`strokes`, one entry
per key), the pinned `revision` and its `source`.

Two kinds are derived from the kana they write. A halfwidth form is the same kana drawn narrow, so
it takes the count of the kana NFKC decomposes it to; ｰ has none, since ー lies outside the counted
ranges. An Ainu small katakana is the same letter drawn small, named for it (KATAKANA LETTER SMALL
KU is ク), so it takes that letter's count.

KanjiVG draws one path per stroke, in writing order, so the number of paths is the count: あ three,
イ two, マ two, フ one. That is every kana in both ranges, and the build says which ones KanjiVG does
not draw rather than dropping them silently: one path may carry attributes besides `id` and `d`,
which is how マ was once lost.

- Licence: **CC BY-SA 3.0**, Copyright (C) 2009/2010/2011 Ulrich Apel; attribution and licence links
  in `data/licences/kanjivg-CC-BY-SA-3.0.txt`. The derived table is shared alike under the same
  licence. Rebuild with `node scripts/build_kana_strokes.mjs [kvg directory]`, which reads KanjiVG at
  revision `610091ce618cf757ed1357a8954cd65283e015d6` unless given a checkout.

The table holds counts alone. KanjiVG records no five-stroke class, and one cannot be read off the
paths: kana strokes are curved, so a turn and a curve carry the same turning angle, and a classifier
built on that angle labelled ア, コ and ヨ wrongly. A class column waits for a source that names
stroke types.

## `han-parts.json.gz`

Every Han-script character the composer can draw: 103,352 keys in code-point order, with the
export's `base` and `commit`, a stroke count for each (`strokes`, one entry per key) and the class of
its first stroke (`firsts`, one entry per key). Unihan 18.0.0 supplies most counts; a radical form it
does not list takes the count of the unified character `component-forms.tsv` names, and the 25 marks
and Hangzhou numerals it lacks carry counts the project supplies from their shapes. The pinned export
records 95,899 of them; the bundled fallback outlines add 7,434 and the palette's own fallback
outlines 19, so the list matches what the preview can compose rather than what one export happens to
hold.

`firsts` gives 横, 豎, 撇, 點 or 折, the class of the first stroke Rime's five-stroke dictionary
records, for 103,341 of the characters, read as the parts palette's `first` column is; the two agree
wherever both record a class. A radical form the dictionary does not name takes the class of the
character `component-forms.tsv` says it stands for, the way its stroke count already does, so ⺅ reads
as 撇 like 亻; a compatibility ideograph takes the class of the unified ideograph Unihan's
`kCompatibilityVariant` says it encodes, so U+F900 豈 reads as 豎 like U+8C48 豈. The marks and
Hangzhou numerals take a class the project reads from their shapes, as their stroke counts are: 々
begins with a dot, 〡〢〣 and 〦〧〨 with a vertical, 〤〥〩 with a falling stroke, and 〸〹〺 with a
horizontal. The remaining 11 hold `null`: 〻𖿢𖿣𖿰𖿱𖿲𖿳𖿴𖿵𖿶𫠞, marks whose stroke order no source
names. A search hit's tooltip and the character card show these two facts; the dictionary's stroke
order follows Chinese order, which can differ from Japanese order.

The Components tab offers the list as **All characters**, beside the curated components and their
stroke-count groups, paged at 120, searchable by character or `U+` code point and filterable by
stroke count: single counts up to 22, then one 23+ group.

Rebuild with `node scripts/build_han_parts.mjs [Unihan.zip] [stroke.dict.yaml]`. It reads all 4,096
record shards from the export, the bundled outline index and palette outlines, and the pinned Unihan
archive (`https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip`, SHA-256
`4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`) and the Rime five-stroke
dictionary (`https://raw.githubusercontent.com/rime/rime-stroke/1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48/stroke.dict.yaml`,
SHA-256 `b3e93dce89c185f45c3d6e189b86b3a8626913352cc85e1094c786579a665791`); pass local copies to skip
the download. The export's outlines come from Noto Sans CJK JP and Plangothic (SIL OFL 1.1) and its
records from han-compose (MIT). Unihan is distributed under the Unicode License v3, and the Rime
dictionary under LGPL-3.0 (see `data/licences/rime-stroke-LGPL-3.0.txt`).


## `ids-corpus.json.gz`

One catalogue of component identities and the descriptions that name them, built by
`scripts/build_ids_corpus.mjs` from BabelStone IDS and CHISE-IDS. It holds 211,319 descriptions,
108,425 of them BabelStone's (public domain, `babelstone-ids.tsv.gz`, pinned above) and 102,894
CHISE's, and every row carries the source it came from. It also holds 1,517 components — 1,396 CHISE
entities and BabelStone's 121 numbered parts as `bsp:n` — and 62 `equivalences` between them, 48 of
them seen on two or more characters.

- Licence: **GPL-2.0-or-later** for the file as a whole, because CHISE's rows are
  (`COPYING-chise-ids.txt`). The code stays MIT.
- Sources: `ids-corpus-sources.tar.gz` holds the eighteen CHISE files, CHISE's README and the
  licence; the pin, per-file digests and licence statement are in `chise-sources.json`.
- Changes: CHISE writes each description with the character's code point and its parts as entities;
  the build converts the first to a `ucs` cid and the second to `chise:` names, then merges the
  rows with BabelStone's. It gives BabelStone's numbered parts `bsp:n` cids and aligns the two
  sources' descriptions of each character: at every operand position where a number and an entity
  differ, the pair is an `equivalence` (`verified` on two or more characters, `candidate` on one). A
  number with a known note 6 fragment is compared as that fragment, so a composite is not taken for a
  leaf. A component is not equated with a character it resembles, and two characters that differ are
  variants or slips, not identities. Built on 2026-11-09 from the sources pinned on 2026-11-04.
- Use: `babelStoneAdapter({ chise })` adds the CHISE rows to the description table, each with
  `sources: ['chise']`; a host that cannot take GPL leaves the option out.
- Format: columnar JSON, gzipped; the design behind the identity model is in
  [the corpus note](../docs/ids-corpus.md).

## `ids-equivalences.json`

The alignments in `ids-corpus.json.gz`, as one small table for the components page at `/unencoded`:
62 rows of a BabelStone number against the CHISE entity that names the same component, 48 of them
`verified`. Each row carries both sides' display characters, BabelStone's description, the basis, the
status, the provenance indexes and the characters that attest it. Written by
`scripts/build_ids_corpus.mjs`; the data is **GPL-2.0-or-later** like the corpus it comes from.

## Preview coverage audit

`bun scripts/audit_render_coverage.mjs CACHE_DIR OUTPUT_JSON [sans|serif|fangsong|klee]` renders every
accepted non-private Unicode scalar through the actual preview worker. It preloads the selected
export's record shards four at a time, caches bytes and missing-shard responses, and leaves later
shard requests to the worker's loader. It stops on transport errors instead of treating them as
glyph gaps. Run it under the project's batch resource limits. A warm cache avoids repeating the
download.

The reports in `docs/coverage/` include exact missing ranges by block, downloaded-file hashes,
local bundle hashes and implementation hashes. They cover individual components, finite paths
and source routing. They do not establish visual fidelity, variation-sequence support or successful
layout of every possible IDS tree. Private-use characters need an explicit host mapping.

Each report records the hashes of the files that decide what the preview draws, listed in
`scripts/lib/coverage-sources.mjs`. `bun scripts/check_coverage_freshness.mjs` compares those
hashes against the tree and names the files that moved, and `bun run coverage` re-renders all
four styles into `docs/coverage/`. Both are manual. Gating merges on them fired on nearly every
change to the composer while saying nothing about whether the change was right, so the scheduled
`Coverage` workflow renders nightly and opens a pull request when a report moved; the committed
reports trail the exports by at most a day.

Read a report as a statement about the commit it was rendered at, which `implementationHashes`
records, rather than about whatever is checked out.

`python3 scripts/build_host_glyph_coverage.py CACHE_DIR` rebuilds the default export's exact
direct-outline inventory from that cache. The fallback builder uses it to retain missing CJK
outlines. `python3 scripts/build_bundled_coverage.py` rebuilds the dedicated bundles' scalar index;
run it after changing any dedicated outlines. Offline routing uses this index, while a bundle's
missing records can fall through to other sources.

## `seal-extra-parts.json`

Keys from the bundled Small Seal outlines absent from its curated palette. Regenerate with `node scripts/build_seal_extra_parts.mjs` when the source data changes.
