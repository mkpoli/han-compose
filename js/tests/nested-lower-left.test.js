import { describe, expect, it } from 'bun:test'
import { sweptPart } from '../src/compose.js'
import { partOf, placed } from '../src/geometry.js'
import { compose, createSource } from '../src/loader.js'
import { constants, files, layout, shards } from './fixtures/small-export.js'
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

const edge0 = (/** @type {{ target: number[] }} */ p) => p.target[0] + 0.5 * (p.target[2] - p.target[0])

describe('a glyph swept in a cell smaller than the face', () => {
  // 几 drawn at half size in the lower right quarter: the pieces `sweptPart` answers hold contours
  // already scaled to the cell, so the stroke widths they state are half the glyph's own.
  const glyph = partOf({ ...parts.几.G, w: [80, 76] })
  const [x0, y0, x1, y1] = glyph.box, w = x1 - x0, h = y1 - y0
  const half = placed(glyph, glyph.box, [x0 + w / 2, y0, x1, y0 + h / 2], parts.几.ink, 'glyph 几')
  const whole = placed(glyph, glyph.box, glyph.box.slice(), parts.几.ink, 'glyph 几')

  it('states the stroke widths its scaled contours have', () => {
    for (const [p, scale] of /** @type {const} */ ([[whole, 1], [half, 0.5]])) {
      const swept = sweptPart(p, edge0(p), constants)
      expect(swept).toHaveLength(2)
      for (const piece of swept ?? []) for (const contour of piece.part.contours) {
        expect(contour.width[0]).toBeCloseTo(80 * scale, 5)
        expect(contour.width[1]).toBeCloseTo(76 * scale, 5)
      }
    }
  })
  it('moves both masters of the foot alike, so the heavy stroke keeps its width', () => {
    // The sweeping stroke is the one that reaches the glyph's lower right corner. Point by point,
    // its heavy master stands as far from its light one after the sweep as before it.
    const sweep = glyph.contours.find(contour => {
      const xs = contour.light.filter((_, i) => i % 2 === 0), ys = contour.light.filter((_, i) => i % 2 === 1)
      return Math.max(...xs) > x1 - 0.15 * w && Math.min(...ys) < y0 + 0.25 * h && Math.max(...ys) - Math.min(...ys) > 0.3 * h
    })
    expect(sweep).toBeDefined()
    if (!sweep) return
    for (const [p, scale] of /** @type {const} */ ([[whole, 1], [half, 0.5]])) {
      const swept = sweptPart(p, edge0(p), constants)
      expect(swept).toHaveLength(2)
      if (!swept) continue
      const [contour] = swept[1].part.contours
      for (let i = 0; i < contour.light.length; i += 2)
        expect(contour.heavy[i] - contour.light[i]).toBeCloseTo((sweep.heavy[i] - sweep.light[i]) * scale, 5)
    }
  })
  it('measures a glyph that states no width by the width its ink calls for', () => {
    const plain = partOf({ ...parts.几.G })
    const swept = sweptPart(placed(plain, plain.box, half.target, parts.几.ink, 'glyph 几'), edge0(half), constants)
    const [sx, sy] = [0.5, 0.5]
    const own = [0, 1].map(axis => constants.STEM_CURVE[axis][0] + constants.STEM_CURVE[axis][1] * parts.几.ink / 1000)
    for (const piece of swept ?? []) for (const contour of piece.part.contours) {
      expect(contour.width[0]).toBeCloseTo(own[0] * sx, 5)
      expect(contour.width[1]).toBeCloseTo(own[1] * sy, 5)
    }
    expect(swept).toHaveLength(2)
  })
})
