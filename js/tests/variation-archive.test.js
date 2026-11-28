import { expect, test } from 'bun:test'
import { archiveVariation, openVariationArchive } from '../src/variation-archive.js'
import { createVariationBranches, variationBranchesFromJSON } from '../src/variation-branches.js'
import { chooseVariation, realizeVariation, replaceVariation, variationExpression } from '../src/variation-expression.js'
import { createVariationProduct, variationProductFromJSON } from '../src/variation-product.js'
import { createVariationRegistry, ivdFamilies, ucvFamilies } from '../src/variation-registry.js'
import { expression, family as yao, sites } from '../examples/variation-expression/u26201.js'

const unrelated = { id: 'unused', subjects: ['木'], forms: [{ id: '木', text: '木' }] }
const portable = value => JSON.parse(JSON.stringify(value))

test('a nine-member space reopens with the exact original drawings after the current catalogue changes', () => {
  const registry = createVariationRegistry([yao, unrelated])
  const document = {version: 1, expression, dimensions: sites}
  const saved = portable(archiveVariation(registry, document))
  expect(saved.families.map(f => f.id)).toEqual([yao.id])
  const updated = structuredClone(yao)
  updated.forms[0].outline.d = ''
  updated.forms[1].text = '幺'
  const latest = createVariationRegistry([updated])
  expect(() => variationProductFromJSON(latest, saved.document)).toThrow('Changed spelling')

  const reopened = openVariationArchive(saved)
  const recovered = reopened.registry.families[0].forms[0]
  expect(recovered.outline).toEqual(yao.forms[0].outline)
  expect(recovered.sources).toEqual(yao.forms[0].sources)
  saved.families[0].forms[0].outline.d = ''
  expect(recovered.outline.d).toBe(yao.forms[0].outline.d)
  const original = createVariationProduct(registry, expression, sites)
  const restored = variationProductFromJSON(reopened.registry, reopened.document)
  expect(restored.count).toBe(9n)
  for (let i = 0n; i < 9n; i++) {
    const text = realizeVariation(original.at(i), registry)
    expect(restored.detect(text).index).toBe(i)
  }
})

test('retains supplied IVD and IRG provenance in the source closure', () => {
  const ivd = ivdFamilies('7387 E0100; Adobe-Japan1; CID+3952', '2026-08-03')
  const iwds = ucvFamilies({ source: { edition: 'N2978' }, groups: [], entries: [{
    id: '30', kind: 'unifiable', components: '率', forms: [{ glyph: 'aj1-03952' }],
  }] })
  const documented = {id: 'documented/率', subjects: ['率'], forms: [{
    id: 'a', text: '率󠄀', sources: [{family:'IVD/7387',form:'E0100'}, {family:'UCV/30',form:'1'}],
  }]}
  const registry = createVariationRegistry([documented, ...ivd, ...iwds, unrelated])
  const chosen = chooseVariation(registry, variationExpression('率'), [], documented.id, 'a')
  const saved = archiveVariation(registry, chosen)
  expect(saved.families.map(f => f.id)).toEqual(['documented/率', 'IVD/7387', 'UCV/30'])
  expect(saved.families[1].forms[0].registrations).toEqual([{collection:'Adobe-Japan1',identifier:'CID+3952'}])
  expect(saved.families[2].entry).toEqual(iwds[0].entry)
  expect(realizeVariation(openVariationArchive(saved).document)).toBe('率󠄀')
  const withoutUpstream = archiveVariation(createVariationRegistry([documented]), chosen)
  expect(withoutUpstream.families).toEqual([documented])
})

test('local source-qualified designs and spaces reopen with an empty catalogue', () => {
  const registry = createVariationRegistry([unrelated])
  const option = { text: '&GW-u58ec-t;', source: 'https://glyphwiki.org/wiki/u58ec-t' }
  const chosen = replaceVariation(variationExpression('⿰木壬'), [1], option)
  const space = createVariationProduct(registry, variationExpression('壬'), [{path:[],options:[option]}])
  const saved = archiveVariation(registry, chosen)
  expect(saved.families).toEqual([])
  expect(openVariationArchive(saved).document).toEqual(chosen)
  const restored = openVariationArchive(portable(archiveVariation(registry, space)))
  expect(restored.registry.families).toEqual([])
  expect(variationProductFromJSON(restored.registry, restored.document).at(0n).choices[0]).toMatchObject(option)
})

test('rejects incorrect or incomplete archives and metadata that JSON would discard', () => {
  const cat = createVariationRegistry([yao, unrelated])
  const saved = archiveVariation(cat, {version:1, expression, dimensions:sites})
  expect(() => openVariationArchive({...saved, format:'other'})).toThrow('archive')
  expect(() => openVariationArchive({...saved, version:2})).toThrow('archive')
  expect(() => openVariationArchive({...saved, families:[]})).toThrow('Missing archived family')
  expect(() => openVariationArchive({...saved, families:[...saved.families, unrelated]})).toThrow('Unreferenced')
  expect(() => openVariationArchive({...saved, families:[yao,yao]})).toThrow('Duplicate')
  expect(() => openVariationArchive({...saved, document:{version:1,expression,dimensions:sites}})).toThrow('pinned')
  const stale = portable(saved)
  stale.document.dimensions[0].options[0].text = '木'
  expect(() => openVariationArchive(stale)).toThrow('Changed spelling')
  const unsupported = createVariationRegistry([{...yao, metadata: new Map([['ink','black']])}])
  expect(() => archiveVariation(unsupported, saved.document)).toThrow('JSON data')
})

test('a branched space shares its archived families across its named branches', () => {
  const catalogue = createVariationRegistry([yao, unrelated])
  const one = createVariationProduct(catalogue, expression, sites.slice(0, 1))
  const both = createVariationProduct(catalogue, expression, sites)
  const space = createVariationBranches([{id:'one', product:one}, {id:'both', product:both}])
  const saved = portable(archiveVariation(catalogue, space))
  expect(saved.families.map(f => f.id)).toEqual([yao.id])
  const reopened = openVariationArchive(saved)
  const rebuilt = variationBranchesFromJSON(reopened.registry, reopened.document)
  expect(rebuilt.count).toBe(12n)
  expect(rebuilt.at(11n)).toEqual(space.at(11n))
})
