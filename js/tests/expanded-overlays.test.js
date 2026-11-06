const CHARS = "木口永人大小工土火又水屮㗊燚叕㵘茻林矛彳亍弓𤣩王辛隹亠𧘇方𠂉匕頁𠦝𠆢鬲士冖一殳木日金水火土女子口吉隹魚牛馬羊犬貝毛手耳虫車力森晶鑫淼焱垚姦孨品嚞雥鱻犇驫羴猋贔毳掱聶蟲轟劦夾巫坐爽㸚头⺀"
import { expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { groupParts } from '../src/group-parts.js'
import { files, shards } from './fixtures/small-export.js'

const fixture = (missing = '') => {
  const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
  const extra = shards('g', [
    ...[...new Set(CHARS)].filter(ch => !missing.includes(ch)).map((ch, i) => [ch, {
      k: ch, G: { v: 1, b: [100, 0, 300 + i, 800], p: [['MLLL', int16([400, 0, 1200 + 4 * i, 0, 1200 + 4 * i, 3200, 400, 3200]), int16(Array(8).fill(0))]] },
      ink: 2000, nl: 1, o: 1,
    }]),
    ...mappedCases.map(([k, e]) => [k, { k, e }]),
  ])
  return createSource(async name => {
    const body = extra[name] ?? files[name]
    return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
  })
}

// Mappings from han-compose's Noto Sans CJK export:
// https://glyphatlas.org/atlas/composer/bd0829bc6fbf-sans-compose-layout-v4-f5+letters/
const mappedCases = [["⿻大㸚", "爽"], ["⿻⺀大", "头"]]
const cases = [["⿻大⿰人人", "夾"], ["⿻工⿰人人", "巫"], ["⿻⿰人人土", "坐"], ...mappedCases]

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
it('keeps known overlays separated when the export supplies usable cuts', async () => {
  const source = fixture()
  await compose(source, '⿻大㸚', { separate: true })
  const c = new Composer(source.store(), { separate: true })
  const frame = c.glyph('爽').box
  c.hostsOf = (key, place) => {
    const i = ['⿻0', '⿻1'].indexOf(place), children = ['大', '㸚']
    return i >= 0 && key === children[i] ? [{
      h: '爽', d: '⿻大㸚', op: '⿻', ok: [children[1 - i]], r: 0, k: [0], b: frame, fr: frame,
    }] : []
  }
  expect(c.standaloneExpandedOverlay(c.parse('⿻大㸚'))).toBeNull()
  expect(c.compose('⿻大㸚').map(part => part.origin)).toEqual(['overlay 爽', 'overlay 爽'])
})

it('keeps teacherless overlays in a shared frame when no enclosing room is found', async () => {
  const source = fixture('爽头')
  for (const [text] of mappedCases) await compose(source, text, { separate: true })
  const c = new Composer(source.store(), { separate: true })
  c.room = () => null
  const node = c.node.bind(c)
  for (const [text] of mappedCases) {
    const children = c.parse(text).slice(1)
    for (const region of [[0, 0, 1000, 1000], [100, 200, 600, 700]]) {
      const visited = []
      c.node = (child, box) => { visited.push(child); return node(child, box) }
      const parts = c.overlay(children, region)
      expect(visited.every(child => typeof child === 'string')).toBe(true)
      expect(parts).toHaveLength(2)
      const [a, b] = parts.map(part => part.target)
      expect(Math.min(a[2], b[2]) - Math.max(a[0], b[0])).toBeGreaterThan(0)
      expect(Math.min(a[3], b[3]) - Math.max(a[1], b[1])).toBeGreaterThan(0)
    }
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
