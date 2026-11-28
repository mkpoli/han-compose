import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { character, files, records, shards } from './fixtures/small-export.js'

const source = () => {
  const base = (ch, cross, foot) => character(ch, [
    [470, 0, 530, 820], [500 - cross, 330, 500 + cross, 380], [500 - foot, 0, 500 + foot, 50],
  ])
  const data = { ...files, ...shards('g', Object.entries({
    ...records, 土: base('土', 300, 440), 士: base('士', 440, 300), 吅: { s: '⿰口口' }, 測: { s: '⿰口⿱口口' },
  })) }
  return createSource(async name => data[name] === undefined ? null : new Uint8Array(Buffer.from(data[name])).buffer)
}

for (const base of ['土', '士']) {
  it(`puts a pair in the two upper openings of ${base}`, async () => {
    const src = source()
    for (const row of ['⿰口口', '吅']) {
      const seq = '⿻' + row + base
      const cold = await sketch(src, seq)
      const { parts } = await compose(src, seq, { separate: true })
      expect(parts).toHaveLength(3)
      const [left, right, frame] = parts.map(p => p.box)
      expect(left[0] + left[2]).toBeLessThan(frame[0] + frame[2] / 2)
      expect(right[0]).toBeGreaterThan(frame[0] + frame[2] / 2)
      for (const corner of [left, right])
        expect(corner[1] + corner[3]).toBeLessThan(frame[1] + 0.62 * frame[3])
      expect(await sketch(src, seq)).toEqual(cold)
      if (row === '吅') expect(parts.map(p => p.leaf)).toEqual([0, 0, 1])
    }
    const { parts } = await compose(src, '⿱⿰口口' + base, { separate: true })
    expect(parts[0].box[1] + parts[0].box[3]).toBeLessThanOrEqual(parts.at(-1).box[1])
  })
}

it('keeps every piece of a compact compound row on the same editable leaf', async () => {
  const { parts } = await compose(source(), '⿻測土', { separate: true })
  expect(parts.map(p => p.leaf)).toEqual([0, 0, 0, 1])
})
