import { expect, test } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { documentSource } from '../src/document-source.js'
import { pathMask } from '../src/geometry.js'
import { character, files, shards } from './fixtures/small-export.js'
// Format-7 published outlines from Noto Sans/Serif CJK JP, TW-Kai, Zhuque FangSong and Kureedo.
import glyphs from './fixtures/shi.json' with { type: 'json' }

const angles = ['#(丿𠄌)', '#(丿𠃊)', '#(丿𠄌>)', '#(丿𠃊>)']
const idsOf = left => '⿸' + left + '𫠠'
const component = (char, id) => ({ id, kind: 'component', char })
const sourceOf = entries => {
  const input = { ...files, ...shards('g', entries) }
  return createSource(async name => input[name] ? Uint8Array.from(Buffer.from(input[name])).buffer : null)
}

test('places and edits the two written operands of 氏 from the same native glyph', async () => {
  for (const [fontStyle, G] of Object.entries(glyphs)) {
    const source = sourceOf([['氏', { G, ink: 5760 }]])
    const native = await compose(source, '氏', { fontStyle })
    for (const left of angles) {
      const ids = idsOf(left), root = { id: 'shi', kind: 'operator', op: '⿸', children: [component(left, 'turn'), component('𫠠', 'sweep')] }
      const ordinary = await compose(source, ids, { fontStyle })
      const editable = await compose(source, ids, { fontStyle, separate: true })
      expect(ordinary.d).toBe(native.d)
      expect(editable.parts.map(p => [p.origin, p.leaf])).toEqual([[left + ' from 氏', 0], ['𫠠 from 氏', 1]])
      expect(documentSource({ root }, editable, await sketch(source, ids, { fontStyle })).complete).toBe(true)
      expect(pathMask(editable.d, 300)).toEqual(pathMask(native.d, 300))
      const [turn, sweep] = editable.parts
      expect(turn.box[0]).toBeLessThan(sweep.box[0])
      expect(sweep.box[0] + sweep.box[2]).toBeGreaterThan(turn.box[0] + turn.box[2])
      expect(turn.box[1]).toBeLessThan(sweep.box[1])
    }
    const pair = '⿰' + idsOf(angles[1]) + idsOf(angles[2])
    const ordinary = await compose(source, pair, { fontStyle })
    const editable = await compose(source, pair, { fontStyle, separate: true })
    expect(editable.parts.map(p => p.leaf)).toEqual([0, 1, 2, 3])
    expect(pathMask(editable.d, 300)).toEqual(pathMask(ordinary.d, 300))
  }
})

test('keeps the ordinary component fallback for an excluded, unknown, or mismatched 氏 donor', async () => {
  const strokes = ['丿', '𠃊', '𫠠'].map(char => [char, character(char, [[90, 120, 680, 570]])])
  const flat = idsOf(angles[1]), historical = idsOf(angles[3])
  for (const [G, exclude] of [[glyphs.sans, []], [{ ...glyphs.fangsong, p: glyphs.fangsong.p.slice(1) }, []],
    [glyphs.fangsong, ['氏']], [glyphs.fangsong, [flat]]]) {
    const source = sourceOf([['氏', { G, ink: 5760 }], ...strokes])
    for (const separate of [false, true]) {
      const drawn = await compose(source, historical, { fontStyle: 'fangsong', exclude, separate })
      expect(drawn.d.length).toBeGreaterThan(0)
      expect(drawn.origins.some(origin => origin.includes('氏'))).toBe(false)
    }
  }
})
