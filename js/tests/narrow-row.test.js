import { describe, expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { character, constants, files, records, shards } from './fixtures/small-export.js'

// 甲 stands for a character with a description: three bars over a box, spelled ⿱三口. The other
// parts are the small export's boxes, and its layout is all zeros, so the composer's shares set
// every row.
const stacked = { ...character('甲', [[120, 620, 880, 700], [160, 480, 840, 560], [120, 340, 880, 420], [120, -40, 880, 240]]), s: '⿱三口' }
const source = () => {
  const input = { ...files, ...shards('g', Object.entries({ ...records, 甲: stacked })) }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}
const drawn = async (/** @type {string} */ sequence) => (await compose(source(), sequence, { layout: 'composed' })).parts
const heights = (/** @type {{ box: number[] }[]} */ parts) => parts.map(part => Math.round(part.box[3]))

describe('a pair written as an operand of a row along its own axis', () => {
  it('fill their quarter columns as the operands of a row of three fill theirs', async () => {
    const quarter = await drawn('⿰⿰口木⿰木口')
    expect(quarter.map(part => part.origin)).toEqual(['glyph 口', 'glyph 木', 'glyph 木', 'glyph 口'])
    // Held to the proportions a glyph keeps elsewhere, each stood about 400 units high in a column
    // of 922. A column of ⿲口木口 is the cell's full height.
    expect(Math.min(...heights(quarter))).toBeGreaterThan(800)
    expect(Math.max(...heights(await drawn('⿲口木口')))).toBeLessThanOrEqual(Math.max(...heights(quarter)))
  })
  it('fill their quarter rows in a stack of stacks', async () => {
    const quarter = await drawn('⿱⿱口木⿱木口')
    expect(Math.min(...quarter.map(part => Math.round(part.box[2])))).toBeGreaterThan(600)
  })
  it('draw a character whole where the parts of its description would leave the column short', async () => {
    const parts = await drawn('⿰⿰甲木⿰木口')
    expect(parts.map(part => part.origin)).toEqual(['glyph 甲', 'glyph 木', 'glyph 木', 'glyph 口'])
    expect(Math.min(...heights(parts))).toBeGreaterThan(800)
  })
  it('leave a row of three drawing a character from its description', async () => {
    const parts = await drawn('⿲甲木口')
    expect(parts.map(part => part.origin)).toEqual(['glyph 三', 'glyph 口', 'glyph 木', 'glyph 口'])
  })
  it('leave a pair in the room of an enclosure, or in a stack beside a row, as it was', async () => {
    // Neither pair stands beside another part along its own axis: each glyph keeps its proportions.
    for (const sequence of ['⿴口⿰木扌', '⿸厃⿰木扌']) {
      const wood = (await drawn(sequence)).find(part => part.origin === 'glyph 木')
      expect(wood?.box[3]).toBeLessThan(700)
    }
    const under = await drawn('⿱口⿰木扌')
    expect(under.find(part => part.origin === 'glyph 木')?.box[3]).toBeLessThan(500)
  })
  it('leave a pair that is the whole description as it was', async () => {
    const parts = await drawn('⿰甲木')
    // At half the width the description is drawn: the bars and the box, then 木.
    expect(parts.map(part => part.origin)).toEqual(['glyph 三', 'glyph 口', 'glyph 木'])
  })
})

describe('a character in a band of a stack of three', () => {
  it('is flattened no further than CELL_STRETCH', async () => {
    const middle = (await drawn('⿳木永木')).find(part => part.origin === 'glyph 永')
    expect(middle).toBeDefined()
    if (!middle) return
    // 永 is a square in the fixture, so its box's proportions are its stretch; weighting widens
    // the drawn box a little past the fitted one. Filling the band it would be over four to one.
    const stretch = middle.box[2] / middle.box[3]
    expect(stretch).toBeGreaterThan(constants.STRETCH)
    expect(stretch).toBeLessThan(constants.CELL_STRETCH * 1.15)
  })
})
