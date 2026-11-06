import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { isComponent, isJurchen, parseDescription as parse, writeDescription as write } from '../src/tree.js'
import { characterScript } from '../src/scripts.js'
import { compose } from '../src/loader.js'
import { onlyBundled } from '../src/local.js'
import { hasJurchen, jurchenSource } from '../src/jurchen.js'
import { traitsOf } from '../src/source.js'
import { dataUrls } from '../src/index.js'

const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/sources/jurchen/outlines.json.gz', import.meta.url))).toString())
const chars = Object.keys(outlines.records)

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
  it('lists its file among the package\'s data URLs', () => {
    expect(dataUrls['sources/jurchen/outlines.json.gz']).toContain('sources/jurchen/outlines.json.gz')
  })
})
