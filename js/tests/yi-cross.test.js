import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { fill, pathRings } from '../src/geometry.js'
import { files, records, shards } from './fixtures/small-export.js'
// Noto Serif CJK (SIL OFL 1.1) and CNS11643 TW-Kai (OGDL 1.0).
import donors from './fixtures/yi-cross.json' with { type: 'json' }

const sequence = '⿽弋十'
const mask = d => fill(pathRings(d, 16), 256, [0, -120, 1000, 880])

for (const [fontStyle, donor] of Object.entries(donors)) {
  it(`retains the upper 十 from 𢦏 in the ${fontStyle} 弋 form`, async () => {
    const input = { ...files, ...shards('g', Object.entries({ '𢦏': donor, 弋: records.木, 十: records.口 })) }
    const src = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
    const before = await sketch(src, sequence, { fontStyle })
    const reference = mask((await compose(src, '𢦏', { fontStyle })).d)
    for (const layout of ['composed', 'cells']) {
      const result = await compose(src, sequence, { layout, fontStyle, separate: true })
      expect(result.approximate).not.toContain('⿽')
      expect(result.parts.map(p => p.origin)).toEqual(['弋 from 𢦏', '十 from 𢦏'])
      const ink = mask(result.d)
      expect(ink.slice(0, 100 * 256)).toEqual(reference.slice(0, 100 * 256))
      expect(reference.some((v, i) => v && !ink[i])).toBe(true)
      expect(result.parts[1].box[1] + result.parts[1].box[3]).toBeLessThan(500)
    }
    expect(await sketch(src, sequence, { fontStyle })).toEqual(before)
    expect((await compose(src, sequence, { fontStyle, exclude: ['𢦏'] })).origins).not.toContain('弋 from 𢦏')
  })
}
