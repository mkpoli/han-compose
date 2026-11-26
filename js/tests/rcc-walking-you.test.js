import { expect, it } from 'bun:test'
import { fill, groupRings, grown } from '../src/geometry.js'
import { overlayContextDonors, overlayContextParts } from '../src/rcc-overlays.js'
import records from './fixtures/rcc-walking-you.json' with { type: 'json' }

const key = '⿺#(㇋乀)由', em = [0, 0, 1000, 1000]
const composer = (fontStyle, excluded = []) => ({
  fontStyle, glyphRecord: ch => records[fontStyle]?.[ch], excluded: ch => excluded.includes(ch),
})

it('carries 由 above the crossed lower-left strokes in the three brush faces', () => {
  for (const style of Object.keys(records)) {
    expect(overlayContextDonors(key, style)).toEqual(Object.keys(records[style]))
    const parts = overlayContextParts(composer(style), key, em)
    expect(parts.map(p => p.rccLeaf)).toEqual([0, 1])
    const [frame, inside] = parts.map(p => fill(groupRings([p], 24), 128, em))
    // Below the crossing, the end of the falling stroke appears at the left,
    // with a clear interval before the broad sweep to the right.
    const lower = frame.slice(106 * 128, 107 * 128)
    const runs = [...lower].flatMap((ink, i) => ink && !lower[i - 1] ? [i] : [])
    expect(runs).toHaveLength(2)
    expect(runs[0]).toBeLessThan(24)
    expect(runs[1]).toBeGreaterThan(45)
    expect(grown(frame, 128, 2).some((ink, i) => ink && inside[i])).toBe(false)
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
