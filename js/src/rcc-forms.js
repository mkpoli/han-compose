import { rccChainContextParts, rccChainDonors } from './rcc-chain-contexts.js'
import { numeralDonors, numeralParts } from './rcc-numerals.js'
import { overlayContextDonors, overlayContextParts } from './rcc-overlays.js'
import { k5Donors, k5Parts } from './k5h00030.js'
import { union } from './geometry.js'

/** @param {string} key @param {string} style */
export const rccDonors = (key, style) => [
  ...rccChainDonors(key, style), ...numeralDonors(key, style), ...overlayContextDonors(key, style), ...k5Donors(key),
]

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region @returns {any[] | null} */
export function rccParts(composer, key, region) {
  /** @type {any[] | null} */
  const parts = rccChainContextParts(composer, key, region) ?? numeralParts(composer, key, region) ??
    overlayContextParts(composer, key, region) ?? k5Parts(composer, key, region)
  if (parts && composer.separate && parts.every(p => Number.isInteger(p.rccLeaf))) {
    // Equal spellings can occur several times in one IDS. Each occurrence
    // owns its own group, including contours emitted in paint order.
    const group = { key }
    for (const part of parts) part.rccGroup = group
  }
  return parts
}

/** Combine all contours belonging to one source operand for its editor box.
 * @param {any[]} parts @param {number} count */
export function rccLeafBoxes(parts, count) {
  if (!parts[0]?.rccGroup) return null
  const boxes = []
  for (let i = 0; i < count; i++) {
    const group = parts.filter(p => p.rccLeaf === i)
    if (!group.length) return null
    boxes.push(union(group.map(p => p.target)))
  }
  return boxes
}

/** Carry record-local operand numbers into the original IDS. Ordinary pieces
 * between two known groups can also be numbered when they match one for one.
 * @param {any} tree @param {any[]} parts @param {(node: any) => string} keyOf
 * @param {(node: any) => string[]} leafTexts */
export function numberRccLeaves(tree, parts, keyOf, leafTexts) {
  if (!parts.some(p => p.rccGroup)) return
  const groups = [...new Set(parts.map(p => p.rccGroup).filter(Boolean))]
  let g = 0, next = 0, cursor = 0, ordinaryStart = 0
  const ordinary = (/** @type {number} */ end) => {
    const first = cursor
    while (cursor < parts.length && !parts[cursor].rccGroup) cursor++
    if (cursor - first === end - ordinaryStart) {
      for (let i = first; i < cursor; i++) parts[i].leaf = ordinaryStart + i - first
    }
  }
  const visit = (/** @type {any} */ node) => {
    if (!Array.isArray(node)) { next++; return }
    const group = groups[g]
    if (group && keyOf(node) === group.key) {
      ordinary(next)
      const count = leafTexts(node).length
      while (parts[cursor]?.rccGroup === group) {
        const part = parts[cursor++]
        if (part.rccLeaf >= 0 && part.rccLeaf < count) part.leaf = next + part.rccLeaf
      }
      next += count
      ordinaryStart = next
      g++
    } else node.slice(1).forEach(visit)
  }
  visit(tree)
  ordinary(next)
}
