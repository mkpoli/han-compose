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
const inkOnly = drawing => ({ ...drawing, parts: drawing.parts.map(({ leaf, ...part }) => part) })

it('cancels paired transforms before lookup, layout and approximation reporting', async () => {
  const source = fixture()
  for (const op of ['⿾', '⿿']) for (const text of ['木', '⿰木口', '⿱⬚木']) {
    for (const wrap of [x => x, x => `⿱口${x}`]) {
      const original = wrap(text), doubled = wrap(op + op + text)
      for (const separate of [false, true]) expect(await compose(source, doubled, { separate })).toEqual(await compose(source, original, { separate }))
      expect(await sketch(source, doubled)).toEqual(await sketch(source, original))
    }
    expect(await compose(source, op.repeat(3) + text)).toEqual(await compose(source, op + text))
    expect(await compose(source, op.repeat(4) + text)).toEqual(await compose(source, text))
  }
  const c = new Composer(source.store())
  const mixed = c.parse('⿾⿿木')
  expect(c.cancelTransforms(mixed)).toEqual(mixed)
})
