import { expect, it } from 'bun:test'
import { derived, partOf, pathMask, pathRings, placed, pointsBox, svgPath, union } from '../src/geometry.js'
import { openHookCounters } from '../src/hook-seat.js'
import { hookFloor } from '../src/hook-floor.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { character, files, shards } from './fixtures/small-export.js'
// Sans export a83fc941166b: Noto Sans CJK JP and its Plangothic extension fallback.
// Serif export 8156f838798c: Noto Serif CJK JP 2.003.
// Regular export c14ee5e08798: CNS11643 TW-Kai.
// Pen export ce3eaafda8f9: Kureedo Full 0.5.0. Sources and OFL licences in docs/licensing.md.
import donors from './fixtures/hook-floor.json' with { type: 'json' }

function source(face, extra = {}) {
  const input = { ...files, ...shards('g', Object.entries({ ...donors[face], ...extra })) }
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

it('opens short counters upward while keeping their baseline, width and crossbar thickness', async () => {
  // Previous placement in font units and vertical stroke sections on a 512-pixel em.
  for (const [face, style, sequence, top, width, height, expectedShare, bars] of [
    ['serif', 'serif', '⿺⿱夂見自', 193.16, 365.43, 642.30, 0.804, [10, 11, 11, 10, 11]],
    ['pen', 'pen-writing', '⿺𡕚自', 148.99, 389.91, 680.17, 0.804, [14, 19, 17, 17, 18]],
    ['pen', 'pen-writing', '⿺見自', 162.51, 383.90, 547.51, 0.711, [12, 15, 13, 14, 15]],
    ['pen', 'pen-writing', '⿺見日', 162.74, 383.68, 547.35, 0.637, [16, 17, 17]],
  ]) {
    const { parts } = await compose(source(face), sequence, { separate: true, fontStyle: style })
    const [x, y, w, h] = parts.at(-1).box
    const frame = union(parts.slice(0, -1).map(({ box: [x, y, w, h] }) => [x, y, x + w, y + h]))
    expect(frame[2] - (x + w)).toBeGreaterThan(40)
    expect(Math.abs(y + h - top - height)).toBeLessThan(0.1)
    expect(h).toBeGreaterThan(height + 25)
    expect(h / (frame[3] - frame[1])).toBeCloseTo(expectedShare, 2)
    const size = 512, mask = pathMask(parts.at(-1).d, size)
    const column = Math.round((x + 0.53 * w) * size / 1000)
    const section = Array.from({ length: size }, (_, row) => mask[row * size + column]).join('')
    const strokes = section.match(/1+/g).map(run => run.length)
    expect(strokes).toHaveLength(bars.length)
    for (let i = 0; i < bars.length; i++) expect(Math.abs(strokes[i] - bars[i])).toBeLessThanOrEqual(1)
    expect(Math.abs(w - width)).toBeLessThan(0.1)
  }
})

it('opens three bands for 目 and leaves the gap above the roof intact for 白 and 百', () => {
  // The same four horizontal strokes expose which bands the fit opens.
  const frame = partOf(character('', [[0, 0, 80, 1000], [0, 0, 1000, 80]]).G)
  const rows = [0, 250, 500, 750]
  const inner = partOf(character('', rows.map(y => [0, y, 400, y + 50])).G)
  for (const char of ['目', '白', '百']) {
    const result = openHookCounters(frame, frame.box, inner, inner.box,
      [500, 120, 850, 600], frame.box, char, 'serif')
    expect(result).not.toBeNull()
    const bottoms = result.part.contours.map(c => pointsBox(c.light)[1])
    const gaps = bottoms.slice(1).map((y, i) => y - bottoms[i] - 50)
    expect(gaps[0]).toBeGreaterThan(200)
    expect(gaps[1]).toBeCloseTo(gaps[0])
    expect(gaps[2]).toBeCloseTo(char === '目' ? gaps[0] : 200)
  }
})

it('opens the editable cells for 見自 and 見日 above their original inset baselines', async () => {
  // Cell left, width and baseline in the Kureedo export on main (37c86487).
  for (const [char, left, width, baseline, heightShare] of [
    ['自', 487.42, 370.08, 700.17, 0.686],
    ['日', 487.43, 369.87, 700.24, 0.614],
  ]) {
    const { parts: [frame, inner] } = await compose(source('pen'), '⿺見' + char, {
      fontStyle: 'pen-writing', layout: 'cells', separate: true,
    })
    const [x, y, w, h] = inner.box
    expect([frame.leaf, inner.leaf]).toEqual([0, 1])
    expect(x).toBeCloseTo(left, 1)
    expect(w).toBeCloseTo(width, 1)
    expect(y + h).toBeCloseTo(baseline, 1)
    expect(h / frame.box[3]).toBeCloseTo(heightShare, 2)
    const outline = pathMask(frame.d, 256)
    expect(pathMask(inner.d, 256).some((ink, i) => ink && outline[i])).toBe(false)
  }
})

it('opens both sides of 田 and 由 in composed and editable layouts', async () => {
  const control = '\uE001'
  for (const char of ['田', '由']) {
    // Different crossbar levels on each side force a fit to respect both white bands.
    const strokes = [[0, 0, 50, 480], [750, 0, 800, 480], [0, 0, 800, 50], [0, 480, 800, 530],
      [0, 215, 400, 265], [400, 270, 800, 320], [355, 0, 445, char === '由' ? 630 : 530]]
    const record = character(char, strokes)
    const src = source('pen', { [char]: record, [control]: record })
    for (const layout of ['composed', 'cells']) {
      const draw = async ch => (await compose(src, '⿺見' + ch, { fontStyle: 'pen-writing', separate: true, layout })).parts
      // The control puts the identical outline through the ordinary leaf fit.
      const [, before] = await draw(control)
      const [frame, after] = await draw(char)
      const [x, y, w, h] = after.box
      expect(x).toBeCloseTo(before.box[0], 1)
      expect(w).toBeCloseTo(before.box[2], 1)
      expect(y + h).toBeCloseTo(before.box[1] + before.box[3], 1)
      expect(h).toBeGreaterThan(before.box[3] + 100)

      const size = 512, outline = pathMask(frame.d, size)
      const oldMask = pathMask(before.d, size), newMask = pathMask(after.d, size)
      expect(newMask.some((ink, i) => ink && outline[i])).toBe(false)
      const section = (mask, fraction) => {
        const column = Math.floor((x + fraction * w) * size / 1000)
        return Array.from({ length: size }, (_, row) => mask[row * size + column]).join('')
      }
      for (const side of [0.30, 0.70]) {
        const runs = mask => section(mask, side).replace(/^0+|0+$/g, '').match(/1+|0+/g)
        const oldRows = runs(oldMask), newRows = runs(newMask)
        expect(newRows).toHaveLength(5)
        for (let i = 0; i < oldRows.length; i++) {
          if (i % 2) expect(newRows[i].length).toBeGreaterThan(oldRows[i].length)
          else expect(Math.abs(newRows[i].length - oldRows[i].length)).toBeLessThanOrEqual(1)
        }
      }
      expect(section(newMask, 0.50).match(/1+/g)).toHaveLength(1)
      if (char === '由') {
        const tip = mask => section(mask, 0.30).indexOf('1') - section(mask, 0.50).indexOf('1')
        expect(Math.abs(tip(oldMask) - tip(newMask))).toBeLessThanOrEqual(1)
      }
    }
  }
})

for (const [face, style, outer] of [['pen', 'pen-writing', '見'], ['reg', 'regular', '先'], ['reg', 'regular', '亀']]) {
  it(`fits the native 首 in ${style} ⿺${outer}首 after the root layout`, async () => {
    const src = source(face)
    const record = donors[face].馗.G, glyph = partOf(record)
    const cut = derived(glyph, record.ls.首.map(index => glyph.contours[index]))
    const native = svgPath([placed(cut, cut.box, cut.box, 1, '馗')])
    const expected = normalizedOutline(native)
    const [left, bottom, right, top] = inkBounds(native)
    for (const layout of ['composed', 'cells']) {
      const draw = async (input, exclude = []) => (await compose(input, '⿺' + outer + '首', {
        separate: true, fontStyle: style, layout, exclude,
      })).parts
      const [frame, inner] = await draw(src)
      expect(inner.origin).toBe('host 馗')
      const actual = normalizedOutline(inner.d)
      expect(actual.map(ring => ring.length)).toEqual(expected.map(ring => ring.length))
      for (let i = 0; i < actual.length; i++) {
        const error = Math.max(...actual[i].map((coordinate, j) => Math.abs(coordinate - expected[i][j])))
        expect(error).toBeLessThan(0.001)
      }
      const [x0, y0, x1, y1] = inkBounds(inner.d)
      const nativeAspect = (top - bottom) / (right - left)
      expect(Math.abs((y1 - y0) / (x1 - x0) / nativeAspect - 1)).toBeLessThan(0.001)
      const mask = pathMask(frame.d, 256)
      expect(pathMask(inner.d, 256).some((ink, i) => ink && mask[i])).toBe(false)
      if (layout === 'cells') expect([frame.leaf, inner.leaf]).toEqual([0, 1])
      const [, fallback] = await draw(src, ['馗'])
      expect(fallback.d).not.toBe(inner.d)
      const [, unlabeled] = await draw(source(face, { 馗: { ...donors[face].馗, G: { ...record, ls: {} } } }))
      expect(unlabeled.d).toBe(fallback.d)
    }
  })
}
