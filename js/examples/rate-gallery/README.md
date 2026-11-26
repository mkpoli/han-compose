# 率 gallery

The gallery shows the 37 characters built on 率 in the five Han Compose faces. Each card sets the face's own glyphs beside the four reviewed forms: a Chinese or Japanese 幺, with inward dots or with paired strokes. Selecting a form copies its IDS.

Build from the package's `js/` directory after installing the workspace dependencies.

```sh
bun run data
bun examples/rate-gallery/build.mjs
```

Open `dist/rate-gallery/index.html` in a browser. The page is one script with its outlines embedded, so it needs no server and no network.

## Address parameters

| Parameter | Value |
| --- | --- |
| `q` | Characters, code points such as `U+2032D`, or one of a character's spellings |
| `face` | `sans`, `serif` (default), `regular`, `fangsong`, `pen-writing` |
| `view` | `matrix` hides the reference column |
| `family` | `30`, the IRG UCV number of 率; any other family lists nothing |

## Reference outlines

The four forms come from `src/rate-forms.js` and `src/rate-drawing.js`. The reference column reads the whole-glyph outlines in `data/`, in a 1000-unit em with y running down.

| Caption | Source | Licence |
| --- | --- | --- |
| 原字 | [Noto Sans CJK JP 2.004](https://github.com/notofonts/noto-cjk/releases/tag/Sans2.004), [Noto Serif CJK 2.003](https://github.com/notofonts/noto-cjk/releases/tag/Serif2.003) (JP, SC, TC, HK and KR, one figure per distinct glyph), [TW-Kai 11510.1](https://www.cns11643.gov.tw/opendata/Fonts_Kai.zip), [Zhuque Fangsong 0.212](https://github.com/TrionesType/zhuque), Kureedo Full 0.5.0 | SIL OFL 1.1; TW-Kai under the Open Government Data License 1.0 |
| 补字原字 | [WenJin Mincho 2.101](https://github.com/takushun-wu/WenJinMincho/releases/tag/v2.101) for serif, TW-Kai-Ext-B 11510.2 for regular | SIL OFL 1.1; Open Government Data License 1.0 |
| 参考字形 | [Plangothic P1 and P2 2.9.5795](https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project), Copyright (c) 2024 by Fitzgerald P. Köeingsegg | SIL OFL 1.1 |

Plangothic draws 30 of the 37 characters and appears on those cards in every face, including the faces with no glyph of their own. It also draws 𰀪, ⺀, 𦃃, 𤣩 and 𧾷 in the IDS line. A card reads 无原字 when neither the face nor Plangothic has the character. The fonts themselves are not part of the example. [Font sources and licences](../../../docs/licensing.md)

The stroke distinction follows [IRG UCV 30](https://www.unicode.org/irg/docs/n2978-Complete.pdf), and the two Japanese spellings are the Adobe-Japan1 sequences 率 VS17 and 率 VS18 in the [Unicode IVD](https://www.unicode.org/ivd/data/2025-07-14/IVD_Sequences.txt).

`build-data.py` rewrites `data/` from the reviewed proof records and the two Plangothic fonts.

```sh
uv run --script examples/rate-gallery/build-data.py <proofs> <fonts>
```
