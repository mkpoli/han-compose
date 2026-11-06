import { describe, expect, it } from 'bun:test'
import { makePart, placed } from '../src/geometry.js'
import { CONSTRUCTS, constructParts } from '../src/constructs.js'

const rect = (x0, y0, x1, y1) => {
  const light = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])
  return { ops: [], light, heavy: light.slice(), width: null }
}

describe('a known construct', () => {
  it('carries the body cut from its host', () => {
    const spec = CONSTRUCTS['⿳山𠚍禸']
    expect(spec.host).toBe('𱵺')
    expect(spec.keep).toBe('bottom')
    expect(spec.keepParts).toBe(1)
    expect(spec.body.p).toHaveLength(5)
  })

  it('keeps the prefix and fits the body to the replaced parts', () => {
    const top = placed(makePart([rect(0, 500, 1000, 800)]), [0, 500, 1000, 800], [0, 500, 1000, 800], 0, 'top')
    const rest = placed(makePart([rect(100, 0, 900, 400)]), [100, 0, 900, 400], [100, 0, 900, 400], 0, 'rest')
    const out = constructParts(CONSTRUCTS['⿳山𠚍禸'], [top, rest])
    expect(out).toHaveLength(2)
    expect(out[0]).toBe(top)
    expect(out[1].origin).toBe('construct 𱵺 bottom')
    expect(out[1].target).toEqual([100, 0, 900, 400])
  })

  it('leaves a drawing with nothing to replace alone', () => {
    const only = placed(makePart([rect(0, 0, 10, 10)]), [0, 0, 10, 10], [0, 0, 10, 10], 0, 'only')
    const out = constructParts(CONSTRUCTS['⿳山𠚍禸'], [only])
    expect(out).toEqual([only])
  })
})
