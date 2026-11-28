// Compare each imported record with its source and check that its exact spelling is recoverable.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createVariationRegistry, ivdCollections, ivdFamilies, ucvFamilies } from '../src/variation-registry.js'
import { grassFamily } from '../src/variants.js'
import { rateVariationFamilies } from '../src/rate-forms.js'

const [ivdPath, edition, iwdsPath, collectionsPath] = process.argv.slice(2)
if (!ivdPath || !edition || !iwdsPath || !collectionsPath) throw new Error('Expected IVD_Sequences.txt, IVD edition, IWDS catalogue.json and IVD_Collections.txt')
const ivdText = readFileSync(ivdPath, 'utf8')
const iwds = JSON.parse(readFileSync(iwdsPath, 'utf8'))
const collectionsText = readFileSync(collectionsPath, 'utf8')
const collections = ivdCollections(collectionsText)
const families = ivdFamilies(ivdText, edition, collections)
const collectionRows = collectionsText.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'))
assert.deepEqual(families[0].source.collections.map(row => [row.collection, row.pattern, row.url]),
  collectionRows.map(line => line.split(';').map(field => field.trim())))
const rules = ucvFamilies(iwds)
const registry = createVariationRegistry([...families, ...rules, ...rateVariationFamilies, grassFamily])

const sourceRows = ivdText.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'))
const imported = []
for (const family of families) {
  for (const form of family.forms) {
    const text = registry.select(family.subjects[0], [], family.id, form.id)
    const codepoints = [...text].map(char => char.codePointAt(0).toString(16).toUpperCase()).join(' ')
    for (const { collection, identifier } of form.registrations) imported.push([codepoints, collection, identifier])
  }
}
const rows = sourceRows.map(line => line.split(';').map(field => field.trim()))
assert.deepEqual(imported.sort(), rows.sort())

let witnesses = 0
assert.equal(rules.length, iwds.entries.length)
for (const [index, rule] of rules.entries()) {
  const entry = iwds.entries[index]
  assert.deepEqual(rule.entry, entry)
  assert.deepEqual(rule.forms.map(form => form.glyph), entry.forms.map(form => form.glyph))
  for (const form of rule.forms) {
    const hits = registry.at(form.text, []).find(hit => hit.family.id === rule.id)
    assert.ok(hits?.forms.some(found => found.id === form.id), rule.id + '/' + form.id + ': ' + form.text)
    witnesses++
  }
}
for (const form of grassFamily.forms) {
  const hits = registry.at(form.text, [])
  assert.equal(hits.find(hit => hit.family.id === grassFamily.id)?.forms[0].text, form.text)
  if (form.kind === 'ivs') assert.ok(hits.some(hit => hit.family.id === 'IVD/8279' && hit.forms.length === 1))
}
for (const form of registry.familiesFor('率').find(family => family.id === 'rate/率').forms) {
  for (const ref of form.sources) {
    const family = registry.families.find(family => family.id === ref.family)
    const target = family?.forms.find(target => target.id === ref.form)
    assert.ok(target)
    if (ref.collection) assert.ok(target.registrations.some(r => r.collection === ref.collection && r.identifier === ref.identifier))
  }
}
console.log(`${rows.length} registrations, ${families.reduce((n,f) => n + f.forms.length,0)} IVSes, ${rules.length} IRG entries, ${witnesses} source glyph positions`)
