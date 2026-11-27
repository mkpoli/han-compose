import { expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { files, records, shards } from './fixtures/small-export.js'

it('draws a hollow 〇 inside 囗 with an older FangSong export', async () => {
  const frame = records.口
  const input = { ...files, ...shards('g', Object.entries({ ...records, 囗: frame })) }
  const source = createSource(async name => input[name] ? Uint8Array.from(Buffer.from(input[name])).buffer : null)
  for (const layout of ['composed', 'cells']) {
    const result = await compose(source, '⿴囗〇', { fontStyle: 'fangsong', separate: true, layout })
    const [outer, zero] = result.parts
    expect(zero.d.match(/M/g)).toHaveLength(2)
    for (const axis of [0, 1]) {
      const span = zero.box[axis + 2] / outer.box[axis + 2]
      expect(span).toBeGreaterThan(0.40)
      expect(span).toBeLessThan(0.68)
    }
  }
})
