import cuts from './k5h00030-cuts.json' with { type: 'json' }
import { derived, mapped, partInk, partOf, placed, segments } from './geometry.js'
import { reconnectStroke } from './stroke-donors.js'
import { hexOf } from './sha256.js'

// ROK Extension C1 submission, IRG N896, page 48, K5H00030 (128 × 128 bitmap).
// The two crossing middle strokes have a short bar. The right side includes
// the complete crested 鳥 with its four dots and hook.
// https://www.unicode.org/irg/docs/n0896-ROK-ExtensionC1-sub.pdf#page=48
// https://rare.glyphatlas.org/en/entry/3124/history
const spelling = '⿲牛⿻𡿨㇇⿱丿⿹⿷⿴#(-𠃍㇉)二一灬'
const donors = ['特', '奴', '鳴']
const leaves = ['牛', '𡿨', '㇇', '丿', '#(-𠃍㇉)', '𠃍', '㇉', '二', '一', '灬']
const slots = [[5, -123, 43, -6], [39, -121, 72, -8], [71, -123, 126, -3]]
const frame = [5, -123, 126, -3]
const faces = /** @type {Record<string, Record<string, [string, number[]]>>} */ (/** @type {unknown} */ (cuts))

// In 奴 the bar of 女 extends left of the long descending stroke. In the
// submitted form it starts at that junction. For a fused outline the two
// segment indices mark where the projecting terminal leaves and rejoins it.
/** @type {Record<string, [number, number]>} */
const joinedBar = { regular: [65, 82], fangsong: [8, 15], 'pen-writing': [35, 49] }

/** @param {any} whole @param {number[]} indices @param {string} style */
function middleContours(whole, indices, style) {
  const [first, ...others] = indices
  const contour = whole.contours[first]
  const junction = joinedBar[style]
  let shortened
  if (junction) {
    const end = segments(contour.ops, contour.light).length
    shortened = reconnectStroke(whole.contours, [[first, 0, junction[0]], [first, junction[1], end - 1]])
  } else {
    // Noto has a separate horizontal contour. Keep its right-hand tip and
    // register its left end within the adjacent stem in both weight masters.
    const trim = (/** @type {Float64Array} */ xy) => {
      const xs = xy.filter((_, i) => !(i % 2)), right = Math.max(...xs)
      return xy.map((v, i) => i % 2 ? v : right + (v - right) * 0.59)
    }
    shortened = { ...contour, light: trim(contour.light), heavy: trim(contour.heavy) }
  }
  return [shortened, ...others.map(i => whole.contours[i])]
}

/** @typedef {[number, number, number]} Run */
/** @typedef {(number | Run[])[]} Cut */

// Indices are local to the already shortened 奴 and the right component of 鳴.
// A number keeps a complete contour. Runs follow one contour from a junction
// to the next, wrapping through its start when necessary. The adjoining stroke
// follows the same closing chord in reverse, so the assembled ink stays exact.
// 奴 contributes 𡿨 and ㇇. 鳴 contributes 丿, the hooked frame, 二, 一 and 灬.
/** @type {Record<string, { middle: Cut[], bird: Cut[] }>} */
const partitions = {
  sans: {
    middle: [[1, 2], [0, 3]],
    bird: [[10], [0, 3, 4, [[9, 5, 2]]], [2, [[9, 2, 5]]], [1], [5, 6, 7, 8]],
  },
  serif: {
    middle: [[1, 2], [0, 3]],
    bird: [[1], [2, 3, 4, 7, 8], [5, 6], [0], [9, 10, 11, 12]],
  },
  regular: {
    middle: [
      [[[0, 57, 0], [1, 1, 8]], [[0, 25, 39]]],
      [[[0, 0, 25], [0, 39, 57], [1, 8, 1]]],
    ],
    bird: [
      [[[0, 107, 126]]],
      [[[0, 29, 107], [0, 126, 0], [1, 7, 8], [2, 7, 0], [1, 14, 0], [0, 7, 8]]],
      [[[1, 8, 14], [2, 0, 7]], [[0, 0, 7], [1, 0, 7]]],
      [[[0, 8, 29]]], [3, 4, 5, 6],
    ],
  },
  fangsong: {
    middle: [
      [[[0, 0, 19], [1, 1, 5]], [[0, 32, 43]]],
      [[[0, 19, 32], [0, 43, 0], [1, 5, 1]]],
    ],
    bird: [
      [[[0, 28, 41]]],
      [[[0, 70, 28], [0, 41, 57], [5, 4, 9], [5, 20, 21], [0, 58, 59]]],
      [[[5, 9, 20]], [[0, 57, 58], [5, 21, 4]]],
      [[[0, 59, 70]]], [1, 2, 3, 4],
    ],
  },
  'pen-writing': {
    middle: [
      [[[0, 22, 44], [1, 2, 6]], [[0, 53, 60]]],
      [[[0, 44, 53], [0, 60, 22], [1, 6, 2]]],
    ],
    bird: [
      [[[0, 42, 51]]],
      [[[0, 35, 42], [0, 51, 21], [0, 30, 31], [2, 2, 3], [1, 2, 1], [2, 0, 1]]],
      [[[1, 1, 2], [2, 3, 0]], [[0, 31, 35], [2, 1, 2]]],
      [[[0, 21, 30]]], [3, 4, 5, 6],
    ],
  },
}

/** @param {any} glyph @param {Cut} cut */
function partition(glyph, cut) {
  return derived(glyph, cut.map(contour => {
    if (typeof contour === 'number') return glyph.contours[contour]
    const runs = contour.flatMap(([i, start, end]) => {
      if (start <= end) return [[i, start, end]]
      const c = glyph.contours[i], last = segments(c.ops, c.light).length - 1
      return [[i, start, last], [i, 0, end]]
    })
    return reconnectStroke(glyph.contours, /** @type {Run[]} */ (runs))
  }))
}

/** @param {string} key */
export const k5Donors = key => key === spelling ? donors : []

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region @returns {any[] | null} */
export function k5Parts(composer, key, region) {
  if (key !== spelling || [key, ...leaves, ...donors].some(ch => composer.excluded(ch))) return null
  if (!Object.hasOwn(faces, composer.fontStyle)) return null
  const spec = faces[composer.fontStyle]
  const parts = []
  for (const [i, donor] of donors.entries()) {
    const record = composer.glyphRecord(donor)
    const [digest, indices] = spec[donor]
    if (record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== digest) return null
    const whole = partOf(record)
    const contours = donor === '奴' ? middleContours(whole, indices, composer.fontStyle) : indices.map(index => whole.contours[index])
    const piece = derived(whole, contours)
    const target = mapped(slots[i], frame, region)
    if (composer.separate && i > 0) {
      const groups = partitions[composer.fontStyle]
      const cuts = i === 1 ? groups.middle : groups.bird
      const start = i === 1 ? 1 : 3
      for (const [j, cut] of cuts.entries()) {
        const leaf = partition(piece, cut)
        parts.push({ ...placed(leaf, leaf.box, mapped(leaf.box, piece.box, target), partInk(leaf), `K5H00030 cut from ${donor}`),
          fixed: true, rccLeaf: start + j })
      }
    } else {
      parts.push({ ...placed(piece, piece.box, target, partInk(piece), `K5H00030 cut from ${donor}`), fixed: true, rccLeaf: 0 })
    }
  }
  return parts
}
