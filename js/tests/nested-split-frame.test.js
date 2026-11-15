import { describe, expect, it } from 'bun:test'
import { groupParts } from '../src/group-parts.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, shards } from './fixtures/small-export.js'

// 𦥑 as two blocks, one at each side of the cell; 木 and 口 are the small export's boxes.
const int16 = (/** @type {number[]} */ values) => Buffer.from(Int16Array.from(values).buffer).toString('base64')
const block = (/** @type {number[]} */ [x0, y0, x1, y1]) => ['MLLL', int16([x0, y0, x1, y0, x1, y1, x0, y1].map(v => v * 4)), int16(Array(8).fill(0))]
const frame = { G: { v: 1, b: [100, 0, 900, 800], p: [block([100, 0, 300, 800]), block([700, 0, 900, 800])] }, ink: 4000, nl: 2, o: 2 }
const source = () => {
  const input = { ...files, ...shards('g', [['𦥑', frame]]) }
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
