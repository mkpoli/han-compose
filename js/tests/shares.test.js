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

// 𲎰 is Extension J: Jigmo alone draws it, no sequence describes it and no host holds a cut of it.
it('draws a character only another face draws, with no sequence, in every style', async () => {
  const foreign = character('𲎰', [[100, 0, 300, 800]])
  foreign.G.v = 0
  const input = { ...files, 'identity.json': identityOf(Object.entries({ ...records, '𲎰': foreign })), ...shards('g', [['𲎰', foreign]]) }
  for (const fontStyle of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
    const out = await compose(sourceOf(input), '⿰𲎰口', { separate: true, fontStyle })
    expect(out.origins).toContain('glyph 𲎰')
    const cells = await compose(sourceOf(input), '⿰𲎰口', { separate: true, fontStyle, layout: 'cells' })
    expect(cells.origins).toContain('cells 𲎰')
  }
})

// 𲖀 is ⿰口推 in the bundled Extension J sequences; the export holds Jigmo's outline alone.
it('draws an Extension J character from its sequence, in the parts of the face', async () => {
  const foreign = character('𲖀', [[100, 0, 900, 800]])
  foreign.G.v = 0
  const push = character('推', [[400, 0, 900, 800]])
  const entries = { '𲖀': foreign, 推: push }
  const input = { ...files, 'identity.json': identityOf(Object.entries({ ...records, ...entries })), ...shards('g', Object.entries(entries)) }
  for (const fontStyle of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
    for (const sequence of ['𲖀', '⿱木𲖀', '⿰木𲖀']) {
      const out = await compose(sourceOf(input), sequence, { separate: true, fontStyle })
      expect(out.origins).toContain('glyph 推')
      expect(out.origins).not.toContain('glyph 𲖀')
    }
  }
  // Without 推 the sequence cannot be drawn, and the outline stays.
  const alone = { ...files, 'identity.json': identityOf(Object.entries({ ...records, '𲖀': foreign })), ...shards('g', [['𲖀', foreign]]) }
  expect((await compose(sourceOf(alone), '⿰木𲖀', { separate: true })).origins).toContain('glyph 𲖀')
})
// 𲎰 is 五 without its bottom stroke; no sequence spells that, so the face's own 五 is cut.
it('cuts an Extension J character from the character of the face it is a part of', async () => {
  const foreign = character('𲎰', [[100, 0, 900, 800]])
  foreign.G.v = 0
  const five = character('五', [[100, 0, 900, 80], [200, 80, 280, 700], [600, 80, 680, 700], [100, 700, 900, 780]])
  const entries = { '𲎰': foreign, 五: five }
  const input = { ...files, 'identity.json': identityOf(Object.entries({ ...records, ...entries })), ...shards('g', Object.entries(entries)) }
  for (const fontStyle of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
    for (const sequence of ['𲎰', '⿰𲎰口']) {
      const out = await compose(sourceOf(input), sequence, { separate: true, fontStyle })
      // The upper bar and the two legs, without the bar they stood on.
      expect(out.parts[0].d.match(/M/g)).toHaveLength(3)
    }
  }
  // Without 五 the outline of the other face stays.
  const alone = { ...files, 'identity.json': identityOf(Object.entries({ ...records, '𲎰': foreign })), ...shards('g', [['𲎰', foreign]]) }
  expect((await compose(sourceOf(alone), '𲎰', { separate: true })).parts[0].d.match(/M/g)).toHaveLength(1)
})

// 𲐬 is 巫 without its bottom stroke and with four 人: the 人 on each side of the stem is doubled.
it('draws 𲐬 from the 巫 of the face with a second 人 under each 人', async () => {
  const foreign = character('𲐬', [[100, 0, 900, 800]])
  foreign.G.v = 0
  const shaman = character('巫', [[100, 0, 900, 80], [460, 80, 540, 720], [100, 720, 900, 800], [200, 200, 350, 600], [650, 200, 800, 600]])
  const entries = { '𲐬': foreign, 巫: shaman }
  const input = { ...files, 'identity.json': identityOf(Object.entries({ ...records, ...entries })), ...shards('g', Object.entries(entries)) }
  for (const fontStyle of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
    const out = await compose(sourceOf(input), '𲐬', { separate: true, fontStyle })
    // The bar, the stem and two 人 on each side of it.
    expect(out.parts[0].d.match(/M/g)).toHaveLength(6)
  }
})

// Beside another part the face draws 五 narrow, as in 伍: 𲎰 there is cut from that narrow 五.
it('cuts 𲎰 from the form 五 takes in the place it stands in', async () => {
  const foreign = character('𲎰', [[100, 0, 900, 800]])
  foreign.G.v = 0
  const five = character('五', [[100, 0, 900, 80], [200, 80, 280, 700], [600, 80, 680, 700], [100, 700, 900, 780]])
  const host = character('伍', [[600, 0, 900, 80], [640, 80, 680, 700], [820, 80, 860, 700], [600, 700, 900, 780], [100, 0, 400, 800]])
  const entries = { '𲎰': foreign, 五: five, 伍: host }
  const cut = { h: '伍', i: 1, op: '⿰', ok: ['亻'], v: 1, c: { k: [0, 1, 2, 3], b: [600, 0, 900, 780], fr: [0, 0, 1000, 1000] } }
  const input = { ...files, 'identity.json': identityOf(Object.entries({ ...records, ...entries })), ...shards('g', Object.entries(entries)), ...shards('p', [['R\t五', [cut]]]) }
  const out = await compose(sourceOf(input), '⿰口𲎰', { fontStyle: 'sans' })
  expect(out.origins.some(origin => origin.endsWith(' 伍'))).toBe(true)
  expect(out.origins).not.toContain('glyph 𲎰')
})

// 二 on the left has a cut in another face's font alone; the face's own cut is on the right, in
// 仁, where its bars are spread to the height of 亻.
it('draws bars beside another part from their own glyph, not a cut spread on the facing side', async () => {
  const two = character('二', [[250, 550, 750, 620], [100, 200, 900, 270]])
  const other = character('𠚧', [[100, 100, 400, 170], [100, 700, 400, 770], [600, 0, 900, 800]])
  other.G.v = 0
  const benevolent = character('仁', [[100, 0, 300, 800], [500, 650, 900, 720], [450, 50, 950, 120]])
  const entries = { 二: two, '𠚧': other, 仁: benevolent }
  const left = { h: '𠚧', i: 0, op: '⿰', ok: ['刂'], v: 0, c: { k: [0, 1], b: [100, 100, 400, 770], fr: [0, 0, 1000, 1000] } }
  const right = { h: '仁', i: 1, op: '⿰', ok: ['亻'], v: 1, c: { k: [1, 2], b: [450, 50, 950, 720], fr: [0, 0, 1000, 1000] } }
  const input = { ...files, 'identity.json': identityOf(Object.entries({ ...records, ...entries })), ...shards('g', Object.entries(entries)), ...shards('p', [['L\t二', [left]], ['R\t二', [right]]]) }
  const out = await compose(sourceOf(input), '⿰二口', { fontStyle: 'sans' })
  expect(out.origins).toContain('glyph 二')
  // 木 has an upright, so its facing cut is still taken.
  const wood = { h: '休', i: 1, op: '⿰', ok: ['亻'], v: 1, c: { k: [1, 2], b: [450, 0, 950, 800], fr: [0, 0, 1000, 1000] } }
  const foreign = { h: '𠚧', i: 0, op: '⿰', ok: ['刂'], v: 0, c: { k: [0, 1], b: [100, 100, 400, 770], fr: [0, 0, 1000, 1000] } }
  const rest = character('休', [[100, 0, 300, 800], [450, 500, 950, 570], [670, 0, 730, 800]])
  const more = { ...entries, 休: rest }
  const trees = { ...files, 'identity.json': identityOf(Object.entries({ ...records, ...more })), ...shards('g', Object.entries(more)), ...shards('p', [['L\t木', [foreign]], ['R\t木', [wood]]]) }
  expect((await compose(sourceOf(trees), '⿰木口', { fontStyle: 'sans' })).origins.some(origin => origin.endsWith(' 休'))).toBe(true)
})

// 甲 is ⿺厃木, as 遲 is ⿺辶犀: a part written into it stands beside 木 over the same foot.
it('holds a part written into a lower-left enclosure beside the part already held', async () => {
  const held = { ...character('甲', [[100, 0, 900, 800]]), s: '⿺厃木' }
  const hung = { ...character('乙', [[100, 0, 900, 800]]), s: '⿸厃木' }
  const entries = { 甲: held, 乙: hung }
  const input = { ...files, 'identity.json': identityOf(Object.entries({ ...records, ...entries })), ...shards('g', Object.entries(entries)) }
  const source = sourceOf(input)
  await compose(source, '⿺甲口')
  await compose(source, '⿸乙口')
  const composer = new Composer(source.store(), { fontStyle: 'sans' })
  expect(composer.respelled(['⿺', '甲', '口'])).toEqual(['⿺', '厃', ['⿰', '木', '口']])
  expect(composer.respelled(['⿺', ['⿺', '厃', '木'], '口'])).toEqual(['⿺', '厃', ['⿰', '木', '口']])
  expect(composer.respelled(['⿸', '乙', '口'])).toEqual(['⿸', '厃', ['⿱', '木', '口']])
  // A lower-left enclosure round an upper-left one is no such pair.
  expect(composer.respelled(['⿺', '乙', '口'])).toEqual(['⿺', '乙', '口'])
})

it('keeps the outline of another face when the sequence of its character cannot be drawn', async () => {
  const foreign = { ...character('𲎰', [[100, 0, 300, 800]]), s: '⿰木牙' }
  foreign.G.v = 0
  const input = { ...files, 'identity.json': identityOf(Object.entries({ ...records, '𲎰': foreign })), ...shards('g', [['𲎰', foreign]]) }
  const out = await compose(sourceOf(input), '⿰𲎰口', { separate: true, fontStyle: 'fangsong' })
  expect(out.origins).toContain('glyph 𲎰')
  expect(out.missing ?? []).not.toContain('𲎰')
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
