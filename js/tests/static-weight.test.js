import { expect, it } from 'bun:test'
import { commands, makePart, placed } from '../src/geometry.js'
import { Composer } from '../src/compose.js'
import { createSource } from '../src/loader.js'
import { constants, files } from './fixtures/small-export.js'

const staticFiles = {
  ...files,
  'manifest.json': JSON.stringify({
    ...JSON.parse(files['manifest.json']),
    weighted: false,
    heavy: 400,
    constants: { ...constants, stem: [[59.132, 99.132], [45.204, 85.204]] },
  }),
}
const source = () => createSource(async name => {
  const file = staticFiles[name]
  return file === undefined ? null : new Blob([file]).arrayBuffer()
})

/** A part whose measured stroke is `width`, drawn from `box` into `target`. */
const part = (box, target, width, grow = 20) => {
  const [x0, y0, x1, y1] = box
  const contour = { ops: commands('MLLL'), light: Float64Array.from([x0, y0, x0, y1, x1, y1, x1, y0]),
    heavy: Float64Array.from([x0 - grow, y0 - grow, x0 - grow, y1 + grow, x1 + grow, y1 + grow, x1 + grow, y0 - grow]), width }
  return placed(makePart([contour]), box, target, 0, 'test')
}

it('lifts a thin part of a static face to the stroke the parts at their own size draw', async () => {
  const loaded = source()
  await loaded.ready()
  const composer = new Composer(loaded.store(), { fontStyle: 'fangsong' })
  expect(composer.staticFace).toBe(true)
  const frame = part([0, 0, 500, 1000], [0, 0, 250, 1000], [60, 45])
  const thin = part([0, 0, 1000, 1000], [0, 0, 400, 400], [60, 45])
  composer.staticBalance([frame, thin])
  expect(frame.weight).toEqual([0, 0])
  expect(thin.weight[0]).toBeGreaterThan(0)
  expect(thin.weight[1]).toBeGreaterThan(thin.weight[0])
  expect(thin.weight[1]).toBeLessThanOrEqual(0.75)
})

it('takes an inset heavy master the other way, as Kureedo\'s contours need', async () => {
  const loaded = source()
  await loaded.ready()
  const composer = new Composer(loaded.store(), { fontStyle: 'pen-writing' })
  const frame = part([0, 0, 500, 1000], [0, 0, 250, 1000], [60, 45])
  const thin = part([0, 0, 1000, 1000], [0, 0, 400, 400], [60, 45], -20)
  composer.staticBalance([frame, thin])
  expect(thin.weight[0]).toBeLessThan(0)
  expect(thin.weight[0]).toBeGreaterThanOrEqual(-0.375)
})

const lawFiles = stems => ({
  ...files,
  'manifest.json': JSON.stringify({
    ...JSON.parse(files['manifest.json']),
    weighted: true,
    heavy: 400,
    constants: { ...constants, stem: [[60, 100], [40, 80]], PART_STEMS: stems, STATIC: true, PART_SCALE_LEAST: 0.2, WEIGHT_GROWTH: 3 },
  }),
})

/** A square frame of `stroke`-wide strokes, drawn from the em's middle into `target`. */
const frame = (stroke, target) => {
  const ring = (a, b) => ({ ops: commands('MLLL'), light: Float64Array.from([a, a, a, b, b, b, b, a]),
    heavy: Float64Array.from([a, a, a, b, b, b, b, a]), width: [stroke, stroke] })
  const inner = ring(200 + stroke, 700 - stroke)
  inner.light = Float64Array.from([200 + stroke, 200 + stroke, 700 - stroke, 200 + stroke, 700 - stroke, 700 - stroke, 200 + stroke, 700 - stroke])
  inner.heavy = inner.light.slice()
  return placed(makePart([ring(200, 700), inner]), [200, 200, 700, 700], target, 0, 'test')
}

it('weights a part by the measured powers of its scale, against its own stem', async () => {
  const loaded = createSource(async name => {
    const file = lawFiles([0.25, 0.5])[name]
    return file === undefined ? null : new Blob([file]).arrayBuffer()
  })
  await loaded.ready()
  const composer = new Composer(loaded.store(), { fontStyle: 'fangsong' })
  expect(composer.staticFace).toBe(false)
  const whole = frame(50, [200, 200, 700, 700]), half = frame(50, [200, 200, 450, 450])
  composer.balance([whole, half])
  expect(whole.weight).toEqual([0, 0])
  // The frame's strokes are 50 wide and the heavy master 40 wider: grown by 40 / 50 at weight 1.
  expect(half.weight[0]).toBeCloseTo((0.5 ** -0.75 - 1) / (40 / 50), 6)
  expect(half.weight[1]).toBeCloseTo((0.5 ** -0.5 - 1) / (40 / 50), 6)
  // Below the smallest measured scale a part is weighted as one at that scale.
  const tiny = frame(50, [200, 200, 250, 250])
  composer.balance([whole, tiny])
  expect(tiny.weight[0]).toBeCloseTo((0.2 ** -0.75 - 1) / (40 / 50), 6)
  // A fallback's outline is grown in proportion to its stem: counted by the font's ratio.
  const borrowed = frame(50, [200, 200, 450, 450])
  for (const c of borrowed.part.contours) c.kindred = true
  composer.balance([whole, borrowed])
  expect(borrowed.weight[0]).toBeCloseTo((0.5 ** -0.75 - 1) / (100 / 60 - 1), 6)
})
