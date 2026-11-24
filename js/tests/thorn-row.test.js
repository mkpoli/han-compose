import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, records, shards } from './fixtures/small-export.js'
// The 棘 and 企 outlines from Kureedo, SIL OFL 1.1.
import donors from './fixtures/pen-thorn-row.json' with { type: 'json' }

const source = () => {
  const input = { ...files, ...shards('g', Object.entries({ ...donors, 朿: records.木 })) }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}

it('fits the shorter 企 between the two 朿 from 棘 in R+06D8', async () => {
  const id = '⿲朿企朿'
  for (const layout of ['composed', 'cells']) {
    const src = source()
    const options = { layout, separate: true, fontStyle: 'pen-writing' }
    const positions = await sketch(src, id, options)
    const { parts } = await compose(src, id, options)
    expect(positions).toHaveLength(3)
    expect(positions).toEqual(await sketch(src, id, options))
    expect(parts.map(p => p.origin)).toEqual(['left 朿 from 棘', 'glyph 企', 'right 朿 from 棘'])
    const [left, middle, right] = parts.map(p => p.box)
    expect(left[0]).toBeLessThan(middle[0])
    expect(middle[0]).toBeLessThan(right[0])
    expect(middle[1] + middle[3]).toBeLessThan(Math.min(left[1] + left[3], right[1] + right[3]))
    expect((await compose(src, id, { ...options, exclude: ['棘'] })).origins).not.toContain('left 朿 from 棘')
  }
})
