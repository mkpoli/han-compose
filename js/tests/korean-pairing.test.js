import { expect, it } from 'bun:test'
import { Composer, designedSources } from '../src/compose.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { character, files, records, shards } from './fixtures/small-export.js'

const frameBoxes = [
  [80, -80, 920, -10],
  [80, 730, 920, 800],
  [80, -80, 150, 800],
  [850, -80, 920, 800],
]
const innerBox = [[320, 140, 680, 560]]
const hostGlyph = () => character('國', [...frameBoxes, ...innerBox])
const hostCut = (h, r) => ({
  h, r, op: '⿴', d: 0,
  c: { k: [0, 1, 2, 3], b: [80, -80, 920, 800], fr: [80, -80, 920, 800] },
})

function makeSource({ includeDo = true, hostList = [hostCut('國', 0), hostCut('圖', 1)] } = {}) {
  const extra = {
    囗: { ...character('囗', frameBoxes), P: ['⿴0'] },
    國: hostGlyph(),
    圖: hostGlyph(),
    ...(includeDo ? { 도: character('도', [[160, 120, 840, 220], [440, 220, 560, 420], [200, 460, 800, 720]]) } : {}),
  }
  const input = {
    ...files,
    ...shards('g', Object.entries({ ...records, ...extra })),
    ...shards('p', [['⿴0\t囗', hostList]]),
  }
  return createSource(async name => input[name] === undefined ? null : Uint8Array.from(Buffer.from(input[name])).buffer)
}

it('preloads 囗 enclosure donors for ⿴口도 and ⿴囗도 in all five faces', () => {
  for (const seq of [['⿴', '口', '도'], ['⿴', '囗', '도']]) {
    for (const style of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
      const donors = designedSources(seq, style)
      expect(donors).toEqual(expect.arrayContaining(['囗', '國', '圖', '園']))
    }
    expect(designedSources(seq, 'woodblock')).toEqual([])
  }
})

it('uses a proper 囗 host cut instead of standalone 口 across all five faces and keeps normal === separate', async () => {
  for (const style of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
    const src = makeSource({ includeDo: style !== 'regular' })
    const expectedInner = style === 'sans' || style === 'serif' ? 'glyph 도' : 'Gowun Batang 도'
    for (const seq of ['⿴口도', '⿴囗도']) {
      const normal = await compose(src, seq, { fontStyle: style })
      const separate = await compose(src, seq, { fontStyle: style, separate: true })
      expect(normal.d).toBe(separate.d)
      expect(normal.parts.map(p => p.origin)).toEqual(['host 國', expectedInner])
      expect(separate.parts.map(p => p.origin)).toEqual(['host 國', expectedInner])
      const [frame, inner] = normal.parts
      // Inner 도 stays well clear of all four walls of the 囗 frame.
      expect(inner.box[0]).toBeGreaterThan(frame.box[0] + 80)
      expect(inner.box[0] + inner.box[2]).toBeLessThan(frame.box[0] + frame.box[2] - 80)
      expect(inner.box[1]).toBeGreaterThan(frame.box[1] + 80)
      expect(inner.box[1] + inner.box[3]).toBeLessThan(frame.box[1] + frame.box[3] - 80)
      // Left and right clearance inside the symmetric test frame are balanced.
      const leftGap = inner.box[0] - frame.box[0]
      const rightGap = (frame.box[0] + frame.box[2]) - (inner.box[0] + inner.box[2])
      expect(Math.abs(leftGap - rightGap)).toBeLessThan(8)
    }
  }
})

it('honors donor exclusions by falling back to the next 囗 host or returning null when an operand is excluded', async () => {
  const src = makeSource({ includeDo: false })
  const withoutGuo = await compose(src, '⿴口도', { fontStyle: 'regular', exclude: ['國'] })
  expect(withoutGuo.parts.map(p => p.origin)).toEqual(['host 圖', 'Gowun Batang 도'])

  const withoutBothHosts = await compose(src, '⿴口도', { fontStyle: 'regular', exclude: ['國', '圖'] })
  expect(withoutBothHosts.parts.map(p => p.origin)).toEqual(['glyph 囗', 'Gowun Batang 도'])

  const withoutWei = await compose(src, '⿴口도', { fontStyle: 'regular', exclude: ['囗'] })
  expect(withoutWei.parts.map(p => p.origin)).toEqual(['glyph 口', 'Gowun Batang 도'])

  const store = src.store()
  await src.load(src.filesOf(['口', '囗', '國', '圖']))
  expect(new Composer(store, { fontStyle: 'regular', exclude: ['口'] }).koreanPair(['⿴', '口', '도'], [0, 0, 1000, 1000], true)).toBeNull()
  expect(new Composer(store, { fontStyle: 'regular', exclude: ['도'] }).koreanPair(['⿴', '口', '도'], [0, 0, 1000, 1000], true)).toBeNull()
})

it('matches sketch boxes to composed parts for ⿴口도 on first use', async () => {
  const src = makeSource({ includeDo: false })
  const options = { fontStyle: 'regular', separate: true }
  const boxes = await sketch(src, '⿴口도', options)
  const drawn = await compose(src, '⿴口도', options)
  expect(boxes.map(leaf => leaf.box)).toEqual(drawn.parts.map(part => part.box))
})

it('gives Serif generous interior fill and slants FangSong and Regular 도 upward to the right', async () => {
  const src = makeSource({ includeDo: true })
  const serif = await compose(src, '⿴口도', { fontStyle: 'serif' })
  const [serifFrame, serifInner] = serif.parts
  expect(serifInner.box[2] / serifFrame.box[2]).toBeGreaterThan(0.66)

  const avgEdgeSlope = d => {
    const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number)
    let sumW = 0, sumSlope = 0
    for (let i = 0; i + 3 < nums.length; i += 2) {
      let dx = nums[i + 2] - nums[i], dy = nums[i + 3] - nums[i + 1]
      const len = Math.hypot(dx, dy)
      if (len < 15 || Math.abs(dx) < Math.abs(dy) * 3) continue
      if (dx < 0) { dx = -dx; dy = -dy }
      // SVG y points down, so upward-right strokes have negative dy / dx.
      sumW += len
      sumSlope += (-dy / dx) * len
    }
    return sumSlope / sumW
  }
  const fangsong = await compose(src, '⿴口도', { fontStyle: 'fangsong' })
  const regular = await compose(src, '⿴口도', { fontStyle: 'regular' })
  const pen = await compose(src, '⿴口도', { fontStyle: 'pen-writing' })
  expect(avgEdgeSlope(fangsong.parts[1].d)).toBeGreaterThan(0.05)
  expect(avgEdgeSlope(regular.parts[1].d)).toBeGreaterThan(0.04)
  expect(avgEdgeSlope(pen.parts[1].d)).toBeGreaterThan(0.01)

  // With a slanted enclosing 囗 frame, FangSong and Regular solve the shear mathematically
  // so rendered 도 matches the frame's horizontal bar slope within 0.01.
  const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
  const targetSlope = 0.065
  const slantedBar = (l, b, r, t) => {
    const cx = (l + r) / 2
    return [
      l, Math.round(b + targetSlope * (l - cx)),
      r, Math.round(b + targetSlope * (r - cx)),
      r, Math.round(t + targetSlope * (r - cx)),
      l, Math.round(t + targetSlope * (l - cx)),
    ]
  }
  const rectPts = ([l, b, r, t]) => [l, b, r, b, r, t, l, t]
  const slantedContours = [
    slantedBar(80, -80, 920, -10),
    slantedBar(80, 730, 920, 800),
    rectPts([80, -80, 150, 800]),
    rectPts([850, -80, 920, 800]),
  ].map(pts => ['MLLL', int16(pts.map(v => v * 4)), int16(Array(8).fill(0))])
  const slantedWei = {
    G: { b: [80, -108, 920, 828], p: slantedContours, v: 1 },
    ink: 6000, nl: 4, o: 4, P: ['⿴0'],
  }
  const slantedInput = {
    ...files,
    ...shards('g', Object.entries({ ...records, 囗: slantedWei })),
    ...shards('p', [['⿴0\t囗', []]]),
  }
  const slantedSrc = createSource(async name => slantedInput[name] === undefined ? null : Uint8Array.from(Buffer.from(slantedInput[name])).buffer)
  for (const style of ['fangsong', 'regular']) {
    const drawn = await compose(slantedSrc, '⿴口도', { fontStyle: style })
    expect(Math.abs(avgEdgeSlope(drawn.parts[1].d) - targetSlope)).toBeLessThan(0.01)
  }
})
