import { cutContours, derived, mapped, partInk, partOf, placed, segments } from './geometry.js'
import { reconnectStroke } from './stroke-donors.js'
import { hexOf } from './sha256.js'

// The five glyphs in RCC sighting 2875 show the sweep crossing the last
// downstroke of ㇋. The folded stroke extends below the junction on the left.
// https://rare.glyphatlas.org/en/entry/2711#sighting-2875
export const walkingYou = '⿺#(㇋乀)由'
const operands = ['#(㇋乀)', '㇋', '乀', '由']
/** @type {Record<string, [string, string, number[], number[]][]>} */
const cuts = {
  regular: [['廸', '8a70c838e829ec6b5227d60619f140cfa0606d8e4b31b296c1b113920a8438de', [0], [1, 2, 3, 4, 5]]],
  fangsong: [
    ['廻', '63cf5ed51792c8cba15db0ca97d5c2bd758c2ad364a4e6fd2a966f89d71cae61', [0], []],
    ['迪', 'e1f6b56e37645cd7d2e544638b251e3ecb79ce27d7871ed80516cdd71c7d081e', [], [1, 3, 4, 5]],
  ],
  'pen-writing': [['廸', 'ef14dfc19db2f5da28a37af260d11ed1a975a5253f58219b5f8878c0523cd00e', [1], [0, 2, 3, 4, 5]]],
}

// Sans and Serif join the sweep within the descending fold. In the native
// enclosed 廴 the beginning of the sweep projects past that stem. The first two
// indices bound the projection. The third marks the end of the contour.
// Measurements use normalized y downward within each native component.
/** @typedef {{junction: number[], tail: number, tilt: number, sweep: number[], bars: number[],
 * barTilt: number, wallTaper: number, soleWidth: number, soleAdjust: number}} Landmarks */
/** @type {Record<string, Landmarks>} */
const walkingLandmarks = {
  regular: { junction: [56, 63, 75], tail: .903, tilt: .085,
    sweep: [.65, .698, .767, .829, .882, .922, .919, .898, .875],
    bars: [.39, .644, .903], barTilt: .10, wallTaper: .38, soleWidth: .63, soleAdjust: .001 },
  fangsong: { junction: [8, 17, 65], tail: .979, tilt: .11,
    sweep: [.68, .725, .773, .820, .866, .907, .939, .917, .900],
    bars: [.396, .620, .876], barTilt: .07, wallTaper: .17, soleWidth: .68, soleAdjust: -.012 },
  'pen-writing': { junction: [3, 13, 73], tail: 1, tilt: .05,
    sweep: [.67, .715, .768, .814, .851, .882, .908, .927, .931],
    bars: [.356, .606, .884], barTilt: .05, wallTaper: .30, soleWidth: .84, soleAdjust: -.013 },
}

const unit = [0, 0, 1, 1]
// Fractions of the Sans/Serif ink bounds. 由 reaches the top and stays clear
// of the sweeping foot. The enclosing fold almost reaches the same height.
const slots = [[0, 0, 1, .989], [.365, .165, 1, 1]]
// Baseline centers measured in the Sans and Serif renderings at tenths
// of the ink width, from .2 through 1. The contact sits higher at the left.
const baseline = [.715, .845, .909, .935, .944, .947, .947, .943, .936]
const referenceBars = [0, .264, .57, .89, 1]
/** @param {number} value */
const clamp = value => Math.max(0, Math.min(1, value))
/** @param {number} a @param {number} b @param {number} t */
const blend = (a, b, t) => a + (b - a) * t

/** @param {number[]} values @param {number} column */
function sample(values, column) {
  const i = Math.floor(column)
  if (i < 0) return values[0]
  if (i >= values.length - 1) return values[values.length - 1]
  return blend(values[i], values[i + 1], column - i)
}

/** @param {number} y @param {number[]} from @param {number[]} to */
function registerLevels(y, from, to) {
  let i = 0
  while (i < from.length - 2 && y > from[i + 1]) i++
  return blend(to[i], to[i + 1], (y - from[i]) / (from[i + 1] - from[i]))
}

// A quadratic restricted to [start, end] has control point B(start,end)
// and endpoint B(end,end). These three pinned folds use lines and quadratics.
/** @param {number[]} out @param {number[]} previous @param {number[][]} controls
 * @param {number} start @param {number} end */
function addSection(out, previous, controls, start, end) {
  const [first, last] = controls
  if (!last) {
    for (let i = 0; i < 2; i++) out.push(blend(previous[i], first[i], end))
    return
  }
  for (const t of [start, end]) {
    for (let i = 0; i < 2; i++) {
      out.push(blend(blend(previous[i], first[i], t), blend(first[i], last[i], t), end))
    }
  }
}

// Both masters take the same exact subdivisions. A long straight side that
// spans the elbow and the baseline then follows each local change of angle.
/** @param {any} contour @param {number} width */
function divideSweep(contour, width) {
  const ops = []
  /** @type {number[]} */
  const light = []
  /** @type {number[]} */
  const heavy = []
  const lightSegments = /** @type {[string, number[][]][]} */ (segments(contour.ops, contour.light))
  const heavySegments = /** @type {[string, number[][]][]} */ (segments(contour.ops, contour.heavy))
  let previousLight = [0, 0], previousHeavy = [0, 0]
  for (const [i, [kind, pts]] of lightSegments.entries()) {
    const heavyPts = heavySegments[i][1], end = pts[pts.length - 1]
    const count = kind === 'M' ? 1 : Math.max(1, Math.ceil(Math.abs(end[0] - previousLight[0]) / width * 24))
    for (let j = 0; j < count; j++) {
      ops.push([kind, pts.length, false])
      addSection(light, previousLight, pts, j / count, (j + 1) / count)
      addSection(heavy, previousHeavy, heavyPts, j / count, (j + 1) / count)
    }
    previousLight = end
    previousHeavy = heavyPts[heavyPts.length - 1]
  }
  return { ...contour, ops, light: Float64Array.from(light), heavy: Float64Array.from(heavy) }
}

/** @param {any} part @param {Landmarks} landmarks @param {number} leaf */
function registerWalking(part, landmarks, leaf) {
  const [left, bottom, right, top] = part.box
  const width = right - left, height = top - bottom
  const [first, last, end] = landmarks.junction
  const contours = leaf ? part.contours :
    [divideSweep(reconnectStroke(part.contours, [[0, 0, first], [0, last, end]]), width)]
  const nativeBars = [0, ...landmarks.bars, 1], nativeFold = [0, .4, .66, landmarks.tail]
  const referenceFold = [.02, .405, .715, .992]
  /** @param {Float64Array} points */
  const register = points => {
    const result = new Float64Array(points.length)
    for (let i = 0; i < points.length; i += 2) {
      const x = (points[i] - left) / width, y = (top - points[i + 1]) / height
      let newX = x, newY
      if (leaf) {
        // Open the lower corners of the tapered body. Register all three
        // bars on the same coordinate system so their counters stay open.
        newX += (x - .5) * landmarks.wallTaper * Math.max(0, y - .42)
        const level = y + landmarks.barTilt * (x - .7) * clamp(y / .25)
        newY = registerLevels(level, nativeBars, referenceBars)
      } else {
        const lift = landmarks.tilt * (.8 - clamp(x / .27)) * clamp((.65 - y) / .18)
        const foldY = registerLevels(y, nativeFold, referenceFold) - lift
        const column = (x - .2) * 10
        const seat = sample(baseline, column) + landmarks.soleAdjust * clamp((x - .30) / .12)
        const sweepY = seat + (y - sample(landmarks.sweep, column)) * landmarks.soleWidth
        // Both sides of the fused junction must meet the same downstroke.
        newY = blend(foldY, sweepY, clamp((x - .18) / .10) * clamp((y - .47) / .17))
      }
      result[i] = left + newX * width
      result[i + 1] = top - newY * height
    }
    return result
  }
  const shaped = derived(part, contours.map((/** @type {any} */ c) => ({
    ...c, light: register(c.light), heavy: register(c.heavy),
  })))
  return { ...shaped, strokes: part.strokes }
}

/** @type {WeakMap<object, any[]>} */
const pieces = new WeakMap()

/** @param {string} style */
export const walkingYouDonors = style => Object.hasOwn(cuts, style) ? cuts[style].map(([char]) => char) : []

/** @param {import('./compose.js').Composer} composer @param {number[]} region */
export function walkingYouParts(composer, region) {
  const entries = Object.hasOwn(cuts, composer.fontStyle) && cuts[composer.fontStyle]
  if (!entries || [walkingYou, ...operands].some(ch => composer.excluded(ch))) return null
  const parts = []
  for (const [char, digest, outer, inner] of entries) {
    if (composer.excluded(char)) return null
    const record = composer.glyphRecord(char)
    if (record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== digest) return null
    const glyph = partOf(record)
    for (const [rccLeaf, indices] of [outer, inner].entries()) {
      if (!indices.length) continue
      let leaves = pieces.get(glyph)
      if (!leaves) {
        leaves = []
        pieces.set(glyph, leaves)
      }
      const piece = leaves[rccLeaf] ??= registerWalking(cutContours(glyph, indices), walkingLandmarks[composer.fontStyle], rccLeaf)
      const target = mapped(slots[rccLeaf], unit, region)
      const origin = (rccLeaf ? '由' : '#(㇋乀)') + ' from ' + char
      parts.push({ ...placed(piece, piece.box, target, partInk(piece), origin), rccLeaf, fixed: true })
    }
  }
  return parts
}
