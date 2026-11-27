import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { partOf, pathMask, pathRings, pointsBox, scaleOf, svgPath, union } from '../src/geometry.js'
import { hexOf } from '../src/sha256.js'
import { brushSweepParts } from '../src/brush-sweep-rooms.js'
import { files, shards } from './fixtures/small-export.js'
// Zhuque Fangsong 0.212, TrionesType, SIL OFL 1.1.
import donors from './fixtures/brush-sweep-fangsong.json' with { type: 'json' }
// Zhuque Fangsong 0.212 (SIL OFL 1.1) with KanjiVG (CC BY-SA 3.0) contour labels.
import hosts from './fixtures/fangsong-tile-hosts.json' with { type: 'json' }

const sources = { ...donors, ...hosts }
const tileHosts = { 千: '仟', 厘: '糎', 十: '什', 屯: '沌', 百: '栢' }
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
  // Centers relative to whole-glyph ink width in ZhongYi FangSong for 厘、屯、
  // 百、克千. The 竜内 target comes from Jigmo because Zhuque Fangsong lacks
  // the U+25A9E glyph. 瓦千 and 瓦十 are tested against the shared 瓦 opening below.
  const centers = { 瓦厘: 0.657, 瓦屯: 0.661, 瓦百: 0.713, 克千: 0.758, 竜内: 0.733 }
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

it('uses the standalone 厘 when the 糎 donor cannot be separated or changes outline', () => {
  const altered = { ...hosts.糎.G, p: [...hosts.糎.G.p].reverse() }
  for (const host of [undefined, altered, { ...hosts.糎.G, ls: { 米: [0, 1], 厘: [0, 2, 3, 4, 5, 6] } }]) {
    const composer = { fontStyle: 'fangsong', excluded: () => false,
      glyphRecord: ch => ch === '糎' ? host : donors[ch]?.G }
    const [, body] = brushSweepParts(composer, ['⿺', '瓦', '厘'], [0, -120, 1000, 880])
    expect(body.part).toBe(partOf(donors.厘.G))
    expect(body.part.kv).toBeUndefined()
  }
})

function tileOpening(framePath) {
  const wallXs = [], hookXs = []
  for (const ring of pathRings(framePath, 32)) {
    for (let i = 0; i < ring.length; i += 2) {
      const x = ring[i], y = ring[i + 1]
      if (y >= 100 && y <= 600 && x < 550) wallXs.push(x)
      if (y >= 100 && y <= 400 && x > 700) hookXs.push(x)
    }
  }
  const innerWall = Math.max(...wallXs), rightHook = Math.min(...hookXs)
  return { innerWall, rightHook, midpoint: (innerWall + rightHook) / 2 }
}

it('reports KanjiVG attribution on host cuts and clears the shared frame on standalone fallback', async () => {
  const centers = { 厘: 0.657, 屯: 0.661, 百: 0.713 }
  const src = source()
  for (const inner of Object.keys(tileHosts)) {
    const withHost = await compose(src, '⿺瓦' + inner, { fontStyle: 'fangsong', separate: true })
    expect(withHost.kanjivg, inner).toBe(true)

    const fallback = await compose(src, '⿺瓦' + inner, {
      fontStyle: 'fangsong', separate: true, exclude: [tileHosts[inner]],
    })
    expect(fallback.kanjivg, inner).toBe(false)
    expect(fallback.parts.map(p => p.origin)).toEqual(['glyph 瓦', 'glyph ' + inner])
    const [frame, filling] = fallback.parts.map(p => pathMask(p.d, 256))
    expect(filling.some((ink, i) => ink && frame[i]), inner).toBe(false)
    const boxes = fallback.parts.map(p => union(pathRings(p.d, 24).map(pointsBox)))
    const [left, , right] = union(boxes)
    const innerCenter = (boxes[1][0] + boxes[1][2]) / 2
    if (inner === '千' || inner === '十') {
      const opening = tileOpening(fallback.parts[0].d)
      expect(Math.abs(innerCenter - opening.midpoint), inner).toBeLessThan(25)
      expect(boxes[1][0], inner).toBeGreaterThan(opening.innerWall)
      expect(boxes[1][2], inner).toBeLessThan(opening.rightHook)
    } else {
      expect(Math.abs((innerCenter - left) / (right - left) - centers[inner]), inner).toBeLessThan(0.012)
    }
  }
})

it('centers the vertical stems of 千 and 十 inside the 瓦 opening', async () => {
  const src = source()
  for (const inner of ['千', '十']) {
    const { parts } = await compose(src, '⿺瓦' + inner, { fontStyle: 'fangsong', separate: true })
    const [frameMask, fillMask] = parts.map(p => pathMask(p.d, 256))
    expect(fillMask.some((ink, i) => ink && frameMask[i]), inner).toBe(false)
    const opening = tileOpening(parts[0].d)
    const boxes = parts.map(p => union(pathRings(p.d, 32).map(pointsBox)))
    const [, bottom, , top] = union(boxes)
    const [x0, y0, x1, y1] = boxes[1]
    const h = y1 - y0
    expect(h / (top - bottom), inner).toBeGreaterThan(0.75)
    const stemXs = []
    for (const ring of pathRings(parts[1].d, 32)) {
      for (let i = 0; i < ring.length; i += 2) {
        if (ring[i + 1] >= y0 + 0.12 * h && ring[i + 1] <= y0 + 0.35 * h) stemXs.push(ring[i])
      }
    }
    const stemMid = (Math.min(...stemXs) + Math.max(...stemXs)) / 2
    if (inner === '十') expect(Math.abs((stemMid - x0) / (x1 - x0) - 0.5)).toBeLessThan(0.02)
    expect(Math.abs(stemMid - opening.midpoint), inner).toBeLessThan(20)
    expect(x0, inner).toBeGreaterThan(opening.innerWall)
    expect(x1, inner).toBeLessThan(opening.rightHook)
  }
})
