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
| `sources/jurchen/outlines.json.gz` | the 965 outlines of Unicode 18.0's 914 Jurchen characters and 51 radicals |
| `sources/palette/outlines.json.gz` | 148 palette components no export's font draws |
| `palette/fallback-characters.json`, `palette/bundled-coverage.json` | the same, listed and indexed |
| `unicode/outlines/*.json.gz`, `unicode/coverage.json`, `unicode/outlines.json` | 56,651 outlines of loose marks and parts no other source draws |
| `licences/` | the OFL, CC0, MIT and Unicode texts the export carries |

Noto Sans CJK JP and Plangothic are SIL OFL 1.1; Noto Serif Tangut too. 69 of the palette's outlines
are the numbered components that BabelStone's [IDS.TXT](https://www.babelstone.co.uk/CJK/IDS.TXT) note 6
gives no description, cut from [BabelStone Han PUA](https://www.babelstone.co.uk/Fonts/Download/BabelStoneHanPUA.ttf) 1.472
(SHA-256 `92e7155bd28f5570449f4dc71e9bb6fa919f67ef0120d4f83b58c61bed3ed4dc`) by Andrew West, under the
Arphic Public License (`licences/Arphic-Public-License.txt`). Their private-use code points hold only for
that version of the font. Unicode data is under the Unicode License v3 (`licences/Unicode-3.0.txt`).
The Small Seal allocation, the New Korean letters and the Shuishu block are proposals, not assigned code points; nothing here is drawn from a font these
notices do not name.

The Jurchen outlines are from Alari Xuwasun Jurchen, public beta of 2026-10-12, by Sulfa, Dooran and
Raxon7, SIL OFL 1.1 (`licences/OFL-1.1.txt`), published at [朝花·夕拾 電子藏書閣](https://dorontu.com/#/cloud),
folder 女真文资料/女真文字体. Sulfa and Ayasala's article
[「没人给女真文做字体和输入法？那我们自己来」](https://mp.weixin.qq.com/s/YaUP6bq4xt_18ywlRxCQpA) (WeChat, date
not seen) says the font is a Fangsong restyling of the encoding proposal's forms, so it does not
reproduce an inscription or manuscript. The site was found through 柳突破's
[Bilibili video](https://www.bilibili.com/video/BV1odec6pEqp/) of 2026-09-16.
The same file holds 537 variant sequences through U+FE00–U+FE04. They are that font's convention, also listed in the Alari
Jurchen Rime table `Alari_jurc.dict.yaml` (version 2026.05.29, by Yehenara Ayasala, Sulfa and Tunggiya
Uju, same site): `StandardizedVariants.txt` of Unicode 18.0 records none for Jurchen, so another font may draw the
base form.

The shape files were written for a browser port of the composer and moved here, unchanged, with the
port. The scripts that rebuilt them stay in the project that sources and audits the data; each file
records its own font checksums.

## Where drawn shapes are cut along KanjiVG

A part cut along KanjiVG's component groups (`kanjivg` in a drawing) adapts KanjiVG, CC BY-SA 3.0;
a drawing with one is shared alike. The export carries the notice.
