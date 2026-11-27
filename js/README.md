# han-compose

Draws a Han character from its ideographic description sequence (IDS), such as `⿰亻哥`, as an SVG
path. Each part is cut from a character a font already draws and set where the font's designers
put parts like it, and the sans and serif styles bring the parts to one stroke weight. A character
with no code point comes out in the font's own style. It runs in a browser, in a Web Worker, and in
Node and Bun.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mkpoli/han-compose/main/docs/images/composer-dark.png">
  <img src="https://raw.githubusercontent.com/mkpoli/han-compose/main/docs/images/composer-light.png" alt="⿰亻哥 drawn in the sans, serif, Regular Kai, Wen Kai and fangsong styles, then ⿵門⿰亻哥 and ⿸广⿰KO in sans, ⿱艹⬚ with its empty slot dotted, and ⿰亻哥 with each of its two parts in a colour of its own" width="774">
</picture>

## Install

```sh
npm install han-compose
```

ES modules with type declarations. The font mixer uses Clipper to unite overlapping outlines and d3-contour to trace distance fields. Node needs 20.16 or later.

## Draw a sequence

The composer reads an *export*: a folder of static files holding one font style's parts and layout.
Five are public ([Exports](#exports)), and `compose` fetches only the files a sequence needs.

```js
import { writeFile } from 'node:fs/promises'
import { compose, drawingSvg, fromUrl } from 'han-compose'

const source = fromUrl('https://ids-input-composer.mkpoli.workers.dev/a83fc941166b-sans-compose-layout-v4-f7+variants/')

const drawing = await compose(source, '⿰亻哥')
await writeFile('out.svg', drawingSvg(drawing))
```

One source serves any number of sequences and keeps what it has loaded.

## Exports

| Style | `fontStyle` | Fonts |
|---|---|---|
| Sans | `'sans'` | Noto Sans CJK JP, Plangothic |
| Serif (明朝) | `'serif'` | Noto Serif CJK JP, Jigmo |
| Woodblock (刻本明體) | `'woodblock'` | Nôm Na Tống |
| Fangsong (仿宋) | `'fangsong'` | Zhuque Fangsong, Jigmo |
| Regular Kai (正楷) | `'regular'` | TW-Kai, TW-Kai Ext-B, TW-Kai Ext-G |
| Wen Kai (文楷) | `'pen-writing'` | Kureedo Full, GenZui Sans |

```js
const EXPORTS = {
  sans: 'https://ids-input-composer.mkpoli.workers.dev/a83fc941166b-sans-compose-layout-v4-f7+variants/',
  serif: 'https://ids-input-composer.mkpoli.workers.dev/8156f838798c-serif-compose-layout-v4-serif-f7+variants/',
  fangsong: 'https://ids-input-composer.mkpoli.workers.dev/9f797e2322d2-fangsong-compose-layout-v4-fangsong-f7/',
  regular: 'https://ids-input-composer.mkpoli.workers.dev/c14ee5e08798-regular-compose-layout-v4-regular-f7/',
  'pen-writing': 'https://ids-input-composer.mkpoli.workers.dev/ce3eaafda8f9-kaisho-compose-layout-v4-kaisho-f7/',
}

// `fontStyle` names the export's style. It defaults to 'sans'.
const drawing = await compose(fromUrl(EXPORTS.serif), '⿰亻哥', { fontStyle: 'serif' })
```

An export's files never change under its URL. `export-web` in the
[repository](https://github.com/mkpoli/han-compose#run) writes an export from the fonts, to serve
from any static host.

## Five-face mixing

Supply the export URLs once. An editor can then change the face proportions and stroke weight on each preview request.

```js
import { composerPreview } from 'han-compose'

const preview = composerPreview({ base: EXPORTS.sans, faceBases: EXPORTS, separate: true })
const mix = {
  shares: { sans: 3, serif: 2, fangsong: 1, regular: 2, 'pen-writing': 2 },
  weight: 1.15,
}
const drawing = await preview('⿰木口', { mix })
```

The shares are relative and at least one must be positive. Only faces with a positive share are read. Weight ranges from 0.65 to 1.50 and defaults to 1. A single pole at neutral weight returns its original drawing. The same mix works with local sources using `composeMixed(sources, sequence, mix, { separate: true })`, where `sources` maps the style names to `createSource` or `fromUrl` results.

For intermediate settings the mixer registers the outlines of corresponding operands. It pairs connected strokes and counters, then matches their vector boundaries. Where the faces differ in topology, it aligns their ink profiles and interpolates on a subpixel-sampled distance grid. Changing weight moves each boundary according to the local stroke thickness. The example queues the latest slider position while the worker finishes the previous draw, so successive frames share prepared outlines. Replacing an in-flight preview resets that worker. Differences in stroke structure can soften fine details. Interpolated parts retain their operand identity and omit the original stroke groups. When sources cannot separate the same operands, the result has a whole-glyph outline and no editable parts. Any KanjiVG attribution requirement from an active face carries through to the mix.

The [interactive font mixer](examples/font-mixer/) has a five-pole pad, independent face controls, a stroke-weight slider and SVG export.

## The drawing

`compose` answers a plain object in a 1000-unit box, y down.

| Field | |
|---|---|
| `d` | The SVG path of the ink, nonzero fill. |
| `parts` | Each drawn part: its path `d`, its `box` as `[x, y, width, height]`, its `origin` (`learned 倡`, `glyph 口`), and `cut: true` on a piece `㇯` takes away. |
| `slots` | Each empty slot (`⬚`), in reading order, with its `box`. |
| `cut` | The path of what `㇯` takes away, to mask out of `d` as `drawingSvg` does. |
| `stroke` | The stroke widths the drawing is weighted to, across x and y. |
| `kanjivg` | `true` when a part was cut along KanjiVG's component groups or drawn with a hand form read from it. The drawing is then CC BY-SA 3.0. |
| `approximate` | The operators the drawing used that have only an approximate rule, among `⿼ ⿽ ⿾ ⿿ ㇯ 〾`. |

`drawingSvg(drawing, { ink, background, padding, size, placeholders, idPrefix })` writes the whole
drawing as an SVG. The parts are paths of their own when a page styles them:

```js
const drawing = await compose(source, '⿰亻哥', { separate: true })
const colours = ['#cf222e', '#0969da']
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${
  drawing.parts.filter(part => !part.cut).map((part, i) => `<path d="${part.d}" fill="${colours[i % 2]}"/>`).join('')
}</svg>`
```

`separate` draws each operand as a piece even where one glyph spells the whole description, and
falls back to that glyph when the operands cannot be drawn apart. `exclude: ['侮']` names characters
nothing may be taken from.

## What a sequence may hold

| | |
|---|---|
| `⿰亻哥` `⿵門⿰亻哥` | The operators `⿰ ⿱ ⿲ ⿳ ⿴ ⿵ ⿶ ⿷ ⿸ ⿹ ⿺ ⿻`, up to 24 in a sequence and 8 deep. |
| `⿼叵口` `⿾可` `㇯口丨` | `⿼ ⿽`, the reflection `⿾`, the half-turn `⿿`, the subtraction `㇯` and `〾`. |
| `⿰又⿱丿⿹⿴#(-𠃌㇉)丶灬` | The face’s 鸡 supplies 又 and the bird frame. The four dots come from 鳮 or, in FangSong, 鴨. Other zi.tools chains can use strokes joined from the face. |
| `⿱艹⬚` | `⬚` (U+2B1A), an empty slot: the layout keeps its room and reports its box. |
| `⿸广⿰KO` | Letters and digits of Latin, Greek, Cyrillic, kana and Hangul as parts. |
| `⿰ㄱㅏ` | Hangul letters, drawn as the syllable they spell. |
| `者󠄁` | A variation sequence, drawn as the glyph the font maps it to. The sans and serif exports hold them. |
| `⿺辶󠄁禺󠄁` | A variation sequence as a part: laid out as its base character is, in the sequence's own shape. |

## In a page

`composerPreview` draws in a module Worker, one sequence at a time. A newer request ends the one
before it, whose promise rejects with an `AbortError`, as does a drawing that outlasts `timeout`
(120 seconds).

```js
import { composerPreview, drawingSvg } from 'han-compose'

const preview = composerPreview({
  base: 'https://ids-input-composer.mkpoli.workers.dev/a83fc941166b-sans-compose-layout-v4-f7+variants/',
})
preview.warm() // start the Worker and read the export before the first drawing

input.addEventListener('input', async () => {
  try {
    const drawing = await preview(input.value)
    output.innerHTML = drawingSvg(drawing, { size: 200 })
  } catch (error) {
    if (error.name !== 'AbortError') status.textContent = error.message
  }
})
```

`preview(sequence, { signal, onSketch })` takes an `AbortSignal`, and `onSketch` hears each leaf's
box as soon as the layout is known. A sequence still being written (`⿰亻`) draws with an empty slot
where the missing part goes, and an Emoji part (`⿰👩木`) comes back in `drawing.emoji` with the box
to draw it in as text.

Vite builds the Worker as it stands. The outlines the package draws [without an
export](#without-an-export) are files under its `data/`: a bundled page serves that folder and names
each file's URL.

```js
// after copying node_modules/han-compose/data to public/composer-data
import { composerPreview, dataUrls } from 'han-compose'

const preview = composerPreview({
  base,
  loaders: Object.fromEntries(Object.keys(dataUrls).map(path => [path, `/composer-data/${path}`])),
})
```

## Without an export

The package carries outlines for Tangut, Jurchen, Shuishu, Small Seal, Bopomofo and the New Korean
Orthography letters, and fallback glyphs from the Noto fonts for other scripts. `sourceFor` picks the
source a sequence draws from: the package's own outlines where they cover it, the export at `base`
otherwise.

```js
import { compose, drawingSvg } from 'han-compose'
import { sourceFor } from 'han-compose/source'

const tangut = await compose(sourceFor('𗀀', { bundled: true }), '𗀀') // no network
const mixed = await compose(sourceFor('⿰𗀀哥', { base }), '⿰𗀀哥')      // Tangut from the package, 哥 from the export
```

### Outlines of the host's own

An entity reference (`&CDP-8BD0;`, `&GW-u58ec-var-001;`) is one component whose glyph belongs to a
set outside Unicode. A host that has outlines for some lists a file of them as
`host/outlines.json.gz` in `loaders`: `{ "records": { "&GW-u58ec-var-001;": record } }`, each record in
the export's format (`{ k, G: { v, b, p }, ink, o }`). The file is read only for a sequence that
names an entity, and a reference it does not hold is drawn as before.

```js
const preview = composerPreview({ base, loaders: { 'host/outlines.json.gz': '/data/my-outlines.json.gz' } })
await preview('⿰氵&GW-u58ec-var-001;')
```

## Errors

`compose` throws a `LookupError` whose message says what could not be drawn or that the sequence is
past the limits. An export that cannot be read throws the error of the read.

```js
import { LookupError } from 'han-compose'

try {
  await compose(source, '⿰亻')
} catch (error) {
  if (error instanceof LookupError) console.log(error.message) // ⿰亻 is missing a component.
}
```

`composerPreview` rejects with a `LookupError` too, with a `TooLargeError` for a sequence past the
limits, and with an `UnavailableError` when the export cannot be read.

## Reading a sequence

```js
import { parseDescription, writeDescription, tokens } from 'han-compose'

parseDescription('⿰亻⿱七木')
// { op: '⿰', parts: ['亻', { op: '⿱', parts: ['七', '木'] }] }

writeDescription({ op: '⿰', parts: ['亻', { op: '⿱', parts: ['七', '木'] }] })
// '⿰亻⿱七木'

tokens('⿰亻⿱七木')[2]
// { path: [1], start: 2, end: 5, tokenEnd: 3, text: '⿱' }
```

### Analysing variant forms

An IDS operand can carry an exact IVS, an explicit decomposition or a custom component reference. The registry indexes these spellings by occurrence, visual feature and source. See [Variation registry](../docs/design/variation-registry.md) for the catalogue format, a worked example and source import commands.

## Entry points

| Import | |
|---|---|
| `han-compose` | `compose`, `fromUrl`, `composerPreview`, `drawingSvg`, the tree and token readers, the error classes |
| `/source` | `sourceFor`: the source a sequence draws from |
| `/loader` | Reading an export: `fromUrl`, `createSource`, `compose`, `sketch`, `LIMITS` |
| `/worker` | The module the Worker runs |
| `/variants` | `variationSequences(base)`: the variation sequences an export draws |
| `/drawing-svg`, `/document-source`, `/document-view` | A drawing as an SVG file, and as the layers of a document |
| `/tangut`, `/jurchen`, `/shuishu`, `/small-seal`, `/bopomofo`, `/new-korean`, `/unicode`, `/palette` | One source for each set of bundled outlines |
| `/host` | `hostSource`, `HOST_OUTLINES`: outlines a host supplies for entity references |
| `/src/<name>.js` | Every other module of the engine |

## Develop

```sh
bun install
bun run check                 # the types the declarations are made from
bun test tests                # the engine, its loader, the Worker, the bundled outlines
bun examples/draw-to-svg.js https://ids-input-composer.mkpoli.workers.dev/a83fc941166b-sans-compose-layout-v4-f7+variants/ '⿰木口' > out.svg
bun examples/bundled-script.js '𗀀' > tangut.svg
COMPOSER_EXPORT=~/exports/serif bun run parity:check   # an export written with export-web --parity N --held-out M
```

The package reads export format 7. The method, its measurements and the export's layout are in the
[repository](https://github.com/mkpoli/han-compose).

## Licence

MIT for the code. The bundled outlines keep their sources' terms, with the texts in `data/licences`:
SIL OFL 1.1 for most, CC BY-SA 4.0 for the New Korean Orthography letters, GPL-2.0-or-later for the
Small Seal sequences from CHISE-IDS, CC0 1.0 and the Arphic Public License for parts of the
fallbacks; the chart font the Shuishu outlines come from states none. The
[repository](https://github.com/mkpoli/han-compose/blob/main/docs/licensing.md) lists each source.

The fonts and tables behind an export keep their own terms, which its `manifest.json` lists under
`licences`. A drawing with `kanjivg: true` adapts KanjiVG and is shared alike under CC BY-SA 3.0
with the notice "KanjiVG, Copyright (C) 2009-2013 Ulrich Apel, CC BY-SA 3.0,
https://kanjivg.tagaini.net/".

### Manuscript form ⿰氵⿺木罒

The FangSong fallback for 〇 is the U+3007 outline from Zhuque FangSong 0.212 (SIL OFL 1.1). [Font notices](../docs/licensing.md)

The prepared form for ⿲㇇丨𰛅 in `src/water-stroke-row.json` cuts 水 into its left bend and hooked body, then inserts the short 丨 shown in the source. The outlines are adapted from Noto Sans CJK, Noto Serif CJK, Zhuque FangSong 0.212, Kureedo Full 0.5.0 (SIL OFL 1.1) and TW-Kai 11510.1 (數位發展部, Open Government Data License 1.0). [潮語十五音 reference](https://rare.glyphatlas.org/media/v2/3bbecda5aaee2182bb994d8cabd674aad5c4a14245b8ec4f8817e4064b2317ce.webp) · [Font notices](../docs/licensing.md)

The prepared form for ⿺水巜 in `src/water-enclosure.json` narrows 水 above its sweeping right leg and sets 巜 in that opening. Zhuque supplies its two bends from 巛. The outlines are adapted from Zhuque FangSong 0.212, Kureedo Full 0.5.0, Noto Sans CJK JP 2.004 and Noto Serif CJK JP 2.003 (SIL OFL 1.1) and TW-Kai 11510.1 (數位發展部, Open Government Data License 1.0). [潮語十五音 reference](https://rare.glyphatlas.org/media/v2/095ea0b397c1652d3bec774a27980ede0ff58f774220eef38636844fcf1dceea.webp) · [Font notices](../docs/licensing.md)

The prepared form in `src/mu-net-forms.json` takes 氵 from 河, the left 木 from 林, the sweeping stroke from 木, and 罒 from 罪 (買 in Fangsong). ⿺沐罒 groups the first two components as 沐. The outlines are adapted from GenZui Sans 0.105, Noto Serif CJK JP 2.003, Zhuque Fangsong 0.212 and Kureedo Full 0.5.0 under SIL OFL 1.1. The Regular Kai outlines are adapted from TW-Kai 11510.1, 數位發展部 (Ministry of Digital Affairs), CNS11643中文標準交換碼全字庫, under the Open Government Data License 1.0. [Font sources and notices](https://github.com/mkpoli/han-compose/blob/main/docs/licensing.md)

For ⿺木 followed by another operand, the same enclosing 木 holds the operand in the opening above its final stroke. 术 and its spelling ⿺木丶 retain their ordinary 木.

The missing FangSong strokes in `src/fangsong-components.json` are cut from Zhuque Fangsong 0.212. The two dots of 丷 come from 半, ㇒ from 丿, 𠃌 from 司, 龺 from 朝, ⺀ from 冬 and ⺈ from 欠. The joined strokes 𠃍, ⺊ and ㇉ follow the lower right of 片, the top of 卓 and the lower turn of 弓. Copyright 2023 JadeFoci, SIL Open Font License 1.1. [Font licensing](https://github.com/mkpoli/han-compose/blob/main/docs/licensing.md)

The FangSong form of 貭 uses the joined upper body of 盾 and the feet of 貝 from Zhuque Fangsong 0.212, © 2023 JadeFoci, SIL OFL 1.1. [Font source and license](../docs/licensing.md)

Noto Serif Hentaigana supplies 𛂦 (hentaigana HA-9) for the FangSong and Regular pairings when the selected font lacks it. The two columns of ⿰𛂦方 follow the encoded form 𭤪. [Noto Serif Hentaigana](https://github.com/notofonts/hentaigana) · [SIL Open Font License 1.1](../data/licences/OFL-NotoSerifHentaigana.txt)

The ㅏ and ㄴ in the FangSong drawing of ⿱⿰◇ㅏㄴ retain their positions in Gowun Batang’s 안, with a diamond from Zhuque Fangsong in the initial position. [Gowun Batang source](https://github.com/yangheeryu/Gowun-Batang) · [SIL Open Font License 1.1](../data/licences/OFL-GowunBatang.txt)

### 率 form selection

`rateFormsFor(text)` from `han-compose/rate-forms` returns four choices for 率 and 36 compounds. Each has an `id`, `host`, `label`, and `text`. Store the chosen `text` in place of the selected IDS subtree. Calling the function on that subtree recovers the same choices.

Two choices use structural IDS spellings. Two use Adobe-Japan1 sequences for 率. A compound wraps that component in its own IDS. `rateDrawing(text, style)` from `han-compose/rate-drawing` returns the reviewed 1000-unit SVG path for an exact choice in one of the five supported faces.

The [Unicode IVD](https://www.unicode.org/ivd/data/2026-08-03/IVD_Sequences.txt) registers 率 VS17 as Adobe-Japan1 CID+3952 and 率 VS18 as CID+14085. Other registered sequences of the host can open the picker. The gallery compares 𳅀 against the [Plangothic P2 source](https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project).
