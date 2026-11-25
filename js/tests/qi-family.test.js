import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { mapped, pathRings, pointsBox, union } from '../src/geometry.js'
import { character, files, shardOf, shards } from './fixtures/small-export.js'
// Dotted 器 from Noto Sans CJK JP 2.004 (Adobe and Google, SIL OFL 1.1).
// https://ids-input-composer.mkpoli.workers.dev/0bd3ee83a5e2-sans-compose-layout-v4-f7+kin/g/7a/7a62.json
import dottedVessel from './fixtures/sans-dotted-vessel.json' with { type: 'json' }

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
const withDottedVessel = { ...assets, ...shards('g', Object.entries({ ...records, 器: { G: dottedVessel } })) }
const source = (reads = [], input = assets) => createSource(async name => {
  reads.push(name)
  return input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer
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

it('keeps the Sans vessel’s mouth counters, walls and crossbar at the native row proportions', async () => {
  const native = () => source([], withDottedVessel)
  // Measured on the light outlines of 器, in font units. Mapping all rows with one
  // transform detects independent stretching of a row or thickening of either wall.
  const vessel = [30.5, -79.75, 971.75, 795.25]
  const upper = [128.25, 524, 874.75, 795.25], lower = [128.25, -79.75, 875.25, 229]
  const dog = [30.5, 140.5, 971.75, 531.75], bar = [52, 352.75, 949, 420]
  const upperLeft = [128.25, 524, 437.5, 795.25], counter = [196.5, 589.5, 365.75, 730.5]
  for (const ids of ['⿳吅犬𫩏', '⿳𫩏犬吅']) {
    const previous = await compose(source(), ids)
    const extent = ink(previous.d)
    const expectBox = (box, original) => {
      const expected = mapped(original, vessel, extent)
      expected.forEach((value, i) => expect(Math.abs(box[i] - value)).toBeLessThan(0.2))
    }
    const leaves = await sketch(native(), ids)
    const src = native(), whole = await compose(src, ids)
    for (const layout of ['composed', 'cells']) {
      const result = await compose(src, ids, { separate: true, layout })
      expect(result.d).toBe(whole.d)
      expect(result.parts.map(p => p.box)).toEqual(leaves.map(p => p.box))
      const rows = result.parts.map(p => pathRings(p.d, 16).map(pointsBox))
      const upperPair = ids.startsWith('⿳吅')
      if (upperPair) {
        expectBox(union(rows[0]), upper)
        const left = rows[0].filter(b => b[2] < (extent[0] + extent[2]) / 2).sort((a, b) => a[0] - b[0])
        expect(left).toHaveLength(2)
        expectBox(left[0], upperLeft)
        expectBox(left[1], counter)
      } else {
        expectBox(union(rows[2]), lower)
      }
      expectBox(union(rows[1]), dog)
      const widest = rows[1].reduce((best, b) => b[2] - b[0] > best[2] - best[0] ? b : best)
      expectBox(widest, bar)
    }
    expect((await compose(src, ids, { exclude: ['器'] })).d).toBe(previous.d)
  }
})
