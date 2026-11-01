import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { groupParts } from '../src/group-parts.js'
import { files } from './fixtures/small-export.js'

const sourceOf = () => createSource(async name => {
  const body = files[name]
  return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
})

it('draws six equal components in centred rows of one, two and three', async () => {
  for (const part of ['口', '木']) {
    const source = sourceOf(), text = `⿳${part}⿰${part}${part}⿲${part}${part}${part}`
    const normal = await compose(source, text), split = await compose(source, text, { separate: true })
    expect(normal.d).toBe(split.d)
    expect(split.origins).toEqual(Array(6).fill(`glyph ${part}`))
    const boxes = (await sketch(source, text)).map(leaf => leaf.box)
    expect(boxes).toHaveLength(6)
    for (const box of boxes) {
      expect(box[2]).toBeCloseTo(boxes[0][2], 6)
      expect(box[3]).toBeCloseTo(boxes[0][3], 6)
    }
    const center = box => box[0] + box[2] / 2
    expect(center(boxes[0])).toBeCloseTo((center(boxes[1]) + center(boxes[2])) / 2, 6)
    expect(center(boxes[0])).toBeCloseTo(center(boxes[4]), 6)
    expect(boxes[0][1]).toBeLessThan(boxes[1][1])
    expect(boxes[1][1]).toBeLessThan(boxes[3][1])
    expect(groupParts(split.parts, await sketch(source, text))?.map(group => group.parts))
      .toEqual([[0], [1], [2], [3], [4], [5]])
  }
})

it('keeps each repeated part selectable when the arrangement is nested', async () => {
  const source = sourceOf(), text = '⿱木⿳口⿰口口⿲口口口'
  const split = await compose(source, text, { separate: true })
  expect(groupParts(split.parts, await sketch(source, text))?.map(group => group.parts))
    .toEqual([[0], [1], [2], [3], [4], [5], [6]])
})
