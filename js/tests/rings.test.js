import { describe, expect, it } from 'bun:test'
import { commands, rings } from '../src/geometry.js'

describe('the rings of a contour', () => {
  it('samples a cubic curve and goes on from its end point', () => {
    const points = Float64Array.from([0, 0, 0, 100, 100, 100, 100, 0, 200, 0])
    const contour = { ops: commands('MCL'), light: points, heavy: points, width: null }
    const [ring] = rings([contour], [points], 2)
    // The middle of the curve, its end point, then the line from there.
    expect(ring).toEqual([0, 0, 50, 75, 100, 0, 200, 0])
  })
})
