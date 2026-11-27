// @ts-check
import { parsePath, splitSubpaths } from './document-path.js'
import { ASCENT, makePart, wound } from './geometry.js'
import { renderU26201, yaoOutline } from './render-u26201.js'

/** @type {Map<string, ReturnType<typeof makePart>>} */
const cache = new Map()

/** Read the sourced whole-character SVG into the composer's font coordinate system.
 * @param {{left?: string, right?: string}} choice */
export function u26201Part({ left, right }) {
  const key = (left ?? '') + '/' + (right ?? '')
  const saved = cache.get(key)
  if (saved) return saved
  const part = svgPart(renderU26201(left, right).d)
  cache.set(key, part)
  return part
}

/** @param {string} id Canonical variant ID. */
export function yaoPart(id) {
  let part = cache.get(id)
  if (!part) {
    part = svgPart(yaoOutline(id).d)
    cache.set(id, part)
  }
  return part
}

/** @param {string} d SVG path in a 1000-unit em. */
function svgPart(d) {
  const contours = splitSubpaths(d).map(path => {
    const ops = [], points = []
    for (const s of parsePath(path).segments) {
      if (s.type === 'Z') continue
      const coordinates = s.type === 'C' ? [s.c1, s.c2, s.end] : s.type === 'Q' ? [s.c, s.end] : [s.p]
      ops.push([s.type, coordinates.length, false])
      for (const [x, y] of coordinates) points.push(x, ASCENT - y)
    }
    return { ops, light: points, heavy: points }
  })
  return wound(makePart(contours))
}
