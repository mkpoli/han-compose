import { afterEach, describe, expect, it } from 'bun:test'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compose } from '../src/loader.js'
import { exportSource, sourceFor } from '../src/source.js'
import { files } from './fixtures/small-export.js'
import { served } from './support.js'

const real = globalThis.fetch
afterEach(() => { globalThis.fetch = real })
const tangut = '\u{17000}'
const gz = value => gzipSync(JSON.stringify(value))

describe('bundled files a host serves', () => {
  it('leaves a script it does not list to the package when it lists Unicode shards', async () => {
    const asked = []
    globalThis.fetch = async url => { asked.push(String(url)); return real(url) }
    const drawn = await compose(sourceFor(tangut, { bundled: true, loaders: { 'unicode/outlines/000.json.gz': 'http://host/000' } }), tangut)
    expect(drawn.d.length).toBeGreaterThan(0)
    expect(asked.some(url => url.endsWith('sources/tangut/outlines.json.gz'))).toBe(true)
  })
  it('reads a Unicode shard at the URL listed for it', async () => {
    const asked = []
    globalThis.fetch = async url => { asked.push(String(url)); return String(url).startsWith('http') ? new Response(gz({ records: {} })) : real(url) }
    const source = sourceFor('木\u0301', { bundled: true, loaders: { 'unicode/outlines/003.json.gz': 'http://host/003' } })
    await source.ready()
    await source.load(['unicode/003'])
    expect(asked).toEqual(['http://host/003'])
  })
  // 𲻋 (U+32ECB) is in no export; the package's shard `unicode/outlines/32e.json.gz` draws it.
  const shard = readFileSync(join(import.meta.dirname, '..', 'data', 'unicode', 'outlines', '32e.json.gz'))
  it('reads a shard an export lacks at the URL listed for it', async () => {
    const asked = []
    globalThis.fetch = async url => { asked.push(String(url)); return String(url) === 'http://host/32e' ? new Response(shard) : new Response('', { status: 404 }) }
    const source = exportSource('/', { loaders: { 'unicode/outlines/32e.json.gz': 'http://host/32e' }, fetch: served(files) })
    const drawn = await compose(source, '𲻋')
    expect(drawn.parts.map(part => part.origin)).toEqual(['glyph 𲻋'])
    // Nothing is asked of the package's own folder, which a page that moved the files does not serve.
    expect(asked).toEqual(['http://host/32e'])
  })
  it('draws without a listed shard the host fails to serve', async () => {
    globalThis.fetch = async () => new Response('', { status: 404 })
    const source = exportSource('/', { loaders: { 'unicode/outlines/32e.json.gz': 'http://host/32e' }, fetch: served(files) })
    expect((await compose(source, '木')).d.length).toBeGreaterThan(0)
    await expect(compose(source, '𲻋')).rejects.toThrow('No glyph or sequence draws 𲻋.')
  })
  it('hands a file it fails to read to the next drawing when nothing else can answer', async () => {
    let calls = 0
    globalThis.fetch = async () => { calls++; return calls === 1 ? new Response('', { status: 500 }) : new Response(gz({ records: {} })) }
    const source = sourceFor(tangut, { bundled: true, loaders: { 'sources/tangut/outlines.json.gz': 'http://host/t' } })
    await expect(source.ready()).rejects.toThrow('500')
    await source.ready()
    expect(calls).toBe(2)
  })
  it('decodes a Response that read answers with', async () => {
    const source = sourceFor(tangut, { bundled: true, read: async () => new Response(gz({ records: { [tangut]: { marker: 1 } } })) })
    await source.ready()
    expect(source.store().rec(tangut)).toEqual({ marker: 1 })
  })
})
