// @ts-nocheck
// Font-derived fallback glyphs. Each 256-code-point shard loads only when a missing glyph needs it.
import coverage from '../data/unicode/coverage.json' with { type: 'json' }
import constants from './constants.json' with { type: 'json' }
import { unpack } from './loader.js'

/** The code points the export covers, as `[first, last]` ranges in order: what a page lists when it
 *  needs every character the fallback can draw. */
export const UNICODE_COVERAGE = /** @type {[number, number][]} */ (coverage)

/** Whether this exact component has a bundled outline. Selectors require an explicit export glyph. */
export function hasUnicodeGlyph(key) {
  if ([...key].length !== 1) return false
  const cp = key.codePointAt(0)
  let lo = 0, hi = coverage.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, [start, end] = coverage[mid]
    if (cp < start) hi = mid - 1
    else if (cp > end) lo = mid + 1
    else return true
  }
  return false
}

const fileOf = key => `unicode/${(key.codePointAt(0) >> 8).toString(16).padStart(3, '0')}`
/** The package's `data/` folder, from this module's own address. Kept as a string: a bundler only
 *  rewrites `new URL(…, import.meta.url)` written out in full. */
const DATA_ROOT = String(import.meta.url).replace(/[^/]*$/, '../data/')
/**
 * The URL of a file under the package's `data/`. A file at the top of the folder keeps the
 * `new URL(…, import.meta.url)` form, which Vite turns into an asset of the build; Vite reads that form
 * as a glob of the folder's top level only, so a nested file (`unicode/outlines/…`, `sources/…`) came
 * out `undefined` and was fetched as `src/undefined`. A nested one is resolved against the folder
 * instead; a build that moves the package's files passes `loaders` for those, as it always had to.
 * @param {string} path @returns {URL}
 */
export const dataFile = path => path.includes('/') ? new URL(path, DATA_ROOT) : new URL(`../data/${path}`, import.meta.url)
/** A bundled file's parsed JSON, as the page reads it: the file under the package's `data/`. */
export const pageLoader = async path => {
  const response = await fetchBundled(dataFile(path))
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}
/** A bundled file fetched at `url`. Node's `fetch` reads no `file:` URL, so an installed package's
 *  own file is read from disk there. @param {string | URL} url @returns {Promise<Response>} */
export const fetchBundled = url => fetch(url).catch(async error => {
  const files = String(url).startsWith('file:') ? globalThis.process?.getBuiltinModule?.('node:fs/promises') : null
  if (!files) throw error
  return new Response(await files.readFile(new URL(url)))
})
const readShard = name => pageLoader(`unicode/outlines/${name.slice('unicode/'.length)}.json.gz`)

/** Add missing glyphs to an export, or draw bundled glyphs alone with geometric layout. `load`
 *  answers a bundled file's parsed JSON by its path under `data/`. */
export function unicodeSource({ fallback = null, load = readShard } = {}) {
  const files = new Map(), loading = new Map()
  let ready = null
  const source = {
    manifest: null,
    get layout() { return fallback?.layout ?? null },
    ready() {
      return ready ??= Promise.resolve().then(() => fallback?.ready()).then(() => {
        source.manifest = fallback?.manifest ?? { constants, spelled: [] }
      }).catch(error => { ready = null; throw error })
    },
    modelFiles: options => fallback?.modelFiles(options) ?? [],
    async load(names) {
      const remote = [], local = []
      for (const name of names) (name.startsWith('unicode/') ? local : remote).push(name)
      await Promise.all([
        fallback?.load(remote),
        ...local.map(name => {
          if (files.has(name)) return null
          if (!loading.has(name)) loading.set(name, Promise.resolve().then(() => load(name))
            .then(data => { files.set(name, data) }).finally(() => loading.delete(name)))
          return loading.get(name)
        }),
      ])
    },
    // Remote records load first; their own glyphs always take precedence over fallback outlines.
    filesOf(keys) {
      return fallback ? fallback.filesOf(keys) : new Set(keys.filter(hasUnicodeGlyph).map(fileOf))
    },
    store() {
      const remote = fallback?.store(), missing = remote?.missing ?? new Set()
      return {
        manifest: source.manifest, missing,
        get layout() { return remote?.layout ?? null },
        identity: key => remote?.identity?.(key),
        rec(key) {
          const record = remote?.rec(key)
          // If a remote record is still loading, finish that round before fetching a fallback.
          if (record?.G || !hasUnicodeGlyph(key) || [...missing].some(name => !name.startsWith('unicode/'))) return record ?? null
          const name = fileOf(key)
          if (!files.has(name)) { missing.add(name); return record ?? null }
          const glyph = files.get(name)[key]
          return glyph ? { ...record, ...glyph } : record ?? null
        },
        hosts: (key, place) => remote?.hosts(key, place) ?? [],
        places: key => remote?.places(key) ?? [],
      }
    },
  }
  return source
}
