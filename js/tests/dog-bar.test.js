import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, records, shards } from './fixtures/small-export.js'

const src = () => {
  const glyphs = { ...records, 犬: records.口, 一: records.口 }
  const input = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async key => input[key] === undefined ? null : Uint8Array.from(Buffer.from(input[key])).buffer)
}

it('keeps clear vertical separation between 犬 and 一 in Serif, FangSong, and Regular', async () => {
  const source = src()
  for (const fontStyle of ['serif', 'fangsong', 'regular']) {
    const options = { fontStyle }
    const boxes = await sketch(source, '⿱犬一', options)
    const drawn = await compose(source, '⿱犬一', options)
    expect(boxes.map(p => p.box)).toEqual(drawn.parts.map(p => p.box))
    expect(drawn.parts.map(p => p.origin)).toEqual(['glyph 犬', 'glyph 一'])
    const [dog, bar] = drawn.parts
    const gap = bar.box[1] - (dog.box[1] + dog.box[3])
    expect(gap).toBeGreaterThanOrEqual(50)
    expect((await compose(source, '⿱犬一', { ...options, separate: true })).d).toBe(drawn.d)
  }
})
