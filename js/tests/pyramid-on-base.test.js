import { describe, expect, it } from 'bun:test'
import { PYRAMID_LAYERS, compose, createSource, sketch, tooLarge } from '../src/loader.js'
import { pyramidOnBaseCells, pyramidOnBaseLayout, pyramidCount, pyramidSequence } from '../src/pyramid.js'
import { pyramidOnBase } from '../src/pyramid-rows.js'
import { parseDescription } from '../src/tree.js'
import { constants, files } from './fixtures/small-export.js'

const sourceOf = () => createSource(async name => {
  const body = files[name]
  return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
})
const tree = parseDescription

describe('reading a pyramid on a base', () => {
  it('reads rows of 1, 2, … cells and one part under them, however the stack is grouped', () => {
    for (const text of ['⿳口⿰口口木', '⿱⿱口⿰口口木', '⿱口⿱⿰口口木'])
      expect(pyramidOnBase(tree(text))).toEqual({ cell: '口', layers: 2, base: '木' })
    expect(pyramidOnBase({ op: '⿳', parts: ['口', { op: '⿰', parts: ['口', '口'] }, '木'] }))
      .toEqual({ cell: '口', layers: 2, base: '木' })
    // A base may repeat the cell, and a description may be the cell.
    expect(pyramidOnBase(tree('⿳口⿰口口口'))).toEqual({ cell: '口', layers: 2, base: '口' })
    expect(pyramidOnBase(tree('⿱' + pyramidSequence('⿰木口', 2) + '水')))
      .toEqual({ cell: { op: '⿰', parts: ['木', '口'] }, layers: 2, base: '水' })
  })

  it('reads a deeper pyramid on a base', () => {
    expect(pyramidOnBase(tree('⿱' + pyramidSequence('口', 3) + '木'))).toEqual({ cell: '口', layers: 3, base: '木' })
  })

  it('reads a stacked cell or base whole', () => {
    expect(pyramidOnBase(tree('⿱' + pyramidSequence('⿱木口', 2) + '水')))
      .toEqual({ cell: { op: '⿱', parts: ['木', '口'] }, layers: 2, base: '水' })
    expect(pyramidOnBase(tree('⿳口⿰口口⿱水火')))
      .toEqual({ cell: '口', layers: 2, base: { op: '⿱', parts: ['水', '火'] } })
  })

  it('leaves whole pyramids, rows, sideways pyramids and plain stacks alone', () => {
    for (const text of ['⿳口⿰口口⿲口口口', '⿱口⿰口口', '⿱木口', '⿳口⿰木木口', '⿳口⿰口口⿰木木', '⿰口口', '⿱木⿰木木',
      '⿱⿱⿰口口口木', '⿱⿰口⿱口口木', '⿱⿰⿱口口口木'])
      expect(pyramidOnBase(tree(text))).toBeNull()
    expect(pyramidOnBase(tree('⿳口⿰口口木'), { minLayers: 3 })).toBeNull()
    expect(pyramidOnBase(tree('⿳口⿰口口木'), { minLayers: 1 })).toBeNull()
  })
})

describe('the preview limits of a pyramid on a base', () => {
  it('counts its layers, its cell and its base', () => {
    expect(tooLarge(tree('⿱' + pyramidSequence('口', 12) + '木'))).toBe(false)
    expect(tooLarge(tree('⿱' + pyramidSequence('口', PYRAMID_LAYERS) + '木'))).toBe(false)
    expect(tooLarge(tree('⿱' + pyramidSequence('口', PYRAMID_LAYERS + 1) + '木'))).toBe(true)
    const deep = '⿱'.repeat(9) + '口'.repeat(10)
    expect(tooLarge(tree('⿳口⿰口口' + deep))).toBe(true)
    expect(tooLarge(tree('⿳口⿰口口木'))).toBe(false)
  })
})

describe('where a pyramid on a base draws', () => {
  it('has no cells for a count of layers that is no whole number', () => {
    expect(pyramidOnBaseCells([0, 0, 1000, 1000], 2.5)).toEqual([])
    expect(pyramidOnBaseCells([0, 0, 1000, 1000], Number.NaN)).toEqual([])
    expect(pyramidOnBaseLayout([0, 0, 1000, 1000], 2.5).cells).toEqual([])
    expect(pyramidOnBaseLayout([0, 0, 1000, 1000], 2).cells).toHaveLength(3)
  })
})

describe('drawing a pyramid on a base', () => {
  it('draws it in its cells, whichever way the stack is grouped', async () => {
    const source = sourceOf(), texts = ['⿳口⿰口口木', '⿱⿱口⿰口口木', '⿱口⿱⿰口口木']
    const drawings = []
    for (const text of texts) drawings.push((await compose(source, text, { separate: true })).parts)
    for (const parts of drawings.slice(1)) expect(parts).toEqual(drawings[0])
    const [top, left, right, base] = drawings[0]
    expect(drawings[0]).toHaveLength(4)
    const cells = [top, left, right]
    // Equal cells, each wider than it is tall, so the rows read 扁 as they are written by hand.
    expect(new Set(cells.map(cell => cell.box[2].toFixed(6)))).toHaveLength(1)
    expect(new Set(cells.map(cell => cell.box[3].toFixed(6)))).toHaveLength(1)
    for (const cell of cells) expect(cell.box[2]).toBeGreaterThan(cell.box[3] * 1.2)
    // The widest row spans the em's face, and the top sits over its middle.
    const [fx0, , fx1] = constants.face
    const [topBox, leftBox, rightBox, baseBox] = (await sketch(source, texts[0])).map(leaf => leaf.box)
    expect(leftBox[0]).toBeCloseTo(fx0, 6)
    expect(rightBox[0] + rightBox[2]).toBeCloseTo(fx1, 6)
    expect(topBox[0] + topBox[2] / 2).toBeCloseTo((leftBox[0] + rightBox[0] + rightBox[2]) / 2, 6)
    expect(left.box[1]).toBeCloseTo(right.box[1], 6)
    expect(left.box[0]).toBeLessThan(right.box[0])
    expect(top.box[1] + top.box[3]).toBeLessThan(left.box[1])
    expect(base.box[1]).toBeGreaterThan(left.box[1] + left.box[3])
    // The base takes the row's width, so a 木 stands as wide as the 品 above it.
    expect(baseBox[0]).toBeCloseTo(fx0, 6)
    expect(baseBox[0] + baseBox[2]).toBeCloseTo(fx1, 6)
  })

  it('draws a deeper pyramid in its cells too', async () => {
    const source = sourceOf(), text = '⿱' + pyramidSequence('口', 3) + '木'
    const parts = (await compose(source, text, { separate: true })).parts
    expect(parts).toHaveLength(pyramidCount(3) + 1)
    const cells = parts.slice(0, -1), base = parts.at(-1)
    expect(new Set(cells.map(cell => cell.box[2].toFixed(3)))).toHaveLength(1)
    expect(base.box[1]).toBeGreaterThan(Math.max(...cells.map(cell => cell.box[1] + cell.box[3])))
  })

  it('draws a stacked cell and a stacked base whole', async () => {
    const source = sourceOf()
    // Three cells of the stacked description ⿱木口, then the base.
    expect((await compose(source, '⿱' + pyramidSequence('⿱木口', 2) + '永', { separate: true })).parts).toHaveLength(7)
    const parts = (await compose(source, '⿳口⿰口口⿱木口', { separate: true })).parts
    expect(parts).toHaveLength(5)
    const cells = parts.slice(0, 3), base = parts.slice(3)
    for (const part of base) expect(part.box[1]).toBeGreaterThan(Math.max(...cells.map(cell => cell.box[1] + cell.box[3])))
  })

  it('numbers its slots in reading order', async () => {
    const source = sourceOf(), drawn = await compose(source, '⿳⬚⿰⬚⬚⬚', { separate: true })
    expect(drawn.parts).toHaveLength(0)
    expect(drawn.slots.map(slot => slot.index)).toEqual([0, 1, 2, 3])
    const [first, left, right, base] = drawn.slots.map(slot => slot.box)
    expect(first[0] + first[2] / 2).toBeCloseTo((left[0] + right[0] + right[2]) / 2, 6)
    expect(first[1] + first[3]).toBeLessThan(left[1])
    expect(left[0] + left[2]).toBeLessThan(right[0])
    expect(right[1] + right[3]).toBeLessThan(base[1])
    expect(base[2]).toBeGreaterThan(first[2])
  })
})
