import { describe, expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { drawnContours, makePart, placed } from '../src/geometry.js'

const contour = (x0, y0, x1, y1) => {
  const light = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])
  return { ops: [], light, heavy: light.slice(), width: null }
}
const part = (...contours) => makePart(contours)
const at = (p, box) => placed(p, box, box, 0, 'test')

const lonely = () => {
  const c = Object.create(Composer.prototype)
  Object.defineProperty(c, 'partial', { value: false, configurable: true })
  c.coverCache = new Map()
  c.exclude = new Set()
  c.rec = () => null
  return c
}

describe('a cover', () => {
  it('is derived from the sequence, not only the four roots', () => {
    const c = lonely()
    c.sequenceOf = ch => ch === '龸' ? '⿱⺌冖' : null
    c.parse = () => ['⿱', '⺌', '冖']
    expect(c.isCover('龸')).toBe(true)
    c.parse = () => ['⿱', '木', '木']
    c.coverCache.clear()
    expect(c.isCover('林')).toBe(false)
  })

  it('narrows a bar under a derived cover', () => {
    const c = lonely()
    c.sequenceOf = ch => ch === '龸' ? '⿱⺌冖' : null
    c.parse = () => ['⿱', '⺌', '冖']
    const cover = [at(part(contour(100, 500, 800, 700)), [100, 500, 800, 700])]
    const bar = at(part(contour(0, 250, 900, 300)), [0, 250, 900, 300])
    const body = at(part(contour(0, 0, 900, 250)), [0, 0, 900, 250])
    const lower = [bar, body]
    c.fitUnderCover('⿱', ['龸', '木'], [cover, lower])
    const xs = bar.part.contours[0].light.filter((_, i) => i % 2 === 0)
    const width = Math.max(...xs) - Math.min(...xs)
    expect(width).toBeGreaterThan(0.6 * 700)
    expect(width).toBeLessThan(0.75 * 700)
  })

  it('narrows a box head under a cover, and leaves what stands below it', () => {
    const c = lonely()
    c.sequenceOf = ch => ch === '昗' ? '⿱日六' : null
    c.parse = text => text === '⿱日六' ? ['⿱', '日', '六'] : text
    const cover = [at(part(contour(100, 600, 900, 800)), [100, 600, 900, 800])]
    const head = contour(100, 300, 900, 580), legs = contour(100, 0, 900, 200)
    const lower = [at(part(head, legs), [100, 0, 900, 580])]
    c.fitUnderCover('⿱', ['冖', '昗'], [cover, lower])
    const span = contour => {
      const xs = contour.light.filter((_, i) => i % 2 === 0)
      return Math.max(...xs) - Math.min(...xs)
    }
    const [drawnHead, drawnLegs] = lower[0].part.contours
    expect(span(drawnHead)).toBeCloseTo(0.72 * 800, 3)
    expect(span(drawnLegs)).toBe(800)
  })

  it('keeps the separate contours of a box head apart', () => {
    const c = lonely()
    c.sequenceOf = ch => ch === '昗' ? '⿱日六' : null
    c.parse = text => text === '⿱日六' ? ['⿱', '日', '六'] : text
    const cover = [at(part(contour(100, 600, 900, 800)), [100, 600, 900, 800])]
    const left = contour(100, 300, 140, 580), right = contour(860, 300, 900, 580), legs = contour(100, 0, 900, 200)
    const lower = [at(part(left, right, legs), [100, 0, 900, 580])]
    c.fitUnderCover('⿱', ['冖', '昗'], [cover, lower])
    const xs = contour => contour.light.filter((_, i) => i % 2 === 0)
    const [drawnLeft, drawnRight] = lower[0].part.contours
    expect(Math.min(...xs(drawnLeft))).toBeCloseTo(500 - 0.72 * 400, 3)
    expect(Math.max(...xs(drawnRight))).toBeCloseTo(500 + 0.72 * 400, 3)
    expect(Math.max(...xs(drawnLeft))).toBeLessThan(Math.min(...xs(drawnRight)))
  })

  it('leaves a counter with the contour below that holds it', () => {
    const c = lonely()
    c.sequenceOf = ch => ch === '買' ? '⿱罒貝' : null
    c.parse = text => text === '⿱罒貝' ? ['⿱', '罒', '貝'] : text
    const cover = [at(part(contour(100, 800, 900, 900)), [100, 800, 900, 900])]
    // The body's outline reaches below the line; its upper counter sits above it.
    const box = contour(100, 600, 900, 780), body = contour(100, 0, 900, 520), counter = contour(200, 440, 800, 500)
    const lower = [at(part(box, body, counter), [100, 0, 900, 780])]
    c.fitUnderCover('⿱', ['冖', '買'], [cover, lower])
    const xs = contour => contour.light.filter((_, i) => i % 2 === 0)
    const [drawnBox, drawnBody, drawnCounter] = lower[0].part.contours
    expect(Math.max(...xs(drawnBox)) - Math.min(...xs(drawnBox))).toBeCloseTo(0.72 * 800, 3)
    expect(Math.max(...xs(drawnBody)) - Math.min(...xs(drawnBody))).toBe(800)
    expect(Math.max(...xs(drawnCounter)) - Math.min(...xs(drawnCounter))).toBe(600)
  })

  it('measures a head by its own width, and never widens it', () => {
    const drawn = (x0, x1) => {
      const c = lonely()
      c.sequenceOf = ch => ch === '昗' ? '⿱日六' : null
      c.parse = text => text === '⿱日六' ? ['⿱', '日', '六'] : text
      const cover = [at(part(contour(100, 600, 900, 800)), [100, 600, 900, 800])]
      const lower = [at(part(contour(x0, 300, x1, 580), contour(100, 0, 900, 200)), [100, 0, 900, 580])]
      c.fitUnderCover('⿱', ['冖', '昗'], [cover, lower])
      const xs = lower[0].part.contours[0].light.filter((_, i) => i % 2 === 0)
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(drawn(150, 850)).toBeCloseTo(0.72 * 800, 3)
    expect(drawn(300, 700)).toBe(400)
  })

  it('centres a mirrored head on the cover as drawn', () => {
    const c = lonely()
    c.sequenceOf = ch => ch === '昗' ? '⿱日六' : null
    c.parse = text => text === '⿱日六' ? ['⿱', '日', '六'] : text
    const cover = [at(part(contour(100, 600, 900, 800)), [100, 600, 900, 800])]
    const lower = at(part(contour(100, 300, 700, 580), contour(100, 0, 900, 200)), [100, 0, 900, 580])
    lower.flips = [{ x: true, y: false, about: [500, 290] }]
    c.fitUnderCover('⿱', ['冖', '昗'], [cover, [lower]])
    const xs = drawnContours(lower)[0].filter((_, i) => i % 2 === 0)
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(500, 3)
  })

  it('leaves a lower part that does not open with a box', () => {
    const c = lonely()
    c.sequenceOf = ch => ch === '杏' ? '⿱木口' : null
    c.parse = text => text === '⿱木口' ? ['⿱', '木', '口'] : text
    const cover = [at(part(contour(100, 600, 900, 800)), [100, 600, 900, 800])]
    const whole = part(contour(100, 300, 900, 580), contour(100, 0, 900, 200))
    const lower = [at(whole, [100, 0, 900, 580])]
    c.fitUnderCover('⿱', ['冖', '杏'], [cover, lower])
    expect(lower[0].part).toBe(whole)
  })

  it('closes a middle 冖 on the part above and the part below', () => {
    const c = lonely()
    const top = [at(part(contour(0, 500, 900, 800)), [0, 500, 900, 800])]
    const cover = [at(part(contour(0, 350, 900, 450)), [0, 350, 900, 450])]
    const lower = [at(part(contour(0, -50, 900, 300)), [0, -50, 900, 300])]
    c.fitUnderCover('⿳', ['大', '冖', '牛'], [top, cover, lower])
    expect(cover[0].target[1]).toBeGreaterThan(350)
    expect(lower[0].target[1]).toBeGreaterThan(-50)
  })
})
