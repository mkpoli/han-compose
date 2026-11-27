import { expect, it } from 'bun:test'
import { componentFix } from 'han-compose/component-fixes'
import { cutContours, groupRings, partOf, placed, pointsBox, union } from 'han-compose/geometry'
// Native Kureedo Pen records, export b53713c2da0e-kaisho-compose-layout-v4-kaisho-f7+kin.
import records from './fixtures/grass-ku.json'

const glyph = ch => partOf(records[ch])
const context = { fontStyle: 'pen-writing', glyphRecord: ch => records[ch], glyph, excluded: () => false }
const bounds = parts => union(groupRings(parts, 24).map(pointsBox))
const head = cutContours(glyph('䓛'), [2]), body = glyph('堀')
const old = [placed(head, head.box, [100, 520, 890, 820], 1, 'learned 蔎'),
  placed(body, body.box, [60, -60, 890, 550], 1, 'glyph 堀')]

it('keeps the native grass-to-屈 clearance, both selectable operands and the final ink frame', () => {
  const drawing = componentFix('⿱艹堀', old, context)
  // A parent can position and weight the operands after the composition rule is chosen.
  drawing[1].target = [72, -45, 895, 573]
  drawing[1].weight = [-0.15, -0.34]
  const previous = bounds(drawing)
  for (const p of drawing) Object.assign(p, p.finishOutline(p, drawing))
  expect(drawing.map(p => p.origin)).toEqual(['艹 from 䓛', '堀 from 䕋 and 䓛'])
  bounds(drawing).forEach((edge, i) => expect(edge).toBeCloseTo(previous[i], 6))
  expect(drawing[1].part.contours).toHaveLength(4)
  expect(drawing[1].part.strokes).toEqual(body.strokes)
  const qu = glyph('䓛'), quHead = cutContours(qu, [2]), quBody = cutContours(qu, [0, 1, 3])
  const gap = (upper, lower) => (bounds([upper])[1] - bounds([lower])[3]) /
    (bounds([upper, lower])[3] - bounds([upper, lower])[1])
  expect(gap(...drawing)).toBeCloseTo(gap(placed(quHead, quHead.box, quHead.box, 0, ''),
    placed(quBody, quBody.box, quBody.box, 0, '')), 6)
})

it('keeps fallback and excluded sources, other faces, and flipped or cut operands on their original path', () => {
  for (const ctx of [{ ...context, partial: true }, { ...context, fontStyle: 'regular' },
    ...['艹', '堀', '䓛', '䕋'].map(char => ({ ...context, excluded: ch => ch === char })), { ...context, glyphRecord: () => null }])
    expect(componentFix('⿱艹堀', old, ctx)).toBe(old)
  for (const flag of [{ flips: [{ x: true, about: [500, 500] }] }, { cut: true }]) {
    const drawing = componentFix('⿱艹堀', old, context)
    Object.assign(drawing[0], flag)
    expect(drawing[1].finishOutline(drawing[1], drawing)).toBe(drawing[1])
    expect(drawing[0].part).toBe(head)
  }
})
