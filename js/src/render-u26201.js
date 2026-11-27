// @ts-check
import serif from '../data/rate-forms/serif.json' with { type: 'json' }
import design from './yao-serif.json' with { type: 'json' }
import { ASCENT, commands, segments } from './geometry.js'
import { resolveYaoForm } from './yao-forms.js'

export { u26201Forms } from './yao-forms.js'

const viewBox = '0 0 1000 1000'
/** @typedef {string | {id:string}} Form */
/** @type {Record<string,{standalone:string,left:string,right:string}>} */
const drawings = design.forms

/** @param {Form} form */
function ink(form) {
  const key = typeof form === 'string' ? form : form.id
  const choice = resolveYaoForm(key)
  if (!choice) throw new RangeError('Unknown 幺 form: ' + key)
  return drawings[choice.id]
}

/** The standalone, editorial Noto Serif-style outline in a full em.
 * @param {Form} form */
export function yaoOutline(form) {
  return { viewBox, d: ink(form).standalone }
}

let original = ''
/** The unchanged reference uses the 文津宋體 source in the 率 catalogue. */
function nativeDrawing() {
  if (!original) original = serif.forms['𦈁'][0].map(i => {
    const [ops, coords] = serif.contours[i]
    const path = /** @type {[string, number[][]][]} */ (segments(commands(ops), coords.split(' ').map(Number)))
    return path.map(([op, points]) => op + points.map(([x, y]) => x + ' ' + (ASCENT - y)).join(' ')).join('') + 'Z'
  }).join('')
  return original
}

/** Noto Serif CJK SC supplies the compound proportions and the surrounding strokes:
 * 𠈌 and 千 for 𠂹, 綦 for the base of 糸, and 蟀 for the compressed 率.
 * The three 幺 outlines are drawn by construction. Unselected sites in this face
 * take the folded form found in the SC source. A bare 𦈁 retains its native outline.
 * @param {Form | null} [left] @param {Form | null} [right] */
export function renderU26201(left, right) {
  if (left == null && right == null) return { viewBox, d: nativeDrawing() }
  return { viewBox, d: design.surround + ink(left ?? 'folded').left + ink(right ?? 'folded').right }
}
