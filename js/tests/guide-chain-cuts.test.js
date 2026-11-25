import { expect, it } from 'bun:test'
import { guideChainDonor, guideChainParts } from '../src/guide-chain-cuts.js'
import { fill, partOf, rings } from '../src/geometry.js'
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

it('centres the native 卬 cut while keeping its size and baseline', () => {
  expect(guideChainDonor(angle)).toBe('卬')
  const source = composer('sans')
  const [part] = guideChainParts(source, angle, face, true)
  expect(part.origin).toContain('cut from 卬')
  expect(part.part.contours).toEqual([0, 2, 4].map(i => partOf(records.sans.卬).contours[i]))
  expect(part.target[0] + part.target[2]).toBe(1000)
  expect(part.target[2] - part.target[0]).toBe(part.source[2] - part.source[0])
  expect([part.target[1], part.target[3]]).toEqual([part.source[1], part.source[3]])
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
