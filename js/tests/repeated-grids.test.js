const CHARS = "木口永人大小工土火又水屮㗊燚叕㵘茻林矛彳亍弓𤣩王辛隹亠𧘇方𠂉匕頁𠦝𠆢鬲士冖一殳木日金水火土女子口吉隹魚牛馬羊犬貝毛手耳虫車力森晶鑫淼焱垚姦孨品嚞雥鱻犇驫羴猋贔毳掱聶蟲轟劦夾巫坐"
import { expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { groupParts } from '../src/group-parts.js'
import { files, shards } from './fixtures/small-export.js'

const fixture = (missing = '') => {
  const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
  const extra = shards('g', [...new Set(CHARS)].filter(ch => !missing.includes(ch)).map((ch, i) => [ch, {
    k: ch, G: { v: 1, b: [100, 0, 300 + i, 800], p: [['MLLL', int16([400, 0, 1200 + 4 * i, 0, 1200 + 4 * i, 3200, 400, 3200]), int16(Array(8).fill(0))]] },
    ink: 2000, nl: 1, o: 1,
  }]))
  return createSource(async name => {
    const body = extra[name] ?? files[name]
    return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
  })
}
const inkOnly = drawing => ({ ...drawing, parts: drawing.parts.map(({ leaf: _leaf, ...part }) => part) })

const cases = [["⿰⿱口口⿱口口", "㗊"], ["⿱⿰口口⿰口口", "㗊"], ["⿰⿱火火⿱火火", "燚"], ["⿱⿰火火⿰火火", "燚"], ["⿰⿱又又⿱又又", "叕"], ["⿱⿰又又⿰又又", "叕"], ["⿰⿱水水⿱水水", "㵘"], ["⿱⿰水水⿰水水", "㵘"], ["⿰⿱屮屮⿱屮屮", "茻"], ["⿱⿰屮屮⿰屮屮", "茻"]]

it('uses designed whole glyphs for attested expanded forms without changing their source', async () => {
  const source = fixture()
  for (const [text, char] of cases) {
    for (const separate of [false, true])
      expect((await compose(source, text, { separate })).parts).toEqual((await compose(source, char, { separate })).parts)
    const c = new Composer(source.store())
    expect(c.parse(text)).not.toEqual(char)
  }
})
it('falls back to operands for unavailable or excluded whole glyphs', async () => {
  for (const [text, char] of cases) {
    const source = fixture(char)
    expect((await compose(source, text, { separate: true })).parts.length).toBeGreaterThan(1)
    const available = fixture()
    await compose(available, text)
    const c = new Composer(available.store(), { exclude: [char], separate: true })
    expect(c.compose(text).every(p => p.origin !== `glyph ${char}`)).toBe(true)
  }
})
it('keeps explicit nested forms editable', async () => {
  const source = fixture()
  for (const [text] of cases) {
    const sequence = '⿱木' + text
    const drawing = await compose(source, sequence, { separate: true })
    expect(drawing.parts.length).toBeGreaterThan(2)
    expect(groupParts(drawing.parts, await sketch(source, sequence))).not.toBeNull()
  }
})

it('gives row and column grids the same ink and preserves column leaf order', async () => {
  const source = fixture('㗊燚叕㵘茻')
  for (const part of ['口', '火', '又', '水', '屮']) {
    const col = `⿰⿱${part}${part}⿱${part}${part}`, row = `⿱⿰${part}${part}⿰${part}${part}`
    for (const wrap of [x => x, x => `⿱木${x}`])
      expect(inkOnly(await compose(source, wrap(col), { separate: true }))).toEqual(inkOnly(await compose(source, wrap(row), { separate: true })))
    const a = await sketch(source, col), b = await sketch(source, row)
    expect(a.map(x => x.box)).toEqual([0, 2, 1, 3].map(i => b[i].box))
    expect(groupParts((await compose(source, col, { separate: true })).parts, a)).not.toBeNull()
  }
  const c = new Composer(source.store())
  expect(c.repeatedGrid(c.parse('⿰⿱火口⿱火火'))).toBeNull()
  expect(c.repeatedGrid(c.parse('⿰⿱木木⿱木木'))).toBeNull()
})
