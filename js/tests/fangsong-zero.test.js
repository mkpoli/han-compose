import { expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { character, files, records, shards } from './fixtures/small-export.js'

it('draws a hollow 〇 inside 囗 with an older FangSong export', async () => {
  const frame = character('囗', [[50, 0, 950, 820]])
  const input = { ...files, ...shards('g', Object.entries({ ...records, 囗: frame })) }
  const source = createSource(async name => input[name] ? Uint8Array.from(Buffer.from(input[name])).buffer : null)
  const result = await compose(source, '⿴囗〇', { fontStyle: 'fangsong', separate: true })
  const zero = result.parts.find(part => part.origin === 'glyph 〇')
  expect(zero.d.match(/M/g)).toHaveLength(2)
})
