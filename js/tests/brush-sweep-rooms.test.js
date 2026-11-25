import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { brushSweepParts } from '../src/brush-sweep-rooms.js'
import { files, shards } from './fixtures/small-export.js'
// Zhuque Fangsong 0.212, TrionesType, SIL OFL 1.1.
import donors from './fixtures/brush-sweep-fangsong.json' with { type: 'json' }

const input = { ...files, ...shards('g', Object.entries(donors)) }
const source = () => createSource(async k => input[k] === undefined ? null : new Uint8Array(Buffer.from(input[k])).buffer)

it('draws the eight brush enclosures from their own face in both editable layouts', async () => {
  for (const layout of ['composed', 'cells']) {
    const src = source(), options = { layout, separate: true, fontStyle: 'fangsong' }
    for (const pair of ['瓦千', '瓦厘', '瓦十', '瓦屯', '瓦百', '巴三', '竜内', '克千']) {
      const ids = '⿺' + pair
      const { parts } = await compose(src, ids, options)
      expect(parts).toHaveLength(2)
      expect(parts.map(p => p.origin)).toEqual([...pair].map(ch => 'glyph ' + ch))
      expect(parts[0].box[2]).toBeGreaterThan(parts[1].box[2])
      expect(await sketch(src, ids, options)).toHaveLength(2)
      if (layout === 'cells') expect(parts.map(p => p.leaf)).toEqual([0, 1])
    }
  }
})

it('returns control to generic layout for excluded or unrelated donors', () => {
  for (const ch of ['巴', '三', '尅']) {
    const composer = { fontStyle: 'fangsong', excluded: x => x === ch }
    expect(brushSweepParts(composer, ['⿺', '巴', '三'], [0, 0, 1, 1])).toBeNull()
  }
  const composer = { fontStyle: 'fangsong', excluded: () => false, glyphRecord: () => donors.十.G }
  expect(brushSweepParts(composer, ['⿺', '瓦', '十'], [0, 0, 1, 1])).toBeNull()
})

it('keeps adjacent brush enclosures inside their cells', async () => {
  const { parts } = await compose(source(), '⿰⿺瓦十⿺竜内', {
    fontStyle: 'fangsong', layout: 'cells', separate: true,
  })
  expect(parts).toHaveLength(4)
  const rightEdge = Math.max(...parts.slice(0, 2).map(part => part.box[2]))
  const leftEdge = Math.min(...parts.slice(2).map(part => part.box[0]))
  expect(rightEdge).toBeLessThan(leftEdge)
})
