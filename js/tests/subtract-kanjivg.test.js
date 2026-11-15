// ㇯ of a character and a component or a stroke KanjiVG names in it: the character's own glyph
// without the outlines the export lists for that name (`G.ls`).
import { describe, expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { character, files, records, shards } from './fixtures/small-export.js'

// Three strokes of 兵: a bar, a stem and a dot at the lower right.
const soldier = character('兵', [[100, 400, 900, 460], [470, 100, 530, 820], [700, 0, 800, 100]])
const sourceOver = (gone = null) => {
  const record = gone ? { ...soldier, G: { ...soldier.G, ls: gone } } : soldier
  const input = { ...files, ...shards('g', Object.entries({ ...records, 兵: record, 丶: character('丶', [[450, 350, 550, 450]]) })) }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}
// Boxes are [x, y, width, height], y down in the drawing's 1000-unit box.
const bottom = part => part.box[1] + part.box[3]

describe('a subtraction KanjiVG names', () => {
  it('draws the glyph without the outlines listed for the name', async () => {
    const whole = await compose(sourceOver({ 丶: [2] }), '兵')
    const less = await compose(sourceOver({ 丶: [2] }), '㇯兵丶')
    expect(less.origins).toEqual(['glyph 兵'])
    expect(less.parts).toHaveLength(1)
    expect(less.approximate ?? []).not.toContain('㇯')
    // The dot was the lowest ink: what is left ends above it, and is fitted to the face again.
    expect(less.d.length).toBeLessThan(whole.d.length)
    expect(less.d).not.toBe(whole.d)
    expect(bottom(less.parts[0])).toBeGreaterThan(900)
  })

  it('comes before a drawing of what is left of the character\'s description', async () => {
    // 兵 described as 三 over 丶, with no cut of 三 in the export: KanjiVG's word is taken, not 三 composed alone.
    const described = { ...soldier, s: '⿱三丶', G: { ...soldier.G, ls: { 丶: [2] } } }
    const input = { ...files, ...shards('g', Object.entries({ ...records, 兵: described, 丶: character('丶', [[450, 350, 550, 450]]) })) }
    const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
    expect((await compose(source, '㇯兵丶')).origins).toEqual(['glyph 兵'])
    // Without the list, what is left of the description is composed.
    const plain = { ...files, ...shards('g', Object.entries({ ...records, 兵: { ...soldier, s: '⿱三丶' }, 丶: character('丶', [[450, 350, 550, 450]]) })) }
    const older = createSource(async name => plain[name] === undefined ? null : new Uint8Array(Buffer.from(plain[name])).buffer)
    expect((await compose(older, '㇯兵丶')).origins).not.toEqual(['glyph 兵'])
  })

  it('cuts the second operand out as before where the export lists no such name', async () => {
    for (const source of [sourceOver(), sourceOver({ 丨: [1] })]) {
      const drawn = await compose(source, '㇯兵丶')
      expect(drawn.origins).toEqual(['glyph 兵', 'glyph 丶'])
      expect(drawn.approximate).toContain('㇯')
    }
  })

  it('keeps a part for each operand where the parts are asked for', async () => {
    const drawn = await compose(sourceOver({ 丶: [2] }), '㇯兵丶', { separate: true })
    expect(drawn.origins).toEqual(['glyph 兵', 'glyph 丶'])
  })

  it('takes nothing where every outline would go', async () => {
    const drawn = await compose(sourceOver({ 丶: [0, 1, 2] }), '㇯兵丶')
    expect(drawn.origins).toEqual(['glyph 兵', 'glyph 丶'])
  })
})
