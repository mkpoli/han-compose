import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { pathMask, pathRings, pointsBox } from '../src/geometry.js'
import { files, records, shards } from './fixtures/small-export.js'
// 原 in the hosted Zhuque FangSong and pen-writing exports (SIL OFL).
import donors from './fixtures/yuan-pyramid.json' with { type: 'json' }
// 𤿁 in the Sans (SIL OFL 1.1) and TW-Kai (CNS11643, OGDL 1.0) exports.
import encoded from './fixtures/yuan-encoded.json' with { type: 'json' }

const expanded = '⿳白小⿰⿱白小⿱白小'
const groups = ['白 from 原', '小 from 原', '白 from 原', '小 from 原', '白 from 原', '小 from 原']
function source(donor, extra = {}) {
  const input = { ...files, ...shards('g', Object.entries({ 原: donor, 厂: records.厃, 白: records.口, 小: records.木, ...extra })) }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}
const mask = d => pathMask(d, 256)
for (const [fontStyle, donor] of Object.entries(donors)) {
  it(`draws three native 白小 cuts in ${fontStyle} with an editable 厂`, async () => {
    const src = source(donor), id = '⿸厂' + expanded
    const cold = await sketch(src, id, { fontStyle })
    for (const layout of ['cells', 'composed']) {
      const options = { fontStyle, layout, separate: true }
      const result = await compose(src, id, options), literal = await compose(src, '⿸厂𤿁', options)
      expect(result.origins).toEqual(['厂 from 原', ...groups])
      expect(literal.origins).toEqual(['厂 from 原', '𤿁 from 原'])
      expect(mask(result.d)).toEqual(mask(literal.d))
      expect((await compose(src, expanded, options)).origins).toEqual(groups)
      expect((await compose(src, '𤿁', options)).origins).toEqual(['𤿁 from 原'])
      expect((await compose(src, '⿸厂⿱⿱白小⿰⿱白小⿱白小', options)).origins).toEqual(result.origins)
      const masks = result.parts.map(p => mask(p.d))
      for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) {
        if ([1, 3, 5].includes(i) && j === i + 1) continue // 白 touches 小 within its own 原.
        expect(masks[i].some((v, k) => v && masks[j][k])).toBe(false)
      }
    }
    expect(await sketch(src, id, { fontStyle })).toEqual(cold)
  })
  it(`retains an export's own 𤿁 in ${fontStyle}`, async () => {
    const src = source(donor, { '𤿁': records.木 })
    expect((await compose(src, '𤿁', { fontStyle })).origins).toEqual(['glyph 𤿁'])
    expect((await compose(src, '⿸厂𤿁', { fontStyle })).origins).not.toContain('𤿁 from 原')
    expect((await compose(src, expanded, { fontStyle })).origins).toEqual(groups)
    expect((await compose(src, expanded, { fontStyle, exclude: ['原'] })).origins).not.toContain('小 from 原')
  })
}

for (const [fontStyle, record] of Object.entries(encoded)) {
  it(`keeps both counters of each encoded 白 in an expanded ${fontStyle} pyramid`, async () => {
    const src = source(records.木, { '𤿁': record })
    for (const id of [expanded, '⿸厂' + expanded, '⿸厂⿱⿱白小⿰⿱白小⿱白小']) {
      const result = await compose(src, id, { fontStyle, separate: true })
      const pieces = result.parts.slice(-6)
      expect(pieces.map(p => p.origin)).toEqual(Array.from({ length: 3 }, () => ['白 from 𤿁', '小 from 𤿁']).flat())
      for (const index of [0, 2, 4]) {
        const contours = pathRings(pieces[index].d)
        expect(contours.length).toBe(3)
        for (const ring of contours.slice(1)) {
          const [, bottom, , top] = pointsBox(ring)
          expect(top - bottom).toBeGreaterThan(12)
        }
      }
    }
  })
}
