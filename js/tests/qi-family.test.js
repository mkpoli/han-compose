import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { pathRings, pointsBox, union } from '../src/geometry.js'
import { character, files, shardOf, shards } from './fixtures/small-export.js'

const mouth = x => [[x, 100, x + 360, 160], [x, 640, x + 360, 700],
  [x, 160, x + 60, 640], [x + 300, 160, x + 360, 640]]
const body = [[90, 440, 910, 510], [440, 110, 500, 700]]
const records = {
  吅: character('吅', [...mouth(60), ...mouth(580)]),
  犬: character('犬', [...body, [620, 590, 750, 665]]),
  太: character('太', [...body, [560, 130, 700, 210]]),
  大: character('大', body),
  半: character('半', [[240, 570, 360, 720], [650, 570, 780, 720], [450, 50, 520, 800]]),
  丨: character('丨', [[480, 0, 535, 780]]),
  '𫩏': character('𫩏', [...mouth(180), [345, 160, 400, 640]]),
}
const assets = { ...files, ...shards('g', Object.entries(records)) }
const source = (reads = []) => createSource(async name => {
  reads.push(name)
  return assets[name] === undefined ? null : new Uint8Array(Buffer.from(assets[name])).buffer
})
const ink = d => union(pathRings(d, 16).map(pointsBox))
const variants = ['⿳吅犬𫩏', '⿳吅太吅', '⿳吅𡗜吅', '⿳吅大𫩏', '⿳𫩏犬吅', '⿳𫩏大吅']

it('preserves the three written operands of every four-mouth variant', async () => {
  const src = source()
  for (const ids of variants) {
    const whole = await compose(src, ids)
    for (const layout of ['composed', 'cells']) {
      const edited = await compose(src, ids, { separate: true, layout })
      expect(edited.parts.map(p => p.origin)).toEqual([...ids].slice(1).map(ch => ch + ' in 器'))
      expect(edited.d).toEqual(whole.d)
    }
  }
})

it('draws the missing 𡗜 within the reference footprint, with a stroke on each side of 大', async () => {
  const src = source(), reference = await compose(src, '⿳吅犬吅')
  const result = await compose(src, '⿳吅𡗜吅')
  expect(ink(result.d)).toEqual(ink(reference.d))
  expect(pathRings(result.parts[1].d)).toHaveLength(4)
  const boxes = await sketch(source(), '⿳吅𡗜吅')
  expect(boxes.map(p => p.box)).toEqual(result.parts.map(p => p.box))
})

it('retains the ordinary ink bounds when the left and right mouths become one frame', async () => {
  const src = source(), ids = '⿳吅犬𫩏'
  const ordinary = await compose(src, ids, { exclude: ['丨'] })
  const result = await compose(src, ids)
  const reads = []
  expect((await sketch(source(reads), ids)).map(p => p.box)).toEqual(result.parts.map(p => p.box))
  expect(reads).toContain(shardOf('g', '𫩏'))
  expect(ink(result.d)).toEqual(ink(ordinary.d))
  expect(pathRings(result.parts[2].d)).toHaveLength(5)
})
