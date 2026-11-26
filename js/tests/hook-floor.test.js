import { expect, it } from 'bun:test'
import { pathMask, pathRings, pointsBox, union } from '../src/geometry.js'
import { hookFloor } from '../src/hook-floor.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, shards } from './fixtures/small-export.js'
// Sans export a83fc941166b: Noto Sans CJK JP and its Plangothic extension fallback.
// Serif export 8156f838798c: Noto Serif CJK JP 2.003.
// Pen export ce3eaafda8f9: Kureedo Full 0.5.0. Sources and OFL licences in docs/licensing.md.
import donors from './fixtures/hook-floor.json' with { type: 'json' }

function source(face) {
  const input = { ...files, ...shards('g', Object.entries(donors[face])) }
  return createSource(async k => input[k] === undefined ? null : new Uint8Array(Buffer.from(input[k])).buffer)
}

function inkBounds(d) {
  return union(pathRings(d, 48).map(pointsBox))
}

function normalizedOutline(d) {
  const [left, bottom, right, top] = inkBounds(d)
  return pathRings(d).map(ring => ring.map((value, i) =>
    i % 2 ? (value - bottom) / (top - bottom) : (value - left) / (right - left)))
}

it('preserves the three white counters of 見 in encoded and reconstructed 𡕚', async () => {
  for (const [face, fontStyle] of [['sans', 'sans'], ['pen', 'pen-writing']]) {
    const src = source(face)
    const preview = await sketch(src, '⿺𡕚自', { fontStyle })
    for (const layout of ['composed', 'cells']) {
      const { parts } = await compose(src, '⿺𡕚自', { separate: true, layout, fontStyle })
      expect(parts).toHaveLength(2)
      const [frame, inner] = parts
      expect(frame.origin).toBe('enclosing 𡕚')
      if (layout === 'composed') expect(preview.map(p => p.box)).toEqual(parts.map(p => p.box))
      expect(inner.box[2]).toBeGreaterThan(frame.box[2] * 0.24)
      expect(inner.box[3]).toBeGreaterThan(frame.box[3] * 0.40)

      // A vertical section through 目 passes its roof, three white counters,
      // and its floor. Bracket each counter with ink in the actual SVG fill.
      const mask = pathMask(frame.d, 128)
      const eye = Array.from({ length: 49 }, (_, y) => mask[(y + 51) * 128 + 35]).join('')
      expect(eye).toMatch(/1+0{2,}1+0{2,}1+0{2,}1+/)
    }
  }
})

it('uses the same enclosure for different contents and independent outer glyphs', async () => {
  for (const [face, fontStyle, char, second] of [['pen', 'pen-writing', '見', '日'], ['sans', 'sans', '𡕚', '口']]) {
    const src = source(face)
    const draw = inner => compose(src, '⿺' + char + inner, { separate: true, layout: 'composed', fontStyle })
    const preview = await sketch(src, '⿺' + char + second, { fontStyle })
    const first = await draw('自'), next = await draw(second)
    expect(next.parts.map(p => p.box)).toEqual(preview.map(p => p.box))
    expect(first.parts[0].origin).toBe('enclosing ' + char)
    // The enclosing outline is reusable even if the whole composition's ink
    // dimensions differ between the two source glyphs.
    const a = normalizedOutline(first.parts[0].d), b = normalizedOutline(next.parts[0].d)
    expect(b.map(ring => ring.length)).toEqual(a.map(ring => ring.length))
    const differences = a.flatMap((ring, i) => ring.map((v, j) => Math.abs(v - b[i][j])))
    expect(Math.max(...differences)).toBeLessThan(0.001)
    expect(next.parts[1].d).not.toBe(first.parts[1].d)
  }
})

it('carries 自 on the hook of an explicit ⿱夂見 with each stroke group editable', async () => {
  const src = source('serif')
  const ids = '⿺⿱夂見自'
  const preview = await sketch(src, ids, { fontStyle: 'serif' })
  for (const layout of ['composed', 'cells']) {
    const options = { fontStyle: 'serif', layout }
    const whole = await compose(src, ids, options)
    const { parts, d } = await compose(src, ids, { ...options, separate: true })
    expect(parts).toHaveLength(3)
    const [top, eye, inner] = parts
    if (layout === 'cells') expect(parts.map(p => p.leaf)).toEqual([0, 1, 2])
    if (layout === 'composed') expect(preview.map(p => p.box)).toEqual(parts.map(p => p.box))
    expect(top.box[0] + top.box[2]).toBeLessThan(inner.box[0])
    expect(eye.box[0] + eye.box[2]).toBeGreaterThan(inner.box[0] + inner.box[2])
    expect(eye.box[1] + eye.box[3]).toBeGreaterThan(inner.box[1] + inner.box[3])
    expect(inner.box[2]).toBeGreaterThan(250)
    expect(inner.box[3]).toBeGreaterThan(400)

    const side = 128
    const frameMasks = [top, eye].map(p => pathMask(p.d, side))
    const fill = pathMask(inner.d, side)
    expect(fill.some((ink, i) => ink && frameMasks.some(mask => mask[i]))).toBe(false)
    expect(pathMask(whole.d, side)).toEqual(pathMask(d, side))
  }
})

it('keeps the rendered footprint of the ordinary root drawing', async () => {
  // Independent measurements of the same fixtures on main (b1893d86), in font
  // coordinates. Where 𡕚 is absent, the reconstructed Pen glyph uses the face.
  for (const [face, fontStyle, ids, expected] of [
    ['sans', 'sans', '⿺𡕚自', [43.6, -88.7, 978.6, 847.4]],
    ['serif', 'serif', '⿺⿱夂見自', [27.9, -90.1, 898, 850.7]],
    ['pen', 'pen-writing', '⿺𡕚自', [38.4, -81.5, 966.8, 840.1]],
  ]) {
    for (const separate of [false, true]) {
      const { d } = await compose(source(face), ids, { layout: 'composed', separate, fontStyle })
      const bounds = inkBounds(d)
      for (let i = 0; i < expected.length; i++) {
        expect(Math.abs(bounds[i] - expected[i])).toBeLessThan(0.2)
      }
    }
  }
})

it('respects the exclusion of a stacked donor or the frame', async () => {
  for (const char of ['夂', '見', '𡕚']) {
    await expect(compose(source('pen'), '⿺𡕚自', {
      separate: true, fontStyle: 'pen-writing', exclude: [char],
    })).rejects.toThrow('𡕚')
  }
})

it('requires a low returning tip on the floor', () => {
  function outline(tipHeight, verticalOffset) {
    const points = Float64Array.from([0, 1000, 400, 1000, 400, 100 + verticalOffset,
      890, 100 + verticalOffset, 960, tipHeight + verticalOffset, 1000, 5 + verticalOffset, 0, 0])
    const ops = Array.from({ length: points.length / 2 }, (_, i) => [i ? 'L' : 'M', 1, false])
    return { box: [0, 0, 1000, 1000], contours: [{ ops, light: points, heavy: points }] }
  }
  expect(hookFloor(outline(220, 0))).not.toBeNull()
  expect(hookFloor(outline(100, 0))).toBeNull()
  expect(hookFloor(outline(220, 400))).toBeNull()
})

it('seats 自 near the horizontal floor while clearing the upturned tip', async () => {
  for (const [face, fontStyle] of [['sans', 'sans'], ['pen', 'pen-writing']]) {
    const { parts: [frame, inner] } = await compose(source(face), '⿺𡕚自', {
      separate: true, fontStyle, layout: 'composed',
    })
    const size = 256, outline = pathMask(frame.d, size), contents = pathMask(inner.d, size)
    const x = Math.floor((inner.box[0] + inner.box[2] / 2) * size / 1000)
    let floor = size - 1, base = size - 1
    while (floor > 0 && !outline[floor * size + x]) floor--
    while (floor > 0 && outline[floor * size + x]) floor--
    while (base > 0 && !contents[base * size + x]) base--
    expect((floor - base) / size).toBeLessThan(0.16)
    expect((floor - base) / size).toBeGreaterThan(0.07)
    expect(contents.some((ink, i) => ink && outline[i])).toBe(false)
  }
})

it('gives 自 lateral clearance inside the hook without shortening or lifting it', async () => {
  // At the preceding floor position these two specimens left only 22–23 units
  // of the hook projecting to the right. Retain their exact vertical fit.
  for (const [face, style, sequence, top, width, height] of [
    ['serif', 'serif', '⿺⿱夂見自', 193.16, 365.43, 642.30],
    ['pen', 'pen-writing', '⿺𡕚自', 148.99, 389.91, 680.17],
  ]) {
    const { parts } = await compose(source(face), sequence, { separate: true, fontStyle: style })
    const [x, y, w, h] = parts.at(-1).box
    const edge = Math.max(...parts.slice(0, -1).map(p => p.box[0] + p.box[2]))
    expect(edge - (x + w)).toBeGreaterThan(40)
    expect(Math.abs(y - top)).toBeLessThan(0.1)
    expect(Math.abs(h - height)).toBeLessThan(0.1)
    expect(Math.abs(w - width)).toBeLessThan(0.1)
  }
})
