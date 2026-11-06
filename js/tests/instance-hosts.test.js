import { describe, expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { makePart } from '../src/geometry.js'

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
  c.exclude = new Set(exclude)
  c.excluded = ch => c.exclude.has(ch)
  c.data = { places: name => name === '⿰甲乙' ? ['R'] : [], hosts: () => hosts, manifest: {} }
  c.rec = key => key === '⿰甲乙' ? { e: '丙' } : null
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
