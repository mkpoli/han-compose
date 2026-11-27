import { segments } from './geometry.js'

/** @typedef {{ ops: unknown[], light: Float64Array, heavy: Float64Array, width: unknown }} Contour */
/** @typedef {[string, number[][]]} Segment */

// The two junctions of 丿 with the frame, indexed by segment after resolving
// implied on-curve points. The optional fraction splits a line at the junction.
const junctions = new Map([
  ['鸡/regular', [2, 9]],
  ['鸡/fangsong', [30, 41]],
  ['鸡/pen-writing', [8, 24]],
  ['鸟/regular', [3, 10]],
  ['鸟/fangsong', [29, 41, 0.875]],
  ['鸟/pen-writing', [69, 83]],
])

/** Split a verified contour into 丿 and the rest of the frame. Their closing
 * chords run in opposite directions along the same junction in both masters.
 * @param {Contour} contour @param {string} style @param {string} [char] */
export function splitBirdCrest(contour, style, char = '鸡') {
  const splitAt = junctions.get(`${char}/${style}`)
  if (!splitAt) return null
  const [first, last, fraction] = splitAt

  /** @param {Float64Array} points @returns {Segment[][]} */
  const split = points => {
    const path = /** @type {Segment[]} */ (segments(contour.ops, points))
    if (fraction) {
      const [x, y] = path[last - 1][1].at(-1) ?? []
      const [u, v] = path[last][1][0]
      path.splice(last, 0, ['L', [[x + (u - x) * fraction, y + (v - y) * fraction]]])
    }
    const a = path[first][1].at(-1) ?? [], b = path[last][1].at(-1) ?? []
    return [
      [['M', [a]], ...path.slice(first + 1, last + 1)],
      [['M', [b]], ...path.slice(last + 1), ...path.slice(1, first + 1)],
    ]
  }
  const light = split(contour.light), heavy = split(contour.heavy)
  /** @param {Segment[]} path */
  const coordinates = path => Float64Array.from(path.flatMap(([, points]) => points.flat()))
  return light.map((path, i) => ({
    ops: path.map(([op, points]) => [op, points.length, false]),
    light: coordinates(path),
    heavy: coordinates(heavy[i]),
    width: contour.width,
  }))
}
