// @ts-check
import sans from '../data/rate-forms/sans.json' with { type: 'json' }
import serif from '../data/rate-forms/serif.json' with { type: 'json' }
import regular from '../data/rate-forms/regular.json' with { type: 'json' }
import pen from '../data/rate-forms/pen-writing.json' with { type: 'json' }
import fangsong from '../data/rate-forms/fangsong.json' with { type: 'json' }
import { exactRateForm, rateFormsFor } from './rate-forms.js'
import { commands, makePart, mapped, partInk, placed, svgPath, wound } from './geometry.js'
import constants from './constants.json' with { type: 'json' }

/** @type {Record<string,{contours:string[][],forms:Record<string,number[][]>}>} */
const faces = {sans, serif, regular, 'pen-writing':pen, fangsong}
/** @type {Map<string, ReturnType<typeof makePart>>} */
const cache = new Map()

/** @param {string} text @param {string} style @param {number[]} region @param {boolean} atRoot */
export function rateParts(text, style, region, atRoot) {
  const choice = exactRateForm(text)
  const data = faces[style]
  if (!choice || !data) return null
  const key = style + ':' + text
  let part = cache.get(key)
  if (!part) {
    const index = rateFormsFor(text).indexOf(choice)
    const contours = data.forms[choice.host][index].map(i => {
      const [ops, coords] = data.contours[i]
      const points = coords.split(' ').map(Number)
      return {ops:commands(ops), light:points, heavy:points}
    })
    part = /** @type {ReturnType<typeof makePart>} */ (wound(makePart(contours)))
    cache.set(key, part)
  }
  const target = atRoot ? mapped(part.box, constants.face, region) : region
  return [{...placed(part, part.box, target, partInk(part), choice.host + ' · ' + choice.label), fixed:true}]
}

/** A reviewed whole-glyph outline in the 1000-unit SVG em. @param {string} text @param {string} style */
export function rateDrawing(text, style) {
  const parts = rateParts(text, style, constants.face, true)
  return parts ? svgPath(parts) : null
}
