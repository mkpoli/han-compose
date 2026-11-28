import { expect, test } from 'bun:test'
import { recognizeVariationOutline } from '../src/variation-outline.js'

const frame = 'fixture:1000-unit-em:y-down'
const top = 'M10 10L25 10 25 18 10 18Z'
const lower = 'M10 40Q20 35 29 45L26 50 10 47Z'
const observation = { frame, d: top + lower }
const near = { form:'one', source:'fixture:a', ...observation }
const wider = { form:'two', source:'fixture:b', frame, d:top + lower.replace('40','43') }

test('fixed-frame geometry distinguishes gaps and retains all candidates within the tolerance', () => {
  expect(recognizeVariationOutline(observation, [near, wider])).toEqual({
    status:'matched', candidates:[{form:'one', source:'fixture:a', distance:0}],
  })
  expect(recognizeVariationOutline(observation, [wider], {tolerance:2}).status).toBe('unknown')
  expect(recognizeVariationOutline(observation, [wider, near], {tolerance:3}).candidates.map(c => c.distance)).toEqual([0,3])
  expect(recognizeVariationOutline(observation, [near, {...near, source:'fixture:second witness'}]).status).toBe('ambiguous')
})

test('contour order, cyclic start and an explicit closing line preserve a drawing', () => {
  const reordered = 'M29 45L26 50 10 47 10 40Q20 35 29 45Z' + 'M25 18L10 18 10 10 25 10Z'
  expect(recognizeVariationOutline({frame, d:reordered}, [near]).status).toBe('matched')
  expect(recognizeVariationOutline({frame, d:top + top}, [near]).status).toBe('unknown')
  expect(() => recognizeVariationOutline({frame, d:top.toLowerCase()}, [near])).toThrow()
})

test('explicit affine maps carry geometry into the common coordinate frame', () => {
  const shifted = {...observation, matrix:[1,0,0,1,3,4]}
  expect(recognizeVariationOutline(shifted, [near]).status).toBe('unknown')
  expect(recognizeVariationOutline(shifted, [near], {tolerance:5}).candidates[0].distance).toBe(5)
  expect(recognizeVariationOutline(shifted, [{...near,matrix:[1,0,0,1,3,4]}]).status).toBe('matched')
  expect(() => recognizeVariationOutline(observation, [{...near,frame:'other'}])).toThrow('frames')
})

test('malformed or unrepresentable geometry fails explicitly', () => {
  for (const d of ['', 'M0 0L2', 'M0 0L1 1', 'M0 0Z', 'M0 0A3 3 0 0 0 2 2Z', 'M0 0L1e999 3Z']) {
    expect(() => recognizeVariationOutline({frame, d}, [near])).toThrow()
  }
  expect(() => recognizeVariationOutline({...observation,transform:'scale(2)'}, [near])).toThrow('matrix')
  expect(() => recognizeVariationOutline({...observation,matrix:[0,0,0,0,0,0]}, [near])).toThrow('matrix')
  expect(() => recognizeVariationOutline(observation, [near], {tolerance:NaN})).toThrow('tolerance')
})
