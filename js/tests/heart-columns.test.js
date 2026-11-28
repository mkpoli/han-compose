import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { referenceLayout } from '../src/reference-layout.js'
import { files, records, shards } from './fixtures/small-export.js'

const src = () => {
  const glyphs = { ...records, 意: records.口, 情: records.口 }
  const input = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async key => input[key] === undefined ? null : Uint8Array.from(Buffer.from(input[key])).buffer)
}

it('keeps left and right 意 symmetric around full-height 情 in ⿲意情意 across all five faces', async () => {
  const source = src()
  for (const style of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
    const entry = referenceLayout(['⿲', '意', '情', '意'], style)
    expect(entry).not.toBeNull()
    const [left, mid, right] = entry.cells
    // Left and right 意 share identical width, top/bottom alignment, and stroke weight.
    expect(left[1][2] - left[1][0]).toBeCloseTo(right[1][2] - right[1][0], 5)
    expect(left[1][1]).toBe(right[1][1])
    expect(left[1][3]).toBe(right[1][3])
    expect(left[2]).toEqual(right[2])
    // Center 情 matches vertical bounds and sits symmetrically between left and right 意.
    expect(mid[1][1]).toBe(left[1][1])
    expect(mid[1][3]).toBe(left[1][3])
    expect(mid[1][0] - left[1][2]).toBeCloseTo(right[1][0] - mid[1][2], 5)

    const options = { fontStyle: style }
    const boxes = await sketch(source, '⿲意情意', options)
    const drawn = await compose(source, '⿲意情意', options)
    expect(boxes.map(p => p.box)).toEqual(drawn.parts.map(p => p.box))
    expect((await compose(source, '⿲意情意', { ...options, separate: true })).d).toBe(drawn.d)
  }
})
