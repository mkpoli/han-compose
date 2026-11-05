// @ts-check
// Draw sequences from han-compose's export (an `export-web` folder) and write them as one SVG.
//
//   bun scripts/draw.js --export DIR ⿰亻哥 [⿰木口 …] > out.svg
//   bun scripts/draw.js --export DIR --json ⿰亻哥         # what the engine answers, as JSON
//
// The export is read from disk as a static host would serve it; the package's own `data/` supplies
// the bundled outlines. No page and no Worker: the engine draws in this process.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fromUrl } from '../src/loader.js'

const args = process.argv.slice(2)
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const exportDir = flag('--export')
const json = args.includes('--json')
const sequences = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--export')
if (!exportDir || !sequences.length) {
  console.error('usage: bun scripts/draw.js --export DIR [--json] SEQUENCE…')
  process.exit(2)
}
const root = resolve(exportDir)
if (!statSync(root).isDirectory()) throw new Error(`${root} is not a folder`)

const DATA = join(import.meta.dirname, '..', 'data')
/** The export's files, and the package's own, as a host serves them. */
async function fetchFile(/** @type {string | URL | Request} */ url) {
  const text = decodeURIComponent(String(url))
  // The export's names are relative to its folder; a bundled file's are under the package's `data/`.
  const name = text.startsWith(`${root}/`) ? text.slice(root.length + 1) : text.slice(text.indexOf('/data/') + '/data/'.length)
  const file = text.startsWith(`${root}/`) ? join(root, name) : join(DATA, name)
  if (!existsSync(file)) return new Response('{}', { status: 404 })
  return new Response(readFileSync(file), { headers: { 'content-type': name.includes('/') ? 'application/octet-stream' : 'application/json' } })
}

const { compose } = await import('../src/loader.js')
const source = fromUrl(`${root}/`, { fetch: fetchFile })
await source.ready()

/** Every drawing, or the reason it has none. */
const drawings = []
for (const sequence of sequences) {
  try { drawings.push({ sequence, drawn: await compose(source, sequence) }) } catch (error) {
    console.error(`${sequence}: ${/** @type {Error} */ (error).message}`)
    process.exitCode = 1
  }
}
if (json) {
  console.log(JSON.stringify(drawings, null, 2))
} else {
  const size = 1000
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size * drawings.length} ${size}" width="${size * drawings.length}" height="${size}">`]
  drawings.forEach(({ drawn }, i) => {
    const shift = `translate(${i * size} 0)`
    if (drawn.cut) out.push(`<mask id="cut${i}"><rect width="${size}" height="${size}" fill="#fff"/><path d="${drawn.cut}" transform="${shift}" fill="#000"/></mask>`)
    out.push(`<path d="${drawn.d}" transform="${shift}" fill="#000"${drawn.cut ? ` mask="url(#cut${i})"` : ''}/>`)
  })
  out.push('</svg>')
  console.log(out.join('\n'))
}
