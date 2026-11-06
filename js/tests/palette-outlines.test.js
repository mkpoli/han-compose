import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { compose } from '../src/loader.js'
import { onlyBundled } from '../src/local.js'
import { hasPaletteGlyph, paletteSource } from '../src/palette.js'

it('draws every palette fallback as an editable component', async () => {
  const chars = JSON.parse(readFileSync(new URL('../data/palette/fallback-characters.json', import.meta.url)))
  const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/sources/palette/outlines.json.gz', import.meta.url))))
  expect(Object.keys(outlines.records).sort()).toEqual([...chars].sort())
  const source = paletteSource({ load: async () => outlines })
  for (const char of chars) {
    expect(hasPaletteGlyph(char)).toBe(true)
    expect(onlyBundled(`⿰${char}⬚`)).toBe(true)
    const drawn = await compose(source, `⿰${char}⬚`, { separate: true })
    expect(drawn.origins).toContain(`glyph ${char}`)
    expect(drawn.parts[0].d.length).toBeGreaterThan(10)
  }
})

it('draws the numbered components with no description at their private-use code points', async () => {
  const chars = JSON.parse(readFileSync(new URL('../data/palette/fallback-characters.json', import.meta.url)))
  const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/sources/palette/outlines.json.gz', import.meta.url))))
  const numbered = chars.filter(char => /\p{Co}/u.test(char))
  expect(numbered).toHaveLength(69)
  const source = paletteSource({ load: async () => outlines })
  const [first] = numbered
  expect(onlyBundled(`⿰${first}${first}`)).toBe(true)
  const drawn = await compose(source, `⿰${first}${first}`, { separate: true })
  expect(drawn.parts).toHaveLength(2)
  expect(drawn.origins).toContain(`glyph ${first}`)
})

describe('the palette under an export', () => {
  const record = { o: 1, ink: 1 }
  const exported = rec => ({
    manifest: { constants: {} }, layout: null,
    ready: async () => {}, load: async () => {}, filesOf: keys => new Set(keys),
    store: () => ({ manifest: {}, layout: null, missing: new Set(), rec, hosts: () => [{ h: '江' }], places: () => ['L'] }),
  })
  const over = async fallback => {
    const source = paletteSource({ load: async () => ({ records: { 江: record } }), fallback, under: true })
    await source.ready()
    return source
  }
  it('lets the export draw a character it holds', async () => {
    const own = { o: 2, ink: 2, G: {} }
    const source = await over(exported(key => key === '江' ? own : null))
    expect(source.store().rec('江')).toBe(own)
    expect(source.store().hosts('江', 'L')).toEqual([{ h: '江' }])
    expect(source.filesOf(['江'])).toEqual(new Set(['江']))
  })
  it('fills in what the export lacks', async () => {
    const source = await over(exported(() => null))
    expect(source.store().rec('江')).toBe(record)
    expect(source.store().hosts('江', 'L')).toEqual([])
  })
  it('keeps its outline over a record that cannot draw', async () => {
    const source = await over(exported(key => key === '江' ? { o: 1, ink: 1 } : null))
    expect(source.store().rec('江')).toBe(record)
  })
  it('owns its characters in Sans, as ever', async () => {
    const source = paletteSource({ load: async () => ({ records: { 江: record } }), fallback: exported(() => ({ o: 2, ink: 2, G: {} })) })
    await source.ready()
    expect(source.store().rec('江')).toBe(record)
  })
  it('stays local for every face when the export cannot be read', () => {
    for (const face of ['sans', 'serif', 'fangsong', 'kaisho']) expect(onlyBundled('江', false, true, face)).toBe(true)
  })
  it('needs an export only where the face has its own glyphs', () => {
    expect(onlyBundled('江', false, false, 'sans')).toBe(true)
    for (const face of ['serif', 'fangsong', 'kaisho']) expect(onlyBundled('江', false, false, face)).toBe(false)
  })
})
