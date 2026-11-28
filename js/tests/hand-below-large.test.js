import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, records, shards } from './fixtures/small-export.js'

const src = () => {
  const glyphs = { ...records, 大: records.口, 手: records.口 }
  const input = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async key => input[key] === undefined ? null : Uint8Array.from(Buffer.from(input[key])).buffer)
}

it('nests 手 up into 大 splayed legs across all five faces and matches separated rendering', async () => {
  const source = src()
  for (const fontStyle of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
    const options = { fontStyle }
    const boxes = await sketch(source, '⿱大手', options)
    const drawn = await compose(source, '⿱大手', options)
    expect(boxes.map(p => p.box)).toEqual(drawn.parts.map(p => p.box))
    expect(drawn.parts.map(p => p.origin)).toEqual(['glyph 大', 'glyph 手'])
    const [large, hand] = drawn.parts
    // 手 rises into the lower tent of 大's splayed legs so the strokes meet cleanly.
    expect(hand.box[1]).toBeLessThan(large.box[1] + large.box[3] - 80)
    expect((await compose(source, '⿱大手', { ...options, separate: true })).d).toBe(drawn.d)
  }
})
