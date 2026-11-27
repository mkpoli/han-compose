import { expect, test } from 'bun:test'
import { hostChainParts } from '../src/host-chain.js'
import { partOf, pathMask, pointsBox, svgPath } from '../src/geometry.js'
import { compose, createSource } from '../src/loader.js'
import { files, shards } from './fixtures/small-export.js'
// Format-7 Noto Sans CJK and Zhuque FangSong outlines from the primary exports.
import records from './fixtures/chain-component-donors.json' with { type: 'json' }

test('preserves the thickness of the flat foot of 乐 in both standalone proportions', () => {
  const face = [0, -120, 1000, 880], record = records.sans.乐
  const composer = { fontStyle: 'sans', C: { face }, data: { manifest: { composer: { commit: 'a83fc941166b' } } },
    excluded: () => false, glyphRecord: ch => ch === '乐' ? record : null }
  const key = '#(丿𠃊)', foot = pointsBox(partOf(record).contours[5].light)
  const widths = []
  for (const written of [key, '#(丿𠃊>)']) {
    const [frame] = hostChainParts(composer, key, face, true, written)
    const bar = pointsBox(frame.part.contours[2].light)
    const yScale = (frame.target[3] - frame.target[1]) / (frame.source[3] - frame.source[1])
    expect((bar[3] - bar[1]) * yScale).toBeCloseTo(foot[3] - foot[1], 1)
    widths.push(frame.target[2] - frame.target[0])
  }
  expect(widths[0]).toBeLessThan(widths[1] * 0.6)
})

test('draws both spellings of three missing FangSong components as editable native outlines', async () => {
  const input = { ...files, ...shards('g', Object.entries(records.fangsong).map(([ch, G]) => [ch, { G }])) }
  const source = createSource(async key => input[key] ? Uint8Array.from(Buffer.from(input[key])).buffer : null)
  for (const [component, host, current, historical, count] of [
    ['㠯', '官', '#(一-𠃍丨b一-𠃍)', '#(丨𠃍一𠃍一^v,0>4,3v4)', 3],
    ['㔾', '氾', '#(-𠃌乚)', '#(𠃌乚^)', 1],
    ['⺆', '周', '#(-丿𠃌)', '#(丿𠃌^)', 1],
  ]) {
    for (const key of [current, historical]) {
      const normal = await compose(source, key, { fontStyle: 'fangsong' })
      const editable = await compose(source, key, { fontStyle: 'fangsong', separate: true })
      expect(normal.origins).toEqual([`chain ${current}, cut from ${host}`])
      expect(editable.d).toBe(normal.d)
      expect(editable.parts).toHaveLength(1)
      expect(normal.d.match(/M/g)).toHaveLength(count)
    }
    const mock = { fontStyle: 'fangsong', glyphRecord: () => records.fangsong[host] }
    for (const blocked of [component, host]) {
      expect(hostChainParts({ ...mock, excluded: ch => ch === blocked }, current, [0, 0, 1000, 1000], false)).toBeNull()
    }
  }
})

test('keeps the FangSong stems at native weight when standalone components fill their recorded boxes', () => {
  const face = [0, -120, 1000, 880]
  const composer = { fontStyle: 'fangsong', C: { face }, data: { manifest: { composer: { commit: '9f797e2322d2' } } },
    glyphRecord: ch => records.fangsong[ch], excluded: ch => ch === '木', exclude: new Set(['木']) }
  for (const key of ['#(一-𠃍丨b一-𠃍)', '#(-𠃌乚)']) {
    const parts = hostChainParts(composer, key, face, true)
    const mask = pathMask(svgPath(parts), 500)
    // The row through the upper opening crosses the left stem and the right fold.
    const bands = Array.from(mask.slice(140 * 500, 141 * 500)).join('').match(/1+/g)
    expect(bands).toHaveLength(2)
    for (const band of bands) {
      expect(band.length).toBeGreaterThanOrEqual(27)
      expect(band.length).toBeLessThanOrEqual(31)
    }
  }
})
