import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, records, shards } from './fixtures/small-export.js'
// Zhuque FangSong 0.212, SIL OFL 1.1.
import donors from './fixtures/triple-water-donors.json' with { type: 'json' }

const src = (hosts = donors) => {
  const glyphs = { ...records, 水: records.口, ...hosts }
  const input = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async key => input[key] === undefined ? null : Uint8Array.from(Buffer.from(input[key])).buffer)
}

it('uses yielded left and middle 水 from 水 and 氺 in FangSong ⿲水水水', async () => {
  const source = src(), options = { fontStyle: 'fangsong' }
  const boxes = await sketch(source, '⿲水水水', options)
  const drawn = await compose(source, '⿲水水水', options)
  expect(boxes.map(p => p.box)).toEqual(drawn.parts.map(p => p.box))
  expect(drawn.parts.map(p => p.origin)).toEqual(['水 from 水氺', '水 from 水氺', 'glyph 水'])
  expect((await compose(source, '⿲水水水', { ...options, separate: true })).d).toBe(drawn.d)
})

it('falls back to standalone 水 when 氺 is absent or changed', async () => {
  const changed = { G: { ...records.口.G, v: 1 } }
  const options = { fontStyle: 'fangsong' }
  const standalone = await compose(src({ 水: donors.水 }), '⿲水水水', options)
  expect(standalone.parts.map(p => p.origin)).toEqual(['glyph 水', 'glyph 水', 'glyph 水'])
  const altered = await compose(src({ 水: donors.水, 氺: changed }), '⿲水水水', options)
  expect(altered.parts.map(p => p.origin)).toEqual(['glyph 水', 'glyph 水', 'glyph 水'])
  expect(altered.d).toBe(standalone.d)
})
