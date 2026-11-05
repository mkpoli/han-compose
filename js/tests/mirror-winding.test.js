import { describe, expect, it } from 'bun:test'
import { commands, derived, makePart, pathMask, pathRings, placed, runsBack, svgPath, wound } from '../src/geometry.js'

/** A contour of one command run, in font units. */
const contour = (ops, points) => ({ ops: commands(ops), light: Float64Array.from(points), heavy: Float64Array.from(points) })
/** A part of one contour in font units, placed onto itself unless `from` and `to` say otherwise. */
const part = (ops, points, { from = [0, 0, 1000, 1000], to = [0, 0, 1000, 1000] } = {}) => placed(
  { contours: [contour(ops, points)] }, from, to, 1000,
)
/** A part as a glyph gives it to the composer: wound where it is made. */
const source = contours => wound(makePart(contours.map(([ops, points]) => contour(ops, points))))
/** A part drawn where it was made. */
const stood = part => placed(part, part.box, part.box, 1000)
const square = (x0, y0, x1, y1) => part('MLLL', [x0, y0, x1, y0, x1, y1, x0, y1])
const area = ring => {
  let sum = 0
  for (let i = 0; i < ring.length; i += 2) {
    const x0 = ring[i], y0 = ring[i + 1], x1 = ring[(i + 2) % ring.length], y1 = ring[(i + 3) % ring.length]
    sum += x0 * y1 - x1 * y0
  }
  return sum / 2
}
/** The nonzero winding number of a point, as the browser fills the path. */
const winding = (rings, px, py) => rings.reduce((sum, ring) => {
  let count = 0
  for (let i = 0; i < ring.length; i += 2) {
    const x0 = ring[i], y0 = ring[i + 1], x1 = ring[(i + 2) % ring.length], y1 = ring[(i + 3) % ring.length]
    const side = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0)
    if (y0 <= py && y1 > py && side > 0) count++
    else if (y0 > py && y1 <= py && side < 0) count--
  }
  return sum + count
}, 0)
const mirror = about => ({ x: true, about })
const turn = about => ({ x: true, y: true, about })

describe('a mirrored part', () => {
  it('is wound the way the parts it is drawn with are', () => {
    const plain = pathRings(svgPath([square(0, 0, 500, 800)]))[0]
    const mirrored = pathRings(svgPath([{ ...square(0, 0, 500, 800), flips: [mirror([500, 400])] }]))[0]
    expect(Math.sign(area(plain))).toBe(Math.sign(area(mirrored)))
    expect(Math.abs(area(mirrored))).toBe(Math.abs(area(plain)))
  })
  it('fills the ink it overlaps instead of cancelling it', () => {
    const left = square(0, 0, 500, 800)
    const right = square(400, 0, 900, 800)
    expect(winding(pathRings(svgPath([left, right])), 450, 400)).toBe(2)
    expect(winding(pathRings(svgPath([left, { ...right, flips: [mirror([650, 400])] }])), 450, 400)).toBe(2)
  })
  it('is left wound as it was by a half turn', () => {
    const right = square(400, 0, 900, 800)
    expect(area(pathRings(svgPath([{ ...right, flips: [turn([650, 400])] }]))[0])).toBeGreaterThan(0)
  })
  it('turns a curve round without moving it', () => {
    const curved = part('MLQ2Q2', [0, 0, 0, 800, 700, 800, 700, 0, 700, 0, 0, 0])
    const ring = pathRings(svgPath([curved]))[0]
    const flipped = pathRings(svgPath([{ ...curved, flips: [mirror([500, 400])] }]))[0]
    expect(Math.sign(area(flipped))).toBe(Math.sign(area(ring)))
    expect(Math.abs(area(flipped))).toBeCloseTo(Math.abs(area(ring)), 3)
    expect(Math.min(...ring.filter((_, i) => i % 2 === 0))).toBe(0)
    expect(Math.min(...flipped.filter((_, i) => i % 2 === 0))).toBeCloseTo(300, 6)
  })
})

describe('a part from a source wound the other way', () => {
  it('is marked where it is made, and a part running the canonical way is not', () => {
    const clockwise = source([['MLLL', [0, 0, 0, 800, 500, 800, 500, 0]]])
    const counter = source([['MLLL', [0, 0, 500, 0, 500, 800, 0, 800]]])
    expect(clockwise.reverse).toBeUndefined()
    expect(counter.reverse).toBe(true)
    expect(runsBack(stood(clockwise))).toBe(false)
    expect(runsBack(stood(counter))).toBe(true)
    expect(runsBack({ ...stood(clockwise), flips: [mirror([250, 400])] })).toBe(true)
  })
  it('turns a cubic contour round instead of flattening it', () => {
    const curved = source([['MCC', [0, 0, 200, 800, 500, 800, 700, 0, 400, -200, 300, -200, 0, 0]]])
    const drawn = { ...stood(curved), part: { ...curved, reverse: true } }
    const plain = { ...drawn, part: { ...curved, reverse: false } }
    const reversed = pathMask(svgPath([drawn]), 96)
    expect(svgPath([drawn])).toContain('C')
    expect(reversed.some(Boolean)).toBe(true)
    expect(reversed).toEqual(pathMask(svgPath([plain]), 96))
  })
  it('fills the ink it overlaps with a part from another source instead of cancelling it', () => {
    const left = source([['MLLL', [0, 0, 500, 0, 500, 800, 0, 800]]])
    const right = source([['MLLL', [400, 0, 400, 800, 900, 800, 900, 0]]])
    expect(Math.abs(winding(pathRings(svgPath([stood(left), stood(right)])), 450, 400))).toBe(2)
  })
})

describe('a glyph split into its outline and its counters', () => {
  // `sweptPart` splits ⿺'s enclosure into the long stroke and the counters it holds, as Klee One
  // draws 电's 日: the outline runs one way, the windows the other, and both pieces must keep that.
  const outline = ['MLLL', [0, 0, 0, 900, 900, 900, 900, 0]]
  const window = ['MLLL', [200, 200, 700, 200, 700, 700, 200, 700]]
  /** The two pieces, drawn where the glyph stood, the window over the outline it was cut from. */
  const pieces = glyph => [derived(glyph, [glyph.contours[0]]), derived(glyph, [glyph.contours[1]])].map(stood)

  it('keeps the window a hole when the outline runs the canonical way', () => {
    const glyph = source([outline, window])
    expect(winding(pathRings(svgPath(pieces(glyph))), 450, 450)).toBe(0)
  })
  it('keeps the window a hole when the whole glyph runs the other way', () => {
    const glyph = source([['MLLL', [0, 0, 900, 0, 900, 900, 0, 900]], ['MLLL', [200, 200, 200, 700, 700, 700, 700, 200]]])
    expect(winding(pathRings(svgPath(pieces(glyph))), 450, 450)).toBe(0)
  })
})
