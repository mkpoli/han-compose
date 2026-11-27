// @ts-check
import sans from '../data/rate-forms/sans.json' with { type: 'json' }
import serif from '../data/rate-forms/serif.json' with { type: 'json' }
import regular from '../data/rate-forms/regular.json' with { type: 'json' }
import pen from '../data/rate-forms/pen-writing.json' with { type: 'json' }
import fangsong from '../data/rate-forms/fangsong.json' with { type: 'json' }
import slots from './rate-yao-slots.json' with { type: 'json' }
import design from './yao-serif.json' with { type: 'json' }
import { prepareWeight } from './mix-contours.js'
import { svgPart } from './u26201-part.js'
import { rateRenderChoice } from './rate-forms.js'
import { ASCENT, commands, fill, makePart, mapped, partInk, pathRings, placed, pointsBox, svgPath, union, wound } from './geometry.js'
import constants from './constants.json' with { type: 'json' }

/** @type {Record<string,{contours:string[][],forms:Record<string,number[][]>}>} */
const faces = {sans, serif, regular, 'pen-writing':pen, fangsong}
/** @type {Map<string, ReturnType<typeof makePart>>} */
const cache = new Map()

/** @param {number[][]} rings */
function density(rings) {
  const mask = fill(rings, 96, union(rings.map(pointsBox)))
  return mask.reduce((sum, value) => sum + value, 0) / mask.length
}

/** Start with the contextual drawing from the right of 𦈁, then match the
 * proportion of ink in the receiving center. Fit it to its original slot below.
 * @type {ReturnType<typeof prepareWeight>|undefined} */
let weightReturning
/** @param {ReturnType<typeof makePart>} target */
function matchedReturning(target) {
  if (!weightReturning) {
    const rings = pathRings(design.forms.returning.right, 12).map(flat => {
      const points = []
      for (let i = 0; i < flat.length; i += 2) points.push([flat[i], flat[i+1]])
      // prepareWeight measures inward normals on counterclockwise outer rings.
      return [...points, points[0]]
    })
    weightReturning = prepareWeight(rings)
  }
  const targetInk = density(pathRings(svgPath([placed(target, target.box, target.box, 0, '')])))
  let low = 0.4, high = 1.9
  const grows = density(weightReturning(high).map(r => r.flat())) > density(weightReturning(low).map(r => r.flat()))
  let rings = weightReturning(1)
  for (let i = 0; i < 8; i++) {
    const weight = (low + high) / 2
    rings = weightReturning(weight)
    if ((density(rings.map(r => r.flat())) < targetInk) === grows) low = weight
    else high = weight
  }
  const d = rings.map(r => r.slice(0,-1).map(([x,y],i) =>
    (i ? 'L' : 'M') + x.toFixed(2) + ' ' + (ASCENT-y).toFixed(2)).join('') + 'Z').join('')
  return svgPart(d)
}

/** @param {string} text @param {string} style */
export function ratePart(text, style) {
  const choice = rateRenderChoice(text)
  const data = faces[style]
  if (!choice || !data) return null
  const { host, index, returning } = choice
  const key = [style, host, index, returning].join(':')
  let part = cache.get(key)
  if (!part) {
    // Each entry names a synthetic cell with a separable center. The same
    // body and center precede either side setting in the reviewed contour arrays.
    const [startCell, first, end] = /** @type {Record<string,Record<string,number[]>>} */ (slots)[style][host]
    const cell = returning ? startCell + index % 2 : index
    const contours = data.forms[host][cell].map(i => {
      const [ops, coords] = data.contours[i]
      const points = coords.split(' ').map(Number)
      return {ops:commands(ops), light:points, heavy:points}
    })
    if (returning) {
      const surround = wound(makePart([...contours.slice(0, first), ...contours.slice(end)]))
      const originalCenter = makePart(contours.slice(first, end))
      const center = matchedReturning(originalCenter)
      part = svgPart(svgPath([
        placed(surround, surround.box, surround.box, partInk(surround), host),
        placed(center, center.box, originalCenter.box, partInk(center), '幺'),
      ]))
    } else part = /** @type {ReturnType<typeof makePart>} */ (wound(makePart(contours)))
    if (part) cache.set(key, part)
  }
  return part
}

/** @param {string} text @param {string} style @param {number[]} region @param {boolean} atRoot */
export function rateParts(text, style, region, atRoot) {
  const part = ratePart(text, style)
  const choice = rateRenderChoice(text)
  if (!part || !choice) return null
  const target = atRoot ? mapped(part.box, constants.face, region) : region
  return [{...placed(part, part.box, target, partInk(part), choice.host + ' · ' + text), fixed:true}]
}

/** A reviewed whole-glyph outline in the 1000-unit SVG em. @param {string} text @param {string} style */
export function rateDrawing(text, style) {
  const parts = rateParts(text, style, constants.face, true)
  return parts ? svgPath(parts) : null
}
