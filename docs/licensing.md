# Sources and licence

The code is MIT (`LICENSE`). What it reads and what it draws carry their own terms.

## 率 drawings and reference gallery

The five sets of reviewed outlines carry their [font notices](../src/han_compose/rate_forms/NOTICE.txt).
The gallery names the source of each whole-glyph reference. Its Plangothic outlines come from
[P1 and P2 release 2.9.5795](https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project)
and carry the [Plangothic font licence](../data/licences/OFL-Plangothic.txt).

## Fonts

Each style (`compose.STYLES`) reads one variable font and static fonts for what it lacks. All are
downloaded and pinned by SHA-256 (`compose.font_file`, `compose.fallback_files`); nothing of them is
committed.

`sans`:

- **Noto Sans CJK JP 2.004** (Adobe and Google, SIL OFL 1.1), the variable font read at weight 400
  and at 900. GenZui Sans takes its ideographs unchanged from Noto Sans JP, which draws them as
  this font does. The outlines the composer moves and rescales are this font's.
- **Plangothic P1 and P2** (SIL OFL 1.1), static. They draw the CJK extensions in the Source Han
  Sans design Noto Sans CJK shares, so they are the source of components Noto lacks. A part taken
  from here is thinned and thickened synthetically to match the main font's weight.

`regular`:

- **TW-Kai** (數位發展部 (Ministry of Digital Affairs), CNS11643中文標準交換碼全字庫, BMP version
  11510.1, Extension B version 11510.2), static, 1,024 units to the em, brought to 1,000, read at its one weight. Its BMP face
  and its Extension B and G faces draw the ideographs. The data set offers either the **Open
  Government Data License 1.0** (the licence taken here, whose Exhibit asks for the provider, the
  release and its version) or the SIL OFL 1.1.

`pen-writing`:

- **Kureedo Full 0.5.0** (the Klee Project Authors, mkpoli and LXGW, SIL OFL 1.1), static. Klee One's
  kaisho with the historical kana, and LXGW WenKai Light 1.530 for the public code points Klee lacks;
  read at its one weight. LXGW reserves the font names '霞鹜', '霞鶩', '落霞孤鹜', '落霞孤鶩' and 'LXGW'.
- **GenZui Sans 0.105** (SIL OFL 1.1), static. It draws the ideographs Kureedo Full lacks; its strokes
  keep their own weight.

`fangsong`:

- **Zhuque Fangsong 0.212** (TrionesType; copyright line "Copyright 2023 JadeFoci", SIL OFL 1.1, no
  Reserved Font Name), static, a technical preview read at its one weight. Its Latin, Cyrillic and
  Greek glyphs are Alegreya's (Copyright 2011 The Alegreya Project Authors, SIL OFL 1.1). Its README asks
  that versions modified by others not be widely distributed before the official release; that
  request is not a licence term.
- **Jigmo** (CC0 1.0), static. It draws the ideographs Zhuque lacks; its strokes keep their own weight.

`serif`:

- **Noto Serif CJK JP 2.003** (Adobe and Google, SIL OFL 1.1; its copyright line names no Reserved
  Font Name), the variable Source Han Serif, read at weight 400 and at 900. Its horizontals keep
  about 30 units at every weight, so the heavy master's horizontals are grown synthetically in the
  proportion its verticals grow (`Style.synthetic_y`).
- **Jigmo 2025-09-12** (Kamichi Koichi and GlyphWiki's contributors, CC0 1.0), static, 1,024 units
  to the em, brought to 1,000. A Mincho drawn by the KAGE engine from GlyphWiki's data, covering
  every unified ideograph through Extension J: Jigmo2 (B to F, I), Jigmo3 (G, H, J), Jigmo (BMP).
  Fetched from https://kamichikoichi.github.io/jigmo/Jigmo-20250912.zip, whose SHA-1 the site
  lists. Its strokes are lighter than Noto Serif's; a part taken from it is thinned and thickened
  synthetically, as Plangothic's are.

`variants` (`han_compose.variants`) reads fonts of its own, in `sans` and in `serif`:

- **Noto Sans CJK 2.004 and Noto Serif CJK 2.002, the Regular collections** (© 2014-2021 and
  © 2017-2023 Adobe, SIL OFL 1.1), static. `NotoSansCJK-Regular.ttc` (SHA-256
  `b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a`) holds the faces Noto Sans CJK
  JP, KR, SC, TC and HK in that order, then the five Noto Sans Mono CJK faces in the same order;
  `NotoSerifCJK-Regular.ttc` (SHA-256
  `93069d8e9e45d515cc421c971a79e6a5777704b348e36a9ef86578bf58adef77`) holds Noto Serif CJK JP, KR,
  SC, TC and HK. Both are the files Debian's `fonts-noto-cjk` 1:20230817+repack1-3 installs in
  `/usr/share/fonts/opentype/noto/`, packaged from https://github.com/notofonts/noto-cjk. They are
  read in place and not fetched. Uncertain: whether the upstream release files have the same bytes;
  they were not compared.
- **IPAmj Mincho 006.01** ("Copyright(c) Information-technology Promotion Agency, Japan (IPA),
  2011-2019", IPA Font License v1.0, https://opensource.org/licenses/IPA/), static, 2,048 units to
  the em. Fetched from https://dforest.watch.impress.co.jp/library/i/ipamjfont/10750/ipamjm00601.zip
  (SHA-256 `35494e0f2896f38b3f7369a8421a895cea6440a42c0a66ac95eab47d6ed25b68`; `ipamjm.ttf`
  `a3e84f495f3c388db7a1473bf1985c1c076d0c814100f10a027ca6853eb1e8cb`); the font's page is
  https://moji.or.jp/mojikiban/font/. It maps Hanyo-Denshi and Moji_Joho sequences, each Moji_Joho
  one to the glyph named by its MJ number. An outline `variants` writes from it stays under the IPA
  Font License.
- **Jigmo 2025-09-12** (CC0 1.0), as in `serif`. It draws the sequences neither of the others maps,
  but for seven Moji_Joho sequences registered after it was made.

## Tables

- **Ideographic Variation Database, `IVD_Sequences.txt` of 2026-08-03** (Copyright 2006–2026
  Unicode, Inc.; its header gives https://www.unicode.org/copyright.html for its terms). The
  sequences `variants` lists and their collections and identifiers. Fetched and pinned
  (`variants.IVD`); nothing of it is committed. Source record: `data/sources/ivd.yaml`.
- **Unicode Character Database 16.0.0** (© 2024 Unicode, Inc., Unicode License v3,
  `data/licences/Unicode-3.0.txt`): `StandardizedVariants.txt` for the standardized variation
  sequences; `Unihan.zip`, whose `Unihan_IRGSources.txt` gives `kCompatibilityVariant` and the
  `kIRG_*Source` values and whose `Unihan_OtherMappings.txt` gives `kJoyoKanji` for `bench` and
  `export-web`. Fetched and pinned (`variants.STANDARDIZED`, `variants.UNIHAN`); nothing of them is
  committed. Source record: `data/sources/unicode-ucd.yaml`.
- `data/vocab/han-ids.tsv`, `data/vocab/han-component-forms.tsv`: BabelStone IDS.TXT, whose header
  states that IDS sequences are facts not eligible for copyright and waives any claim to the file's
  format, used as public domain and credited; Unicode's EquivalentUnifiedIdeograph.txt (Unicode
  License v3); cjkvi-variants `radical-variants.txt`, used as public domain like the rest of that
  database. BabelStone's data descends in part from Kawabata Taichi's IDS, which derives from CHISE;
  only BabelStone's file is read.
- `data/vocab/han-ids-drawn.tsv`: this project's own sequences (MIT, with the code), written by hand
  where a BabelStone sequence draws the character wrongly, because an operand is not the shape drawn
  or a single shape is listed stroke by stroke. Each row keeps the sequence it replaces and the
  reason. `src/han_compose/compose.py` reads it after BabelStone's.
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

## Bundled outlines

`data/sources/*/outlines.json.gz`, `data/unicode/` and `data/palette/` hold the outlines the browser
package (`js/`) draws without an export. `js/scripts/data.mjs` copies them into the package together
with every text in `data/licences/`.

| Outlines | Source | Terms | Text in `data/licences/` |
|---|---|---|---|
| Tangut | Noto Serif Tangut 2.168 (Google) | SIL OFL 1.1 | `OFL-NotoSerifTangut.txt` |
| Bopomofo | Noto Sans CJK JP 2.004 (Adobe); Plangothic P1 V2.9.5795 for U+31BC–U+31BF | SIL OFL 1.1 | `OFL-NotoSansCJK.txt`, `OFL-Plangothic.txt` |
| Jurchen | Alari Xuwasun Jurchen, public beta of 2026-10-12 (Sulfa, Dooran, Raxon7) | SIL OFL 1.1 | `OFL-AlariXuwasunJurchen.txt` |
| Small Seal | Kaiyuan Small Seal Font (frankslin/kaiyuan-small-seal-font) | SIL OFL 1.1 | `OFL-KaiyuanSmallSeal.txt` |
| Small Seal, the 48 sequences that spell a character | CHISE-IDS `IDS-SW-JIGUGE.txt` (MORIOKA Tomohiko and contributors) | GPL-2.0-or-later | `GPL-2.0-CHISE-IDS.txt` |
| New Korean Orthography letters | Four drawings by Nanuun-saram on Wikimedia Commons, 2016-02-08 | CC BY-SA 4.0 | `CC-BY-SA-4.0-NewKorean.txt` |
| Shuishu | The chart font of ISO/IEC 10646 Amendment 2.2 (WG2 N4922) | none stated | `NOTICE-Shuishu.txt` |
| Palette fallback | Plangothic, Noto Sans CJK, BabelStone Han PUA | SIL OFL 1.1; Arphic Public License | `OFL-Plangothic.txt`, `OFL-NotoSansCJK.txt`, `Arphic-Public-License.txt` |
| Unicode fallback | The Noto fonts, Jigmo, Noto Emoji, GNU Unifont, Iosevka, UniHieroglyphica | per source, with its copyright line, in `data/unicode/outlines.json` | `OFL-1.1.txt`, `CC0-1.0.txt` |

The chart font the Shuishu outlines come from states no redistribution terms. `data/README.md`
records each set's files, digests and rebuild.

## Web export

`scripts/compose_ids.py export-web` writes the data a browser port of the composer reads
(`han_compose.web_export`). `manifest.json` carries these notices in `licences`, and the export
ships the licence texts beside it.

- **Outlines**: every glyph (`G`), and every piece a host-list entry names by its host glyph's
  contour indices (`c.k`), is outline data of the style's fonts. A `sans` export's are Noto Sans CJK
  JP's (© 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source') or Plangothic P1
  and P2's (Copyright (c) 2024 by Fitzgerald P. Köeingsegg; no Reserved Font Name), under the
  **SIL OFL 1.1**. A `regular` export's are TW-Kai's, under the **Open Government Data License 1.0**, whose full text is `OGL.txt`. A `pen-writing` export's are Kureedo Full's and GenZui Sans's, under the **SIL OFL 1.1**. A `fangsong` export's are Zhuque Fangsong's, under the **SIL OFL 1.1**, or Jigmo's, under **CC0 1.0**. A `serif` export's are Noto Serif CJK JP's (© 2017-2024 Adobe (http://www.adobe.com/); no
  Reserved Font Name), under the **SIL OFL 1.1**, or Jigmo's, under **CC0 1.0**. `OFL.txt` holds the
  OFL's full text after each OFL font's copyright line, read from the font's `name` table (the text
  is `data/licences/OFL-1.1.txt`, as Noto CJK ships it); a serif export also ships `CC0.txt`
  (`data/licences/CC0-1.0.txt`, the Creative Commons legal code) for Jigmo. Each style's export
  has its own version (`<commit>-<style>-<layout>-f<format>`).
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
component data. Glyphs drawn without those cuts carry only the terms of the fonts they come from:
the SIL OFL 1.1 for Noto Sans CJK, Noto Serif CJK and Plangothic outlines; none for Jigmo's (CC0).

The Serif drawing of ⿶む子 uses the outline of U+1B127 𛄧 from GenZui Serif Bold 0.118 for its inner operand. The outline in `js/src/genzui-alternate-ne.json` is in the font’s original coordinates. [GenZui Serif 0.118](https://github.com/mkpoli/GenZui/releases/tag/v0.118) · [SIL Open Font License 1.1 and copyright notices](../data/licences/OFL-GenZuiSerif.txt)
