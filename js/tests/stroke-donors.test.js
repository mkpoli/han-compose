import { expect, it } from 'bun:test'
import { fill, partOf, rings, union } from '../src/geometry.js'
import { chainForm } from '../src/stroke-chain.js'
import { nativeStroke, reconstructStroke, strokeDonor } from '../src/stroke-donors.js'
// Zhuque FangSong 0.212 (SIL OFL 1.1), pinned donor outlines used by the FangSong export.
import glyphs from './fixtures/fangsong-stroke-donor.json' with { type: 'json' }

const styles = ['sans', 'serif', 'regular', 'fangsong', 'pen-writing']

it('cuts the four arcs from each primary face’s ideographic zero', () => {
  for (const style of styles) {
    const corners = [...'◝◞◟◜'].map(char => {
      expect(strokeDonor(char, style)).toBe('〇')
      const glyph = nativeStroke(char, style)
      expect(glyph.strokeSource).toBe('〇')
      expect(glyph.contours).toHaveLength(2)
      expect(glyph.box[2]).toBeGreaterThan(glyph.box[0])
      expect(glyph.box[3]).toBeGreaterThan(glyph.box[1])
      return glyph.box
    })
    expect(corners[0][0]).toBe(corners[2][2])
    expect(corners[0][1]).toBe(corners[2][3])
    expect(corners[1][0]).toBe(corners[3][2])
    expect(corners[1][3]).toBe(corners[3][1])
  }
})

it('uses a verified FangSong contour for a stroke missing from its cmap', () => {
  const recordOf = char => glyphs[char]
  const donor = partOf(glyphs.刁)
  const lift = nativeStroke('㇀', 'fangsong', recordOf)
  expect(strokeDonor('㇀', 'fangsong')).toBe('刁')
  expect(lift.strokeSource).toBe('刁')
  expect(lift.contours).toEqual([donor.contours[1]])
  expect(nativeStroke('𠃌', 'fangsong', recordOf).contours).toEqual([donor.contours[0]])
  expect(nativeStroke('㇀', 'fangsong', () => null)).toBeNull()
  expect(nativeStroke('㇀', 'fangsong', () => ({ ...glyphs.刁, v: 0 }))).toBeNull()
  expect(nativeStroke('㇀', 'fangsong', () => ({ ...glyphs.刁, p: [...glyphs.刁.p].reverse() }))).toBeNull()
})

it('labels a reconstruction and leaves it unavailable when its constituent is excluded', () => {
  const donor = nativeStroke('◝', 'fangsong')
  const glyphOf = char => char === '㇄' ? donor : null
  const result = reconstructStroke('㇘', 'fangsong', glyphOf)
  expect(result.strokeSource).toBe('reconstructed ㇘ from ㇄')
  expect(result.box).toEqual(donor.box)
  expect(reconstructStroke('㇘', 'fangsong', () => null)).toBeNull()
  expect(reconstructStroke('㇘', 'sans', glyphOf)).toBeNull()
})

it('keeps the FangSong 凸 sidewall narrow below its shoulder', () => {
  const glyph = char => nativeStroke(char, 'fangsong', donor => glyphs[donor])
  const { parts } = chainForm('#(-𠃊㇎z)', glyph)
  const frame = union(parts.map(part => part.box))
  const ink = parts.flatMap(part => rings(part.contours, part.contours.map(c => c.light)))
  const row = fill(ink, 100, frame).slice(6500, 6600)
  expect(Array.from(row).lastIndexOf(1)).toBeGreaterThan(85)
  expect(row.slice(45, 85).some(Boolean)).toBe(false)
})

it('uses the attested first bend of FangSong 巛 for 𡿨', () => {
  const glyph = nativeStroke('𡿨', 'fangsong', char => glyphs[char])
  expect(strokeDonor('𡿨', 'fangsong')).toBe('巛')
  expect(glyph.contours).toEqual([partOf(glyphs.巛).contours[1]])
})
