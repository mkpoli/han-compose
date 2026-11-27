import { expect, test } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { pathMask } from '../src/geometry.js'
import { leContextDonors, leContextParts } from '../src/le-context.js'
import { files, shards } from './fixtures/small-export.js'
// Format-7 primary outlines from the five published faces.
import records from './fixtures/chain-component-donors.json' with { type: 'json' }

const frame = '#(丿𠃊)', old = '#(丿𠃊>)'
const compound = chain => '⿻[1:]亅⿱' + chain + '八'
const plain = '⿻亅⿱' + frame + '八'
const alternate = '⿻[1:]丨⿱' + frame + '人'

test('draws the hook, crossing foot and lower strokes from the same native 乐 in each face', async () => {
  for (const [fontStyle, glyphs] of Object.entries(records)) {
    const input = { ...files, ...shards('g', [['乐', { G: glyphs.乐, ink: 6100 }]]) }
    const source = createSource(async name => input[name] ? Uint8Array.from(Buffer.from(input[name])).buffer : null)
    const native = await compose(source, '乐', { fontStyle })
    for (const left of [frame, old]) {
      const key = compound(left), normal = await compose(source, key, { fontStyle })
      expect(normal.d).toBe(native.d)
      expect(normal.approximate).toEqual([])
      for (const ids of [key, '⿰木' + key]) {
        const separate = await compose(source, ids, { fontStyle, separate: true })
        const joined = await compose(source, ids, { fontStyle })
        const layout = await sketch(source, ids, { fontStyle })
        expect(separate.parts.map(p => p.leaf)).toEqual(layout.map(b => b.index))
        const [hook, foot, dots] = separate.parts.slice(-3)
        expect([hook.origin, foot.origin, dots.origin]).toEqual(['亅 from 乐', left + ' from 乐', '八 from 乐'])
        expect(hook.d.match(/M/g)).toHaveLength(1)
        expect(dots.d.match(/M/g)).toHaveLength(2)
        expect(pathMask(separate.d, 300)).toEqual(pathMask(joined.d, 300))
        expect(separate.approximate).toEqual([])
      }
    }
  }
})

test('requires the default source spelling, permitted inputs, and recorded native outlines of 乐', () => {
  const key = compound(old)
  for (const other of [plain, alternate, '⿻[2:]亅⿱' + frame + '八']) expect(leContextDonors(other)).toEqual([])
  for (const excluded of ['乐', key, compound(frame), frame, old, '亅', '八', '丿', '𠃊', '⿱' + old + '八', '⿱' + frame + '八']) {
    expect(leContextParts({ excluded: k => k === excluded, glyphRecord: () => { throw new Error('excluded') } }, key, [])).toBeNull()
  }
  const unknown = { excluded: () => false, glyphRecord: () => records.fangsong.官 }
  expect(leContextParts(unknown, key, [])).toBeNull()
})
