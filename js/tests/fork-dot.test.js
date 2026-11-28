import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, records, shards } from './fixtures/small-export.js'

const src = () => {
  const glyphs = { ...records, 叉: records.口, 丶: records.口 }
  const input = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async key => input[key] === undefined ? null : Uint8Array.from(Buffer.from(input[key])).buffer)
}

it('places a full-sized inner dot in FangSong ⿼叉丶 and matches separated rendering', async () => {
  const source = src(), options = { fontStyle: 'fangsong' }
  const boxes = await sketch(source, '⿼叉丶', options)
  const drawn = await compose(source, '⿼叉丶', options)
  expect(boxes.map(p => p.box)).toEqual(drawn.parts.map(p => p.box))
  expect(drawn.parts.map(p => p.origin)).toEqual(['glyph 叉', 'glyph 丶'])
  const [, dot] = drawn.parts
  expect(dot.box[2]).toBeGreaterThanOrEqual(170)
  expect(dot.box[3]).toBeGreaterThanOrEqual(200)
  expect((await compose(source, '⿼叉丶', { ...options, separate: true })).d).toBe(drawn.d)
})
