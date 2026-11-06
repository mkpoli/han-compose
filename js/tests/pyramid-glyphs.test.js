const EXTRA_CHARS = catalog.entries.map(r => r.char + r.part + r.sequence + r.pair).join('')
const CHARS = EXTRA_CHARS + "木口永人大小工土火又水屮㗊燚叕㵘茻林矛彳亍弓𤣩王辛隹亠𧘇方𠂉匕頁𠦝𠆢鬲士冖一殳木日金水火土女子口吉隹魚牛馬羊犬貝毛手耳虫車力森晶鑫淼焱垚姦孨品嚞雥鱻犇驫羴猋贔毳掱聶蟲轟劦夾巫坐"
import { expect, it } from 'bun:test'
import catalog from '../src/pyramid-glyphs.json'
import { Composer } from '../src/compose.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { groupParts } from '../src/group-parts.js'
import { files, shards } from './fixtures/small-export.js'

const built = new Map()
/** The export with every glyph but the ones `missing` names; one per distinct set, since building it
 *  hashes and gzips two hundred records. */
const fixture = (missing = '') => {
  if (built.has(missing)) return built.get(missing)
  const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
  const extra = shards('g', [...new Set(CHARS)].filter(ch => !missing.includes(ch)).map((ch, i) => [ch, {
    k: ch, G: { v: 1, b: [100, 0, 300 + i, 800], p: [['MLLL', int16([400, 0, 1200 + 4 * i, 0, 1200 + 4 * i, 3200, 400, 3200]), int16(Array(8).fill(0))]] },
    ink: 2000, nl: 1, o: 1,
  }]))
  const source = createSource(async name => {
    const body = extra[name] ?? files[name]
    return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
  })
  built.set(missing, source)
  return source
}

const cases = [...new Map(catalog.entries.flatMap(({ char, part, sequence, pair }) =>
  [sequence, `⿱${part}${pair}`, `⿱${part}⿰${part}${part}`].map(ids => [ids, char])))]


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
  const available = fixture()
  for (const [text, char] of cases) {
    const source = fixture(char)
    expect((await compose(source, text, { separate: true })).parts.length).toBeGreaterThan(1)
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

it('covers common omissions and preserves distinct non-pyramid shapes', async () => {
  const source = fixture()
  for (const [part, char] of [['鹿', '麤'], ['龍', '龘'], ['石', '磊'], ['金', '鑫'], ['牛', '犇'], ['鳥', '𪈼']])
    expect((await compose(source, `⿱${part}⿰${part}${part}`)).parts).toEqual((await compose(source, char)).parts)
  for (const text of ['⿱⿰木木木', '⿲木木木', '⿱木⿰木口', '⿱口⿰木木']) {
    await compose(source, text)
    const c = new Composer(source.store())
    expect(c.standalonePyramid(c.parse(text))).toBeNull()
  }
})
