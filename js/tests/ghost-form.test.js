import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { fill, pathRings } from '../src/geometry.js'
import { files, records, shards } from './fixtures/small-export.js'
// Noto Serif CJK and Zhuque FangSong (SIL OFL), TW-Kai (CNS11643, OGDL 1.0).
import donors from './fixtures/ghost-outlines.json' with { type: 'json' }

const id = '⿷⿱田儿厶'
const mask = d => fill(pathRings(d, 16), 256, [0, -120, 1000, 880])

for (const [fontStyle, donor] of Object.entries(donors)) {
  it(`removes only the upper stroke of the native ${fontStyle} 鬼`, async () => {
    const input = { ...files, ...shards('g', Object.entries({ 鬼: donor, 田: records.口, 儿: records.木, 厶: records.口 })) }
    const src = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
    const cold = await sketch(src, id, { fontStyle })
    const native = mask((await compose(src, '鬼', { fontStyle })).d)
    for (const layout of ['cells', 'composed']) {
      const result = await compose(src, id, { fontStyle, layout, separate: true })
      expect(result.parts.map(p => p.origin)).toEqual(['田 from 鬼', '儿 from 鬼', '厶 from 鬼'])
      const revised = mask(result.d)
      expect(revised.some((v, i) => v > native[i])).toBe(false)
      expect(revised.some((v, i) => v < native[i])).toBe(true)
      expect(revised.subarray(85 * 256)).toEqual(native.subarray(85 * 256))
    }
    expect(await sketch(src, id, { fontStyle })).toEqual(cold)
    expect((await compose(src, id, { fontStyle, exclude: ['鬼'] })).origins).not.toContain('田 from 鬼')
  })
}
