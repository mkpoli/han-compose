import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { pathMask, pathRings, pointsBox, union } from '../src/geometry.js'
import { files, shards } from './fixtures/small-export.js'
// Noto Sans CJK JP 2.004, SIL Open Font License 1.1.
import turn from './fixtures/double-turn.json' with { type: 'json' }

it('crosses the two 𡿨 strokes once within the original ink bounds', async () => {
  const data = { ...files, ...shards('g', [['𡿨', turn], ['乚', turn]]) }
  const source = createSource(async name => data[name] === undefined ? null : new Uint8Array(Buffer.from(data[name])).buffer)
  const ids = '⿻𡿨𡿨'
  const bounds = drawing => union(pathRings(drawing.d, 24).map(pointsBox))
  // In this export the control has identical outlines under unrelated names.
  const ordinary = await compose(source, '⿻𡿨乚')
  for (const separate of [false, true]) {
    const drawing = await compose(source, ids, { separate })
    expect(drawing.parts.map(p => p.origin)).toEqual(['glyph 𡿨', 'glyph 𡿨'])
    const [upper, lower] = drawing.parts.map(bounds)
    const height = upper[3] - lower[1]
    expect((upper[3] - lower[3]) / height).toBeCloseTo(0.30, 3)
    expect((upper[1] - lower[1]) / height).toBeCloseTo(0.30, 3)
    bounds(drawing).forEach((v, i) => expect(v).toBeCloseTo(bounds(ordinary)[i], 1))
    const [a, b] = drawing.parts.map(p => pathMask(p.d, 384))
    expect(a.some((ink, i) => ink && b[i])).toBe(true)
    expect((await sketch(source, ids)).map(p => p.box)).toEqual(drawing.parts.map(p => p.box))
  }
})
