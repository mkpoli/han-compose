import { expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { componentParts, isGroupedForm } from '../src/component-forms.js'
import { files } from './fixtures/small-export.js'

const ids = '⿺辶⿳穴⿰月⿰⿲⿱幺長⿱言馬⿱幺長刂心'
const source = () => createSource(async name => {
  const file = files[name]
  return file === undefined ? null : new Blob([file]).arrayBuffer()
})

for (const fontStyle of ['sans', 'serif']) {
  it(`${fontStyle} keeps biang's native enclosure and eleven editable leaves`, async () => {
    expect(isGroupedForm(ids, fontStyle)).toBe(true)
    const auto = await compose(source(), ids, { fontStyle, separate: true })
    const composed = await compose(source(), ids, { fontStyle, layout: 'composed' })
    expect(auto.cells).toBeUndefined()
    expect(auto.parts).toHaveLength(11)
    expect(auto.d).toBe(composed.d)
    expect(auto.approximate).toEqual([])
    expect(auto.missing).toEqual([])
    expect(auto.d).not.toMatch(/NaN|Infinity/)
    const [walk, cave, moon, thread, long, speech, horse, rightThread, rightLong, knife, heart] = componentParts(ids, undefined, fontStyle)
    // 辶 runs under the whole interior, rather than occupying a narrow left cell.
    expect(walk.target[2] - walk.target[0]).toBeGreaterThan(900)
    expect(walk.target[1]).toBeLessThan(heart.target[1])
    expect(cave.target[3]).toBeGreaterThan(knife.target[3])
    expect(thread.target[1]).toBeGreaterThan(long.target[3] - 30)
    expect(rightThread.target[1]).toBeGreaterThan(rightLong.target[3] - 30)
    expect(speech.target[1]).toBeGreaterThan(horse.target[3] - 30)
    expect(moon.target[0]).toBeLessThan(thread.target[0])
    expect(knife.target[0]).toBeGreaterThan(rightLong.target[2] - 30)
    for (const part of auto.parts) expect(part.origin).toContain('Noto')
  })

  it(`${fontStyle} preserves native grouped placement when nested`, async () => {
    const result = await compose(source(), `⿰木${ids}`, { fontStyle, separate: true })
    expect(result.parts).toHaveLength(12)
    expect(result.cells).toBeUndefined()
    expect(result.d).not.toMatch(/NaN|Infinity/)
  })
}

it('does not substitute Noto biang outlines for Kaisho', () => {
  expect(isGroupedForm(ids, 'kaisho')).toBe(false)
  expect(componentParts(ids, undefined, 'kaisho')).toBeNull()
})
