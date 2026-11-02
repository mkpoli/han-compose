# @han-compose/composer

The composing engine of [han-compose](https://github.com/mkpoli/han-compose) for the browser: it
draws an Ideographic Description Sequence (`⿰亻⿱七木`) from the data `compose_ids.py export-web`
writes, and from the outlines it carries for the scripts no export covers.

It is the same method as the Python composer — hosts, cuts, layout, weight, guide, the rewriting
rules for enclosures, transforms, repeated grids, pyramids and constructs — in JavaScript, with its
own tests and a parity run against the Python drawings.

## Install

```
bun add @han-compose/composer
```

## Draw a description

A page draws in a Worker, one sequence at a time; a newer request ends the one before.

```js
import { composerPreview, dataUrls } from '@han-compose/composer'

const preview = composerPreview({
  base: 'https://example.org/composer/<version>/',   // the folder holding manifest.json
  loaders: dataUrls,                                 // where your build serves the package's data/
})
const drawing = await preview('⿰木口')                 // { d, parts, slots, emoji, … }
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
composer), `/source` (which source a sequence draws from), `/document-view` (a layered drawing for a
document), `/worker` (the module a Worker runs), `/pyramid`, `/component-forms`, `/scripts`, and one
per bundled script (`/tangut`, `/bopomofo`, `/new-korean`, `/small-seal`, `/shuishu`, `/palette`).

## The export

`export-web` writes format 6: `manifest.json`, `layout.json`, and the records and host lists packed
into gzipped shards by the first three hex digits of their SHA-256 (`g/<hhh>.json`, `p/<hhh>.json`),
so a sequence loads only the shards its parts fall in. This package reads format 6 and no earlier
one; a manifest of another format is a failed load.

## Tests

```
bun run check     # the types the declarations are made from
bun test tests    # the engine, its loader, the Worker, the bundled scripts
bun run parity:check   # against an export written with export-web --parity N --held-out M
```

## Licence

MIT. The outlines come with their own licences, in `data/licences`.
