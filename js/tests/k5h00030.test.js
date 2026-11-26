import { expect, it } from 'bun:test'
import { fill, groupRings } from '../src/geometry.js'
import { k5Donors, k5Parts } from '../src/k5h00030.js'
// Format-7 native records for the five primary faces used by K5H00030.
import records from './fixtures/k5h00030.json' with { type: 'json' }

const spelling = '⿲牛⿻𡿨㇇⿱丿⿹⿷⿴#(-𠃍㇉)二一灬'
const region = [0, 0, 1000, 1000]
const composer = (style, exclude = []) => ({
  fontStyle: style,
  excluded: ch => exclude.includes(ch),
  glyphRecord: ch => records[style][ch],
})

it('keeps the crossed center and the crested bird at their full source heights', () => {
  expect(k5Donors(spelling)).toEqual(['特', '奴', '鳴'])
  for (const style of Object.keys(records)) {
    const parts = k5Parts(composer(style), spelling, region)
    expect(parts).toHaveLength(3)
    expect(parts[1].target[3] - parts[1].target[1]).toBeGreaterThan(900)
    expect(parts[2].target[0]).toBeGreaterThan(500)
    expect(parts[2].target[3]).toBeCloseTo(1000)
    const masks = parts.map(p => fill(groupRings([p]), 256, region))
    // The printed cow and center approach at the lower lift. A continuous
    // upper bar across both produces the wrong form.
    const upper = 256 * 110
    expect(masks[0].slice(0, upper).some((ink, i) => ink && masks[1][i])).toBe(false)
  }
})

it('falls back for excluded operands, other revisions and incomplete RCC text', () => {
  for (const ch of ['牛', '灬', '#(-𠃍㇉)', '奴', '特', '鳴']) {
    expect(k5Parts(composer('sans', [ch]), spelling, region)).toBeNull()
  }
  expect(k5Parts({ ...composer('sans'), glyphRecord: () => ({ v: 1, p: [] }) }, spelling, region)).toBeNull()
  expect(k5Parts(composer('sans'), '⿲牛⿻[x', region)).toBeNull()
  expect(k5Donors('⿲牛女鳥')).toEqual([])
})

it('partitions the composed outlines into eight movable IDS leaves in all five faces', () => {
  for (const style of Object.keys(records)) {
    const face = composer(style)
    const ordinary = k5Parts(face, spelling, region)
    const editable = k5Parts({ ...face, separate: true }, spelling, region)
    expect(editable.map(p => p.rccLeaf)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    const raster = parts => fill(groupRings(parts), 320, region)
    const original = raster(ordinary)
    expect(Buffer.from(raster(editable)).equals(Buffer.from(original))).toBe(true)
    for (const leaf of editable) {
      const moved = editable.map(p => p === leaf ? { ...p, target: p.target.map((v, i) => v + (i % 2 ? 0 : 60)) } : p)
      expect(raster(moved).some((ink, i) => ink !== original[i])).toBe(true)
    }
  }
})
