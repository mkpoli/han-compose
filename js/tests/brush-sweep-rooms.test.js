import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { partOf, pathMask, pathRings, pointsBox, scaleOf, svgPath, union } from '../src/geometry.js'
import { hexOf } from '../src/sha256.js'
import { brushSweepParts } from '../src/brush-sweep-rooms.js'
import { files, shards } from './fixtures/small-export.js'
// Zhuque Fangsong 0.212, TrionesType, SIL OFL 1.1.
import donors from './fixtures/brush-sweep-fangsong.json' with { type: 'json' }
import hosts from './fixtures/fangsong-tile-hosts.json' with { type: 'json' }

const sources = { ...donors, ...hosts }
const tileHosts = { 千: '仟', 厘: '糎', 十: '叶', 屯: '沌', 百: '栢' }
const input = { ...files, ...shards('g', Object.entries(sources)) }
const source = () => createSource(async k => input[k] === undefined ? null : new Uint8Array(Buffer.from(input[k])).buffer)

it('draws the eight brush enclosures from their own face in both editable layouts', async () => {
  for (const layout of ['composed', 'cells']) {
    const src = source(), options = { layout, separate: true, fontStyle: 'fangsong' }
    for (const pair of ['瓦千', '瓦厘', '瓦十', '瓦屯', '瓦百', '巴三', '竜内', '克千']) {
      const ids = '⿺' + pair
      const { parts } = await compose(src, ids, options)
      expect(parts).toHaveLength(2)
      const [frame, inner] = [...pair]
      expect(parts.map(p => p.origin)).toEqual([
        'glyph ' + frame, frame === '瓦' ? inner + ' from ' + tileHosts[inner] : 'glyph ' + inner,
      ])
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
    if (pair.startsWith('瓦')) {
      const [frame, filling] = parts.map(p => pathMask(p.d, 256))
      expect(filling.some((ink, i) => ink && frame[i]), pair).toBe(false)
    }
    const boxes = parts.map(p => union(pathRings(p.d, 24).map(pointsBox)))
    const [left, bottom, right, top] = union(boxes)
    if (pair.startsWith('瓦')) {
      const innerHeight = boxes[1][3] - boxes[1][1]
      expect(innerHeight / (top - bottom), pair).toBeGreaterThan(0.75)
    }
    // In 甅 the bottom bar of 厘 needs room beside the projecting Zhuque hook.
    if (pair === '瓦厘') {
      expect(Math.abs((boxes[1][0] - left) / (right - left) - 0.368)).toBeLessThan(0.020)
      expect(Math.abs((boxes[1][2] - left) / (right - left) - 0.946)).toBeLessThan(0.020)
    }
    const innerCenter = (boxes[1][0] + boxes[1][2]) / 2
    expect(Math.abs((innerCenter - left) / (right - left) - center), pair).toBeLessThan(0.012)
  }
})

it('draws one 瓦 frame with uniformly scaled native right-hand fillings', () => {
  const composer = { fontStyle: 'fangsong', excluded: () => false, glyphRecord: ch => sources[ch]?.G }
  // The complete fixed 甅 frame from the preceding revision.
  const digest = '97f0586d91f416cb174975d3a35963ca3c20df437ab420eb2f7dccbcc22aeb51'
  for (const [inner, host] of Object.entries(tileHosts)) {
    const record = hosts[host].G
    const tree = ['⿺', '瓦', inner]
    const [frame] = brushSweepParts(composer, tree, [0, -120, 1000, 880])
    expect(hexOf(svgPath([frame])), inner).toBe(digest)
    for (const nested of [false, true]) {
      const [, body] = brushSweepParts(composer, tree, [17, 25, 540, 760], nested)
      const contours = record.ls[inner].map(i => partOf(record).contours[i])
      expect(body.part.contours).toHaveLength(contours.length)
      contours.forEach((contour, i) => expect(body.part.contours[i]).toBe(contour))
      const [sx, sy] = scaleOf(body)
      expect(sx).toBeCloseTo(sy, 10)
    }
    const [, fallback] = brushSweepParts({ ...composer, excluded: ch => ch === host }, tree, [0, -120, 1000, 880])
    expect(fallback.part).toBe(partOf(donors[inner].G))
  }
})

it('uses the standalone 厘 when the 糎 donor cannot be separated', () => {
  for (const host of [undefined, { ...hosts.糎.G, ls: { 米: [0, 1], 厘: [0, 2, 3, 4, 5, 6] } }]) {
    const composer = { fontStyle: 'fangsong', excluded: () => false,
      glyphRecord: ch => ch === '糎' ? host : donors[ch]?.G }
    const [, body] = brushSweepParts(composer, ['⿺', '瓦', '厘'], [0, -120, 1000, 880])
    expect(body.part).toBe(partOf(donors.厘.G))
  }
})
