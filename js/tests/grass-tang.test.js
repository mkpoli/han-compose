import { expect, it } from 'bun:test'
import { cutContours, fill, groupRings, partOf, placed, pointsBox, union } from '../src/geometry.js'
import { finishGrassTang, penGrassTang } from '../src/grass-tang.js'
import records from './fixtures/grass-tang.json'

const glyph = c => partOf(records[c])
const face = { glyph, glyphRecord: c => records[c], excluded: () => false, fontStyle: 'pen-writing', separate: true }
const source = glyph('䕋')
const whole = () => placed(source, source.box, [50, 30, 480, 750], 0, 'glyph 䕋')
const bounds = rings => union(rings.map(pointsBox))

it('attaches the dot to 塘, clears 艹, and preserves the four placed edges', () => {
  const prior = whole()
  const [head, body] = penGrassTang([prior], face, '⿱艹塘')
  expect(body.part.contours.slice(0, 6)).toEqual(source.contours.slice(0, 6))
  const rings = groupRings([body], 24), cap = groupRings([head], 24)
  const mask = paths => fill(paths, 500, [0, 0, 500, 800])
  const dot = mask(rings.slice(-1)), roof = mask(rings.slice(0, -1)), grass = mask(cap)
  expect(dot.some((ink, i) => ink && roof[i])).toBe(true)
  expect(dot.some((ink, i) => ink && grass[i])).toBe(false)
  const before = bounds(groupRings([prior], 24))
  bounds([...cap, ...rings]).forEach((edge, i) => expect(edge).toBeCloseTo(before[i], 6))
})

it('changes a complete placed glyph while respecting other faces, exclusions, and partial donor cuts', () => {
  const part = whole()
  finishGrassTang(part, face)
  expect(part.origin).toBe('䕋 with 唐 dot from 蓎')
  for (const override of [{ fontStyle: 'serif' }, { excluded: c => c === '蓎' }, { partial: true },
    { glyphRecord: c => ({ ...records[c], v: 0 }) }]) {
    const part = whole()
    finishGrassTang(part, { ...face, ...override })
    expect(part.part).toBe(source)
  }
  const cut = { ...whole(), part: cutContours(source, [0]) }
  finishGrassTang(cut, face)
  expect(cut.part.contours).toHaveLength(1)
})
