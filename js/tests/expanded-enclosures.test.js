const CHARS = "須攸𪧇朕彡頁亻丨攵宀爿月关氺此丙羽山攵木口永人大小工土火又水屮㗊燚叕㵘茻林矛彳亍弓𤣩王辛隹亠𧘇方𠂉匕頁𠦝𠆢鬲士冖一殳木日金水火土女子口吉隹魚牛馬羊犬貝毛手耳虫車力森晶鑫淼焱垚姦孨品嚞雥鱻犇驫羴猋贔毳掱聶蟲轟劦夾巫坐"
import { expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { groupParts } from '../src/group-parts.js'
import { files, shards } from './fixtures/small-export.js'

const fixture = (missing = '', records = []) => {
  const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
  const extra = shards('g', [...new Set(CHARS)].filter(ch => !missing.includes(ch)).map((ch, i) => [ch, {
    k: ch, G: { v: 1, b: [100, 0, 300 + i, 800], p: [['MLLL', int16([400, 0, 1200 + 4 * i, 0, 1200 + 4 * i, 3200, 400, 3200]), int16(Array(8).fill(0))]] },
    ink: 2000, nl: 1, o: 1,
  }]).concat(records))
  return createSource(async name => {
    const body = extra[name] ?? files[name]
    return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
  })
}
const inkOnly = drawing => ({ ...drawing, parts: drawing.parts.map(({ leaf, ...part }) => part) })

const cases = [["⿵⿲彳⿱山一攵", "⿲彳⿱⿱山一{inner}攵"], ["⿴⿰彳亍", "⿲彳{inner}亍"], ["⿴⿰弓弓", "⿲弓{inner}弓"], ["⿴⿰𤣩王", "⿲𤣩{inner}王"], ["⿴⿰辛辛", "⿲辛{inner}辛"], ["⿴⿰隹隹", "⿲隹{inner}隹"], ["⿴⿱亠𧘇", "⿳亠{inner}𧘇"], ["⿸⿰方𠂉", "⿰方⿱𠂉{inner}"], ["⿹⿰匕頁", "⿰⿱匕{inner}頁"], ["⿸⿰𠦝𠆢", "⿰𠦝⿱𠆢{inner}"], ["⿶⿱⿰弓弓鬲", "⿱⿲弓{inner}弓鬲"], ["⿹⿰⿳士冖一殳", "⿰⿱⿳士冖一{inner}殳"]]

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

it('places the mountain host slot below 一 while retaining source leaf indices', async () => {
  const source = fixture()
  await sketch(source, '水')
  const c = new Composer(source.store())
  for (const inner of ['水', '⬚', '⿱木⬚', '⿴行⬚']) {
    const implicit = `⿵⿲彳⿱山一攵${inner}`
    const explicit = `⿲彳⿱⿱山一${inner}攵`
    expect(c.splitEnclosure(c.parse(implicit))).toEqual({
      tree: ['⿲', '彳', ['⿱', ['⿱', '山', '一'], c.parse(inner)], '攵'], innerIndex: 3,
    })
    const target = await sketch(source, explicit)
    // Source order is 彳, 山, 一, 攵, then the inserted subtree.
    const expected = [...target.slice(0, 3), target.at(-1), ...target.slice(3, -1)]
      .map((leaf, index) => ({ ...leaf, index }))
    expect(await sketch(source, implicit)).toEqual(expected)
    const drawing = await compose(source, implicit, { separate: true })
    const actualLeaves = drawing.parts.map(part => part.leaf)
    const explicitDrawing = await compose(source, explicit, { separate: true })
    const sourceIndex = index => index < 3 ? index : index === target.length - 1 ? 3 : index + 1
    const groups = groupParts(explicitDrawing.parts, target)
    expect(groups).not.toBeNull()
    const expectedOwners = []
    for (const group of groups) for (const index of group.parts) expectedOwners[index] = sourceIndex(group.index)
    expect(actualLeaves).toEqual(expectedOwners)
  }
  for (const text of ['⿴⿲彳⿱山一攵水', '⿸⿲彳⿱山一攵水', '⿵⿲彳⿱山二攵水', '⿵⿲彳⿱山一文水'])
    expect(c.splitEnclosure(c.parse(text))).toBeNull()
})

const requestedHosts = [
  ['⿹', '須', '⿰彡頁', '⿰⿱彡{inner}頁', '此', 1, 2],
  ['⿸', '攸', '⿲亻丨攵', '⿲亻丨⿱攵{inner}', '羽', 3, 3],
  ['⿸', '𪧇', '⿱宀爿', '⿱宀⿰爿{inner}', '丙', 2, 2],
  ['⿸', '朕', '⿰月关', '⿰月⿱关{inner}', '氺', 2, 2],
]

it('opens all four requested hosts without changing encoded-host editor ownership', async () => {
  const source = fixture()
  for (const [op, host, spelling, layout, sample, start, outerLeaves] of requestedHosts) {
    for (const inner of [sample, '⬚', '⿱木⬚', '⿴行⬚']) {
      const expanded = layout.replace('{inner}', inner)
      for (const outer of [host, spelling]) {
        const text = op + outer + inner
        for (const separate of [false, true])
          expect(inkOnly(await compose(source, text, { separate }))).toEqual(inkOnly(await compose(source, expanded, { separate })))
        const leaves = await sketch(source, text)
        const renderedLeaves = await sketch(source, expanded)
        const count = renderedLeaves.length - outerLeaves
        const inside = renderedLeaves.slice(start, start + count)
        const first = outer === host ? 1 : outerLeaves
        expect(leaves).toHaveLength(first + count)
        expect(leaves.slice(first)).toEqual(inside.map((leaf, i) => ({ ...leaf, index: first + i })))
        const drawing = await compose(source, text, { separate: true })
        const groups = groupParts(drawing.parts, leaves)
        expect(groups).not.toBeNull()
        expect(groups.length).toBe(leaves.filter(leaf => !leaf.empty).length)
        if (outer === host) expect(drawing.parts.filter(part => part.leaf === 0)).toHaveLength(outerLeaves)
      }
    }
    const c = new Composer(source.store())
    for (const wrong of [op === '⿹' ? '⿸' : '⿹', '⿴', '⿵', '⿱'])
      for (const outer of [host, spelling]) expect(c.splitEnclosure(c.parse(wrong + outer + sample))).toBeNull()
    expect(c.splitEnclosure(c.parse(op + '木' + sample))).toBeNull()
  }
})


it('resolves the expanded native glyph before drawing requested enclosure aliases', async () => {
  const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
  const glyph = (char, width) => [char, { k: char, G: { v: 1, b: [0, 0, width, 800],
    p: [['MLLL', int16([0, 0, width * 4, 0, width * 4, 3200, 0, 3200]), int16(Array(8).fill(0))]] }, ink: 3000, nl: 1, o: 1 }]
  const expanded = '⿲亻丨⿱攵羽'
  const source = fixture('', [glyph('翛', 750), [expanded, { k: expanded, e: '翛' }],
    glyph('甲', 900), ['⿰木' + expanded, { k: '⿰木' + expanded, e: '甲' }]])
  for (const [prefix, native] of [['', '翛'], ['⿰木', '甲']]) {
    const alias = prefix + '⿸攸羽', explicit = prefix + expanded
    const drawing = await compose(source, alias)
    expect(drawing.origins).toEqual(['glyph ' + native])
    expect(drawing).toEqual(await compose(source, explicit))
    const excluded = await compose(source, alias, { exclude: ['翛', '甲'] })
    expect(excluded.origins.some(origin => /glyph (翛|甲)/.test(origin))).toBe(false)
    expect(inkOnly(excluded)).toEqual(inkOnly(await compose(source, explicit, { exclude: ['翛', '甲'] })))
    const separated = await compose(source, alias, { separate: true })
    expect(separated.origins.some(origin => /glyph (翛|甲)/.test(origin))).toBe(false)
    expect(inkOnly(separated)).toEqual(inkOnly(await compose(source, explicit, { separate: true })))
    expect(groupParts(separated.parts, await sketch(source, alias))).not.toBeNull()
  }
  for (const separate of [false, true]) {
    const a = await compose(source, '⿰木⿸攸⿱水⬚', { separate })
    const b = await compose(source, '⿰木⿲亻丨⿱攵⿱水⬚', { separate })
    expect(inkOnly(a)).toEqual(inkOnly(b))
    expect(a.slots).toHaveLength(1)
    expect(a.slots[0].index).toBe(0)
  }
  const c = new Composer(source.store())
  const original = c.parse('⿰木⿸攸羽')
  expect(c.normalizeRequestedEnclosures(original)).toEqual(c.parse('⿰木' + expanded))
  expect(original).toEqual(['⿰', '木', ['⿸', '攸', '羽']])
})

it('uses expanded child features for nested sketches without changing source leaf indices', async () => {
  const source = fixture()
  await source.ready()
  const c = new Composer(source.store())
  c.predict = (op, kids) => {
    const canonical = JSON.stringify(kids[1]) === JSON.stringify(c.parse('⿲亻丨⿱攵羽'))
    const edge = canonical ? 300 : 700
    return [[0, 0, edge, 1000], [edge, 0, 1000, 1000]]
  }
  const alias = c.sketch('⿰木⿸攸羽'), explicit = c.sketch('⿰木⿲亻丨⿱攵羽')
  expect(alias[0]).toEqual(explicit[0])
  expect(alias[2]).toEqual({ ...explicit[4], index: 2 })
  expect(alias.map(leaf => leaf.index)).toEqual([0, 1, 2])
})
