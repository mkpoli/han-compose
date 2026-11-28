import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { referenceLayout } from '../src/reference-layout.js'
import { files, records, shards } from './fixtures/small-export.js'

const src = () => {
  const glyphs = { ...records, 門: records.口, 山: records.口, 玉: records.口, 水: records.口 }
  const input = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async key => input[key] === undefined ? null : Uint8Array.from(Buffer.from(input[key])).buffer)
}

it('fits compact weighted 山, 玉 and 水 inside FangSong 門 consistently in normal and separated rendering', async () => {
  const source = src(), options = { fontStyle: 'fangsong' }
  for (const [ids, inner] of [['⿵門山', '山'], ['⿵門玉', '玉'], ['⿵門水', '水']]) {
    const entry = referenceLayout(['⿵', '門', inner], 'fangsong')
    expect(entry).not.toBeNull()
    const [, box, weight] = entry.cells[1]
    expect(box[2] - box[0]).toBeLessThan(485)
    expect(box[3] - box[1]).toBeLessThan(460)
    expect(weight[0]).toBeGreaterThan(0.7)
    expect(weight[1]).toBeGreaterThan(0.7)

    const boxes = await sketch(source, ids, options)
    const drawn = await compose(source, ids, options)
    expect(boxes.map(p => p.box)).toEqual(drawn.parts.map(p => p.box))
    expect((await compose(source, ids, { ...options, separate: true })).d).toBe(drawn.d)
  }
})
