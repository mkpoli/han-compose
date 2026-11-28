import { expect, it } from 'bun:test'
import { fangsongJianBirang } from '../src/fangsong-jian-birang.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { referenceLayout } from '../src/reference-layout.js'
import { files, records, shards } from './fixtures/small-export.js'

const src = () => {
  const glyphs = { ...records, 入: records.口, 柬: records.口, 鳥: records.口, 鶇: records.口, 鴿: records.口 }
  const input = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async key => input[key] === undefined ? null : Uint8Array.from(Buffer.from(input[key])).buffer)
}

const quadContour = (x0, y0, x1, y1, ccw = true) => {
  const pts = ccw
    ? [x1, y0, x1, y1, x0, y1, x0, y0]
    : [x0, y0, x0, y1, x1, y1, x1, y0]
  return {
    ops: [['M', 1, false], ['L', 1, false], ['L', 1, false], ['L', 1, false]],
    light: new Float64Array(pts),
    heavy: new Float64Array(pts),
  }
}

const signedArea = pts => {
  let sum = 0
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length
    sum += pts[i] * pts[j + 1] - pts[j] * pts[i + 1]
  }
  return sum / 2
}

it('weights 入 to match 鳥 in FangSong ⿰入鳥 and builds 避讓 柬 from 鶇+柬 in ⿰柬鳥', async () => {
  const nio = referenceLayout(['⿰', '入', '鳥'], 'fangsong')
  expect(nio).not.toBeNull()
  const [, , weight] = nio.cells[0]
  expect(weight[0]).toBeGreaterThan(0.8)
  expect(weight[1]).toBeGreaterThan(0.3)

  const tsugumi = referenceLayout(['⿰', '柬', '鳥'], 'fangsong')
  expect(tsugumi).not.toBeNull()
  expect(tsugumi.donors.柬.char).toBe('鶇')
  expect(tsugumi.donors.柬.variant).toBe('jian-birang')
  expect(tsugumi.donors.柬.dots.char).toBe('柬')
  expect(tsugumi.donors.鳥.char).toBe('鶇')

  const source = src(), options = { fontStyle: 'fangsong' }
  for (const ids of ['⿰入鳥', '⿰柬鳥']) {
    const boxes = await sketch(source, ids, options)
    const drawn = await compose(source, ids, options)
    expect(boxes.map(p => p.box)).toEqual(drawn.parts.map(p => p.box))
    expect((await compose(source, ids, { ...options, separate: true })).d).toBe(drawn.d)
  }

  for (const excluded of ['鶇', '柬', '鳥', '鴿', '入']) {
    const ids = excluded === '鴿' || excluded === '入' ? '⿰入鳥' : '⿰柬鳥'
    const res = await compose(source, ids, { ...options, exclude: [excluded] })
    expect(res.parts.every(p => !p.origin.includes('鶇') && !p.origin.includes('鴿'))).toBe(true)
  }
})

it('merges 鶇 田 counters into two openings and places 柬 dots cleanly inside', () => {
  const outer = quadContour(27, -100, 504, 813, false)
  const lowerLeft = quadContour(192, 297, 288, 379, true)
  const upperLeft = quadContour(191, 405, 287, 480, true)
  const lowerRight = {
    ops: [['M', 1, false], ['L', 1, false], ['L', 1, false], ['L', 1, false]],
    light: new Float64Array([417, 388, 333, 382, 333, 310, 411, 302]),
    heavy: new Float64Array([396, 366, 353, 363, 353, 331, 396, 338]),
  }
  const upperRight = {
    ops: [['M', 1, false], ['L', 1, false], ['L', 1, false], ['L', 1, false]],
    light: new Float64Array([421, 492, 334, 485, 334, 417, 418, 405]),
    heavy: new Float64Array([400, 470, 354, 466, 354, 442, 399, 458]),
  }
  const dummy = quadContour(0, 0, 10, 10, false)
  const dong = { box: [27, -100, 504, 813], contours: [outer, dummy, lowerLeft, upperLeft, lowerRight, dummy, upperRight] }
  const jian = {
    box: [48, -117, 950, 814],
    contours: [dummy, quadContour(280, 267, 462, 476, true), quadContour(314, 307, 414, 434, false), quadContour(512, 276, 710, 493, true), quadContour(532, 313, 661, 467, false)],
  }

  const birang = fangsongJianBirang(dong, jian)
  expect(birang.contours).toHaveLength(5)
  expect(birang.contours[0]).toBe(outer)
  expect(signedArea(birang.contours[0].light)).toBeLessThan(0)
  expect(signedArea(birang.contours[1].light)).toBeGreaterThan(0)
  expect(signedArea(birang.contours[2].light)).toBeLessThan(0)
  expect(signedArea(birang.contours[3].light)).toBeGreaterThan(0)
  expect(signedArea(birang.contours[4].light)).toBeLessThan(0)

  // Left dot stays strictly inside the merged left counter
  for (let i = 0; i < birang.contours[2].light.length; i += 2) {
    const x = birang.contours[2].light[i], y = birang.contours[2].light[i + 1]
    expect(x).toBeGreaterThan(192)
    expect(x).toBeLessThan(287)
    expect(y).toBeGreaterThan(306)
    expect(y).toBeLessThan(471)
  }
})
