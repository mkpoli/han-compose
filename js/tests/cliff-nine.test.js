import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { referenceLayout } from '../src/reference-layout.js'
import { files, records, shards } from './fixtures/small-export.js'

const src = () => {
  const glyphs = { ...records, 厂: records.口, 九: records.口 }
  const input = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async key => input[key] === undefined ? null : Uint8Array.from(Buffer.from(input[key])).buffer)
}

it('fits balanced, full-scale 厂 and weighted 九 for ⿸厂九 across all five faces', async () => {
  const source = src()
  for (const style of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
    const entry = referenceLayout(['⿸', '厂', '九'], style)
    expect(entry).not.toBeNull()
    const [, cliff] = entry.cells[0]
    const [, nine, weight] = entry.cells[1]
    // 厂 fills the em frame; 九 sits cleanly beneath 厂's roof and aligns with its baseline.
    expect(cliff[2] - cliff[0]).toBeGreaterThan(930)
    expect(cliff[3] - cliff[1]).toBeGreaterThan(920)
    expect(nine[0]).toBeGreaterThan(cliff[0] + 200)
    expect(cliff[3] - nine[3]).toBeGreaterThan(170)
    expect(Math.abs(nine[1] - cliff[1])).toBeLessThanOrEqual(10)
    expect(weight).toBeDefined()
    if (style === 'pen-writing') {
      expect(weight[0]).toBeLessThan(0)
      expect(weight[1]).toBeLessThan(0)
    } else {
      expect(weight[0]).toBeGreaterThan(0)
      expect(weight[1]).toBeGreaterThan(0)
    }

    const options = { fontStyle: style }
    const boxes = await sketch(source, '⿸厂九', options)
    const drawn = await compose(source, '⿸厂九', options)
    expect(boxes.map(p => p.box)).toEqual(drawn.parts.map(p => p.box))
    expect((await compose(source, '⿸厂九', { ...options, separate: true })).d).toBe(drawn.d)
  }
})
