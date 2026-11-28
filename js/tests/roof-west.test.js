import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, records, shards } from './fixtures/small-export.js'

const src = () => {
  const glyphs = { ...records, 宀: records.口, 西: records.口 }
  const input = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async key => input[key] === undefined ? null : Uint8Array.from(Buffer.from(input[key])).buffer)
}

it('contains 西 under 宀 in Sans, FangSong, and Pen and matches separated rendering', async () => {
  const source = src()
  for (const fontStyle of ['sans', 'fangsong', 'pen-writing']) {
    const options = { fontStyle }
    const boxes = await sketch(source, '⿱宀西', options)
    const drawn = await compose(source, '⿱宀西', options)
    expect(boxes.map(p => p.box)).toEqual(drawn.parts.map(p => p.box))
    expect(drawn.parts.map(p => p.origin)).toEqual(['glyph 宀', 'glyph 西'])
    const [roof, west] = drawn.parts
    // 西 stays narrower than 宀 and tucks up inside 宀's eaves.
    expect(west.box[0]).toBeGreaterThan(roof.box[0])
    expect(west.box[0] + west.box[2]).toBeLessThan(roof.box[0] + roof.box[2])
    expect(west.box[1]).toBeLessThan(roof.box[1] + roof.box[3])
    expect((await compose(source, '⿱宀西', { ...options, separate: true })).d).toBe(drawn.d)
  }
})
