import { describe, expect, it } from 'bun:test'
import { Composer, keyOf, parseTree } from '../src/compose.js'
import { createRenderNormalizer } from '../src/normalization.js'
import { makePart, partOf, pointsBox } from '../src/geometry.js'
// Kureedo Full 0.5.0, SIL OFL 1.1.
import penLian from './fixtures/pen-lian.json'

const square = (x0, y0, x1, y1) => {
  const light = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])
  return { ops: [], light, heavy: light.slice(), width: null }
}
const host = (h, ok = ['木']) => ({ h, ok, r: 0, op: '⿰', d: 0, p: [{ ops: 'MLLL', l: [] }], b: [0, 0, 100, 100] })

/** A composer with `hosts` for one place of the sequence ⿰甲乙, which draws 丙. */
const composer = (hosts, exclude = []) => {
  const c = Object.create(Composer.prototype)
  Object.defineProperty(c, 'partial', { value: false, configurable: true })
  c.C = { INSTANCE_HOSTS: 2, INSTANCE_KEPT: 0.75, STRETCH: 1.6, SIDED_PLACES: [] }
  c.AXIS = { '⿰': 0, '⿱': 1, '⿲': 0, '⿳': 1 }
  c.exclude = new Set(exclude)
  c.excluded = ch => c.exclude.has(ch)
  c.data = { places: name => name === '⿰甲乙' ? ['R'] : [], hosts: () => hosts, manifest: {} }
  c.rec = key => key === '⿰甲乙' ? { e: '丙' } : null
  // The real resolver over these records, so exclusion reaches it as it does in a drawing.
  c.normalizer = createRenderNormalizer({
    record: key => c.rec(key), parse: text => parseTree(text, op => c.arities?.get(op) ?? 2),
    keyOf, excluded: ch => c.excluded(ch),
  })
  c.outlines = () => 1
  c.stroked = () => exclude.length > 0
  c.ink = () => 1
  c.pieceOf = () => makePart([square(0, 0, 100, 100)])
  return c
}
const region = [0, 0, 100, 100]
const node = ['⿰', '甲', '乙']

describe('the hosts an instance weighs', () => {
  it('takes nothing from a host built of the character being redrawn', () => {
    const hosts = [host('嚞', ['丙'])]
    expect(composer(hosts, ['丙']).instance(node, region)).toBeNull()
    expect(composer(hosts).instance(node, region).origin).toBe('instance 嚞')
  })
  it('takes a host of other parts while redrawing', () => {
    expect(composer([host('丘')], ['丙']).instance(node, region).origin).toBe('instance 丘')
  })
})

describe('a piece kept from its host', () => {
  it('recovers the fourth 魚 dot where Kureedo 鰱 joins it to 辶', () => {
    const c = Object.create(Composer.prototype)
    c.fontStyle = 'pen-writing'
    c.glyph = () => partOf(penLian)
    c.glyphRecord = () => penLian
    const host = { h: '鰱', k: [0, 3, 6, 7, 8, 10, 4, 9, 12], b: [40, -58, 407, 785] }
    const piece = c.pieceOf(host)
    const drawing = [{ part: piece }]
    c.finishPenParts(drawing)
    const feet = drawing[0].part.contours.map(contour => pointsBox(contour.light)).filter(box => box[3] < 180)
    expect(feet).toHaveLength(4)
    expect(feet[3]).toEqual([324, 39, 410, 172])
    expect(c.pieceOf(host)).toBe(piece)
    expect(c.glyph().contours).toHaveLength(16)
  })
  it('carries the strokes it holds whole, renumbered to its own contours', () => {
    const glyph = makePart([0, 1, 2, 3].map(i => square(i * 100, 0, i * 100 + 80, 100)))
    glyph.strokes = [[1, [0]], [2, [1, 2]], [3, [2, 3]], [4, [3]]]
    const c = Object.create(Composer.prototype)
    c.glyph = () => glyph
    const piece = c.pieceOf({ h: '甲', k: [3, 2], b: [200, 0, 380, 100] })
    expect(piece.contours).toEqual([glyph.contours[3], glyph.contours[2]])
    expect(piece.strokes).toEqual([[3, [1, 0]], [4, [0]]])
    expect(c.pieceOf({ h: '乙', k: [0], b: [0, 0, 80, 100] }).strokes).toEqual([[1, [0]]])
  })
})
