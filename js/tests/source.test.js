// Which source a sequence draws from, and how a page that keeps its own files answers for them.
import { describe, expect, it } from 'bun:test'
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
})
