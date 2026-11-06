// What a test hands the engine in place of a page: the export's files from a table, and the package's
// bundled files from `data/`. The page fetches a bundled file as gzip bytes and unpacks it; here the
// same bytes are read from disk and given to a `fetch` that speaks for both sources.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fromUrl } from '../src/loader.js'

const DATA = join(import.meta.dirname, '..', 'data')

/**
 * A `fetch` over an export given as files by name (JSON text, or gzip bytes for a shard) and over the
 * package's bundled files, as a static host serves both: a file that is not there is a 404. `asked`
 * collects the names.
 * @param {Record<string, string | Uint8Array>} files
 * @param {string[]} [asked]
 */
export function served(files, asked = []) {
  return async url => {
    const path = decodeURIComponent(String(url)).replace(/^.*?\/data\//, '').replace(/^\//, '')
    asked.push(path)
    const bundled = join(DATA, path)
    if (files[path] !== undefined) return new Response(files[path], { headers: { 'content-type': path.includes('/') ? 'application/octet-stream' : 'application/json' } })
    if (!path.includes('/') || !existsSync(bundled)) return new Response('{}', { status: 404 })
    return new Response(readFileSync(bundled))
  }
}

/** A source over `files`, reading the package's bundled files from disk too. */
export const sourceOver = (files, asked) => fromUrl('/', { fetch: served(files, asked) })

/** The source a sequence draws from over `files`, bundled files from disk. */
export { sourceFor } from '../src/source.js'
