// A three-band stack's middle band, when it is an enclosed box such as 口 or 日, and the bands a
// stack over a compound foot takes from the dictionary glyph 羔 over 口 over 𦉪十.
import { expect, it } from 'bun:test'
import { narrowMiddleBand, stackBands } from '../src/compose.js'
import { makePart, placed } from '../src/geometry.js'

const rect = ([x0, y0, x1, y1]) => {
  const light = Float64Array.from([x0, y0, x1, y0, x1, y1, x0, y1])
  return { ops: [{ code: 'M' }, { code: 'L' }, { code: 'L' }, { code: 'L' }], light, heavy: light.slice(), width: null }
}
/** A placed rectangle: its own `natural` box drawn into `box`. */
const part = (natural, box = natural) => placed(makePart([rect(natural)], natural.slice()), natural, box, 0, 'glyph x')
const width = p => p.target[2] - p.target[0]

it('narrows an enclosed middle band to the region’s share, and leaves a middle that is not one alone', () => {
  const region = [50, -80, 950, 840]
  const top = part([50, 700, 950, 840])
  const middle = part([150, 300, 850, 600])
  narrowMiddleBand('口', [[top], [middle]], region)
  expect(width(middle)).toBeCloseTo(0.72 * (region[2] - region[0]), 6)
  expect((middle.target[0] + middle.target[2]) / 2).toBeCloseTo((region[0] + region[2]) / 2, 6)
  const open = part([150, 300, 850, 600])
  narrowMiddleBand('木', [[top], [open]], region)
  expect(open.target).toEqual([150, 300, 850, 600])
})

it('sets a stack over a compound foot to the dictionary’s bands', () => {
  const region = [50, -80, 950, 840]
  const { top, mouth, foot } = stackBands(region)
  const height = region[3] - region[1]
  expect(top[3] - top[1]).toBeCloseTo(0.38 * height, 6)
  expect(mouth[3] - mouth[1]).toBeCloseTo(0.15 * height, 6)
  expect(mouth[1]).toBeCloseTo(region[1] + 0.47 * height, 6)
  expect(foot[3] - foot[1]).toBeCloseTo(0.43 * height, 6)
  expect(top[3]).toBeCloseTo(region[3], 6)
  expect(foot[1]).toBeCloseTo(region[1], 6)
  expect(width({ target: top })).toBeCloseTo(0.64 * (region[2] - region[0]), 6)
  expect(width({ target: mouth })).toBeCloseTo(0.30 * (region[2] - region[0]), 6)
  expect(width({ target: foot })).toBeCloseTo(0.64 * (region[2] - region[0]), 6)
  // The mouth meets the top band and clears the foot.
  expect(top[1]).toBeGreaterThanOrEqual(mouth[3])
  expect(mouth[1]).toBeGreaterThanOrEqual(foot[3])
})
