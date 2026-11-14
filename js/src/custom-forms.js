// @ts-nocheck
// Outlines for components no code point names, cut from the characters that write them (ids-input's
// scripts/build_custom_cuts.py): loaded into the component forms once a sequence names one.
import { bundledSource } from './bundled.js'
import { addCutForms } from './component-forms.js'
import { pageLoader } from './unicode.js'

export const CUSTOM_FORMS = 'custom-forms.json.gz'
/** Whether a sequence names a component no code point does: a stroke chain #(…), an entity &…;, or
 *  a numbered component {…}. @param {string} text */
export const hasCustomComponent = text => /#\(|&[^;\s]+;|\{[^}]+\}/u.test(text)

let added = null
/** A source over `fallback` that answers nothing itself: it makes the cut forms ready first.
 *  @param {{ fallback?: any, load?: () => Promise<any> }} options */
export const customFormsSource = ({ fallback = null, load = () => pageLoader(CUSTOM_FORMS) } = {}) => bundledSource({
  load: async () => {
    await (added ??= load().then(addCutForms).catch(error => { added = null; throw error }))
    return { records: {} }
  },
  matches: () => false,
  fallback,
})
