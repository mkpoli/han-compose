// Which source a sequence draws from, and how a page that keeps its own files answers for them.
import { describe, expect, it } from 'bun:test'
import { gzipSync } from 'node:zlib'
import { sourceFor } from '../src/source.js'

describe('a page that reads its own bundled files', () => {
  it('answers by path, wherever the page keeps them', async () => {
    const asked = []
    const source = sourceFor('𘆽', {
      base: 'https://example.org/export/',
      read: async (path, url) => { asked.push([path, url]); return new Response(null, { status: 404 }) },
      loaders: { 'sources/tangut/outlines.json.gz': 'https://assets.example.org/tangut.json.gz' },
    })
    await source.ready().catch(() => {})
    expect(asked).toContainEqual(['sources/tangut/outlines.json.gz', 'https://assets.example.org/tangut.json.gz'])
  })
  it('reads the export through the fetch it is given', async () => {
    const asked = []
    const source = sourceFor('⿰木口', { base: 'https://example.org/export/', fetch: async url => { asked.push(String(url)); return new Response('{}', { status: 404 }) } })
    await source.ready().catch(() => {})
    expect(asked).toContain('https://example.org/export/manifest.json')
  })
  it('draws a numbered component from the Sans cuts the page reads', async () => {
    const numbered = '\u{F2A9}'
    const files = {
      'sources/palette/outlines.json.gz': { records: { [numbered]: { face: 'pua' } } },
      'numbered-sans-outlines.json.gz': { records: { [numbered]: { face: 'sans' } } },
    }
    const asked = []
    const read = async path => { asked.push(path); return files[path] ?? {} }
    const sans = sourceFor(`⿰${numbered}口`, { bundled: true, read })
    await sans.ready()
    expect(sans.store().rec(numbered)).toEqual({ face: 'sans' })
    expect(asked).toContain('numbered-sans-outlines.json.gz')
    // Another face draws the glyph of the palette's own file.
    asked.length = 0
    const serif = sourceFor(`⿰${numbered}口`, { bundled: true, fontStyle: 'serif', read })
    await serif.ready()
    expect(serif.store().rec(numbered)).toEqual({ face: 'pua' })
    expect(asked).not.toContain('numbered-sans-outlines.json.gz')
  })
  it('fetches the Sans cuts at the URL listed for them', async () => {
    const numbered = '\u{F2A9}'
    const served = {
      'https://assets.example.org/palette.json.gz': { records: { [numbered]: { face: 'pua' } } },
      'https://assets.example.org/sans.json.gz': { records: { [numbered]: { face: 'sans' } } },
    }
    const real = globalThis.fetch
    globalThis.fetch = async url => new Response(gzipSync(JSON.stringify(served[String(url)])))
    try {
      const source = sourceFor(`⿰${numbered}口`, { bundled: true, loaders: {
        'sources/palette/outlines.json.gz': 'https://assets.example.org/palette.json.gz',
        'numbered-sans-outlines.json.gz': 'https://assets.example.org/sans.json.gz',
      } })
      await source.ready()
      expect(source.store().rec(numbered)).toEqual({ face: 'sans' })
    } finally { globalThis.fetch = real }
  })
})
