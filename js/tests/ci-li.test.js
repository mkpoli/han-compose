import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, records, shards } from './fixtures/small-export.js'
// Zhuque FangSong 0.212, SIL OFL 1.1. The sparse export omits contour labels.
import donors from './fixtures/ci-li-donors.json' with { type: 'json' }

const src = (hosts = donors) => {
  const glyphs = { ...records, 此: records.口, 力: records.口, ...hosts }
  const input = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async key => input[key] === undefined ? null : Uint8Array.from(Buffer.from(input[key])).buffer)
}

it('uses the positional 此 and 力 even without contour labels', async () => {
  const source = src(), options = { fontStyle: 'fangsong' }
  const boxes = await sketch(source, '⿱此力', options)
  const drawn = await compose(source, '⿱此力', options)
  expect(boxes.map(p => p.box)).toEqual(drawn.parts.map(p => p.box))
  expect(drawn.parts.map(p => p.origin)).toEqual(['此 from 柴', '力 from 勢'])
  expect((await compose(source, '⿱此力', { ...options, separate: true })).d).toBe(drawn.d)
})

it('uses standalone operands for absent or unrecognized donors', async () => {
  const changed = { G: { ...records.口.G, v: 1 } }
  const options = { fontStyle: 'fangsong' }
  const standalone = await compose(src({}), '⿱此力', options)
  for (const hosts of [{ 勢: donors.勢 }, { 柴: donors.柴, 勢: changed }]) {
    const drawn = await compose(src(hosts), '⿱此力', options)
    expect(drawn.parts.map(p => p.origin)).toEqual(['glyph 此', 'glyph 力'])
    expect(drawn.d).toBe(standalone.d)
  }
})
