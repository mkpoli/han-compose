import { expect, it } from 'bun:test'
import { partOf } from '../src/geometry.js'
import { nativeStroke, reconstructStroke, strokeDonor } from '../src/stroke-donors.js'
// Zhuque FangSong 0.212 (SIL OFL 1.1), pinned outline of 刁 used by the FangSong export.
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
