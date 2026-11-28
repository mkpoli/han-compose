// @ts-check
import catalogue from '../data/rate-forms/catalogue.json' with { type: 'json' }
import { createVariationRegistry } from './variation-registry.js'
import { u26201Forms } from './yao-forms.js'
import { tokens } from './tokens.js'

export const rateHosts = Object.freeze(Object.keys(catalogue.hosts))
const roots = Object.values(catalogue.shapes)
// Positions in the face data are the catalogue's stable drawing order.
const features = [
  { center: '1', sides: '1' }, { center: '1', sides: '2' },
  { center: '2', sides: '1' }, { center: '2', sides: '2' },
]
const families = Object.entries(catalogue.hosts).map(([host, template]) => {
  const plain = template.replace('@', '率')
  const prefix = tokens(plain).find(t => t.text === '率')?.path
  if (!prefix) throw new Error(`Missing 率 in ${template}`)
  const axes = [
    { id: 'center', property: 'construction', examples: { '1': '1.1', '2': '2.1' }, locus: [{ path: [...prefix, 1, 0, 1] }], values: ['1', '2'] },
    { id: 'sides', property: 'direction', examples: { '1': '1.1', '2': '1.2' }, locus: [{ path: [...prefix, 1, 0, 0] }, { path: [...prefix, 1, 0, 2] }], values: ['1', '2'] },
  ]
  const forms = roots.map((root, index) => {
    const text = template.replace('@', root)
    // IRG N2978, criterion 30, and Unicode IVD 2026-08-03 (Adobe-Japan1).
    const sources = host === '率' && (root === '率󠄀' || root === '率󠄁')
      ? [{ family: 'UCV/30', form: root === '率󠄀' ? '1' : '2' },
        { family: 'IVD/7387', form: root === '率󠄀' ? 'E0100' : 'E0101',
          collection: 'Adobe-Japan1', identifier: root === '率󠄀' ? 'CID+3952' : 'CID+14085' }]
      : []
    const traits = features[index]
    return { id: traits.center + '.' + traits.sides, host, text, traits, sources }
  })
  const selectors = /** @type {Record<string,string>} */ (catalogue.selectors)[host] ?? ''
  return { id: 'rate/' + host, subjects: [host, plain, ...[...selectors].map(s => host + s)],
    reference: template.replace('@', roots[0]), axes, forms }
})

export const rateRegistry = createVariationRegistry(families)
export const rateVariationFamilies = rateRegistry.families
// Existing callers key their cached drawings by the IDs from the original face catalogue.
const drawingIds = Object.keys(catalogue.shapes)
const choices = new Map(rateVariationFamilies.map(family => [family.id, Object.freeze(
  family.forms.map((form, i) => Object.freeze({ ...form, id: drawingIds[i], label: form.text }))),
]))
/** @typedef {typeof families[number]['forms'][number] & {label:string}} RateForm */

/** Four independent center and side-stroke choices for a host or its exact IDS subtree.
 * @param {string} text @returns {readonly RateForm[]} */
export const rateFormsFor = text => choices.get(rateRegistry.familiesFor(text)[0]?.id) ?? []
/** The selected drawing, only for an explicitly qualified spelling. @param {string} text */
export const exactRateForm = text => rateFormsFor(text).find(form => form.text === text)
/** The same 率 can be written with its four surrounding strokes as BabelStone
 * component 11, its entity spelling, or the explicit side operands. */
const rendered = new Map()
const qualifiedRoots = new Set(roots)
for (const [host, template] of Object.entries(catalogue.hosts)) {
  const forms = rateFormsFor(host)
  forms.forEach((form, index) => rendered.set(form.text, {host, index, returning: false}))
  for (const form of u26201Forms) for (const text of [form.text, ...form.aliases]) {
    const spellings = [
      '⿳亠⿴{11}' + text + '十',
      '⿳亠⿴&X-00011;' + text + '十',
      catalogue.shapes['cn-chevron'].replace('幺', text),
      catalogue.shapes['cn-strokes'].replace('幺', text),
    ]
    spellings.forEach((spelling, i) => {
      qualifiedRoots.add(spelling)
      const side = i === 3 ? 1 : 0
      rendered.set(template.replace('@', spelling), {
        host, index: (form.id === 'detached' ? 2 : 0) + side, returning: form.id === 'returning',
      })
    })
  }
}

/** @param {string} text @returns {{host:string,index:number,returning:boolean}|undefined} */
export const rateRenderChoice = text => rendered.get(text)
/** Whether an expression contains a qualified 率, including inside another operand. @param {string} text */
export const containsRateForm = text => {
  if (!text.includes('率') && !text.includes('⿳亠⿴') && !text.includes('⿱亠⿱⿲')) return false
  for (const root of qualifiedRoots) if (text.includes(root)) return true
  return false
}
