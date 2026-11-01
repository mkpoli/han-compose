// @ts-check
// Pyramids: one part in groups of 1, 2, 3, … pointing top, bottom, left or right. The sequence
// generator writes a balanced description; `pyramidRows` reads such a tree back, however its groups
// and cross axis are grouped.
import { repeatedPart, repeatedText } from './repeat-part.js'
import { parseDescription as parse, isNode } from './tree.js'
import { PYRAMID_DIRECTIONS, pyramidRows } from './pyramid-rows.js'

/** Whether two trees are the same part: the same operators over the same parts. @param {import('./tree.js').Part} a @param {import('./tree.js').Part} b @returns {boolean} */
const sameTree = (a, b) => a === b || isNode(a) && isNode(b) && a.op === b.op
  && a.parts.length === b.parts.length && a.parts.every((part, i) => sameTree(part, b.parts[i]))

/** The cells in a pyramid of `layers` rows. @param {number} layers */
export const pyramidCount = layers => layers * (layers + 1) / 2

/** Whether `tree` still has an empty slot. @param {import('./tree.js').Part} tree */
const hasSlot = tree => tree === null || isNode(tree) && tree.parts.some(hasSlot)

/**
 * One part per cell of a pyramid of `layers` layers, as an IDS sequence. Rows of two or three use
 * `⿰` and `⿲`; longer rows split in half, and stacks of two or three use `⿱` and `⿳`, so the
 * description stays balanced. The 3-layer sequence is `⿳口⿰口口⿲口口口`. A sideways pyramid turns
 * it: columns of 1, 2, … cells, arranged with `⿰`/`⿲`, and each column stacked with `⿱`/`⿳`.
 *
 * The part is a component, any description or ⬚: `pyramidSequence('⿱众⿰众众', 2)` repeats that
 * description as `⿱⿱众⿰众众⿰⿱众⿰众众⿱众⿰众众`, and an empty part lays out empty slots.
 * @param {string} part A component, a description, or ⬚ for a slot.
 * @param {number} layers
 * @param {{ direction?: 'top' | 'bottom' | 'left' | 'right' }} [options] Where the pyramid points.
 * @returns {string}
 */
export function pyramidSequence(part, layers, { direction = 'top' } = {}) {
  if (!Number.isSafeInteger(layers) || layers < 1) throw new RangeError('A pyramid needs at least one layer.')
  if (!PYRAMID_DIRECTIONS.includes(direction)) throw new RangeError('A pyramid points top, bottom, left or right.')
  const cell = repeatedPart(part, 'pyramid part')
  /** @param {number} count @returns {import('./tree.js').Part} */
  const row = count => {
    if (count === 1) return cell
    if (count === 2) return { op: '⿰', parts: [cell, cell] }
    if (count === 3) return { op: '⿲', parts: [cell, cell, cell] }
    const left = Math.floor(count / 2)
    return { op: '⿰', parts: [row(left), row(count - left)] }
  }
  /** @param {number} count @returns {import('./tree.js').Part} */
  const column = count => {
    if (count === 1) return cell
    if (count === 2) return { op: '⿱', parts: [cell, cell] }
    if (count === 3) return { op: '⿳', parts: [cell, cell, cell] }
    const top = Math.floor(count / 2)
    return { op: '⿱', parts: [column(top), column(count - top)] }
  }
  const sideways = direction === 'left' || direction === 'right'
  const widestFirst = direction === 'bottom' || direction === 'right'
  const group = sideways ? column : row
  /**
   * Groups `from` through `to`, one-based in reading order, along the arrangement axis: stacked for
   * top/bottom, side by side for left/right.
   * @param {number} from
   * @param {number} to
   * @returns {import('./tree.js').Part}
   */
  const arrange = (from, to) => {
    if (from === to) return group(widestFirst ? layers + 1 - from : from)
    if (to - from === 1) return { op: sideways ? '⿰' : '⿱', parts: [arrange(from, from), arrange(to, to)] }
    if (to - from === 2) return { op: sideways ? '⿲' : '⿳', parts: [arrange(from, from), arrange(from + 1, from + 1), arrange(to, to)] }
    const middle = Math.floor((from + to) / 2)
    return { op: sideways ? '⿰' : '⿱', parts: [arrange(from, middle), arrange(middle + 1, to)] }
  }
  const text = repeatedText(arrange(1, layers), 'pyramid')
  // A description without slots reads back as a pyramid of the same cell, which is what lets a long
  // one through the ordinary length and preview limits. A draft of slots is no pyramid to read.
  if (!hasSlot(cell)) {
    let shape = null
    try { shape = pyramidRows(parse(text), { minLayers: layers }) } catch { /* text that reads no description */ }
    if (!shape || shape.layers !== layers || (layers > 1 && shape.direction !== direction)
      || !sameTree(/** @type {import('./tree.js').Part} */ (shape.cell), cell)) {
      throw new TypeError('A pyramid part cannot be repeated as written.')
    }
  }
  return text
}
