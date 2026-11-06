import { describe, expect, it } from 'bun:test'
import { makePart, partOf, placed } from '../src/geometry.js'
import { splitStroke } from '../src/strokes.js'

const rect = (x0, y0, x1, y1) => {
  const light = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])
  return { ops: [], light, heavy: light.slice(), width: null }
}
const at = part => placed(part, part.box, part.box, 0, 'test')

describe('splitting a stroke from a part', () => {
  it('detaches a stroke whose contours belong to no other stroke', () => {
    const part = makePart([rect(100, 500, 900, 600), rect(100, 0, 900, 100), rect(450, 0, 550, 600)])
    part.strokes = [[0, [0]], [1, [1]], [2, [2]]]
    const { stroke, rest } = splitStroke(at(part), 0)
    expect(stroke.part.contours).toHaveLength(1)
    expect(rest.part.contours).toHaveLength(2)
    expect(stroke.part.box[1]).toBeCloseTo(500)
    expect(rest.part.box[3]).toBeCloseTo(600)
  })

  it('refuses a stroke that shares a contour with another', () => {
    const part = makePart([rect(100, 0, 900, 600), rect(450, 0, 550, 600)])
    part.strokes = [[0, [0]], [1, [0]]]
    expect(splitStroke(at(part), 0)).toBeNull()
  })

  it('refuses an unknown stroke or a part without groups', () => {
    const part = makePart([rect(0, 0, 10, 10)])
    part.strokes = [[0, [0]]]
    expect(splitStroke(at(part), 1)).toBeNull()
    delete part.strokes
    expect(splitStroke(at(part), 0)).toBeNull()
  })

  it('reads the groups from a glyph record', () => {
    const part = partOf({ b: [0, 0, 1, 1], p: [], sg: [[0, []]] })
    expect(part.strokes).toEqual([[0, []]])
  })
})

describe('a stroke that is the whole part', () => {
  it('is not split into an empty rest', () => {
    const part = makePart([rect(0, 0, 10, 10)])
    part.strokes = [[0, [0]]]
    expect(splitStroke(at(part), 0)).toBeNull()
  })
})
