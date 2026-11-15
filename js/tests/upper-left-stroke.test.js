import { describe, expect, it } from 'bun:test'
import { Composer, near, strokeMiddle, topEdgeStart } from '../src/compose.js'
import { commands, makePart, placed } from '../src/geometry.js'
import { compose, createSource } from '../src/loader.js'
import { files, shards } from './fixtures/small-export.js'
import strokes from './fixtures/sans-strokes.json' with { type: 'json' }

// 丿, 丨, 丶, 久, 八, 一 and 古 as the Sans export draws them, with their stroke groups (Noto Sans CJK,
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

/** A placed outline through `points`, [x, y] pairs with y up. */
const shape = (/** @type {number[][]} */ points) => {
  const light = Float64Array.from(points.flat())
  const part = makePart([{ ops: commands('M' + 'L'.repeat(points.length - 1)), light, heavy: light, width: null }])
  return placed(part, part.box, part.box, 0, 'shape')
}
const rect = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) =>
  shape([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])

describe('a bare stroke at the upper left of ⿸', () => {
  it('runs a falling stroke through the corner of a box', async () => {
    const { stroke, rest, all } = await boxes('⿸丿口')
    // The stroke is 久's own first stroke, not the full-height 丿 squeezed.
    expect(stroke.origin).toBe('stroke 久')
    const fall = span([stroke]), box = span(rest), cell = span(all)
    // The box is drawn smaller at the lower right.
    expect(box[2]).toBe(cell[2])
    expect(box[3]).toBe(cell[3])
    expect(box[2] - box[0]).toBeGreaterThan(600)
    expect(box[3] - box[1]).toBeGreaterThan(600)
    // The stroke starts at the top of the cell, right of the box's corner, and ends at the cell's
    // left side, below that corner: the corner lies inside the stroke's box, near its middle.
    expect(fall[1]).toBe(cell[1])
    expect(fall[0]).toBe(cell[0])
    expect(box[0]).toBeGreaterThan(fall[0] + 100)
    expect(box[0]).toBeLessThan(fall[2] - 80)
    expect(box[1]).toBeGreaterThan(fall[1] + 120)
    expect(box[1]).toBeLessThan(fall[3] - 150)
    // It leans as the stroke of 久 does.
    expect((fall[2] - fall[0]) / (fall[3] - fall[1])).toBeGreaterThan(0.6)
    expect(fall[3] - fall[1]).toBeGreaterThan(400)
  })
  it('touches the corner with the stroke', async () => {
    const data = source()
    await compose(data, '⿸丿口', { layout: 'composed' })
    const composer = new Composer(data.store())
    const [fall, ...under] = composer.strokeEnclosure(['丿', '口'], composer.face)
    // The box's upper-left corner, a little inside its strokes, is the stroke's ink.
    const box = [Math.min(...under.map(p => p.target[0])), 0, 0, Math.max(...under.map(p => p.target[3]))]
    const at = strokeMiddle(fall, (fall.target[3] - (box[3] - 30)) / (fall.target[3] - fall.target[1]))
    expect(Math.abs(at - (box[0] + 40))).toBeLessThan(50)
  })
  it('moves the stroke to a bar that starts inside the part', async () => {
    const data = source()
    await compose(data, '⿸丿口', { layout: 'composed' })
    const composer = new Composer(data.store())
    // A leg at the lower left under a bar that starts well inside the part, as the second stroke
    // of 久 does: the part stays and the stroke goes to the bar.
    composer.node = (_node, room) => [rect(room[0], room[1], room[0] + 80, room[1] + 300), rect(room[0] + 400, room[3] - 80, room[2], room[3])]
    const [fall, leg, bar] = composer.strokeEnclosure(['丿', '口'], composer.face)
    expect(leg.target[0]).toBe(composer.face[0])
    const at = strokeMiddle(fall, (fall.target[3] - (bar.target[3] - 40)) / (fall.target[3] - fall.target[1]))
    expect(Math.abs(at - (bar.target[0] + 40))).toBeLessThan(40)
  })
  it('follows the bar of a part short of its room, the two centred together', async () => {
    const data = source()
    await compose(data, '⿸丿一', { layout: 'composed' })
    const composer = new Composer(data.store())
    const [fall, bar] = composer.strokeEnclosure(['丿', '一'], composer.face)
    // The bar's left end lies on the stroke, not under a stroke left at the top of the cell.
    const at = strokeMiddle(fall, (fall.target[3] - (bar.target[1] + bar.target[3]) / 2) / (fall.target[3] - fall.target[1]))
    expect(Math.abs(at - bar.target[0])).toBeLessThan(60)
    const [, bottom, , top] = composer.face
    expect(Math.abs((top - fall.target[3]) - (fall.target[1] - bottom))).toBeLessThan(2)
  })
  it('keeps a part with no corner clear of the stroke', async () => {
    const data = source()
    await compose(data, '⿸丿古', { layout: 'composed' })
    const composer = new Composer(data.store())
    const [fall, ...under] = composer.strokeEnclosure(['丿', '古'], composer.face)
    expect(near([fall], under, composer.face, 0.4 * composer.stem0[0][0])).toBe(false)
    // It moved in from the left to get clear, and no further than it had to.
    const left = Math.min(...under.map(part => part.target[0]))
    expect(left).toBeGreaterThan(composer.face[0] + 20)
    expect(left).toBeLessThan(composer.face[0] + 200)
  })
  it('takes the left stroke of 八 where 久 does not give its stroke', async () => {
    const { stroke } = await boxes('⿸丿口', ['久'])
    expect(stroke.origin).toBe('stroke 八')
  })
  it('draws the own glyph of the stroke where no character gives one', async () => {
    const { stroke, rest } = await boxes('⿸丿口', ['久', '八'])
    expect(stroke.origin).toBe('glyph 丿')
    expect(stroke.box[1] + stroke.box[3]).toBeGreaterThan(span(rest)[1])
  })
  it('sets a part with no such corner under the stroke, at the lower right', async () => {
    const { stroke, rest, all } = await boxes('⿸丿木')
    const fall = span([stroke]), tree = span(rest), cell = span(all)
    expect(stroke.origin).toBe('stroke 久')
    expect(fall[0]).toBe(cell[0])
    expect(fall[1]).toBe(cell[1])
    expect(tree[2]).toBe(cell[2])
    expect(tree[3]).toBe(cell[3])
    // The part starts below the stroke's middle and reaches left under it.
    expect(tree[1]).toBeGreaterThan(centre(fall)[1])
    expect(tree[1]).toBeLessThan(fall[3])
    expect(tree[0]).toBeLessThan(centre(fall)[0])
  })
  it('places any other stroke beside the part, in its own proportion', async () => {
    const { stroke, rest } = await boxes('⿸丨口')
    const stem = span([stroke]), box = span(rest)
    expect(stem[2] - stem[0]).toBeLessThan(120)
    expect(centre(stem)[0]).toBeLessThan(centre(box)[0])
    expect(centre(stem)[1]).toBeLessThan(centre(box)[1])
    expect(box[0]).toBeGreaterThan(stem[2] - 20)
  })
  it('is the same inside a larger description', async () => {
    const { all } = await boxes('⿰木⿸丿口')
    const fall = all.find(part => part.origin === 'stroke 久')
    // Parts come in reading order: 木, the stroke, then the box whose corner it runs through.
    const under = span(all.slice(all.indexOf(fall) + 1))
    expect(fall.box[1]).toBeLessThan(under[1])
    expect(fall.box[0]).toBeLessThan(under[0])
    expect(fall.box[0] + fall.box[2]).toBeGreaterThan(under[0])
    expect(fall.box[1] + fall.box[3]).toBeGreaterThan(under[1])
  })
  it('keeps a dot its own size at the lower right', async () => {
    const { stroke, rest } = await boxes('⿸丿丶')
    const fall = span([stroke]), dot = span(rest)
    expect(dot[2] - dot[0]).toBeLessThan(400)
    expect(dot[3] - dot[1]).toBeLessThan(400)
    expect(centre(dot)[0]).toBeGreaterThan(centre(fall)[0])
    expect(centre(dot)[1]).toBeGreaterThan(centre(fall)[1])
  })
  it('keeps a dot at the upper left the size its glyph has', async () => {
    const { stroke, rest } = await boxes('⿸丶口')
    const dot = span([stroke]), box = span(rest)
    expect(dot[3] - dot[1]).toBeLessThan(500)
    expect(dot[2]).toBeLessThan(box[0])
    expect(dot[1]).toBeLessThan(box[1])
  })
  it('counts a glyph of one outline as a bare stroke only where it has one stroke', async () => {
    const data = source()
    await compose(data, '⿸丿丶', { layout: 'composed' })
    const composer = new Composer(data.store())
    const tall = () => { const [, dot] = composer.strokeEnclosure(['丿', '丶'], composer.face); return dot.target[3] - dot.target[1] }
    const dot = tall()
    // A brush face draws 人 as one outline of two strokes: it is a character, not a dot.
    const record = composer.glyphRecord('丶')
    composer.glyphRecord = ch => ch === '丶' ? { ...record, sg: [[0, [0]], [1, [0]]] } : Composer.prototype.glyphRecord.call(composer, ch)
    expect(tall()).toBeGreaterThan(dot * 1.5)
  })
  it('takes the stroke only from one that is an outline of its own', async () => {
    const data = source()
    // Both donors' glyphs are loaded: 久 by the first drawing, 八 by the one that leaves 久 out.
    await compose(data, '⿸丿口', { layout: 'composed' })
    await compose(data, '⿸丿口', { layout: 'composed', exclude: ['久'] })
    const composer = new Composer(data.store())
    // The stroke is weighted as its donor's glyph is, not as 丿.
    const [fall] = composer.strokeEnclosure(['丿', '口'], composer.face)
    expect(fall.origin).toBe('stroke 久')
    expect(fall.native).toBe(composer.ink('久'))
    expect(fall.native).not.toBe(composer.ink('丿'))
    // A face that joins the strokes of 久: the first two share an outline.
    const record = composer.glyphRecord('久')
    composer.glyphRecord = ch => ch === '久' ? { ...record, sg: [[0, [0]], [1, [0, 2, 3]], [2, [1]]] } : Composer.prototype.glyphRecord.call(composer, ch)
    expect(composer.strokeEnclosure(['丿', '口'], composer.face)[0].origin).toBe('stroke 八')
  })
  it('keeps the stroke in the corner of the cell over a part with no corner of its own', async () => {
    // 丶 leads with a slant and 丨 with a stem: neither is a bar for the stroke to run through.
    for (const sequence of ['⿸丿丶', '⿸丿丨']) {
      const { stroke, all } = await boxes(sequence)
      const cell = span(all)
      expect(stroke.box[0]).toBe(cell[0])
      expect(stroke.box[1]).toBe(cell[1])
      expect(stroke.box[3]).toBeGreaterThan(400)
    }
  })
  it('keeps an empty slot at the lower right', async () => {
    const drawn = await compose(source(), '⿸丿⬚', { layout: 'composed' })
    expect(drawn.parts.map(part => part.origin)).toEqual(['stroke 久'])
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

describe('the top edge a falling stroke meets', () => {
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
    // The stroke meets the bar, not the serif's tip.
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
