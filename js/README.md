# @han-compose/composer

The composing engine of [han-compose](https://github.com/mkpoli/han-compose) for the browser: it
draws an Ideographic Description Sequence (`⿰亻⿱七木`) from the data `compose_ids.py export-web`
writes, and from the outlines it carries for the scripts no export covers.

It is the same method as the Python composer — hosts, cuts, layout, weight, the rewriting rules for
enclosures, transforms, repeated grids, pyramids and constructs — in JavaScript, with its own tests
and a parity run against the Python drawings.

## Install

```
bun add @han-compose/composer
```

## Draw a description

A page draws in a Worker, one sequence at a time; a newer request ends the one before.

```js
import { composerPreview } from '@han-compose/composer'

const preview = composerPreview({
  base: 'https://example.org/composer/<version>/',   // the folder holding manifest.json
})
const drawing = await preview('⿰木口')                 // { d, parts, slots, emoji, … }

// A build that serves the package's `data/` somewhere else names the files it moved:
import { dataUrls } from '@han-compose/composer'
composerPreview({ base, loaders: dataUrls })
```

`preview.warm()` starts the Worker on the export before the first drawing. A page that serves the
package's `data/` where the package sits needs no `loaders`.

Without a Worker:

```js
import { compose, fromUrl } from '@han-compose/composer/loader'

const source = fromUrl('https://example.org/composer/<version>/')
await source.ready()
const drawn = await compose(source, '⿰木口', { separate: true, fontStyle: 'sans' })
```

Entry points: `.` (drawing files, the preview, Emoji, tokens), `/loader` (the export and the
composer), `/compose` (the composer and the tree it draws), `/geometry`, `/tree`, `/source` (which
source a sequence draws from), `/drawing-svg`, `/document-source` and `/document-view` (a layered
drawing for a document), `/worker` (the module a Worker runs), `/retry`, `/local`, `/bundled`,
`/hangul`, `/hangul-ids`, `/pyramid`, `/pyramid-rows`, `/repetition`, `/strokes`, `/component-forms`,
`/emoji`, `/group-parts`, `/scripts`, `/tokens`, `/unicode` (the fallback shards), and one per bundled script (`/tangut`, `/bopomofo`,
`/new-korean`, `/small-seal`, `/shuishu`, `/jurchen`, `/palette`).

## The export

`export-web` writes format 6: `manifest.json`, `layout.json`, and the records and host lists packed
into gzipped shards by the first three hex digits of their SHA-256 (`g/<hhh>.json`, `p/<hhh>.json`),
so a sequence loads only the shards its parts fall in. This package reads format 6 and no earlier
one; a manifest of another format is a failed load.

## Examples

```
bun examples/draw-to-svg.js https://example.org/composer/<version>/ '⿰木口' > kou.svg
bun examples/bundled-script.js '𗀀' > tangut.svg
```

The first draws from an export over HTTP, the second from the outlines the package carries, with no
export at all.

## Tests

```
bun run check     # the types the declarations are made from
bun test tests    # the engine, its loader, the Worker, the bundled scripts
COMPOSER_EXPORT=~/exports/serif bun run parity:check   # against an export written with export-web --parity N --held-out M
```

## Licence

MIT. The outlines come with their own licences, in `data/licences`.
