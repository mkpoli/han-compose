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
