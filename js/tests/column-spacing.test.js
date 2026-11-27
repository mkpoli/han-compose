import { expect, it } from 'bun:test'
import { settleColumns } from '../src/column-spacing.js'
import { makePart, placed } from '../src/geometry.js'

function column(origin, x, width, solid = false) {
  const spans = solid ? [[0, width]] : [[0, width / 4], [width * .75, width]]
  const contours = spans.map(([l, r]) => {
    const light = Float64Array.from([l, 0, r, 0, r, 700, l, 700])
    return { ops: [['M', 1], ['L', 1], ['L', 1], ['L', 1]], light, heavy: light }
  })
  const source = [0, 0, width, 700], target = [x, 0, x + width, 700]
  return placed(makePart(contours, source), source, target, 0, origin)
}

it('settles wide seams at final weight and keeps all four outer edges', () => {
  const left = column('host 甲', 0, 390), right = column('host 乙', 550, 390)
  settleColumns([[[left], [right]]], [left, right], 'serif')
  expect(left.target[2]).toBeGreaterThan(390)
  expect(right.target[0]).toBeLessThan(550)
  expect(left.target.slice(0, 2)).toEqual([0, 0])
  expect(right.target[2]).toBeCloseTo(940)
  expect(right.target[3]).toBe(700)
})

it('shares one stretch budget across nested and three-column layouts', () => {
  const a = column('A', 0, 240), b = column('B', 360, 240), c = column('C', 720, 240)
  const row = [[a], [b], [c]], parts = row.flat()
  settleColumns([row, [[a, b], [c]]], parts, 'pen-writing')
  const widths = parts.map(p => p.target[2] - p.target[0])
  for (const width of widths) expect(width).toBeCloseTo(240 * 1.06)
  expect(b.target[0] - a.target[2]).toBeCloseTo(c.target[0] - b.target[2])
})

it('retains narrow strokes, native donor pairs, and fixed component metrics', () => {
  const a = column('host 甲', 0, 100), b = column('host 甲', 600, 250)
  const own = [a.target, b.target]
  for (const other of [b, column('丨', 600, 100, true), { ...b, origin: '⿴', fixed: true },
    { ...b, origin: '乙', nativeAspect: true }]) {
    const original = other.target
    settleColumns([[[a], [other]]], [a, other], 'serif')
    expect(other.target).toBe(original)
    expect(a.target).toBe(own[0])
  }
})

it('contains an overhang outside the scanlines shared with the other column', () => {
  const left = column('A', 0, 150), end = column('flourish', 5, 988, true)
  end.target = [5, -150, 993, -30]
  const right = column('B', 650, 350)
  settleColumns([[[left, end], [right]]], [left, end, right], 'serif')
  expect(left.target[2]).toBeGreaterThan(150)
  expect(end.target[2]).toBeLessThanOrEqual(1000.000001)
  expect(right.target[2]).toBeCloseTo(1000)
})
