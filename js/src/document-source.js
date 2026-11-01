// @ts-check
// A document renderer source over a separated composer drawing. The composer gives each drawn leaf
// a box and, when ownership is complete, a leaf index; this module turns those boxes into nested
// local placements, normalizes each leaf's canvas paths into its own 1000-unit frame, and leaves the
// authored layer transforms to the document renderer. The caller must request `separate: true` and
// pass the sketch it received with the drawing.
import { TransformError, parsePath, toSequence, transformPath } from '../document/index.js'

/** @typedef {import('../document/index.js').Document} Document */
/** @typedef {import('../document/index.js').Node} Node */
/** @typedef {import('../document/render.js').LayerSource} LayerSource */
/** @typedef {import('../adapter/types.js').Drawing} Drawing */
/** @typedef {import('../adapter/types.js').DrawingPart} DrawingPart */
/** @typedef {import('../adapter/types.js').SketchLeaf} SketchLeaf */
/** @typedef {[number, number, number, number]} Box */
/** @typedef {{ node: Node, leaf: number | null, region: Box | null }} LayerInfo */
/** @typedef {{ source: LayerSource, complete: boolean, issues: string[] }} DocumentSource */

const CANVAS = /** @type {Box} */ ([0, 0, 1000, 1000])

/** @param {Box} a @param {Box} b @returns {Box} */
const union = (a, b) => {
  const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1])
  const x1 = Math.max(a[0] + a[2], b[0] + b[2]), y1 = Math.max(a[1] + a[3], b[1] + b[3])
  return [x, y, x1 - x, y1 - y]
}

/** The affine map from a child's 1000-unit local frame into its parent's, by their boxes.
 * @param {Box} child @param {Box} parent @returns {number[] | null} */
function placementOf(child, parent) {
  if (!(child[2] > 0) || !(child[3] > 0) || !(parent[2] > 0) || !(parent[3] > 0)) return null
  return [
    child[2] / parent[2], 0,
    0, child[3] / parent[3],
    (child[0] - parent[0]) * 1000 / parent[2],
    (child[1] - parent[1]) * 1000 / parent[3],
  ]
}

/** The affine map that normalizes a box into a 1000-unit local frame. @param {Box} box @returns {number[] | null} */
function localOf(box) {
  if (!(box[2] > 0) || !(box[3] > 0)) return null
  return [1000 / box[2], 0, 0, 1000 / box[3], -box[0] * 1000 / box[2], -box[1] * 1000 / box[3]]
}

/**
 * Build the `LayerSource` a document renderer needs from a separated composer drawing. `sketch` is
 * the leaf layout the composer sent for the same sequence. Every drawn part must carry its leaf
 * index; otherwise the source is incomplete and those components have no geometry. Identity layer
 * transforms reconstruct the composer's canvas drawing exactly; nested transforms then act in each
 * layer's box-derived 1000-unit frame.
 * @param {Document} document @param {Drawing} drawing @param {SketchLeaf[] | null | undefined} sketch
 * @returns {DocumentSource}
 */
export function documentSource(document, drawing, sketch) {
  /** @type {string[]} */
  const issues = []
  /** @type {Map<string, LayerInfo>} */
  const info = new Map()
  /** @type {Map<number, DrawingPart[]>} */
  const parts = new Map()
  let leaves = 0, components = 0

  /** @param {Node} node @returns {Box | null} */
  const walk = node => {
    if (node.kind === 'component' || node.kind === 'slot') {
      const leaf = leaves++
      if (node.kind === 'component') components++
      const box = sketch?.[leaf]?.box
      const region = Array.isArray(box) && box.length === 4 && Number.isFinite(box[2]) && box[2] > 0 && Number.isFinite(box[3]) && box[3] > 0
        ? /** @type {Box} */ ([...box])
        : null
      if (!region) issues.push(`leaf ${leaf} has no layout box`)
      info.set(node.id, { node, leaf, region })
      return region
    }
    if (node.kind === 'group') {
      const region = walk(node.child)
      info.set(node.id, { node, leaf: null, region })
      return region
    }
    let region = null
    for (const child of node.children) {
      const box = walk(child)
      if (box) region = region ? union(region, box) : box
    }
    info.set(node.id, { node, leaf: null, region })
    return region
  }
  walk(document.root)
  // The root frame is the canvas, not the bounding box of its children. A group forwards its child
  // without a placement, so a root group chain must carry the canvas frame down to its first
  // non-group descendant.
  const root = info.get(document.root.id)
  if (root) root.region = CANVAS
  if (document.root.kind === 'group') {
    let node = /** @type {Node} */ (document.root)
    while (node.kind === 'group') {
      const child = node.child
      const at = info.get(child.id)
      if (at) at.region = CANVAS
      node = child
    }
  }

  const raw = drawing.parts ?? []
  const componentLeaves = [...info.values()]
    .filter(at => at.node.kind === 'component')
    .map(at => /** @type {number} */ (at.leaf))
    .sort((a, b) => a - b)
  const inferred = raw.length === componentLeaves.length && !raw.some(part => part.cut) && raw.every(part => part.leaf === undefined)
  /** @type {{ part: DrawingPart, leaf: number }[]} */
  const assigned = []
  raw.forEach((part, index) => {
    const leaf = inferred ? componentLeaves[index] : part.leaf
    if (typeof leaf !== 'number' || !Number.isInteger(leaf) || leaf < 0 || leaf >= leaves) {
      issues.push(`a drawn part has no valid leaf index`)
      return
    }
    if (!componentLeaves.includes(leaf)) {
      issues.push(`part leaf ${leaf} belongs to an empty slot`)
      return
    }
    try { parsePath(part.d) } catch {
      issues.push(`part leaf ${leaf} has path data the transform engine cannot read`)
      return
    }
    assigned.push({ part, leaf })
  })
  for (const { part, leaf } of assigned) {
    const list = parts.get(leaf)
    if (list) list.push(part)
    else parts.set(leaf, [part])
  }
  if (components && !raw.length) issues.push('the drawing has no parts')
  for (const [id, at] of info) {
    if (at.leaf === null || at.node.kind !== 'component') continue
    if (!parts.has(at.leaf)) issues.push(`leaf ${at.leaf} has no drawn part (${id})`)
  }
  if (!sketch) issues.push('the drawing has no sketch')

  /** @param {Node} node @returns {{ pieces: import('../document/render.js').LocalPiece[] } | null} */
  const geometry = node => {
    const at = info.get(node.id)
    if (!at || at.leaf === null || !at.region) return null
    const list = parts.get(at.leaf)
    const matrix = localOf(at.region)
    if (!list?.length || !matrix) return null
    try {
      return {
        pieces: list.map(part => ({
          d: transformPath(part.d, [{ type: 'affine', matrix }]).d,
          fillRule: /** @type {'nonzero'} */ ('nonzero'),
          cut: Boolean(part.cut),
        })),
      }
    } catch (error) {
      if (error instanceof TransformError) return null
      throw error
    }
  }
  /** @param {Node} parent @param {Node} child */
  const placement = (parent, child) => {
    const from = info.get(child.id)?.region, to = info.get(parent.id)?.region
    return from && to ? placementOf(from, to) : null
  }

  return {
    source: { geometry, placement },
    complete: issues.length === 0,
    issues,
  }
}

/**
 * Draw `document` with a separated composer preview and return its complete source. The preview
 * must have been made with `separate: true`; `onSketch` is forwarded, and the drawing is returned
 * alongside the source.
 * @param {Document} document @param {(sequence: string, options?: { signal?: AbortSignal, onSketch?: (leaves: SketchLeaf[]) => void }) => Promise<Drawing>} preview
 * @param {{ signal?: AbortSignal, onSketch?: (leaves: SketchLeaf[]) => void }} [options]
 * @returns {Promise<DocumentSource & { drawing: Drawing }>}
 */
export async function composeDocumentSource(document, preview, { signal, onSketch } = {}) {
  /** @type {SketchLeaf[] | null} */
  let sketch = null
  const drawing = await preview(toSequence(document.root), {
    signal,
    onSketch: leaves => { sketch = leaves; onSketch?.(leaves) },
  })
  return { ...documentSource(document, drawing, sketch), drawing }
}
