import { expect, it } from 'bun:test'
import { componentFix } from '../src/component-fixes.js'
import { groupRings, partOf, placed, pointsBox, union } from '../src/geometry.js'
import { character } from './fixtures/small-export.js'

it('draws the full 水 of R+02BE in place of a three-dot host cut', () => {
  const dots = partOf(character('氵', [[0, 0, 40, 80], [30, 160, 70, 200], [60, 270, 100, 310]]).G)
  const water = partOf(character('水', [[120, 0, 150, 310], [0, 80, 100, 130], [200, 80, 260, 135]]).G)
  const left = placed(dots, dots.box, [0, 0, 360, 810], 1, 'learned 沼')
  const right = placed(water, water.box, [400, 25, 915, 840], 1, 'learned 絎')
  const original = [left, right]
  const composer = { fontStyle: 'fangsong', glyph: () => water, ink: () => 1, excluded: () => false }
  const result = componentFix('⿰水行', original, composer)
  expect(result[0].part).toBe(water)
  expect(result[1].part).toBe(right.part)
  const bounds = parts => union(groupRings(parts, 24).map(pointsBox))
  expect(bounds(result)).toEqual(bounds(original))
  expect(componentFix('⿰氵行', original, composer)).toBe(original)
  expect(componentFix('⿰水行', original, { ...composer, excluded: ch => ch === '水' })).toBe(original)
})
