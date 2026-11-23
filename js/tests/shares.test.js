import { expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { Composer } from '../src/compose.js'
import { character, files, identityOf, records, shards } from './fixtures/small-export.js'

const sourceOf = map => createSource(async name => {
  const file = map[name]
  return file === undefined ? null : new Blob([file]).arrayBuffer()
})

// ⿴弜⿳羔䒑夫 draws 弜 as a row of two 弓 round a narrow middle. The row of three must keep the
// old shares, not the crossed pair an export also carries for nested unreadable compounds.
const host = {
  弓: character('弓', [[100, 0, 900, 100], [100, 0, 200, 1000], [800, 0, 900, 1000]]),
  羔: character('羔', [[100, 0, 900, 100], [100, 600, 900, 700]]),
  䒑: character('䒑', [[100, 0, 900, 100]]),
  夫: character('夫', [[100, 0, 900, 100], [450, 0, 550, 800]]),
}
const drawn = { ...records, ...host, 弜: character('弜', [[100, 0, 400, 1000], [600, 0, 900, 1000]]) }
const exportFiles = {
  ...files,
  'identity.json': identityOf(Object.entries(drawn)),
  ...shards('g', Object.entries(host)),
  ...shards('g', [['弜', drawn.弜]]),
}

it('splits 弜 round its inner part and shares the row of three evenly', async () => {
  const out = await compose(sourceOf(exportFiles), '⿴弜⿳羔䒑夫', { separate: true })
  expect(out.parts).toHaveLength(5)
  const [left, top, middle, bottom, right] = out.parts
  expect(left.origin).toBe('glyph 弓')
  expect(right.origin).toBe('glyph 弓')
  // The middle column takes about a third: the crossed shares would leave it a fifth of the weight
  // and make the 弓s wider than it.
  const middleWidth = Math.max(top.box[2], middle.box[2], bottom.box[2])
  expect(middleWidth).toBeGreaterThan(left.box[2])
  expect(middleWidth).toBeGreaterThan(300)
})

it('shares a row of three at the root by the old pair, and a nested unreadable compound by the crossed pair', async () => {
  const source = sourceOf(exportFiles)
  await compose(source, '三')
  const composer = new Composer(source.store(), { fontStyle: 'sans' })
  const row = ['木', '口', '木']
  expect(composer.sharesOf('⿲', row, 0, true)).toEqual({ power: 0.5, crossed: 0, middle: 0.95, gap: 0.04 })
  const nested = ['一', ['⿰', '木', '口'], '二']
  expect(composer.sharesOf('⿳', nested, 1, false)).toEqual({ power: 0.5, crossed: 0.4, middle: 0.75, gap: -0.006 })
  // 三's three bars are three strokes a line down the stack crosses.
  expect(composer.crossings('三', 1)).toBe(3)
})

it('reads an export that keeps the old pair in SHARES', async () => {
  const old = JSON.parse(exportFiles['manifest.json'])
  old.constants = { ...old.constants, SHARES: { '⿲,3': [0.5, 0.95], '⿳,3': [0.85, 0.75] } }
  delete old.constants.SHARES_OLD
  const out = await compose(sourceOf({ ...exportFiles, 'manifest.json': JSON.stringify(old) }), '⿴弜⿳羔䒑夫', { separate: true })
  expect(out.parts).toHaveLength(5)
  const [left, top, middle, bottom] = out.parts
  expect(Math.max(top.box[2], middle.box[2], bottom.box[2])).toBeGreaterThan(left.box[2])
})

// A face that draws neither 䒑 nor a cut of it in the middle: Jigmo's 䒑 stands in, in a Mincho the
// face never asked for. The cut of 䒑 out of 立's lower band is the face's own.
const facing = {
  羔: character('羔', [[100, 600, 900, 700]]),
  夫: character('夫', [[100, 0, 900, 100]]),
  善: character('善', [[100, 0, 900, 900]]),
  立: character('立', [[100, 600, 900, 900], [100, 0, 900, 300]]),
}
facing.䒑 = { ...character('䒑', [[100, 0, 300, 300], [700, 0, 900, 300]]), P: ['B', 'M'] }
facing.䒑.G.v = 0
const facingFiles = {
  ...files,
  'identity.json': identityOf(Object.entries({ ...records, ...facing })),
  ...shards('g', Object.entries(facing)),
  ...shards('p', [
    ['M\t䒑', [{ h: '善', i: 1, op: '⿳', ok: ['羊', '口'], v: 1, c: null }]],
    ['B\t䒑', [{ h: '立', i: 1, op: '⿱', ok: ['亠'], v: 1, c: { k: [1], b: [100, 0, 900, 300], fr: [0, 0, 1000, 1000] } }]],
  ]),
}

it('cuts a component the face does not draw from the same axis of another place', async () => {
  const out = await compose(sourceOf(facingFiles), '⿳羔䒑夫', { separate: true, fontStyle: 'fangsong' })
  expect(out.origins).toContain('host 立')
  expect(out.origins).not.toContain('glyph 䒑')
})

it('keeps the baseline of 丛 when a dental host offers a bar above 从', async () => {
  const people = [[200, 180, 270, 680], [600, 180, 670, 680]]
  const bar = [120, 0, 820, 80]
  const bottom = { ...character('丛', [...people, bar]), P: ['B'] }
  const tooth = character('齔', [...people, [120, 700, 820, 780]])
  const input = {
    ...files,
    ...shards('g', Object.entries({ 丛: bottom, 齔: tooth, 一: character('一', [bar]) })),
    ...shards('p', [['B\t丛', [{ h: '齔', i: 1, op: '⿱', ok: ['一'], j: 1, v: 1, si: 1000, d: 1,
      c: { k: [0, 1, 2], b: tooth.G.b, fr: [0, 0, 1000, 1000] } }]]]),
  }
  for (const fontStyle of ['sans', 'serif']) {
    const src = sourceOf(input)
    const out = await compose(src, '⿱一丛', { fontStyle, separate: true })
    expect(out.parts.map(p => p.origin)).toEqual(['glyph 一', 'glyph 丛'])
    const excluded = await compose(src, '⿱一丛', { fontStyle, exclude: ['丛'] })
    expect(excluded.parts[1].origin).toBe('host 齔')
  }
})
