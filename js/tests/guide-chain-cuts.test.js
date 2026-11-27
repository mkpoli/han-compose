import { expect, it } from 'bun:test'
import { angContextDonors, angContextParts, guideChainDonor, guideChainParts } from '../src/guide-chain-cuts.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, shards } from './fixtures/small-export.js'
import { fill, partOf, pathMask, rings } from '../src/geometry.js'
// Noto Sans CJK JP 2.004 and Kureedo Full 0.5.0 (both SIL OFL 1.1).
import records from './fixtures/guide-chain-cuts.json' with { type: 'json' }

const face = [0, -120, 1000, 880]
const angle = '#(丿𠄌)'
const frame = '#(-𠃌𠃊x0)'
const composer = (style, excluded = []) => ({
  C: { face },
  excluded: key => excluded.includes(key),
  glyphRecord: key => records[style][key],
})

const inkAt = (part, x, y) => fill(
  rings(part.contours, part.contours.map(c => c.light)),
  1,
  [x - 0.5, y - 0.5, x + 0.5, y + 0.5],
)[0]

it('restores the standalone guide proportions to the side form from 卬', () => {
  expect(guideChainDonor(angle)).toBe('卬')
  const source = composer('sans')
  const [part] = guideChainParts(source, angle, face, true)
  expect(part.origin).toContain('cut from 卬')
  expect(part.part.contours).toEqual([0, 2, 4].map(i => partOf(records.sans.卬).contours[i]))
  expect(part.target).toEqual([133, -59, 882, 825])
  const region = [230, 340, 400, 690]
  expect(guideChainParts(source, angle, region)[0].target).toEqual(region)
})

it('opens the centre of 母 and keeps its outer wall in separated and joined faces', () => {
  expect(guideChainDonor(frame)).toBe('母')
  for (const [style, leftWall] of [['sans', 230], ['pen-writing', 245]]) {
    const [result] = guideChainParts(composer(style), frame, face, true)
    expect(result.origin).toContain('cut from 母')
    expect(inkAt(partOf(records[style].母), 500, 440)).toBe(1)
    expect(inkAt(result.part, 500, 440)).toBe(0)
    expect(inkAt(result.part, leftWall, 440)).toBe(1)
  }
})

it('respects exclusions and refuses unverified donor contours', () => {
  for (const key of [frame, '母', '𠃌', '𠃊']) {
    expect(guideChainParts(composer('sans', [key]), frame, face)).toBeNull()
  }
  const donor = records.sans.母
  const changed = { ...composer('sans'), glyphRecord: () => ({ ...donor, p: donor.p.slice(1) }) }
  expect(guideChainParts(changed, frame, face)).toBeNull()
  expect(guideChainParts(composer('sans'), '#(一丨)', face)).toBeNull()
})

it('draws and edits both Yi Bai spellings of 卬 in their native 仰 positions', async () => {
  for (const fontStyle of ['sans', 'pen-writing']) {
    const entries = Object.entries(records[fontStyle]).map(([ch, G]) => [ch, { G }])
    const input = { ...files, ...shards('g', entries) }
    const source = createSource(async name => input[name] ? Uint8Array.from(Buffer.from(input[name])).buffer : null)
    const samples = [['⿰亻卬', '仰', ['亻', '卬']]]
    for (const left of ['#(丿𠃊)', '#(丿𠄌)', '#(丿𠃊>)', '#(丿𠄌>)']) {
      const pair = `⿰${left}卩`
      samples.push([pair, '卬', [left, '卩']], ['⿰亻' + pair, '仰', ['亻', left, '卩']])
    }
    for (const [ids, host, leaves] of samples) {
      const normal = await compose(source, ids, { fontStyle })
      const separate = await compose(source, ids, { fontStyle, separate: true })
      const layout = await sketch(source, ids, { fontStyle })
      const native = await compose(source, host, { fontStyle })
      expect(normal.d).toBe(native.d)
      expect(separate.parts.map(p => p.origin)).toEqual(leaves.map(leaf => `${leaf} from ${host}`))
      expect(separate.parts.map(p => p.leaf)).toEqual(layout.map(box => box.index))
      expect(pathMask(separate.d, 180)).toEqual(pathMask(native.d, 180))
    }
  }
})

it('honors exclusions throughout the attested 卬 spelling and requires the identified native host', () => {
  const modern = '⿰#(丿𠃊)卩', historic = '⿰#(丿𠃊>)卩', full = '⿰亻' + historic
  expect(angContextDonors('⿰#(丿𠃊)木')).toEqual([])
  expect(angContextDonors('#(丿𠃊)')).toEqual([])
  for (const blocked of ['仰', '卬', '亻', '卩', '丿', '𠃊', '#(丿𠃊)', '#(丿𠃊>)', modern, historic,
    '⿰亻卬', '⿰亻' + modern, full]) {
    expect(angContextParts(composer('sans', [blocked]), full, face)).toBeNull()
  }
  for (const blocked of ['仰', '亻', '卬', '⿰亻卬']) {
    expect(angContextParts(composer('sans', [blocked]), '⿰亻卬', face)).toBeNull()
  }
  const changed = { ...composer('sans'), glyphRecord: () => ({ ...records.sans.卬, p: [] }) }
  expect(angContextParts(changed, modern, face)).toBeNull()
})
