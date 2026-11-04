import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { bopomofoSource } from '../src/bopomofo.js'
import { tangutSource } from '../src/tangut.js'
import { unicodeSource } from '../src/unicode.js'
import { onlyBundled } from '../src/local.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { drawingSvg } from '../src/drawing-svg.js'
import { isLetter, parseDescription as parse, writeDescription as write } from '../src/tree.js'
import { files } from './fixtures/small-export.js'

const data = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/sources/${name}/outlines.json.gz`, import.meta.url))))
const outlines = data('bopomofo')
const source = fallback => bopomofoSource({ load: async () => outlines, fallback })

it('parses and draws all 75 Bopomofo letters as editable outline parts', async () => {
  expect(Object.keys(outlines.records)).toHaveLength(75)
  const local = source()
  for (const char of Object.keys(outlines.records)) {
    const sequence = `⿰ㄅ${char}`
    expect(isLetter(char)).toBe(true)
    expect(write(parse(sequence))).toBe(sequence)
    const drawn = await compose(local, sequence, { separate: true })
    expect(drawn.origins).toEqual(['glyph ㄅ', `glyph ${char}`])
    expect(drawn.parts).toHaveLength(2)
    expect(drawn.parts.every(part => part.d.length > 0)).toBe(true)
    const svg = drawingSvg(drawn)
    expect(svg).toContain('<path')
    expect(svg).not.toMatch(/NaN|Infinity|<text/)
  }
  for (const char of ['\u3104', '\u3130', '\u319F']) expect(isLetter(char)).toBe(false)
})

it('combines Bopomofo with Han export records and bundled Tangut', async () => {
  const remote = createSource(async name => {
    const file = files[name]
    return file ? typeof file === 'string' ? new TextEncoder().encode(file).buffer : Uint8Array.from(file).buffer : null
  })
  const mixed = source(tangutSource({ load: async () => data('tangut'), fallback: remote }))
  const drawn = await compose(mixed, '⿲木ㄅ𘠁', { separate: true })
  expect(drawn.origins).toEqual(['glyph 木', 'glyph ㄅ', 'glyph 𘠁'])
  expect((await compose(source(tangutSource({ load: async () => data('tangut') })), '⿰ㄅ𘠁')).d.length).toBeGreaterThan(100)
  expect(onlyBundled('⿰ㄅ𘠁')).toBe(true)
  expect(onlyBundled('⿰ㄅ⬚')).toBe(true)
  expect(onlyBundled('⿰ㄅ木')).toBe(false)
  expect(onlyBundled('⿰ㄅ？')).toBe(false)
  expect(onlyBundled('⿰ㄅ!')).toBe(false)
})

it('draws open slots and retries a failed Bopomofo load', async () => {
  let calls = 0
  const local = bopomofoSource({ load: async () => { if (++calls === 1) throw new Error('offline'); return outlines } })
  await expect(local.ready()).rejects.toThrow('offline')
  expect((await compose(local, '⿱ㄅ⬚')).slots).toHaveLength(1)
  expect((await sketch(local, '⿱ㄅ⬚')).map(leaf => leaf.empty)).toEqual([false, true])
})

// Unicode's Bopomofo tone marks live in the Spacing Modifier Letters block.
it('draws Mandarin and extended Bopomofo tone marks', async () => {
  const local = unicodeSource({ load: async name => {
    const shard = name.slice('unicode/'.length)
    return JSON.parse(gunzipSync(readFileSync(new URL(`../data/unicode/outlines/${shard}.json.gz`, import.meta.url))))
  } })
  for (const char of 'ˉˊˇˋ˙˪˫') {
    const drawn = await compose(local, `⿰${char}⬚`, { separate: true })
    expect(drawn.origins).toContain(`glyph ${char}`)
    expect(drawn.parts[0].d.length).toBeGreaterThan(0)
  }
})
