import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { contexts, malformed, spellings } from './recorded-chain-corpus.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const styles = new Set(['sans', 'serif', 'regular', 'fangsong', 'pen-writing'])
const usage = 'Usage: node js/scripts/audit-recorded-chains.mjs --out DIR [--prefix revised|main] [--renderer CHECKOUT] STYLE=LOCAL_EXPORT [STYLE=LOCAL_EXPORT ...]'
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    prefix: { type: 'string', default: 'revised' },
    renderer: { type: 'string', default: root },
    help: { type: 'boolean' },
  },
})
if (values.help) {
  console.log(usage)
  process.exit(0)
}
if (!values.out || !positionals.length || !['revised', 'main'].includes(values.prefix)) {
  throw new Error(usage)
}

const exports = new Map()
for (const arg of positionals) {
  const equals = arg.indexOf('=')
  const style = arg.slice(0, equals), path = arg.slice(equals + 1)
  if (equals < 0 || !styles.has(style) || !path || exports.has(style)) {
    throw new Error(`Expected a distinct STYLE=LOCAL_EXPORT, got ${arg}`)
  }
  const directory = resolve(path)
  await access(join(directory, 'manifest.json'))
  exports.set(style, directory)
}

const renderer = resolve(values.renderer)
const bundled = join(renderer, 'js', 'data')
await access(join(bundled, 'custom-forms.json.gz'))
/** A missing local shard has the same status as a missing export shard. */
async function localFile(directory, path) {
  const inside = relative(directory, path)
  if (inside === '..' || inside.startsWith(`..${sep}`)) throw new Error('Audit tried to read outside its data directory')
  try {
    return new Response(await readFile(path))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return new Response(null, { status: 404 })
  }
}

const networkAttempts = new Set()
globalThis.fetch = async url => {
  networkAttempts.add(String(url))
  throw new Error('This audit only reads local files')
}
const load = name => import(pathToFileURL(join(renderer, 'js', 'src', name)).href)
const { sourceFor, exportSource } = await load('source.js')
const { compose } = await load('loader.js')
const read = path => localFile(bundled, resolve(bundled, path))
const out = resolve(values.out)
await mkdir(out, { recursive: true })

for (const [fontStyle, directory] of exports) {
  const base = pathToFileURL(directory + sep).href
  const fetch = url => localFile(directory, fileURLToPath(url))
  const exported = exportSource(base, { fetch, read })

  async function audit(keys) {
    const rows = {}
    for (const raw of keys) {
      if (malformed.has(raw)) {
        rows[raw] = { ok: false, status: 'invalid-source', path: null, origins: [], missing: [], error: malformed.get(raw) }
        continue
      }
      try {
        const source = sourceFor(raw, { fontStyle, exported, base, fetch, read })
        const drawing = await compose(source, raw, { fontStyle })
        const { d: path = null, origins = [], missing = [] } = drawing
        rows[raw] = { ok: Boolean(path) && !missing.length, path, origins, missing, error: null }
      } catch (error) {
        rows[raw] = { ok: false, path: null, origins: [], missing: [], error: error instanceof Error ? error.message : String(error) }
      }
    }
    return rows
  }

  const rows = await audit(spellings)
  const rccRows = await audit(contexts)
  if (networkAttempts.size) throw new Error(`Audit attempted network access: ${[...networkAttempts].join(', ')}`)
  for (const [prefix, result] of [[values.prefix, rows], [`rcc-${values.prefix}`, rccRows]]) {
    await writeFile(join(out, `${prefix}-${fontStyle}.json`), JSON.stringify(result) + '\n')
  }
  const ok = results => Object.values(results).filter(row => row.ok).length
  console.log(`${fontStyle}: ${ok(rows)}/${spellings.length} chains, ${ok(rccRows)}/${contexts.length - malformed.size} complete RCC contexts, ${malformed.size} invalid source`)
}
