import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { compose } from '../src/loader.js'
import { unicodeSource, hasUnicodeGlyph } from '../src/unicode.js'
import { onlyBundled } from '../src/local.js'
import metadata from '../../data/unicode/outlines.json'

const data = name => JSON.parse(gunzipSync(readFileSync(new URL(`../../data/unicode/outlines/${name.slice(8)}.json.gz`, import.meta.url))))
const source = () => unicodeSource({ load: async name => data(name) })

describe('Unicode fallback outlines', () => {
  it('draws CJK marks, Greek, Cyrillic, other scripts and symbols as real paths', async () => {
    for (const text of ['⿰〇〆', '⿱々〻', '⿰〡〢', '⿰ӂꙮ', '⿰άΩ', '⿰אش', '⿰अก', '⿰∞☯', '⿰𐐀𓀀']) {
      const drawn = await compose(source(), text, { separate: true })
      expect(drawn.parts).toHaveLength(2)
      expect(drawn.parts.every(part => part.d.length > 20 && part.box.every(Number.isFinite))).toBe(true)
      expect(drawn.d).not.toMatch(/NaN|Infinity/)
      expect(drawn.origins).toEqual([...text].slice(1).map(c => `glyph ${c}`))
    }
  })
  it('composes cuts, nested operators and empty slots with fallback paths', async () => {
    const local = source()
    const cut = await compose(local, '㇯〇〆', { separate: true })
    expect(cut.cut.length).toBeGreaterThan(20)
    const draft = await compose(local, '⿰〇⿱ӂ⬚', { separate: true })
    expect(draft.parts).toHaveLength(2)
    expect(draft.slots).toHaveLength(1)
    expect(onlyBundled('⿰〇ӂ', false, true)).toBe(true)
    expect(onlyBundled('⿰〇ӂ')).toBe(false)
  })
  it('does not invent private-use glyphs or silently discard variation selectors', async () => {
    for (const key of ['\uE000', '〇\u{E0100}', '〇木', '⬚', '⿰']) expect(hasUnicodeGlyph(key)).toBe(false)
    await expect(compose(source(), '\uE000')).rejects.toThrow('No glyph')
  })
  it('loads every required shard together, deduplicates reads and retries failures', async () => {
    const calls = []
    let fail = true
    const local = unicodeSource({ load: async name => { calls.push(name); if (fail) { fail = false; throw new Error('offline') } return data(name) } })
    await local.ready()
    const names = local.filesOf(['〇', '〆'])
    expect(names.size).toBe(1)
    await expect(local.load(names)).rejects.toThrow('offline')
    await Promise.all([local.load(names), local.load(names)])
    expect(calls).toHaveLength(2)
    expect(local.store().rec('〇').G.p.length).toBeGreaterThan(0)
  })
  it('preserves the selected export glyph and its metadata without loading a fallback', async () => {
    const native = { k: '〇', G: { native: true }, P: ['L'], s: '⿰口口' }
    const remote = source()
    await remote.ready()
    remote.store = () => ({ missing: new Set(), rec: () => native, hosts: () => ['host'], places: () => ['L'] })
    const selected = unicodeSource({ fallback: remote, load: async () => { throw new Error('unnecessary fallback') } })
    await selected.ready()
    const store = selected.store()
    expect(store.rec('〇')).toBe(native)
    expect(store.hosts('〇', 'L')).toEqual(['host'])
    expect(store.places('〇')).toEqual(['L'])
    expect(store.missing.size).toBe(0)
  })
  it('adds an outline without losing remote decomposition or host metadata', async () => {
    const remote = source()
    await remote.ready()
    remote.filesOf = () => new Set()
    remote.store = () => ({ missing: new Set(), rec: key => ({ k: key, s: '⿰口口', P: ['L'] }), hosts: () => [], places: () => ['L'] })
    const selected = unicodeSource({ fallback: remote, load: async name => data(name) })
    await selected.ready()
    const first = selected.store()
    for (const c of ['〇','ӂ','א','अ','ก','∞']) first.rec(c)
    expect(first.missing.size).toBeGreaterThan(4)
    await selected.load(first.missing)
    expect(selected.store().rec('〇')).toMatchObject({ s: '⿰口口', P: ['L'], G: { v: 0 } })
  })
  it('ships every advertised outline with reproducible hashes and valid geometry', () => {
    let count = 0
    for (const [name, info] of Object.entries(metadata.shards)) {
      const bytes = readFileSync(new URL(`../../data/unicode/outlines/${name}.json.gz`, import.meta.url))
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(info.sha256)
      const records = JSON.parse(gunzipSync(bytes))
      expect(Object.keys(records)).toHaveLength(info.count)
      for (const [key, record] of Object.entries(records)) {
        expect(hasUnicodeGlyph(key)).toBe(true)
        expect(record.G.b.every(Number.isFinite)).toBe(true)
        expect(record.G.p.length).toBeGreaterThan(0)
        count++
      }
    }
    expect(count).toBe(metadata.count)
  })
})

it('renders the audited Unicode gaps as real outlines', async () => {
  const local = source()
  for (const cp of [0x16FE2, 0x16FE3, 0x16FF0, 0x18B00, 0x1AFF0, 0x1B123,
    0x1C89, 0x1E030, 0x1F600, 0x1FAE0, 0x332C, 0x323B0, 0x18E00, 0x1DF00]) {
    const char = String.fromCodePoint(cp)
    expect(hasUnicodeGlyph(char)).toBe(true)
    const drawn = await compose(local, `⿰${char}〇`, { separate: true })
    expect(drawn.origins).toContain(`glyph ${char}`)
    expect(drawn.parts).toHaveLength(2)
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
  }
})

it('does not assign arbitrary Unifont private-use glyphs to users', () => {
  for (const cp of [0xE000, 0xF0000, 0xFE400, 0x100000]) expect(hasUnicodeGlyph(String.fromCodePoint(cp))).toBe(false)
})


it('composes every Egyptian Extended-A character with another component', async () => {
  const local = source()
  for (let cp = 0x13460; cp <= 0x143FA; cp++) {
    const char = String.fromCodePoint(cp)
    expect(hasUnicodeGlyph(char)).toBe(true)
    const drawn = await compose(local, `⿰${char}〇`, { separate: true })
    expect(drawn.origins).toEqual([`glyph ${char}`, 'glyph 〇'])
    expect(drawn.parts).toHaveLength(2)
    expect(drawn.parts.every(part => part.d.length > 20 && part.box.every(Number.isFinite))).toBe(true)
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
  }
}, 30000)

it('draws the formerly excluded CJK fallback glyphs as IDS operands', async () => {
  const local = source()
  for (const [first, last] of metadata.ranges) for (let cp = first; cp <= last; cp++) {
    if (!(cp >= 0x2E80 && cp <= 0x2FDF || cp >= 0x3400 && cp <= 0x9FFF || cp >= 0xF900 && cp <= 0xFAFF || cp >= 0x20000 && cp <= 0x323AF || cp >= 0x1DFD0 && cp <= 0x1DFFF)) continue
    const char = String.fromCodePoint(cp)
    const drawn = await compose(local, `⿰${char}〇`, { separate: true })
    expect(drawn.origins).toEqual([`glyph ${char}`, 'glyph 〇'])
    expect(drawn.parts.every(part => part.d.length > 20 && part.box.every(Number.isFinite))).toBe(true)
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
  }
}, 30000)
