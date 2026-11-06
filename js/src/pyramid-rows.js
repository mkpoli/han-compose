// @ts-check
// The pyramid a description draws as, read from the engine's tree: groups of 1, 2, 3, … cells of one
// part pointing top, bottom, left or right. A cell is any description, so a pyramid of a repeated
// description reads back as well as one of a component. The reader also accepts an editor's tree
// (`{ op, parts }`), so the editor can ask the engine what a draft is before it draws it.

/** The four ways a pyramid can point. */
export const PYRAMID_DIRECTIONS = /** @type {('top' | 'bottom' | 'left' | 'right')[]} */ (['top', 'bottom', 'left', 'right'])

const EMPTY = '⬚'
/** Whether `node` is an empty slot. A drawing numbers them (`⬚0`, `⬚1`, …). @param {unknown} node */
const isSlot = node => node === null || typeof node === 'string' && node[0] === EMPTY

/** An editor's node's children, or undefined for anything else. @param {unknown} node @returns {unknown[] | undefined} */
const nodeParts = node => (node && typeof node === 'object' ? /** @type {{ parts?: unknown[] }} */ (node).parts : undefined)

/** The children of a parsed or editor tree node, or null for a leaf. @param {unknown} node @returns {unknown[] | null} */
const childrenOf = node => Array.isArray(node) ? node.slice(1) : nodeParts(node) ?? null
/** A node's operator, or undefined for a leaf. @param {unknown} node @returns {unknown} */
const operatorOf = node => Array.isArray(node) ? /** @type {unknown} */ (node[0]) : nodeParts(node) ? /** @type {{ op?: string }} */ (node).op : undefined

const ROWS = new Set(['⿰', '⿲'])
const STACKS = new Set(['⿱', '⿳'])

/**
 * Whether two cells are the same part, marks and modifiers included. Both cells come from one tree,
 * so they are spelled the same way.
 * @param {unknown} a @param {unknown} b @returns {boolean}
 */
function samePart(a, b) {
  if (a === b) return true
  if (isSlot(a) && isSlot(b)) return true
  if (typeof a === 'string' || a === null || typeof a !== 'object') return false
  if (typeof b === 'string' || b === null || typeof b !== 'object') return false
  if (operatorOf(a) !== operatorOf(b)) return false
  const left = /** @type {{ marks?: string, note?: string }} */ (a), right = /** @type {{ marks?: string, note?: string }} */ (b)
  if ((left.marks ?? '') !== (right.marks ?? '') || (left.note ?? '') !== (right.note ?? '')) return false
  const kids = childrenOf(a), others = childrenOf(b)
  return Boolean(kids && others && kids.length === others.length && kids.every((kid, i) => samePart(kid, others[i])))
}

/** The group counts, first group first. @param {number} layers @param {'top' | 'bottom' | 'left' | 'right'} direction */
const groupCounts = (layers, direction) => Array.from({ length: layers }, (_, i) => direction === 'bottom' || direction === 'right' ? layers - i : i + 1)

/**
 * `node` as exactly `count` cells of `size` leaves each, added to `out`. Any grouping with the axis
 * works, so `⿰⿰口口口` is three cells as much as `⿲口口口` is.
 * @param {unknown} node @param {number} count @param {number} size @param {unknown[]} out
 * @param {(node: unknown) => number} leaves @param {Set<string>} axis
 */
function splitCells(node, count, size, out, leaves, axis) {
  if (count === 1) {
    if (leaves(node) !== size) return false
    out.push(node)
    return true
  }
  const op = operatorOf(node)
  if (typeof op !== 'string' || !axis.has(op)) return false
  const kids = childrenOf(node)
  if (!kids || kids.length < 2) return false
  let used = 0
  for (const kid of kids) {
    const grown = leaves(kid)
    if (!size || grown % size !== 0) return false
    const cells = grown / size
    if (!cells || used + cells > count) return false
    if (!splitCells(kid, cells, size, out, leaves, axis)) return false
    used += cells
  }
  return used === count
}

/**
 * `node` as groups `from` through `to`, added to `out`: an operator on the arrangement axis splits
 * its operands at group bounds, and a single group is its cells on the other axis.
 * @param {unknown} node @param {number} from @param {number} to @param {number[]} counts @param {number} size
 * @param {unknown[]} out @param {(node: unknown) => number} leaves @param {Set<string>} outer @param {Set<string>} inner
 */
function splitGroups(node, from, to, counts, size, out, leaves, outer, inner) {
  if (from === to) return splitCells(node, counts[from], size, out, leaves, inner)
  const op = operatorOf(node)
  if (typeof op !== 'string' || !outer.has(op)) return false
  const kids = childrenOf(node)
  if (!kids || kids.length < 2) return false
  let at = from
  for (const kid of kids) {
    if (at > to) return false
    let total = 0, end = -1
    for (let i = at; i <= to; i++) {
      total += counts[i] * size
      if (total === leaves(kid)) { end = i; break }
      if (total > leaves(kid)) break
    }
    if (end < 0) return false
    if (!splitGroups(kid, at, end, counts, size, out, leaves, outer, inner)) return false
    at = end + 1
  }
  return at === to + 1
}

/** Whether a node's operator lays out a row. @param {unknown} node */
const isRow = node => { const op = operatorOf(node); return typeof op === 'string' && ROWS.has(op) }
/** Whether a node's operator lays out a stack. @param {unknown} node */
const isStack = node => { const op = operatorOf(node); return typeof op === 'string' && STACKS.has(op) }

/** The leaves a subtree draws, a leaf and an empty slot counting one. @param {unknown} node @returns {number} */
const leafCount = node => {
  if (typeof node === 'string' || node === null) return 1
  if (typeof node !== 'object') return 0
  const kids = childrenOf(node)
  /** @type {number} */
  const total = kids ? kids.reduce((/** @type {number} */ sum, kid) => sum + leafCount(kid), 0) : 0
  return total
}

/** The rows a stack draws, top first: a stacked operand brings its own rows, so every grouping of
 *  one stack answers the same rows. Null when `node` is no stack.
 *  @param {unknown} node @returns {unknown[] | null} */
function stackRows(node) {
  const op = operatorOf(node)
  if (typeof op !== 'string' || !STACKS.has(op)) return null
  const kids = childrenOf(node)
  if (!kids || kids.length < 2) return null
  return kids.flatMap(kid => stackRows(kid) ?? [kid])
}

/**
 * The ways a stack's rows may be read: every operand expanded into rows, and the last operand kept
 * whole as a base, which may itself be a description. The second reading is offered when the last
 * operand is a stack, the only case the two readings differ.
 * @param {unknown} node @returns {unknown[][]}
 */
function stackReadings(node) {
  const rows = stackRows(node)
  const kids = childrenOf(node)
  if (!rows || !kids) return []
  const last = kids.at(-1)
  if (last === undefined || last === rows.at(-1)) return [rows]
  const prefix = kids.slice(0, -1).flatMap(kid => stackRows(kid) ?? [kid])
  return [rows, [...prefix, last]]
}

/**
 * A triangular arrangement of one repeated part, read from a tree: groups of 1, 2, 3, … of the same
 * cell, pointing top, bottom, left or right. Null unless it has at least `minLayers` layers. A cell
 * is any subtree, so a pyramid of a description reads back like one of a component; the cell is that
 * subtree. A row may be grouped by any `⿰` or `⿲` tree, and a stack by any `⿱` or `⿳` tree, so
 * equivalent spellings read alike. A single layer points `top`.
 * @param {unknown} tree
 * @param {{ minLayers?: number }} [options]
 * @returns {{ cell: unknown, layers: number, count: number, direction: 'top' | 'bottom' | 'left' | 'right' } | null}
 */
export function pyramidRows(tree, { minLayers = 3 } = {}) {
  /** @type {Map<unknown, number>} */
  const counted = new Map()
  /** @param {unknown} node @returns {number} */
  const leaves = node => {
    if (typeof node === 'string' || node === null) return 1
    if (!node || typeof node !== 'object') return 0
    const known = counted.get(node)
    if (known !== undefined) return known
    const kids = childrenOf(node)
    /** @type {number} */
    const total = kids ? kids.reduce((/** @type {number} */ sum, kid) => sum + leaves(kid), 0) : 0
    counted.set(node, total)
    return total
  }
  const total = leaves(tree)
  if (!(minLayers >= 1) || total < minLayers * (minLayers + 1) / 2) return null
  // The most rows the leaves allow: every cell holds at least one leaf.
  const most = Math.floor((Math.sqrt(8 * total + 1) - 1) / 2)
  for (let layers = most; layers >= minLayers; layers--) {
    const count = layers * (layers + 1) / 2
    if (total % count) continue
    const size = total / count
    for (const direction of PYRAMID_DIRECTIONS) {
      // Rows are cells grouped along a row inside a stack; columns are cells grouped down a stack
      // inside a row.
      const sideways = direction === 'left' || direction === 'right'
      const outer = sideways ? ROWS : STACKS
      const inner = sideways ? STACKS : ROWS
      /** @type {unknown[]} */
      const cells = []
      if (!splitGroups(tree, 0, layers - 1, groupCounts(layers, direction), size, cells, leaves, outer, inner) || cells.length !== count) continue
      if (!cells.every(cell => samePart(cell, cells[0]))) continue
      return { cell: cells[0], layers, count, direction }
    }
  }
  return null
}

/**
 * Rows of 1, 2, … cells of one part with one more part under them, read as a pyramid on a base.
 * @param {unknown[]} rows @param {number} minLayers
 * @returns {{ cell: unknown, layers: number, base: unknown } | null} */
function rowsOnBase(rows, minLayers) {
  if (rows.length < minLayers + 1) return null
  const layers = rows.length - 1
  const cell = rows[0], base = rows[layers]
  // A row of cells is no base; the pyramid's top is one part, a cell of the row below it.
  if (isRow(base)) return null
  const size = leafCount(cell)
  if (!size) return null
  for (let i = 0; i < layers; i++) {
    /** @type {unknown[]} */
    const cells = []
    if (!splitCells(rows[i], i + 1, size, cells, leafCount, ROWS)) return null
    if (!cells.every(one => samePart(one, cell))) return null
  }
  return { cell: cell, layers, base: base }
}

/**
 * A pyramid standing on a base: rows of 1, 2, … `layers` cells of one part, and one more part under
 * them, read from a stack however its grouping spells it (⿳口⿰口口木 reads like ⿱⿱口⿰口口木). A base
 * is one part; it may repeat the cell, as `⿳口⿰口口口` is a pyramid of three 口 on a fourth, and it
 * may be a description, as `⿳口⿰口口⿱水火` puts a stacked 水火 under the pyramid. Null unless the
 * stack has at least `minLayers` pyramid rows and every row holds that many cells of the part. A
 * complete pyramid, such as ⿳口⿰口口⿲口口口, has no base row and reads by `pyramidRows`.
 * @param {unknown} tree
 * @param {{ minLayers?: number }} [options] At least two, the rows a pyramid needs.
 * @returns {{ cell: unknown, layers: number, base: unknown } | null}
 */
export function pyramidOnBase(tree, { minLayers = 2 } = {}) {
  // A pyramid has at least two rows; one row is a plain stack.
  if (!(minLayers >= 2)) return null
  for (const rows of stackReadings(tree)) {
    const found = rowsOnBase(rows, minLayers)
    if (found) return found
  }
  // A complete pyramid under one base, its top a description rather than a row to read.
  const kids = childrenOf(tree)
  if (kids && kids.length === 2 && isStack(tree) && !isRow(kids[1])) {
    const pyramid = pyramidRows(kids[0], { minLayers })
    if (pyramid?.direction === 'top') return { cell: pyramid.cell, layers: pyramid.layers, base: kids[1] }
  }
  return null
}
