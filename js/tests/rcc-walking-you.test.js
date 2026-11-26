import { expect, it } from 'bun:test'
import { fill, groupRings, grown } from '../src/geometry.js'
import { overlayContextDonors, overlayContextParts } from '../src/rcc-overlays.js'
import records from './fixtures/rcc-walking-you.json' with { type: 'json' }

const key = '⿺#(㇋乀)由', em = [0, 0, 1000, 1000]
const composer = (fontStyle, excluded = []) => ({
  fontStyle, glyphRecord: ch => records[fontStyle]?.[ch], excluded: ch => excluded.includes(ch),
})

// Occupied vertical spans in a single raster column, measured down from the top.
function bands(mask, x, size = 200) {
  const spans = []
  let start
  for (let y = 0; y <= size; y++) {
    const ink = y < size && mask[y * size + x]
    if (ink && start === undefined) start = y
    if (!ink && start !== undefined) {
      spans.push([start, y - 1])
      start = undefined
    }
  }
  return spans
}

it('seats the three brush outlines on the low baseline of the printed form', () => {
  for (const style of Object.keys(records)) {
    expect(overlayContextDonors(key, style)).toEqual(Object.keys(records[style]))
    const parts = overlayContextParts(composer(style), key, em)
    expect(parts.map(p => p.rccLeaf)).toEqual([0, 1])
    expect(parts.map(p => p.part.strokes.length)).toEqual([3, 5])
    expect(parts[1].part.strokes.map(([id]) => id)).toEqual([0, 1, 2, 3, 4])
    for (const { part } of parts) for (const [, contours] of part.strokes) {
      expect(contours.every(i => Number.isInteger(i) && i >= 0 && i < part.contours.length)).toBe(true)
    }
    const [frame, inside] = parts.map(p => fill(groupRings([p], 24), 200, em))
    // The sweep starts within the downstroke. The upper and lower folds,
    // followed by a low tail, are the only ink to the left of that junction.
    expect(bands(frame, 20).some(([top, bottom]) => top < 146 && bottom > 115)).toBe(false)
    expect(bands(frame, 5).at(-1)[1]).toBeGreaterThanOrEqual(192)
    // The entire underline has visible thickness. A line left straight
    // between two mapped controls can fold over the opposite edge.
    for (let x = 80; x <= 180; x++) {
      const [top, bottom] = bands(frame, x).at(-1)
      expect(bottom - top + 1).toBeGreaterThanOrEqual(6)
      expect((top + bottom) / 2).toBeGreaterThan(176)
      expect((top + bottom) / 2).toBeLessThan(193)
    }
    // The brush terminal can taper. It continues under 由 to the right edge.
    for (let x = 181; x <= 196; x++) {
      const terminal = bands(frame, x).at(-1)
      expect(terminal).toBeDefined()
      expect(terminal[0]).toBeGreaterThan(170)
    }
    const centers = bands(inside, 150).map(([top, bottom]) => (top + bottom) / 2)
    expect(centers).toHaveLength(3)
    // Sans and Serif place their three crossbar centers around 22%, 47% and 74%.
    for (const [i, expected] of [43, 95, 148].entries()) expect(Math.abs(centers[i] - expected)).toBeLessThan(6)
    expect(grown(frame, 200, 3).some((ink, i) => ink && inside[i])).toBe(false)
    expect(overlayContextParts({...composer(style), separate: true}, key, em)).toEqual(parts)
    for (const ch of [key, '#(㇋乀)', '㇋', '乀', '由', ...Object.keys(records[style])]) {
      expect(overlayContextParts(composer(style, [ch]), key, em)).toBeNull()
    }
    expect(overlayContextParts({ ...composer(style), glyphRecord: () => ({ v: 1, p: [] }) }, key, em)).toBeNull()
  }
})

it('keeps the existing faces with the native crossed walking radical and other spellings', () => {
  for (const style of ['sans','serif']) {
    expect(overlayContextDonors(key, style)).toEqual([])
    expect(overlayContextParts(composer(style), key, em)).toBeNull()
  }
  expect(overlayContextParts(composer('regular'), '⿺#(㇋乀)田', em)).toBeNull()
})
