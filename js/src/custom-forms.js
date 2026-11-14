// @ts-nocheck
// Outlines for components no code point names, cut from the characters that write them (ids-input's
// scripts/build_custom_cuts.py): loaded into the component forms once a sequence names one.
import { bundledSource } from './bundled.js'
import { addCutForms } from './component-forms.js'
import { customAt, strokeChain } from './tree.js'
import { pageLoader } from './unicode.js'

export const CUSTOM_FORMS = 'custom-forms.json.gz'
/** Whether a sequence names a component the file may hold: a CHISE entity (&CDP-8958;) or a zi.tools
 *  stroke chain (#(丿𠃊)) the grammar gives no character. @param {string} text */
export function hasCustomComponent(text) {
  const chars = [...text]
  for (let at = 0; at < chars.length; at++) {
    const found = customAt(chars, at)
    if (found && found.kind !== 'numbered' && !(found.kind === 'chain' && strokeChain(chars, at))) return true
  }
  return false
}

let added = null
/** A source over `fallback` that answers nothing itself: it makes the cut forms ready first. A file
 *  that cannot be read, or reads empty, leaves the forms out of this drawing and is asked for again
 *  by the next; a description that needs none of them still draws.
 *  @param {{ fallback?: any, load?: () => Promise<any> }} options */
export const customFormsSource = ({ fallback = null, load = () => pageLoader(CUSTOM_FORMS) } = {}) => bundledSource({
  load: async () => {
    added ??= load().then(data => {
      if (!data?.forms) throw new Error(`${CUSTOM_FORMS}: no forms`)
      addCutForms(data)
    })
    await added.catch(() => { added = null })
    return { records: {} }
  },
  matches: () => false,
  fallback,
})
