# Sources and licence

The code is MIT (`LICENSE`). What it reads and what it draws carry their own terms.

## Fonts

- **Noto Sans CJK JP 2.004** (Adobe and Google, SIL OFL 1.1), the variable font read at weight 400
  and at `HEAVY`. GenZui Sans takes its ideographs unchanged from Noto Sans JP, which draws them as
  this font does. The outlines the composer moves and rescales are this font's.
- **Plangothic P1 and P2** (SIL OFL 1.1), static. They draw the CJK extensions in the Source Han
  Sans design Noto Sans CJK shares, so they are the source of components Noto lacks. A part taken
  from here is thinned and thickened synthetically to match the main font's weight.

Both are downloaded and pinned by SHA-256 (`compose.font_file`, `compose.fallback_files`); nothing
of them is committed.

## Tables

- `data/vocab/han-ids.tsv`, `data/vocab/han-component-forms.tsv`: BabelStone IDS.TXT, whose header
  states that IDS sequences are facts not eligible for copyright and waives any claim to the file's
  format, used as public domain and credited; Unicode's EquivalentUnifiedIdeograph.txt (Unicode
  License v3); cjkvi-variants `radical-variants.txt`, used as public domain like the rest of that
  database. BabelStone's data descends in part from Kawabata Taichi's IDS, which derives from CHISE;
  only BabelStone's file is read.
- `data/vocab/han-atomic.tsv`: hfhchan/ids (MIT, Copyright (c) 2021 Henry Chan), of which only the
  list of characters it leaves undecomposed is used. Source record: `data/sources/hfhchan-ids.yaml`.
  Rebuilt by `scripts/build_han_atomic.py`.

## KanjiVG

**KanjiVG**, Copyright (C) 2009-2013 Ulrich Apel, **CC BY-SA 3.0**, https://kanjivg.tagaini.net/

The composer fetches its pinned release and cuts host characters along its component groups. Glyphs
the composer draws from those cuts are adaptations of that component data and are shared alike under
CC BY-SA, with the 3.0 notice kept above. One table derived from it is committed:
`data/vocab/han-hand-forms.tsv` (rebuilt by `scripts/build_hand_forms.py`), which of 𠂇's two strokes
each character writes first, read from KanjiVG's stroke types; it is shared alike under CC BY-SA 3.0.
Source record: `data/sources/kanjivg.yaml`.

## Web export

`scripts/compose_ids.py export-web` writes the data a browser port of the composer reads
(`han_compose.web_export`). `manifest.json` carries these notices in `licences`, and the export
ships the licence texts beside it.

- **Outlines**: every glyph (`G`), and every piece a host-list entry names by its host glyph's
  contour indices (`c.k`), is outline data of Noto Sans CJK JP
  (© 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source') or of Plangothic P1
  and P2 (Copyright (c) 2024 by Fitzgerald P. Köeingsegg; no Reserved Font Name), under the
  **SIL OFL 1.1**. `OFL.txt` holds the licence's full text after each font's copyright line, read
  from the font's `name` table; the text is `data/licences/OFL-1.1.txt`, as Noto CJK ships it.
- **Sequences** (`s`, `e`): BabelStone IDS (Andrew West), public domain as its header states, with
  the editorial sequences of `data/vocab/han-ids-drawn.tsv` (MIT, this project).
- **Positional forms** (`a`): cjkvi-variants `radical-variants.txt` (川幡太一), public domain. The
  Unicode rows of `han-component-forms.tsv` do not feed them.
- **Atomic characters** (`at`): hfhchan/ids (Copyright (c) 2021 Henry Chan), MIT, whose licence
  text ships as `MIT-hfhchan-ids.txt` (`data/licences/hfhchan-ids-MIT.txt`).
- **Cuts and hand forms**: a host-list entry whose cut has `kv` (`c.kv`) was cut along KanjiVG's
  component groups, and the hand forms (`hand`, and `hd` on entries) come from KanjiVG's stroke types: both adapt KanjiVG's data and are shared alike under
  **CC BY-SA 3.0**, with the notice "KanjiVG, Copyright (C) 2009-2013 Ulrich Apel, CC BY-SA 3.0,
  https://kanjivg.tagaini.net/". A drawing that uses a `kv` cut carries the same terms.
- **Code**: the exporter, and a port of the composer written against its format, are **MIT**.

## Consequences

Publishing a glyph drawn with KanjiVG-assisted cuts publishes a CC BY-SA derivative of KanjiVG's
component data. Glyphs drawn without those cuts, from Noto Sans CJK outlines alone, carry only the
SIL OFL 1.1 of the font they come from.
