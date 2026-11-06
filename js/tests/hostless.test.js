// What the composer does when the export carries no host lists, or lists some operands only.
//
// A hosted export cuts a part out of another character's glyph; a host-less one has none to cut, so
// its learned boxes would stretch whole glyphs into component shapes. The composer falls back to the
// plain shares there, and the drawing keeps whole glyphs.
import { describe, expect, it } from 'bun:test'
import { compose, sketch } from '../src/loader.js'
import { files, layout, ops } from './fixtures/small-export.js'
import { sourceOver } from './support.js'

// A layout that puts the two operands of ⿰ in fixed boxes, whatever they are: the network's weights
// are zero and its last biases are the boxes, in thousandths.
const LEFT = [40, -80, 440, 840], RIGHT = [560, -80, 960, 840]
const seats = boxes => ({ ...layout, seeds: [[{ shape: [ops.length + 2 * 81, 8], data: Buffer.alloc(2 * (ops.length + 162) * 8).toString('base64') },
  Buffer.from(Float32Array.from(boxes.map(v => v / 1000)).buffer).toString('base64')]] })

/** The small export, with the layout's boxes and a manifest that says how many host bytes it holds. */
const exportWith = ({ boxes = [...LEFT, ...RIGHT], hosts }) => sourceOver({
  ...files,
  'layout.json': JSON.stringify(seats(boxes)),
  'manifest.json': JSON.stringify({ ...JSON.parse(files['manifest.json']), files: { ...JSON.parse(files['manifest.json']).files, hosts } }),
})

describe('a host-less export', () => {
  it('lays a sequence out by its plain shares', async () => {
    const boxes = async hosts => (await compose(exportWith({ hosts }), '⿰木口')).parts.map(part => part.box)
    const [plain, learned] = [await boxes({ bytes: 0 }), await boxes({ bytes: 1 })]
    // The split follows the learned boxes at x 560; the glyphs fill the full height instead of the
    // learned part boxes, and stay apart.
    expect(learned[1][0]).toBeCloseTo(560, 0)
    expect(plain[0][3]).toBeGreaterThan(learned[0][3] + 100)
    expect(plain[0][0] + plain[0][2]).toBeLessThan(plain[1][0])
  })
  it('narrows a left part to the share the learned boxes give it', async () => {
    const wide = exportWith({ boxes: [40, -80, 360, 840, 420, -80, 960, 840], hosts: { bytes: 0 } })
    const [left, right] = (await compose(wide, '⿰木口')).parts
    expect(left.box[2]).toBeLessThan(right.box[2] * 0.8)
    expect(left.box[3]).toBeCloseTo(right.box[3], 0)
  })
  it('follows the same layout in the sketch, before the drawing arrives', async () => {
    const boxesOf = async hosts => (await sketch(exportWith({ hosts }), '⿰木口')).map(leaf => leaf.box)
    expect((await boxesOf({ bytes: 1 }))[1][0]).toBeCloseTo(560, 0)
    expect((await boxesOf({ bytes: 0 }))[1][0]).toBeLessThan(540)
  })
  it('takes the plain shares for an operand the host lists do not hold', async () => {
    // A hosted export names the places it carries lists for; ⿰木口 has none of them.
    const source = exportWith({ hosts: { bytes: 1 } })
    const [left] = (await compose(source, '⿰木口')).parts
    expect(left.box[3]).toBeGreaterThan(400)
  })
})
