import { expect, test } from 'bun:test'
import { recordedArcDonors, recordedArcParts } from '../src/recorded-arcs.js'
import { drawnBox, raster, svgPath } from '../src/geometry.js'
import constants from '../src/constants.json' with { type: 'json' }
import data from '../src/recorded-arcs.json' with { type: 'json' }

const composer = {
  C: constants,
  stem0: constants.stem,
  excluded: () => false,
  glyph: () => null,
}
const loop = '#(◞x3◟◜◝-◟)'

test('draws each selected source centerline in the root chain frame', () => {
  expect(Object.keys(data.entries)).toHaveLength(34)
  for (const chain of Object.keys(data.entries)) {
    const parts = recordedArcParts(composer, chain, constants.face, true)
    expect(parts[0].origin).toContain('GlyphWiki')
    const [x0, y0, x1, y1] = drawnBox(parts[0])
    expect(x0).toBeGreaterThanOrEqual(99.9)
    expect(y0).toBeGreaterThanOrEqual(-20.1)
    expect(x1).toBeLessThanOrEqual(900.1)
    expect(y1).toBeLessThanOrEqual(790.1)
    expect(svgPath(parts)).not.toContain('NaN')
  }
})

test('keeps separate attested variants and honours exclusions', () => {
  expect(recordedArcDonors(loop, 'sans')).toEqual(['丨', '一'])
  expect(recordedArcDonors('#(丨x4◞◟◜◝◞◝◞◝)', 'sans')).toEqual(['丨', '一'])
  expect(recordedArcParts(composer, '#(丨x4◞◟◜◝◞◝◞◝)', constants.face, true)[0].origin).toContain('Bai IDS, guide U+E00B')
  expect(recordedArcParts({ ...composer, excluded: char => char === '𡆢' }, loop, constants.face, true)).toBeNull()
  const variant = chain => recordedArcParts(composer, chain, constants.face, true)
  expect(variant('#(-◝◟◜◝◞-◜)')[0].origin).toContain('u20ab3-j')
  expect(variant('#(◟◜◝◞x0)')[0].origin).toContain('u20ab3-t')
})

test('preserves a clear central counter and mitered corners for diamond and triangle', () => {
  for (const [key, sides] of [['#(-乀-丿乀丿z)', 4], ['#(-𠃋丶z)', 3]]) {
    const parts = recordedArcParts(composer, key, constants.face, true)
    expect(parts[0].part.contours.map(c => c.ops.length)).toEqual([sides, sides])
    const mask = raster(parts, 96)
    const center = mask.slice(48 * 96, 49 * 96)
    expect(center[48]).toBe(0)
    expect(center.slice(1).filter((pixel, i) => pixel && !center[i])).toHaveLength(2)
  }
})

test('fits a shallow source canopy into the published frame before applying stem width', () => {
  const realFrame = { ...composer, data: { manifest: { composer: { commit: 'a83fc941166b' } } } }
  const parts = recordedArcParts(realFrame, '#(-乛丨)', constants.face, true)
  const midColumn = raster(parts, 96).filter((pixel, i) => pixel && i % 96 === 48)
  expect(parts[0].origin).toContain('u2ced2-j')
  expect(midColumn.length).toBeGreaterThan(1)
  expect(midColumn.length).toBeLessThan(12)
})

test('fits a historical spelling in its own measured frame before drawing strokes', () => {
  const kai = { ...composer, data: { manifest: { composer: { commit: 'c14ee5e08798' } } } }
  const canonical = '#(㇇◝◞)'
  const written = '#(HPQaQb)'
  const width = parts => { const b = drawnBox(parts[0]); return b[2] - b[0] }
  expect(width(recordedArcParts(kai, canonical, constants.face, true, written))).toBeLessThan(300)
  expect(width(recordedArcParts(kai, canonical, constants.face, true))).toBeGreaterThan(740)
})
