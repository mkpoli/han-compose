import { expect, test } from 'bun:test'
import { recordedArcDonors, recordedArcParts } from '../src/recorded-arcs.js'
import { drawnBox, svgPath } from '../src/geometry.js'
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
  expect(Object.keys(data.entries)).toHaveLength(14)
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
