// @ts-check
import serif from '../data/rate-forms/serif.json' with { type: 'json' }
import design from './yao-serif.json' with { type: 'json' }
import { ASCENT, commands, segments } from './geometry.js'
import { resolveYaoForm } from './yao-forms.js'

export { u26201Forms } from './yao-forms.js'

const viewBox = '0 0 1000 1000'
/** @typedef {string | {id:string}} Form */
/** @type {Record<string,{standalone:string,left?:string,right?:string}>} */
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

/** @param {number} index */
function nativeContour(index) {
  const [ops, coords] = serif.contours[index]
  const path = /** @type {[string, number[][]][]} */ (segments(commands(ops), coords.split(' ').map(Number)))
  return path.map(([op, points]) => op + points.map(([x, y]) => x + ' ' + (ASCENT - y)).join(' ')).join('') + 'Z'
}

const nativeForms = serif.forms['𦈁']
const contours = nativeForms[0].map(nativeContour)
// The source fuses the lower-left dot of 率 to its 幺. Its separated outline
// comes from the same 文津宋體 drawing in the reviewed 率 series.
const sideDot = nativeContour(nativeForms[2][13])

/** Both native upper turns are folded. Each alternative follows the host's original
 * diagonal widths, lower strokes and enclosing contours in its own writing slot.
 * @param {Form | null} [left] @param {Form | null} [right] */
export function renderU26201(left, right) {
  const parts = contours.slice()
  const leftPath = left == null ? undefined : ink(left).left
  const rightPath = right == null ? undefined : ink(right).right
  if (leftPath) parts[0] = leftPath
  if (rightPath) parts[9] = rightPath + sideDot
  return { viewBox, d: parts.join('') }
}
