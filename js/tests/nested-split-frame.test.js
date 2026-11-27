import { describe, expect, it } from 'bun:test'
import { groupParts } from '../src/group-parts.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, shards } from './fixtures/small-export.js'
import donorRecords from './fixtures/rcc-early-strokes.json' with { type: 'json' }

// 𦥑 as two blocks, one at each side of the cell; 木 and 口 are the small export's boxes.
const int16 = (/** @type {number[]} */ values) => Buffer.from(Int16Array.from(values).buffer).toString('base64')
const block = (/** @type {number[]} */ [x0, y0, x1, y1]) => ['MLLL', int16([x0, y0, x1, y0, x1, y1, x0, y1].map(v => v * 4)), int16(Array(8).fill(0))]
const frame = { G: { v: 1, b: [100, 0, 900, 800], p: [block([100, 0, 300, 800]), block([700, 0, 900, 800])] }, ink: 4000, nl: 2, o: 2 }
const bar = { G: { v: 1, b: [100, 300, 900, 400], p: [block([100, 300, 900, 400])] }, ink: 1800, nl: 1, o: 1 }
const legs = { G: { v: 1, b: [100, 0, 900, 600], p: [block([100, 0, 300, 600]), block([700, 0, 900, 600])] }, ink: 3200, nl: 2, o: 2 }
const source = (extra = []) => {
  const input = { ...files, ...shards('g', [['𦥑', frame], ['一', bar], ['八', legs], ...extra]) }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}
const right = (/** @type {{ box: number[] }} */ part) => part.box[0] + part.box[2]

describe('a frame drawn as two halves', () => {
  for (const sequence of ['⿴𦥑木', '⿱⿴𦥑木口', '⿰口⿴𦥑木']) for (const separate of [false, true]) {
    it(`holds its part between the halves in ${sequence}${separate ? ', each part drawn apart' : ''}`, async () => {
      const parts = (await compose(source(), sequence, { separate })).parts
      const halves = parts.filter(part => part.origin === 'glyph 𦥑 half')
      const held = parts.find(part => part.origin === 'glyph 木')
      expect(halves).toHaveLength(2)
      expect(held).toBeDefined()
      if (!held) return
      const [left, other] = halves.toSorted((a, b) => a.box[0] - b.box[0])
      expect(held.box[0]).toBeGreaterThanOrEqual(right(left))
      expect(right(held)).toBeLessThanOrEqual(other.box[0])
    })
  }
  it('gives the halves, the bar and the legs of ⿶𲻋木 to the one leaf 𲻋', async () => {
    const leaves = await sketch(source(), '⿶𲻋木')
    const parts = (await compose(source(), '⿶𲻋木', { separate: true })).parts
    const groups = groupParts(parts, leaves)
    expect(leaves).toHaveLength(2)
    expect(groups?.map(group => group.parts.map(i => parts[i].origin))).toEqual([
      ['glyph 𦥑 half', 'glyph 𦥑 half', 'glyph 一', 'glyph 八'], ['glyph 木'],
    ])
  })
  for (const sequence of ['⿴𦥑木', '⿱⿴𦥑木口', '⿰口⿴𦥑木']) {
    it(`gives both halves to the frame's leaf in ${sequence}`, async () => {
      const leaves = await sketch(source(), sequence)
      const parts = (await compose(source(), sequence, { separate: true })).parts
      const groups = groupParts(parts, leaves)
      expect(groups).not.toBeNull()
      const origins = (groups ?? []).map(group => group.parts.map(i => parts[i].origin))
      expect(origins).toContainEqual(['glyph 𦥑 half', 'glyph 𦥑 half'])
      expect(origins).toContainEqual(['glyph 木'])
      expect(origins).toHaveLength(leaves.length)
    })
  }
})

it('assigns both 𦥑 halves to the frame around the three editable parts of 馬', async () => {
  const sequence = '⿴𦥑⿹⿷#(-一丨b𠃌)𰀁灬'
  const data = source([['馬', { G: donorRecords.sans.馬 }]])
  const { parts } = await compose(data, sequence, { separate: true })
  expect(parts.map(part => part.leaf)).toEqual([0, 0, 1, 2, 3])
  expect(parts.slice(0, 2).map(part => part.origin)).toEqual(['glyph 𦥑 half', 'glyph 𦥑 half'])
})
