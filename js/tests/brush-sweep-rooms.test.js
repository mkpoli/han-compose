import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { partOf, pathRings, pointsBox, scaleOf, svgPath, union } from '../src/geometry.js'
import { hexOf } from '../src/sha256.js'
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

it('places inner ink at the horizontal centers of encoded reference glyphs', async () => {
  // Centers relative to whole-glyph ink width in ZhongYi FangSong. The 竜内
  // target comes from Jigmo because Zhuque Fangsong lacks the U+25A9E glyph.
  const centers = { 瓦千: 0.740, 瓦厘: 0.657, 瓦十: 0.761, 瓦屯: 0.661,
    瓦百: 0.713, 克千: 0.758, 竜内: 0.733 }
  const src = source()
  for (const [pair, center] of Object.entries(centers)) {
    const { parts } = await compose(src, '⿺' + pair, { fontStyle: 'fangsong', separate: true })
    const boxes = parts.map(p => union(pathRings(p.d, 24).map(pointsBox)))
    const [left, , right] = union(boxes)
    // In 甅 the bottom bar of 厘 needs room beside the projecting Zhuque hook.
    if (pair === '瓦厘') {
      expect(Math.abs((boxes[1][0] - left) / (right - left) - 0.368)).toBeLessThan(0.020)
      expect(Math.abs((boxes[1][2] - left) / (right - left) - 0.946)).toBeLessThan(0.020)
    }
    const innerCenter = (boxes[1][0] + boxes[1][2]) / 2
    expect(Math.abs((innerCenter - left) / (right - left) - center), pair).toBeLessThan(0.012)
  }
})

it('preserves the five Fangsong 瓦 frames when fitting their contents', () => {
  // Canonical 1000-em frame outlines from 57b3a902.
  const frames = {
    千: 'd68524d1f69a4f88c6aea97bc52c0dcd9f75d2357ad9d47bf69e4b280a0391cf',
    厘: '97f0586d91f416cb174975d3a35963ca3c20df437ab420eb2f7dccbcc22aeb51',
    十: 'e0b99435f3aa7fd7b0043f58e081769d9ca3f556c20fe1f0fc6869789fe69b26',
    屯: '2ba83efd9e6724d6935ed1da4a6a61a9ba133092c192fd39aa79296c261a228b',
    百: 'c5d52a838419808f8e2d05b5b92a72f855fd7097d224f8556afdbb5df040b428',
  }
  const composer = { fontStyle: 'fangsong', excluded: () => false, glyphRecord: ch => donors[ch].G }
  for (const [inner, digest] of Object.entries(frames)) {
    const [frame] = brushSweepParts(composer, ['⿺', '瓦', inner], [0, -120, 1000, 880])
    expect(hexOf(svgPath([frame])), inner).toBe(digest)
  }
})

it('places the original tile fillings at their native aspect ratios', () => {
  const composer = { fontStyle: 'fangsong', excluded: () => false, glyphRecord: ch => donors[ch].G }
  for (const inner of '千厘十屯百') {
    for (const nested of [false, true]) {
      const [, body] = brushSweepParts(composer, ['⿺', '瓦', inner], [17, 25, 540, 760], nested)
      expect(body.part).toBe(partOf(donors[inner].G))
      const [sx, sy] = scaleOf(body)
      expect(sx).toBeCloseTo(sy, 10)
    }
  }
})
