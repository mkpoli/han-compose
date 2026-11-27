import { expect, test } from 'bun:test'
import { ASCENT, EM_BOX, fill, pathRings } from '../src/geometry.js'
import { rateDrawing } from '../src/rate-drawing.js'
import { rateFormsFor } from '../src/rate-forms.js'
import { renderU26201, u26201Forms, yaoOutline } from '../src/render-u26201.js'

const size = 256
const mask = d => fill(pathRings(d, 16), size, EM_BOX)

test('omitting both choices preserves the native WenJin drawing', () => {
  const source = rateFormsFor('𦈁')[0]
  expect(mask(renderU26201().d)).toEqual(mask(rateDrawing(source.text, 'serif')))
})

test('each selection changes ink only inside its own 幺', () => {
  const base = mask(renderU26201('folded', 'folded').d)
  for (const { id, text } of u26201Forms) {
    for (const [choice, x0, y0, x1, y1] of [
      [[id, null], 84, 523, 469, 732],
      [[null, text], 600, 193, 847, 475],
    ]) {
      const rendered = mask(renderU26201(...choice).d)
      let inside = 0, outside = 0
      for (let i = 0; i < rendered.length; i++) {
        if (base[i] === rendered[i]) continue
        const x = ((i % size) + 0.5) * 1000 / size
        const y = (Math.floor(i / size) + 0.5) * 1000 / size
        if (x >= x0 && y >= y0 && x <= x1 && y <= y1) inside++
        else outside++
      }
      expect(outside).toBe(0)
      if (id === 'folded') expect(inside).toBe(0)
      else expect(inside).toBeGreaterThan(100)
    }
  }
})

test('all nine whole characters are visually distinguishable, with native exterior ink extents', () => {
  const native = renderU26201().d
  expect(renderU26201('folded', 'folded').d).toBe(native)
  const nativeInk = mask(native).reduce((sum, pixel) => sum + pixel, 0)
  const silhouettes = new Set()
  function extent(ink) {
    const x = ink.filter((_, i) => i % 2 === 0)
    const y = ink.filter((_, i) => i % 2 === 1).map(v => ASCENT - v)
    return [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)]
  }
  const bounds = extent(pathRings(native, 16).flat())
  for (const left of u26201Forms) for (const right of u26201Forms) {
    const { d, viewBox } = renderU26201(left, right)
    expect(viewBox).toBe('0 0 1000 1000')
    extent(pathRings(d, 16).flat()).forEach((value, i) => expect(value).toBeCloseTo(bounds[i], 0))
    const bitmap = mask(d)
    const ink = bitmap.reduce((sum, pixel) => sum + pixel, 0)
    expect(Math.abs(ink / nativeInk - 1)).toBeLessThan(0.025)
    silhouettes.add(Buffer.from(bitmap).toString('base64'))
  }
  expect(silhouettes.size).toBe(9)
  expect(() => renderU26201('missing', null)).toThrow(RangeError)
})

test('the short stroke is detached in the first drawing and both joined turns have solid junctions', () => {
  for (const [id, rings] of [['detached', 2], ['folded', 1], ['returning', 1]]) {
    expect(pathRings(yaoOutline(id).d, 16)).toHaveLength(rings)
  }
})

test('each source alias draws the same authored outline as its registry identity', () => {
  for (const form of u26201Forms) for (const alias of form.aliases) {
    expect(yaoOutline(alias)).toEqual(yaoOutline(form))
    expect(renderU26201(alias, alias)).toEqual(renderU26201(form, form))
  }
})
