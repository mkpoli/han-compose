import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { isComponent, isJurchen, parseDescription as parse, writeDescription as write } from '../src/tree.js'
import { characterScript } from '../src/scripts.js'
import { compose } from '../src/loader.js'
import { onlyBundled } from '../src/local.js'
import { hasBundledGlyph } from '../src/bundled-coverage.js'
import { hasJurchen, jurchenSource } from '../src/jurchen.js'
import { traitsOf } from '../src/source.js'
import { dataUrls } from '../src/index.js'

const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/sources/jurchen/outlines.json.gz', import.meta.url))).toString())
const keys = Object.keys(outlines.records)
const chars = keys.filter(key => [...key].length === 1)
const variants = keys.filter(key => [...key].length === 2)
const VARIANT = '\u{18E01}\uFE00', TUMEN = '\u{18E01}', FIRST = '\u{18E00}'

describe('Jurchen', () => {
  it('holds an outline for each character and radical of the block', () => {
    expect(chars).toHaveLength(965)
    expect(chars.every(hasJurchen)).toBe(true)
    // The gap between the characters and the radicals is not part of it.
    expect(isJurchen(String.fromCodePoint(0x19192))).toBe(false)
    expect(isJurchen(String.fromCodePoint(0x191D3))).toBe(false)
  })
  it('reads a character as a component of the Jurchen script', () => {
    const char = String.fromCodePoint(0x18E00)
    expect(isComponent(char)).toBe(true)
    expect(characterScript(char)).toBe('jurchen')
    expect(write(parse(`⿰${char}木`))).toBe(`⿰${char}木`)
    expect(traitsOf(`⿰${char}木`).jurchen).toBe(true)
  })
  it('draws from the bundled outlines alone', async () => {
    const [a, b] = chars
    expect(onlyBundled(`⿰${a}${b}`)).toBe(true)
    expect(onlyBundled(`⿰${a}木`)).toBe(false)
    const drawn = await compose(jurchenSource({ load: async () => outlines }), `⿰${a}${b}`)
    expect(drawn.d.length).toBeGreaterThan(0)
    expect(drawn.parts).toHaveLength(2)
  })
  it('draws a selector no record names as the character', async () => {
    const source = () => jurchenSource({ load: async () => outlines })
    const first = String.fromCodePoint(0x18E00)
    expect(outlines.records[`${first}\uFE00`]).toBeUndefined()
    const bare = await compose(source(), first, { separate: true })
    const selected = await compose(source(), `${first}\uFE00`, { separate: true })
    expect(selected.d).toBe(bare.d)
    const variant = Object.keys(outlines.records).find(key => [...key].length === 2)
    expect((await compose(source(), variant, { separate: true })).origins).toEqual([`glyph ${variant}`])
  })
  it('lists its file among the package\'s data URLs', () => {
    expect(dataUrls['sources/jurchen/outlines.json.gz']).toContain('sources/jurchen/outlines.json.gz')
  })
})

describe('Jurchen variant sequences', () => {
  it('holds an outline for each of the 537 through U+FE00..U+FE04', () => {
    expect(variants).toHaveLength(537)
    for (const variant of variants) {
      const [base, selector] = [...variant]
      expect(chars).toContain(base)
      expect(selector.codePointAt(0)).toBeGreaterThanOrEqual(0xFE00)
      expect(selector.codePointAt(0)).toBeLessThanOrEqual(0xFE04)
      expect(hasBundledGlyph('jurchen', variant)).toBe(true)
    }
  })
  it('draws a variant with its own outline, from the bundled outlines alone', async () => {
    expect(outlines.records[VARIANT].G.p).not.toEqual(outlines.records[TUMEN].G.p)
    expect(onlyBundled(`⿰${VARIANT}${FIRST}`, false, false)).toBe(true)
    const drawn = await compose(jurchenSource({ load: async () => outlines }), `⿰${VARIANT}${FIRST}`, { separate: true })
    expect(drawn.parts).toHaveLength(2)
    expect(drawn.origins).toContain(`glyph ${VARIANT}`)
  })
  it('leaves a selector the outlines do not hold to the export', () => {
    expect(hasBundledGlyph('jurchen', `${FIRST}\uFE05`)).toBe(false)
    expect(hasBundledGlyph('jurchen', `${VARIANT}\uFE00`)).toBe(false)
    expect(hasBundledGlyph('tangut', `\u{17000}\uFE00`)).toBe(false)
  })
})
