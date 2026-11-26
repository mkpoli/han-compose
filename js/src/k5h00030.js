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

/** @param {string} key */
export const k5Donors = key => key === spelling ? donors : []

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function k5Parts(composer, key, region) {
  if (key !== spelling || [key, ...leaves, ...donors].some(ch => composer.excluded(ch))) return null
  const spec = faces[composer.fontStyle]
  if (!spec) return null
  const parts = []
  for (const [i, donor] of donors.entries()) {
    const record = composer.glyphRecord(donor)
    const [digest, indices] = spec[donor]
    if (record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== digest) return null
    const whole = partOf(record)
    const contours = donor === '奴' ? middleContours(whole, indices, composer.fontStyle) : indices.map(index => whole.contours[index])
    const piece = derived(whole, contours)
    parts.push(placed(piece, piece.box, mapped(slots[i], frame, region), partInk(piece), `K5H00030 cut from ${donor}`))
  }
  return parts
}
