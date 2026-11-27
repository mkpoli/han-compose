// @ts-check
import positional from './positional-forms.json' with { type: 'json' }

const FULL_FORM = /^&HC-u([0-9a-f]{4,6})-full;$/u

/** The character an entity writes in full (`&HC-u91d1-full;` is 金), or null for anything else.
 * @param {string} text */
export function fullFormOf(text) {
  const found = text.startsWith('&') ? FULL_FORM.exec(text) : null
  return found ? String.fromCodePoint(parseInt(found[1], 16)) : null
}

/** The entity that writes one character in full. @param {string} char */
export const fullFormText = char => `&HC-u${(char.codePointAt(0) ?? 0).toString(16)}-full;`

/** @type {Map<string,{place:string, component:string, forms:string[]}>} */
const grouped = new Map()
for (const [place, component, form] of /** @type {[string,string,string][]} */ (positional)) {
  const id = place + '/' + component
  const entry = grouped.get(id) ?? { place, component, forms: [] }
  if (!entry.forms.includes(form)) entry.forms.push(form)
  grouped.set(id, entry)
}

/**
 * One family for each component the table gives a positional form, in the place that form stands
 * (`place`: L, R, T or B): the positional forms, each written as its own character, and the
 * component in full, written as an entity. The plain component leaves the choice to the composer,
 * which draws the positional form there. The full form is a local design: no source registers it.
 */
export const fullFormFamilies = Object.freeze([...grouped.values()].map(({ place, component, forms }) => ({
  id: `full/${place}/${component}`,
  place,
  subjects: [component],
  reference: component,
  axes: [{ id: 'form', property: 'outline', locus: [{ path: [] }], values: ['positional', 'full'] }],
  forms: [
    ...forms.map(form => ({ id: form, text: form, kind: 'character', traits: { form: 'positional' } })),
    { id: 'full', text: fullFormText(component), kind: 'entity', traits: { form: 'full' } },
  ],
  sources: ['https://github.com/cjkvi/cjkvi-variants/blob/e4f1da248c9737a243f9930b5dc497cef5d5ae16/radical-variants.txt'],
})))
