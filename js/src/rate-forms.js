// @ts-check
import catalogue from '../data/rate-forms/catalogue.json' with { type: 'json' }

/** @typedef {{id:string, host:string, label:string, text:string}} RateForm */
export const rateHosts = Object.freeze(Object.keys(catalogue.hosts))
const labels = ['中式幺 · 向心点', '中式幺 · 双撇双点', '日式幺 · 向心点', '日式幺 · 双撇双点']
/** @type {Map<string, readonly RateForm[]>} */
const choices = new Map()
/** @type {Map<string, RateForm>} */
const exact = new Map()

for (const [host, template] of Object.entries(catalogue.hosts)) {
  const options = Object.freeze(Object.entries(catalogue.shapes).map(([id, root], i) =>
    Object.freeze({ id, host, label: labels[i], text: template.replace('@', root) })))
  choices.set(host, options)
  choices.set(template.replace('@', '率'), options)
  for (const selector of /** @type {Record<string,string>} */ (catalogue.selectors)[host] ?? '') choices.set(host + selector, options)
  for (const option of options) {
    exact.set(option.text, option)
    choices.set(option.text, options)
  }
}

/** Four independent center/dot choices for a whole host or its exact IDS subtree.
 * The two Japanese 率 spellings are Adobe-Japan1 IVSes. The other two are structural IDS.
 * @param {string} text @returns {readonly RateForm[]} */
export const rateFormsFor = text => choices.get(text) ?? []
/** The selected drawing, only for an explicitly qualified spelling. @param {string} text */
export const exactRateForm = text => exact.get(text)
/** Whether an expression contains a qualified 率, including inside another operand. @param {string} text */
export const containsRateForm = text => Object.values(catalogue.shapes).some(root => text.includes(root))
