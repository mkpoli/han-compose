import { expect, it } from 'bun:test'
import { fill, groupRings, grown, partOf } from '../src/geometry.js'
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

it('draws the rising entry, low crossing and level sweep from the RCC specimen', () => {
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
    // The entry rises from the left, then descends across the last fold.
    // At the crest the two sides of the bent stroke meet.
    const entryAt = x => bands(frame, x).find(([top]) => top > 108 && top < 140)
    const left = entryAt(8), rising = entryAt(18), crest = entryAt(25)
    expect(left[0] - rising[0]).toBeGreaterThanOrEqual(6)
    expect(rising[0] - crest[0]).toBeGreaterThanOrEqual(6)
    expect(crest[1] - crest[0]).toBeGreaterThan(15)
    expect(bands(frame, 5).at(-1)[1]).toBeGreaterThanOrEqual(192)

    // Both edges settle below the counter by mid-width. The last few
    // columns taper into the terminal of the donor brush.
    for (let x = 80; x <= 180; x++) {
      const [top, bottom] = bands(frame, x).at(-1)
      expect(bottom - top + 1).toBeGreaterThanOrEqual(6)
      expect((top + bottom) / 2).toBeGreaterThan(177)
      expect((top + bottom) / 2).toBeLessThan(194)
      if (x > 110) expect(top).toBeGreaterThan(180)
    }
    for (let x = 181; x <= 196; x++) expect(bands(frame, x).at(-1)[0]).toBeGreaterThan(178)

    // The complete 由 stays in its native hand, including its counters.
    const innerDonor = style === 'fangsong' ? '迪' : '廸'
    const nativeContours = partOf(records[style][innerDonor]).contours
    for (const contour of parts[1].part.contours) expect(nativeContours).toContain(contour)
    expect(bands(inside, 150)).toHaveLength(3)
    expect(bands(inside, 192)).toHaveLength(0)
    const [smallFrame, smallInside] = parts.map(p => fill(groupRings([p], 24), 32, em))
    expect(grown(smallFrame, 32, 1).some((ink, i) => ink && smallInside[i])).toBe(false)
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

it('carries the native weight change through the entry and sweep', () => {
  const size = 400
  for (const style of Object.keys(records)) {
    const parts = overlayContextParts(composer(style), key, em)
    const pen = style === 'pen-writing'
    const samples = (pen ? [-1, 0, .5, 1] : [0, .5, 1]).map(weight => {
      const [frame, inside] = parts.map(p => fill(groupRings([{ ...p, weight: [weight, weight] }], 24), size, em))
      // The sweep stays continuous and clear of 由 at both master extremes.
      for (let x = 155; x <= 360; x++) {
        const band = bands(frame, x, size).at(-1)
        expect(band).toBeDefined()
        expect(band[1] - band[0]).toBeGreaterThanOrEqual(3)
        expect(band[0]).toBeGreaterThan((bands(inside, x, size).at(-1) ?? [-1, -1])[1])
      }
      const entry = bands(frame, 36, size).find(([top, bottom]) => bottom > 224 && top < 265)
      const sole = bands(frame, 240, size).at(-1)
      return [entry, sole].map(([top, bottom]) => bottom - top + 1)
    })
    for (let i = 1; i < samples.length; i++) {
      for (const k of [0, 1]) {
        // Kureedo's second master moves inward. Its outward weight is negative.
        const growth = samples[i][k] - samples[i - 1][k]
        expect(pen ? -growth : growth).toBeGreaterThan(1)
      }
    }
  }
})
