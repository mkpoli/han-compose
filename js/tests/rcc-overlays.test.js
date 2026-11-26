import { expect, it } from 'bun:test'
import { makePart } from '../src/geometry.js'
import { overlayContextDonors, overlayContextParts } from '../src/rcc-overlays.js'

const steps = '⿻[x_]#(㇄-𠃑)𠃊'
const em = [0, 0, 1000, 1000]
const contour = Float64Array.of(0, 0, 100, 0, 100, 100, 0, 100)
const native = makePart([{ ops: [...'MLLL'].map(op => [op, 1, false]), light: contour, heavy: contour }])
const composer = { fontStyle: 'sans', stem0: [[80, 140], [80, 140]], excluded: () => false, chainStroke: () => native, drawnGlyph: () => native }

it('places the surname headword’s crossbar through the middle upright', () => {
  const [high, step, center] = overlayContextParts(composer, steps, em)
  expect([high, step, center].map(p => p.rccLeaf)).toEqual([0, 0, 1])
  expect(high.target[0]).toBeLessThan(center.target[0])
  expect(high.target[2]).toBeGreaterThan(step.target[0])
  expect(high.target[1]).toBeGreaterThan(center.target[1] + 500)
  expect(step.target[1]).toBeCloseTo(center.target[1], 0)
})

it('checks the exact spelling and every excluded donor before drawing', () => {
  expect(overlayContextDonors('⿻#(㇄-𠃑)𠃊', 'sans')).toEqual([])
  for (const excluded of [steps, '#(㇄-𠃑)', '𠃊', '㇄', '𠃑']) {
    expect(overlayContextParts({ ...composer, excluded: k => k === excluded }, steps, em)).toBeNull()
  }
  const nine = '⿺九⿸⿻干#(-乛丿)亚'
  expect(overlayContextDonors(nine, 'serif')).toContain('亚')
  expect(overlayContextParts({ ...composer, excluded: k => k === '亚' }, nine, em)).toBeNull()
  expect(overlayContextParts({ ...composer, chainStroke: () => null }, steps, em)).toBeNull()
})
