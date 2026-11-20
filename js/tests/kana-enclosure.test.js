import { expect, it } from 'bun:test'
import { designedSources } from '../src/compose.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, records, shards } from './fixtures/small-export.js'
// Noto Serif CJK JP, SIL OFL 1.1. The outline identifies the opening of む.
import serifMu from './fixtures/serif-mu.json' with { type: 'json' }

it('sketches both Serif kana enclosure operands correctly on first use', async () => {
  const input = { ...files, ...shards('g', Object.entries({ ...records, む: { G: serifMu } })) }
  const source = createSource(async name => input[name] === undefined ? null : Uint8Array.from(Buffer.from(input[name])).buffer)
  const options = { fontStyle: 'serif', separate: true }
  const boxes = await sketch(source, '⿶む子', options)
  const { parts } = await compose(source, '⿶む子', options)
  expect(parts.map(part => part.origin)).toEqual(['glyph む', '𛄧 for 子'])
  expect(boxes.map(leaf => leaf.box)).toEqual(parts.map(part => part.box))
})

it('loads native brush operands for a nested kana enclosure', () => {
  const tree = ['⿰', '木', ['⿶', 'む', '子']]
  for (const style of ['fangsong', 'regular', 'pen-writing']) {
    expect(designedSources(tree, style)).toEqual(['む', '子'])
  }
  expect(designedSources(tree, 'sans')).toEqual([])
  expect(designedSources(['⿶', 'む', '木'], 'regular')).toEqual([])
})
