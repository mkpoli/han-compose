import { describe, expect, it } from 'bun:test'
import { partOf } from '../src/geometry.js'

const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
const closed = (tear, last = null) => {
  // A square closed on its first point; `tear` moves the heavy first point away from it.
  const light = [0, 0, 400, 0, 400, 400, 0, 400, 0, 0]
  const heavy = [0, 0, 400, 0, 400, 400, 0, 400, 0, 0]
  heavy[0] += tear
  heavy[1] -= tear
  return [light, heavy, last]
}
const record = (...contours) => ({ b: [0, 0, 400, 400],
  p: contours.map(([light, heavy], i) => [i === 1 ? 'MQ2Q2*' : 'MLLLL', int16(light.map(v => v * 4)), int16(heavy.map((v, k) => (v - light[k]) * 4))]) })
const ends = contour => [contour.heavy[0], contour.heavy[1], contour.heavy.at(-2), contour.heavy.at(-1)]

describe('a contour the light master closes', () => {
  it('closes where the heavy master tears it open', () => {
    const [contour] = partOf(record(closed(156))).contours
    const [x0, y0, x1, y1] = ends(contour)
    expect(x0).toBeCloseTo(x1, 6)
    expect(y0).toBeCloseTo(y1, 6)
  })

  it('is left as stored away from the first point', () => {
    const [contour] = partOf(record(closed(156))).contours
    const light = contour.light, heavy = contour.heavy
    for (let i = 2; i < light.length; i++) expect(heavy[i]).toBeCloseTo(light[i], 6)
  })

  it('leaves a contour that closes on an implied point alone', () => {
    const contours = partOf(record(closed(0), closed(156, '*'))).contours
    const torn = contours[1]
    const [x0, , x1] = ends(torn)
    expect(Math.abs(x0 - x1)).toBeGreaterThan(1)
  })
})
