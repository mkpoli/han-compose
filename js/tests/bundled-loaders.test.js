import { afterEach, describe, expect, it } from 'bun:test'
import { gzipSync } from 'node:zlib'
import { compose } from '../src/loader.js'
import { sourceFor } from '../src/source.js'

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
