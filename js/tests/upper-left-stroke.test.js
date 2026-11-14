import { describe, expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { compose, createSource } from '../src/loader.js'
import { files, shards } from './fixtures/small-export.js'
import strokes from './fixtures/sans-strokes.json' with { type: 'json' }

// 丿 and 丨 as the Sans export draws them (Noto Sans CJK, SIL OFL 1.1); 口, 木 and 厃 are the
// small export's boxes. No host list names a stroke at the upper left of ⿸.
const source = () => {
  const input = { ...files, ...shards('g', Object.entries(strokes)) }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}
/** The drawn boxes, [left, top, right, bottom] with y running down, by the part's origin. */
const boxes = async (/** @type {string} */ sequence) => {
  const drawn = await compose(source(), sequence, { layout: 'composed' })
  return { stroke: drawn.parts[0], rest: drawn.parts.slice(1), all: drawn.parts }
}
const span = (/** @type {{ box: number[] }[]} */ parts) => [Math.min(...parts.map(p => p.box[0])), Math.min(...parts.map(p => p.box[1])),
  Math.max(...parts.map(p => p.box[0] + p.box[2])), Math.max(...parts.map(p => p.box[1] + p.box[3]))]
const centre = (/** @type {number[]} */ b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]

describe('a bare stroke at the upper left of ⿸', () => {
  it('stands as a tick on the corner of a box and touches it', async () => {
    const { stroke, rest } = await boxes('⿸丿口')
    expect(stroke.origin).toBe('glyph 丿')
    const tick = span([stroke]), box = span(rest)
    // The box keeps the cell's width and the lower three quarters; the tick is above it, its foot
    // on the box's left edge and a little inside its top stroke.
    expect(box[3] - box[1]).toBeGreaterThan(600)
    expect(tick[0]).toBeGreaterThanOrEqual(box[0])
    expect(tick[0]).toBeLessThan(box[0] + 60)
    expect(tick[1]).toBeLessThan(box[1])
    expect(tick[3]).toBeGreaterThan(box[1] + 20)
    expect(tick[3]).toBeLessThan(box[1] + 90)
    expect(tick[2] - tick[0]).toBeLessThan(250)
  })
  it('runs down the left of a part led by a stem, which goes to the lower right', async () => {
    const { stroke, rest } = await boxes('⿸丿木')
    const sweep = span([stroke]), tree = span(rest)
    expect(sweep[2] - sweep[0]).toBeLessThan(480)
    expect(centre(sweep)[0]).toBeLessThan(centre(tree)[0])
    expect(centre(sweep)[1]).toBeLessThan(centre(tree)[1])
    expect(tree[0]).toBeGreaterThan(sweep[0] + 150)
  })
  it('places any other stroke the same way, in its own proportion', async () => {
    const { stroke, rest } = await boxes('⿸丨口')
    const stem = span([stroke]), box = span(rest)
    expect(stem[2] - stem[0]).toBeLessThan(120)
    expect(centre(stem)[0]).toBeLessThan(centre(box)[0])
    expect(centre(stem)[1]).toBeLessThan(centre(box)[1])
    expect(box[0]).toBeGreaterThan(stem[2] - 20)
  })
  it('is the same inside a larger description', async () => {
    const { all } = await boxes('⿰木⿸丿口')
    const tick = all.find(part => part.origin === 'glyph 丿')
    // Parts come in reading order: 木, the tick, then the box it stands on.
    const under = span(all.slice(all.indexOf(tick) + 1))
    expect(tick.box[1]).toBeLessThan(under[1])
    expect(tick.box[0]).toBeGreaterThanOrEqual(under[0])
    expect(tick.box[0] + tick.box[2]).toBeLessThan(under[2])
    expect(tick.box[1] + tick.box[3]).toBeGreaterThan(under[1])
  })
  it('leaves an enclosing part to the enclosure layout', async () => {
    const data = source()
    await compose(data, '⿸厃口', { layout: 'composed' })
    const composer = new Composer(data.store())
    expect(composer.strokeEnclosure(['厃', '口'], composer.face)).toBeNull()
    expect(composer.strokeEnclosure([['⿱', '丿', '口'], '口'], composer.face)).toBeNull()
  })
})
