import { describe, expect, it } from 'bun:test'
import { Composer, topEdgeStart } from '../src/compose.js'
import { commands, makePart, placed } from '../src/geometry.js'
import { compose, createSource } from '../src/loader.js'
import { files, shards } from './fixtures/small-export.js'
import strokes from './fixtures/sans-strokes.json' with { type: 'json' }

// 丿, 丨, 丶, 白 and 小 as the Sans export draws them, with their stroke groups (Noto Sans CJK,
// SIL OFL 1.1); 口, 木 and 厃 are the small export's boxes. No host list names a stroke at the
// upper left of ⿸.
const source = () => {
  const input = { ...files, ...shards('g', Object.entries(strokes)) }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}
/** The drawn boxes, [left, top, right, bottom] with y running down, by the part's origin. */
const boxes = async (/** @type {string} */ sequence, /** @type {string[]} */ exclude = []) => {
  const drawn = await compose(source(), sequence, { layout: 'composed', exclude })
  return { stroke: drawn.parts[0], rest: drawn.parts.slice(1), all: drawn.parts }
}
const span = (/** @type {{ box: number[] }[]} */ parts) => [Math.min(...parts.map(p => p.box[0])), Math.min(...parts.map(p => p.box[1])),
  Math.max(...parts.map(p => p.box[0] + p.box[2])), Math.max(...parts.map(p => p.box[1] + p.box[3]))]
const centre = (/** @type {number[]} */ b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]

describe('a bare stroke at the upper left of ⿸', () => {
  it('stands as a tick on the corner of a box and touches it', async () => {
    const { stroke, rest, all } = await boxes('⿸丿口')
    // The tick is 白's own first stroke, not the full-height 丿 squeezed.
    expect(stroke.origin).toBe('tick 白')
    const tick = span([stroke]), box = span(rest), cell = span(all)
    // The box is drawn smaller at the lower right; the tick is above it, its foot on the box's
    // left edge and a little inside its top stroke.
    expect(box[2]).toBe(cell[2])
    expect(box[3]).toBe(cell[3])
    expect(box[3] - box[1]).toBeGreaterThan(550)
    expect(box[3] - box[1]).toBeLessThan(700)
    expect(tick[0]).toBeGreaterThanOrEqual(box[0])
    expect(tick[0]).toBeLessThan(box[0] + 60)
    expect(tick[1]).toBeLessThan(box[1])
    expect(tick[3]).toBeGreaterThan(box[1] + 20)
    expect(tick[3]).toBeLessThan(box[1] + 90)
    // It leans: about as wide as it is tall, where the squeezed 丿 stood upright.
    expect((tick[2] - tick[0]) / (tick[3] - tick[1])).toBeGreaterThan(0.6)
    expect(tick[3] - tick[1]).toBeGreaterThan(250)
  })
  it('takes the left stroke of 小 where 白 does not give its tick', async () => {
    const { stroke } = await boxes('⿸丿口', ['白'])
    expect(stroke.origin).toBe('tick 小')
  })
  it('draws the own glyph of the stroke where no character gives a tick', async () => {
    const { stroke, rest } = await boxes('⿸丿口', ['白', '小'])
    expect(stroke.origin).toBe('glyph 丿')
    expect(stroke.box[1] + stroke.box[3]).toBeGreaterThan(span(rest)[1])
  })
  it('runs down the left of a part led by a stem, which goes to the lower right', async () => {
    const { stroke, rest } = await boxes('⿸丿木')
    const sweep = span([stroke]), tree = span(rest)
    expect(sweep[2] - sweep[0]).toBeLessThan(480)
    expect(sweep[3] - sweep[1]).toBeGreaterThan(700)
    expect(centre(sweep)[1]).toBeLessThan(centre(tree)[1])
    // Each keeps a column of its own.
    expect(tree[0]).toBeGreaterThan(sweep[2])
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
    const tick = all.find(part => part.origin === 'tick 白')
    // Parts come in reading order: 木, the tick, then the box it stands on.
    const under = span(all.slice(all.indexOf(tick) + 1))
    expect(tick.box[1]).toBeLessThan(under[1])
    expect(tick.box[0]).toBeGreaterThanOrEqual(under[0])
    expect(tick.box[0] + tick.box[2]).toBeLessThan(under[2])
    expect(tick.box[1] + tick.box[3]).toBeGreaterThan(under[1])
  })
  it('keeps a dot its own size at the lower right', async () => {
    const { stroke, rest } = await boxes('⿸丿丶')
    const sweep = span([stroke]), dot = span(rest)
    expect(dot[2] - dot[0]).toBeLessThan(400)
    expect(dot[3] - dot[1]).toBeLessThan(400)
    expect(centre(dot)[0]).toBeGreaterThan(centre(sweep)[0])
    expect(centre(dot)[1]).toBeGreaterThan(centre(sweep)[1])
  })
  it('keeps a dot at the upper left the size its glyph has', async () => {
    const { stroke, rest } = await boxes('⿸丶口')
    const dot = span([stroke]), box = span(rest)
    expect(dot[3] - dot[1]).toBeLessThan(500)
    expect(dot[2]).toBeLessThan(box[0])
    expect(dot[1]).toBeLessThan(box[1])
  })
  it('does not stand a tick on a stem', async () => {
    const { stroke } = await boxes('⿸丿丨')
    expect(stroke.origin).toBe('glyph 丿')
    expect(stroke.box[3]).toBeGreaterThan(600)
  })
  it('takes a tick only from a stroke that is an outline of its own', async () => {
    const data = source()
    // Both donors' glyphs are loaded: 白 by the first drawing, 小 by the one that leaves 白 out.
    await compose(data, '⿸丿口', { layout: 'composed' })
    await compose(data, '⿸丿口', { layout: 'composed', exclude: ['白'] })
    const composer = new Composer(data.store())
    expect(composer.tick()?.[0]).toBe('白')
    // The tick is weighted as its donor's glyph is, not as 丿.
    const [tick] = composer.strokeEnclosure(['丿', '口'], composer.face)
    expect(tick.native).toBe(composer.ink('白'))
    expect(tick.native).not.toBe(composer.ink('丿'))
    // A face that joins the tick of 白 to its frame: the first two strokes share an outline.
    const record = composer.glyphRecord('白')
    composer.glyphRecord = ch => ch === '白' ? { ...record, sg: [[0, [3]], [1, [3, 2]], [2, [2]], [3, [1]], [4, [0]]] } : Composer.prototype.glyphRecord.call(composer, ch)
    expect(composer.tick()?.[0]).toBe('小')
  })
  it('does not take a slanted stroke for a bar to stand on', async () => {
    // 丶 leads with a slant: the stroke runs down the side instead of standing on it.
    const { stroke } = await boxes('⿸丿丶')
    expect(stroke.box[3]).toBeGreaterThan(400)
  })
  it('keeps an empty slot at the lower right', async () => {
    const drawn = await compose(source(), '⿸丿⬚', { layout: 'composed' })
    expect(drawn.parts.map(part => part.origin)).toEqual(['glyph 丿'])
    expect(drawn.slots).toHaveLength(1)
    const [left, top, width, height] = drawn.slots[0].box
    expect(left + width / 2).toBeGreaterThan(500)
    expect(top + height / 2).toBeGreaterThan(450)
  })
  it('leaves a stroke with a host cut to the enclosure layout', async () => {
    const data = source()
    await compose(data, '⿸丨口', { layout: 'composed' })
    const composer = new Composer(data.store())
    expect(composer.strokeEnclosure(['丨', '口'], composer.face)).not.toBeNull()
    // A face whose export cuts the stroke from a character that has it there draws that cut.
    composer.host = () => ({ record: { h: '后' }, piece: null })
    expect(composer.strokeEnclosure(['丨', '口'], composer.face)).toBeNull()
  })
  it('leaves an enclosing part to the enclosure layout', async () => {
    const data = source()
    await compose(data, '⿸厃口', { layout: 'composed' })
    const composer = new Composer(data.store())
    expect(composer.strokeEnclosure(['厃', '口'], composer.face)).toBeNull()
    expect(composer.strokeEnclosure([['⿱', '丿', '口'], '口'], composer.face)).toBeNull()
  })
})

describe('the top edge a tick stands on', () => {
  /** A placed outline through `points`, [x, y] pairs with y up. */
  const shape = (/** @type {number[][]} */ points) => {
    const light = Float64Array.from(points.flat())
    const part = makePart([{ ops: commands('M' + 'L'.repeat(points.length - 1)), light, heavy: light, width: null }])
    return placed(part, part.box, part.box, 0, 'shape')
  }
  const rect = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) =>
    shape([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
  /** The edge's left end for parts drawn with upright strokes 80 wide and level strokes 40. */
  const edge = (/** @type {any[]} */ ...parts) => {
    const boxes = parts.map(part => part.target)
    const box = [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))]
    return topEdgeStart(parts, box, [80, 40])?.[0] ?? null
  }
  /** The bar's top for the same parts. */
  const bar = (/** @type {any[]} */ ...parts) => {
    const boxes = parts.map(part => part.target)
    const box = [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))]
    return topEdgeStart(parts, box, [80, 40])?.[1] ?? null
  }
  it('is the left end of a box and of a thin bar alike', () => {
    expect(edge(rect(100, 0, 900, 600))).toBeCloseTo(100, 0)
    expect(edge(rect(100, 560, 900, 600))).toBeCloseTo(100, 0)
  })
  it('reads past a corner that stands proud of the bar', () => {
    // A serif on the left stem rises 30 above the bar.
    expect(edge(rect(100, 560, 900, 600), rect(100, 0, 180, 630))).toBeCloseTo(100, 0)
  })
  it('reads past a serif that stands proud at the far end', () => {
    // The serif stands higher over the bar than a bar may lie under the part's top.
    const parts = [rect(100, 560, 900, 600), shape([[820, 600], [900, 600], [870, 780]])]
    expect(edge(...parts)).toBeCloseTo(100, 0)
    // The tick's foot goes by the bar, not by the serif's tip.
    expect(Math.abs(bar(...parts) - 600)).toBeLessThan(6)
  })
  it('is none for a bar a short stem stands through', () => {
    // 中 and 古: the stem rises less than a bar may lie under the top, with the bar on both sides.
    expect(edge(rect(100, 400, 900, 440), rect(460, 0, 540, 520))).toBeNull()
  })
  it('is none for a bar under a stem that rises from its middle', () => {
    // 木 and 申: the bar is not the part's top edge.
    expect(edge(rect(100, 400, 900, 440), rect(460, 0, 540, 600))).toBeNull()
  })
  it('allows a brush bar its slight rise', () => {
    expect(edge(shape([[100, 540], [900, 580], [900, 620], [100, 580]]))).toBeCloseTo(100, 0)
  })
  it('is none for a stroke that falls to the right', () => {
    expect(edge(shape([[100, 560], [900, 480], [900, 520], [100, 600]]))).toBeNull()
  })
  it('is none for a stroke that climbs steeply', () => {
    expect(edge(shape([[100, 300], [900, 560], [900, 600], [100, 340]]))).toBeNull()
  })
  it('is none for a stem', () => {
    expect(edge(rect(100, 0, 180, 600))).toBeNull()
    expect(edge(rect(100, 0, 180, 600), rect(700, 0, 780, 300))).toBeNull()
  })
  it('is none for a bar that starts in the right half', () => {
    expect(edge(rect(100, 0, 180, 300), rect(600, 560, 1000, 600))).toBeNull()
  })
})
