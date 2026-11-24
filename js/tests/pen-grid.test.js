import { expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { character, files, shards } from './fixtures/small-export.js'

it('gives the six 子 equal cells with native leaves for each spelling', async () => {
  const sourceFiles = { ...files, ...shards('g', [['子', character('子', [[57, 16, 946, 765]])]]) }
  const source = createSource(async key => sourceFiles[key] ? Uint8Array.from(Buffer.from(sourceFiles[key])).buffer : null)
  const opts = { fontStyle: 'pen-writing', separate: true }
  const short = await compose(source, '⿱𡥦𡥦', opts)
  const written = await compose(source, '⿱⿲子子子⿲子子子', opts)
  expect(short.parts.map(p => p.leaf)).toEqual([0,0,0,1,1,1])
  expect(written.d).toBe(short.d)
  expect(written.parts[3].box.slice(2)).toEqual(written.parts[0].box.slice(2))
})
