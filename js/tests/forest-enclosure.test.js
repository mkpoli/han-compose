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

const cases = [["⿴林", "⿲木{inner}木"], ["⿴⿰木木", "⿲木{inner}木"]]

it('opens only supported enclosure hosts and keeps editable leaf ownership', async () => {
  const source = fixture()
  for (const [prefix, layout] of cases) for (const inner of ['木', '⬚', '⿱木⬚', '⿴行⬚']) {
    const text = prefix + inner, explicit = layout.replace('{inner}', inner)
    for (const separate of [false, true])
      expect(inkOnly(await compose(source, text, { separate }))).toEqual(inkOnly(await compose(source, explicit, { separate })))
    const leaves = await sketch(source, text)
    const drawing = await compose(source, text, { separate: true })
    const groups = groupParts(drawing.parts, leaves)
    expect(groups).not.toBeNull()
    expect(groups.length).toBe(leaves.filter(leaf => !leaf.empty).length)
    expect(leaves.filter(x => x.empty).length).toBe(inner.includes('⬚') ? 1 : 0)
  }
  const c = new Composer(source.store())
  for (const text of ['⿵⿰彳亍木', '⿴⿰火木口', '⿵林木', '⿱林木']) expect(c.splitEnclosure(c.parse(text))).toBeNull()
})
