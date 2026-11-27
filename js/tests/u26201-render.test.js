import { expect, test } from 'bun:test'
import { ASCENT, EM_BOX, fill, pathRings } from '../src/geometry.js'
import { rateDrawing } from '../src/rate-drawing.js'
import { rateFormsFor } from '../src/rate-forms.js'
import { renderU26201, u26201Forms } from '../src/render-u26201.js'

const size = 256
const mask = d => fill(pathRings(d, 16), size, EM_BOX)

test('omitting both choices preserves the native WenJin drawing', () => {
  const source = rateFormsFor('𦈁')[0]
  expect(mask(renderU26201().d)).toEqual(mask(rateDrawing(source.text, 'serif')))
})

test('each selection changes ink only inside its own 幺', () => {
  const base = mask(renderU26201().d)
  for (const { id, text } of u26201Forms) {
    for (const [choice, x0, y0, x1, y1] of [
      [[id, null], 86, 527, 496.15, 813.29],
      [[null, text], 604, 195, 849.49, 640.39],
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
      expect(inside).toBeGreaterThan(100)
    }
  }
})

test('all 36 whole characters are visually distinguishable, with native exterior ink extents', () => {
  const silhouettes = new Set()
  const native = pathRings(renderU26201().d, 16).flat()
  function extent(ink) {
    const x = ink.filter((_, i) => i % 2 === 0)
    const y = ink.filter((_, i) => i % 2 === 1).map(v => ASCENT - v)
    return [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)]
  }
  const bounds = extent(native)
  for (const left of u26201Forms) for (const right of u26201Forms) {
    const { d, viewBox } = renderU26201(left, right)
    expect(viewBox).toBe('0 0 1000 1000')
    expect(extent(pathRings(d, 16).flat())).toEqual(bounds)
    silhouettes.add(Buffer.from(mask(d)).toString('base64'))
  }
  expect(silhouettes.size).toBe(36)
  expect(() => renderU26201('missing', null)).toThrow(RangeError)
})
