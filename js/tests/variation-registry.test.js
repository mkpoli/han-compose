import { expect, test } from 'bun:test'
import { createVariationRegistry, ivdCollections, ivdFamilies, ucvFamilies } from '../src/variation-registry.js'
import { exactRateForm, rateRegistry, rateVariationFamilies } from '../src/rate-forms.js'

const registrations = `# IVD 2026-08-03
7387 E0100; Adobe-Japan1; CID+3952
7387 E0101; Adobe-Japan1; CID+14085
7387 E0102; Hanyo-Denshi; JA4608
7387 E0102; Moji_Joho; MJ017116
`
const source = { document: 'IRG N2978', revision: '8302302d615ff1c1f60ae335b118b10060be0ed4' }
const entries = [
  { id: '30', kind: 'unifiable', level: 1, group: 'a-2', components: '率', forms: [{ glyph: 'aj1-03952' }, { glyph: 'aj1-14085' }] },
  { id: '305', kind: 'unifiable', forms: [{ glyph: 'u2ff1', text: '⿱' }, { glyph: 'u2ff8', text: '⿸' }] },
]
const collections = ivdCollections(String.raw`Adobe-Japan1; CID\+[0-9]+; https://www.unicode.org/ivd/adobe-japan1/
Hanyo-Denshi; [A-Z][A-Z][0-9A-F]+S*; https://www.unicode.org/ivd/hanyo-denshi/
Moji_Joho; MJ[0-9]{6}; https://www.unicode.org/ivd/moji_joho/`)
const ivd = ivdFamilies(registrations, '2026-08-03', collections)
const criteria = ucvFamilies({ entries, source, groups: [] })
const registry = createVariationRegistry([...rateVariationFamilies, ...ivd, ...criteria])

test('a form keeps every registration and the published component criterion stays independent', () => {
  expect(registry.familiesFor('率').map(f => f.id)).toEqual(['rate/率', 'IVD/7387', 'UCV/30'])
  expect(registry.at('⿰木率󠄂', [1]).find(hit => hit.family.id === 'IVD/7387').forms[0]).toEqual({
    id: 'E0102', text: '率󠄂', registrations: [
      { collection: 'Hanyo-Denshi', identifier: 'JA4608' },
      { collection: 'Moji_Joho', identifier: 'MJ017116' },
    ],
  })
  expect(registry.familiesFor('率󠄂').find(f => f.id === 'IVD/7387').source.collections[0])
    .toEqual({ collection: 'Adobe-Japan1', pattern: String.raw`CID\+[0-9]+`, url: 'https://www.unicode.org/ivd/adobe-japan1/' })
  expect(registry.select('率', [], 'IVD/7387', 'E0100')).toBe('率󠄀')
  expect(exactRateForm('率󠄀').sources[0]).toEqual({ family: 'UCV/30', form: '1' })
  expect(registry.match('rate/率', { center: '1' }).every(form => !form.sources.length)).toBe(true)
  expect(registry.select('⿰#(H)率', [1], 'IVD/7387', 'E0101')).toBe('⿰#(H)率󠄁')
  expect(() => registry.select('⿰木率', [0], 'IVD/7387', 'E0102')).toThrow()
  expect(() => registry.select('⿰木率', [42], 'IVD/7387', 'E0102')).toThrow()
  expect(() => registry.select('率', [], 'IVD/7387', 'E0104')).toThrow()
})

test('axes are localized in a witness; registered subjects with unknown traits remain unidentified', () => {
  const [family] = rateRegistry.familiesFor('蟀')
  expect(family.axes[0].locus).toEqual([{ path: [1, 1, 0, 1] }])
  expect(family.axes[1].locus).toHaveLength(2)
  expect(rateRegistry.at('⿰蟀蟀', [1])[0].forms).toEqual([])
  const [selected] = rateRegistry.match(family.id, { center: '2', sides: '2' })
  expect(rateRegistry.select('⿰蟀蟀', [1], family.id, selected.id)).toBe('⿰蟀⿰虫率󠄁')
  expect(rateRegistry.at('⿰蟀⿰虫率󠄁', [1])[0].forms).toEqual([selected])
  expect(rateRegistry.at('⿰蟀⿰虫率󠄁', [1, 1])[0].family.id).toBe('rate/率')
  expect(rateRegistry.match(family.id, { sides: 'unknown' })).toEqual([])
  expect(() => createVariationRegistry([{ ...family, reference: '木' }])).toThrow('Invalid locus')
})

test('a criterion retains contextual evidence and source form order; named glyphs are one IDS operand', () => {
  const [criterion] = registry.familiesFor('&GW-aj1-03952;')
  expect(criterion.entry).toEqual(entries[0])
  expect(criterion.source).toEqual(source)
  expect(() => registry.select('率', [], 'UCV/30', '2')).toThrow('explicit replacement')
  expect(registry.select('⿰率率', [0], 'UCV/30', '2', { asReplacement: true })).toBe('⿰&GW-aj1-14085;率')
  expect(registry.at('⿰&GW-u2ff1;率', [0])[0].forms[0].glyph).toBe('u2ff1')
  const repeated = { id: '213a', kind: 'unifiable', forms: Array(2).fill({ text: '⿱𰋣日', glyph: 'u2ff1-u302e3-u65e5' }) }
  const imported = ucvFamilies({ entries: [repeated], source, groups: [] })
  expect(createVariationRegistry(imported).at('⿱𰋣日', [])[0].forms.map(f => f.id)).toEqual(['1', '2'])
  const negative = { id: '264a', kind: 'not-unifiable', components: '\uf618⿱士冖',
    forms: [{ glyph: 'cdp-8d44' }, { glyph: 'cdp-8d44-var-001' }], sourceSeparations: [['殻', '殼']] }
  const n = createVariationRegistry(ucvFamilies({ entries: [negative], source, groups: [] }))
  expect(n.familiesFor('⿱士冖')[0]).toMatchObject({ id: 'NUCV/264a', evidenceOnly: true, entry: negative })
  expect(() => n.select('⿱士冖', [], 'NUCV/264a', '2')).toThrow('explicit replacement')
})

test('a custom family represents an observed combination without inventing a missing one', () => {
  const [rate] = rateVariationFamilies.filter(f => f.id === 'rate/率')
  const subset = { ...rate, id: 'subset', forms: [rate.forms[0], rate.forms[3]] }
  const r = createVariationRegistry([subset])
  expect(r.match('subset', { center: '1', sides: '2' })).toEqual([])
  subset.forms.pop()
  expect(r.match('subset', { center: '2', sides: '2' })).toHaveLength(1)
  expect(() => createVariationRegistry([{ ...subset, forms: [] }])).toThrow('Empty family')
  expect(() => createVariationRegistry([{ ...subset, axes: [{ ...rate.axes[0], locus: [{ path: [1.5] }] }] }])).toThrow('Invalid locus')
  const [first] = rate.forms
  expect(() => createVariationRegistry([{ ...subset, forms: [{ ...first, text: '⿱率' }] }])).toThrow('Invalid form')
  expect(() => createVariationRegistry([{ ...subset, forms: [first, { ...first, id: 'ambiguous' }] }])).toThrow('Ambiguous spelling')
  expect(() => ivdFamilies('0041 E0100; Adobe-Japan1; CID+1', '2026-08-03')).toThrow('Invalid IVD base')
  expect(() => ivdFamilies('FA5D E0100; Adobe-Japan1; CID+1', '2026-08-03')).toThrow('Invalid IVD base')
  expect(() => ivdFamilies('7387 FE00; Adobe-Japan1; CID+3952', '2026-08-03')).toThrow('Invalid IVD record')
})
