import { describe, expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { files, layout, shards } from './fixtures/small-export.js'
import parts from './fixtures/sans-lower-left.json' with { type: 'json' }

// 几 and 力 as the Sans export draws them (Noto Sans CJK, SIL OFL 1.1); 口 is the small export's
// box. The layout's weights are zero and its bias gives the second operand the right of the cell,
// as the font sets 日 in 旭.
const bias = Buffer.from(new Float32Array([0, 0, 1, 1, 0.45, 0, 1, 1]).buffer).toString('base64')
const source = () => {
  const input = {
    ...files,
    'layout.json': JSON.stringify({ ...layout, seeds: [[layout.seeds[0][0], bias]] }),
    ...shards('g', Object.entries(parts)),
  }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}
const right = (/** @type {{ box: number[] }} */ part) => part.box[0] + part.box[2]
const drawn = async (/** @type {string} */ sequence) => (await compose(source(), sequence, { layout: 'composed' })).parts

describe('⿺ inside a larger description', () => {
  for (const sequence of ['⿱口⿺几力', '⿰口⿺几力']) {
    it(`sweeps 几 under 力 in ${sequence}`, async () => {
      const all = await drawn(sequence)
      const swept = all.filter(part => part.origin === 'swept glyph 几')
      const held = all.find(part => part.origin.endsWith('力'))
      // The strokes are pressed to the left and the foot is drawn out, as at the root.
      expect(swept).toHaveLength(2)
      expect(held).toBeDefined()
      if (!held) return
      const [strokes, foot] = swept
      // 力 stands right of the pressed strokes and over the foot, inside the cell 几 was given.
      expect(held.box[0]).toBeGreaterThan(right(strokes) - 40)
      expect(right(foot)).toBeGreaterThan(right(held) - 20)
      expect(held.box[1] + held.box[3]).toBeLessThan(foot.box[1] + foot.box[3])
      expect(foot.box[0]).toBeLessThan(held.box[0])
    })
  }
})
