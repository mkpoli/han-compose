import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { referenceLayout } from '../src/reference-layout.js'
import { files, records, shards } from './fixtures/small-export.js'

const src = () => {
  const glyphs = { ...records, 入: records.口, 柬: records.口, 鳥: records.口 }
  const input = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async key => input[key] === undefined ? null : Uint8Array.from(Buffer.from(input[key])).buffer)
}

it('weights 入 to match 鳥 in FangSong ⿰入鳥 and keeps normal and separated rendering equal', async () => {
  const entry = referenceLayout(['⿰', '入', '鳥'], 'fangsong')
  expect(entry).not.toBeNull()
  const [, , weight] = entry.cells[0]
  expect(weight[0]).toBeGreaterThan(0.8)
  expect(weight[1]).toBeGreaterThan(0.3)

  const source = src(), options = { fontStyle: 'fangsong' }
  for (const ids of ['⿰入鳥', '⿰柬鳥']) {
    const boxes = await sketch(source, ids, options)
    const drawn = await compose(source, ids, options)
    expect(boxes.map(p => p.box)).toEqual(drawn.parts.map(p => p.box))
    expect((await compose(source, ids, { ...options, separate: true })).d).toBe(drawn.d)
  }
})
