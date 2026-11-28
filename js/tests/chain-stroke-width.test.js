import { expect, it } from 'bun:test'
import { makePart } from '../src/geometry.js'
import { risingSweepMap, sweepMap } from '../src/chain-stroke-width.js'

function outline(points) {
  const ops = Array.from({ length: points.length / 2 }, (_, i) => [i ? 'L' : 'M', 1, false])
  const light = Float64Array.from(points)
  return makePart([{ ops, light, heavy: light, width: null }])
}

it('keeps a descending dot’s pen width when stretching its length', () => {
  const glyph = outline([0, 100, 45, 45, 100, 0, 55, 55])
  const stretch = v => 3 * v
  const map = sweepMap(glyph, [stretch, stretch], -1)
  const a = map(45, 45), b = map(55, 55)
  expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeCloseTo(Math.hypot(10, 10))
  expect(map(100, 0)[0] - map(0, 100)[0]).toBeCloseTo(300)
})

it('rotates both edges of a shallow native sweep onto a descending chord', () => {
  const glyph = outline([0, 0, 100, 0, 100, 10, 0, 10])
  const map = risingSweepMap(glyph, [0, 100], [100, 0])
  const a = map(50, 0), b = map(50, 10)
  expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeCloseTo(10)
  expect(a[0] - b[0]).toBeCloseTo(a[1] - b[1])
})
