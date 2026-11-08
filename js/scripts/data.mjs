// The files the package carries, gathered from the repository's `data/`: the outlines the engine
// draws without an export, and the licence texts a package needs. `data/` holds them once, for the
// Python composer and the browser one alike; this copies the browser's share into `js/data/`, which
// `.gitignore` leaves out and `files` publishes. Run by `prepare`, `pretest` and `prepack`.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const source = join(root, '..', 'data')
const into = join(root, 'data')

// An installed package has no repository beside it: its `data/` is already the copy.
// A folder of that name that holds no composer data is no repository, and js/data stays.
if (!existsSync(join(source, 'palette', 'bundled-coverage.json')) || !existsSync(join(source, 'unicode', 'outlines.json'))) {
  console.log('data: no repository data beside this package; js/data is used as it stands')
  process.exit(0)
}
// A file dropped from `data/` must not linger in the package: the copy starts empty.
rmSync(into, { recursive: true, force: true })

/** Copy one file, its folder made first. @param {string} from @param {string} to */
function copy(from, to) {
  mkdirSync(join(to, '..'), { recursive: true })
  copyFileSync(from, to)
}

// The outlines of each bundled script, and of the palette's fallback glyphs.
for (const name of ['tangut', 'bopomofo', 'new-korean', 'small-seal', 'shuishu', 'jurchen', 'palette']) {
  const from = join(source, 'sources', name, 'outlines.json.gz')
  copy(from, join(into, 'sources', name, 'outlines.json.gz'))
}
// The Unicode sandbox: which characters the export draws, their properties, their scripts, and the
// shards of the fallback outlines a page draws as a webfont.
for (const name of ['coverage.json', 'properties.json', 'script-ranges.json', 'outlines.json']) {
  copy(join(source, 'unicode', name), join(into, 'unicode', name))
}
for (const name of readdirSync(join(source, 'unicode', 'outlines'))) {
  copy(join(source, 'unicode', 'outlines', name), join(into, 'unicode', 'outlines', name))
}
// The 山 band of 萬, the numbered forms' cuts, and the Sans cuts for numbered components.
for (const name of ['wan-shan.json', 'numbered-forms.json', 'numbered-sans-outlines.json.gz']) {
  copy(join(source, name), join(into, name))
}
// The contextual five's native cut, drawn from 葭.
for (const name of ['numbered-five-context.json']) {
  copy(join(source, name), join(into, name))
}
// The palette's curated fallback list, and which of it the bundled outlines draw.
for (const name of ['fallback-characters.json', 'bundled-coverage.json']) {
  copy(join(source, 'palette', name), join(into, 'palette', name))
}
// The licence texts a published package carries, and the code licence beside them.
copy(join(root, '..', 'LICENSE'), join(root, 'LICENSE'))
for (const name of readdirSync(join(source, 'licences'))) {
  copy(join(source, 'licences', name), join(into, 'licences', name))
}
console.log(`data: ${readdirSync(join(into, 'sources')).length} scripts, ${readdirSync(join(into, 'unicode', 'outlines')).length} Unicode shards`)
