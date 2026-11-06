import { describe, expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { Composer } from '../src/compose.js'
import { EM_BOX, fill, pathRings } from '../src/geometry.js'
import { groupParts } from '../src/group-parts.js'
import { files, shards } from './fixtures/small-export.js'
import fontRecords from './fixtures/right-enclosure-fonts.json' with { type: 'json' }

// Contours from the project's Noto and Kureedo/GenZui exports, SIL OFL 1.1.
const sourceOf = (style, weighted = false) => {
  const manifest = JSON.parse(files['manifest.json'])
  manifest.weighted = weighted
  const input = { ...files, 'manifest.json': JSON.stringify(manifest), ...shards('g', Object.entries(fontRecords[style])) }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}
const pairs = [['⿽水丶', '氷', 2], ['⿽十⺀', '斗', 2], ['⿽人⿰𠄌丶', '以', 3], ['⿽戈从', '㦰', 2]]
const mask = d => [...fill(pathRings(d), 128, EM_BOX)]

describe('editable lower-right enclosure glyphs', () => {
  for (const style of ['sans', 'serif', 'klee']) for (const [text, character, count] of pairs) {
    if (!fontRecords[style][character]) continue
    it(`preserves ${character} in ${style} with ${count} adjustable leaves`, async () => {
      const source = sourceOf(style)
      const native = await compose(source, character)
      const separated = await compose(source, text, { separate: true })
      expect(separated.parts).toHaveLength(count)
      expect(separated.origins).toEqual(Array(count).fill(`glyph ${character}`))
      expect(separated.approximate).toEqual([])
      expect(mask(separated.d)).toEqual(mask(native.d))
      const separatePaths = separated.parts.map(part => mask(part.d))
      expect(separatePaths[0].map((_, i) => Number(separatePaths.some(path => path[i])))).toEqual(mask(native.d))
      const groups = groupParts(separated.parts, await sketch(source, text))
      expect(groups?.map(group => group.parts)).toEqual(Array.from({ length: count }, (_, i) => [i]))
    })
  }
  for (const [text, character] of pairs) it(`keeps ${character} unchanged when adjustment opens in a weighted font`, async () => {
    const source = sourceOf('sans', true)
    const normal = await compose(source, text)
    const separated = await compose(source, text, { separate: true })
    expect(normal.origins).toEqual([`glyph ${character}`])
    expect(mask(separated.d)).toEqual(mask(normal.d))
  })
  it('preserves the editable leaves when nested in a larger description', async () => {
    const source = sourceOf('sans', true)
    const text = '⿱木⿽水丶'
    const normal = await compose(source, text)
    const drawing = await compose(source, text, { separate: true })
    expect(drawing.origins).toEqual(['glyph 木', 'glyph 氷', 'glyph 氷'])
    expect(groupParts(drawing.parts, await sketch(source, text))?.map(group => group.parts)).toEqual([[0], [1], [2]])
    expect(mask(drawing.d)).toEqual(mask(normal.d))
  })
  it('keeps an expanded character together as one editor leaf', async () => {
    const source = sourceOf('sans', true), text = '⿱木㦰'
    const drawing = await compose(source, text, { separate: true })
    expect(drawing.origins).toEqual(['glyph 木', 'glyph 㦰'])
    expect(groupParts(drawing.parts, await sketch(source, text))?.map(group => group.parts)).toEqual([[0], [1]])
  })
  it('allows a squeezed character to expand through its components', async () => {
    const records = { ...fontRecords.sans, 戈: { ...fontRecords.sans['氷'], s: null }, 从: { ...fontRecords.sans['斗'], s: null } }
    const input = { ...files, ...shards('g', Object.entries(records)) }
    const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
    const drawing = await compose(source, '㦰', { face: [0, 0, 100, 900] })
    expect(drawing.origins).toEqual(['glyph 戈', 'glyph 从'])
  })
  for (const text of ['⿲木⿽水丶木', '⿳木⿽水丶木']) it(`keeps the native shape in ${text}`, async () => {
    const source = sourceOf('sans', true)
    const normal = await compose(source, text)
    const separated = await compose(source, text, { separate: true })
    expect(groupParts(separated.parts, await sketch(source, text))?.map(group => group.parts)).toEqual([[0], [1], [2], [3]])
    expect(mask(separated.d)).toEqual(mask(normal.d))
  })
  it('does not use a cut for a different glyph with the same character', async () => {
    const source = sourceOf('sans')
    await source.ready()
    await source.load(source.filesOf(['氷']))
    const original = source.store(), record = structuredClone(fontRecords.sans['氷'])
    record.G.p[0][0] += 'L'
    const composer = new Composer({ ...original, rec: key => key === '氷' ? record : original.rec(key) }, { separate: true })
    expect(composer.enclosureParts(composer.parse('⿽水丶'), composer.face)).toBeNull()
  })
  it('respects an excluded reference character', async () => {
    const source = sourceOf('sans')
    await source.ready()
    await source.load(source.filesOf(['氷']))
    const composer = new Composer(source.store(), { separate: true, exclude: ['氷'] })
    expect(composer.enclosureParts(composer.parse('⿽水丶'), composer.face)).toBeNull()
  })
  it('still reports a different geometrically composed enclosure as approximate', async () => {
    const drawing = await compose(sourceOf('sans'), '⿰⿽水丶⿽永木', { separate: true })
    expect(drawing.approximate).toEqual(['⿽'])
  })
  it('combines native enclosure and component-form approximation handling', async () => {
    for (const style of ['sans', 'serif']) for (const separate of [false, true]) {
      const source = sourceOf(style)
      const grouped = await compose(source, '⿱⿰冫⿾冫⿽水丶', { fontStyle: style, separate })
      expect(grouped.origins).toContain('glyph 氷')
      expect(grouped.approximate).toEqual([])
      const mirrored = await compose(source, '⿱⿽水丶⿾木', { fontStyle: style, separate })
      expect(mirrored.origins).toContain('glyph 氷')
      expect(mirrored.approximate).toEqual(['⿾'])
    }
  })
})
