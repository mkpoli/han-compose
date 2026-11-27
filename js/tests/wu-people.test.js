import { expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { pathRings } from '../src/geometry.js'
import { files, shards } from './fixtures/small-export.js'
// Outline extracts from the Noto Sans CJK and Noto Serif CJK exports, SIL OFL 1.1.
import faces from './fixtures/wu-people.json' with { type: 'json' }

for (const fontStyle of ['sans', 'serif']) {
  it(`retains the six contours of 巫 around its omitted upright in ${fontStyle}`, async () => {
    const data = { ...files, ...shards('g', Object.entries(faces[fontStyle])) }
    const source = createSource(async name => data[name] === undefined ? null : new Uint8Array(Buffer.from(data[name])).buffer)
    const host = await compose(source, '巫', { fontStyle })
    expect(pathRings(host.d).length).toBe(7)
    for (const separate of [false, true]) {
      const { parts } = await compose(source, '⿱一丛', { fontStyle, separate })
      expect(parts.map(p => p.origin)).toEqual(['一 from 巫', '丛 from 巫'])
      expect(parts.map(p => pathRings(p.d).length)).toEqual([1, 5])
    }
    const fallback = await compose(source, '⿱一丛', { fontStyle, exclude: ['巫'] })
    expect(fallback.parts.some(p => p.origin.includes('from 巫'))).toBe(false)
  })
}
