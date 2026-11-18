// TW-Kai grass heads. Each donor is one complete outline from the named glyph.
// The templates are 12-by-12 occupancy masks of the two native split halves.
import data from './grass-forms.json' with { type: 'json' }
import { commands, fill, makePart, mapped, placed, pointsBox, rings, union, wound } from './geometry.js'

const donors = Object.values(data.donors).map(([ops, light]) =>
  wound(makePart([{ ops: commands(ops), light, heavy: light }])))
/** @param {number[]} b */
const width = b => b[2] - b[0]
/** @param {number[]} b */
const height = b => b[3] - b[1]
/** @param {number} value */
const bitCount = value => {
  let count = 0
  while (value) { value &= value - 1; count++ }
  return count
}

/** @typedef {{light: ArrayLike<number>, ops: any[]}} Contour */
/** @param {Contour[]} contours @param {number[]} box */
function halfScores(contours, box) {
  const mask = fill(rings(contours, contours.map(c => c.light), 3), 12, box)
  const rows = Array.from({ length: 12 }, (_, y) => mask.subarray(y * 12, y * 12 + 12).reduce((bits, v) => bits * 2 + v, 0))
  /** @param {"left" | "right"} side */
  function score(side) {
    return Math.max(...data.halves.map(template => {
      let intersection = 0, total = 0
      rows.forEach((bits, y) => {
        intersection += bitCount(bits & template[side][y])
        total += bitCount(bits | template[side][y])
      })
      return intersection / total
    }))
  }
  return [score('left'), score('right')]
}

/** Identify split heads anywhere in the native outline, including side and lower components.
 * @param {{contours: Contour[]}} glyph @param {number[] | undefined} owned */
export function grassPairs(glyph, owned) {
  const boxes = glyph.contours.map(c => pointsBox(c.light))
  /** @type {{indices: number[], box: number[], left: number, right: number}[]} */
  const halves = []
  /** @param {number[]} indices */
  function add(indices) {
    const box = union(indices.map(i => boxes[i]))
    if (width(box) <= 0 || height(box) <= 0) return
    const [left, right] = halfScores(indices.map(i => glyph.contours[i]), box)
    if (Math.max(left, right) >= 0.52) halves.push({ indices, box, left, right })
  }
  const indices = owned?.length ? owned : boxes.map((_, i) => i)
  for (const i of indices) {
    add([i])
    // Some glyphs store the horizontal and upright as intersecting contours.
    const a = boxes[i]
    if (width(a) < 1.9 * height(a)) continue
    for (const j of indices) {
      const b = boxes[j]
      if (height(b) > width(b) && b[0] < a[2] && b[2] > a[0] && b[1] < a[1] && b[3] > a[3]) add([i, j])
    }
  }
  const pairs = []
  for (const l of halves) for (const r of halves) {
    const a = l.box, b = r.box, w = Math.max(width(a), width(b)), h = Math.max(height(a), height(b))
    const gap = (b[0] - a[2]) / w
    if (gap < -0.08 || gap > 0.6 || Math.abs(a[1] - b[1]) > 0.35 * h ||
        Math.min(width(a), width(b)) < w * 0.5 || Math.min(height(a), height(b)) < h * 0.5) continue
    const score = Math.min(l.left, r.right)
    if (score >= 0.52) pairs.push({ indices: [...l.indices, ...r.indices], box: union([a, b]), score })
  }
  const selected = [], used = new Set()
  for (const pair of pairs.sort((a, b) => b.score - a.score)) {
    if (pair.indices.some(i => used.has(i))) continue
    pair.indices.forEach(i => used.add(i))
    selected.push(pair)
  }
  return selected
}

/** @param {number[]} box @param {number[]} source @param {number[]} target */
export function connectedGrass(box, source, target) {
  /** @param {{box: number[]}} donor */
  const cost = donor => Math.hypot(Math.log(width(box) / width(donor.box)), Math.log(height(box) / height(donor.box)))
  const donor = donors.reduce((best, d) => cost(d) < cost(best) ? d : best)
  return { ...placed(donor, donor.box, mapped(box, source, target), 0, 'TW-Kai: 艹'), fixed: true }
}
