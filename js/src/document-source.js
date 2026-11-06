// @ts-check
// A document renderer source over a separated composer drawing. The composer gives each drawn leaf
// a box and, when ownership is complete, a leaf index; this module turns those boxes into nested
// local placements, normalizes each leaf's canvas paths into its own 1000-unit frame, and leaves the
// authored layer transforms to the document renderer. The caller must request `separate: true` and
// pass the sketch it received with the drawing.
//
// A document is a tree of components, slots, groups and operators (ids-input's `src/document/`); this
// module reads that tree and normalizes a leaf's path into its box itself.

import { parsePath as readPath } from './document-path.js'

/** A document node: a component, a slot, a group of one node, or an operator with its children. A
 *  document's nodes are its own kind of node, kinds included, so a node is read by its `kind`.
 *  @typedef {{ id: string, kind: string, char?: string, child?: Node, op?: string, children?: Node[], note?: string, marks?: string }} Node */
/** A document is the editor's own: the engine reads its `root` and writes nothing back, so the
 *  editor's other fields (its format and version, its render recipe) may ride along.
 *  @typedef {{ root: Node } & Record<string, unknown>} Document */
/** @typedef {{ geometry: (node: Node) => any, placement: (parent: Node, child: Node) => number[] | null }} LayerSource */
/** @typedef {{ d: string, cut?: boolean, leaf?: number }} DrawingPart */
/** @typedef {{ d: string, parts?: DrawingPart[], slots?: { index: number, box: number[] }[] }} Drawing */
/** @typedef {{ index: number, box: number[], empty: boolean }} SketchLeaf */
/** @typedef {[number, number, number, number]} Box */
/** @typedef {{ node: Node, leaf: number | null, region: Box | null }} LayerInfo */
/** @typedef {{ source: LayerSource, complete: boolean, issues: string[], info: Map<string, LayerInfo>, partsByLeaf: Map<number, DrawingPart[]> }} DocumentSource */
/** A scoped drawing and a layer's frame, as the document renderer makes them: the engine passes the
 *  renderer's own values through, so the kinds are named here and typed by the package that writes them.
 *  @typedef {any} Scopes
 *  @typedef {Map<string, any>} Frames
 *  @typedef {{ renderScopes: Function, layerFrames: Function }} Renderer */

const CANVAS = /** @type {Box} */ ([0, 0, 1000, 1000])
/** The slot an empty cell is written as. */
const SLOT = '⬚'

/** A document node written out as a sequence, its slots as ⬚. @param {Node} node @returns {string} */
function toSequence(node) {
  if (node.kind === 'component') return node.char + (node.marks ?? '')
  if (node.kind === 'slot') return SLOT
  if (node.kind === 'group') return toSequence(/** @type {Node} */ (node.child))
  return node.op + (node.note ? `[${node.note}]` : '') + (node.children ?? []).map(toSequence).join('') + (node.marks ?? '')
}

/** The segments of a path, once it is known to read. @param {string} d @returns {import('./document-path.js').Path} */
function parsePath(d) {
  checkPath(d)
  return readPath(d)
}

/** How many numbers each path command takes. */
const OPERANDS = { M: 2, L: 2, Q: 4, C: 6, Z: 0 }

/** @typedef {{ d: string, fillRule: 'nonzero' | 'evenodd', cut?: boolean }} LocalPiece */
/** @typedef {{ id: string, pieces: number[] }} StrokeGroup */

/**
 * Whether `d` reads as the engine's own paths do: each command with the numbers it takes.
 * @param {string} d
 */
function checkPath(d) {
  if (!/^\s*M/.test(d) || /[^MLQCZ0-9.,eE+\-\s]/.test(d)) throw new TypeError('A drawing part is not a path.')
  for (const [, kind, args] of d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    const values = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : []
    if (values.length !== OPERANDS[/** @type {keyof typeof OPERANDS} */ (kind)] || !values.every(Number.isFinite)) throw new TypeError('A drawing part is not a path.')
  }
}

/**
 * `d` under an affine map `[a, b, c, d, e, f]` (SVG's order); the map is whatever takes a leaf's box
 * to its 1000-unit frame. A curve's control points map like its points, so the curves are kept.
 * @param {string} d @param {number[]} matrix
 */
function transformPath(d, matrix) {
  const [a, b, c, d1, e, f] = matrix
  /** @param {number[]} p @returns {number[]} */
  const map = p => [a * p[0] + c * p[1] + e, b * p[0] + d1 * p[1] + f]
  // The same text the editor's own `transformPath` writes (`src/document/transform.js`): three
  // decimals, trailing zeros trimmed, so a path mapped here and one mapped there read alike.
  const round = (/** @type {number} */ v) => {
    const text = v.toFixed(3)
    return text.replace(/\.?0+$/, '') || '0'
  }
  const out = []
  let last = /** @type {number[]} */ ([0, 0])
  for (const [, kind, args] of d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    if (kind === 'Z') { out.push('Z'); continue }
    const v = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : []
    if (kind === 'M' || kind === 'L') {
      last = map([v[0], v[1]])
      out.push(`${kind}${round(last[0])} ${round(last[1])}`)
      continue
    }
    // A quadratic curve has one control point, a cubic two: each maps as its end point does.
    const points = []
    for (let at = 0; at + 1 < v.length; at += 2) points.push(...map([v[at], v[at + 1]]))
    out.push(`${kind}${points.map(round).join(' ')}`)
    last = [points[points.length - 2], points[points.length - 1]]
  }
  return { d: out.join('') }
}

/** @param {Box} a @param {Box} b @returns {Box} */
const union = (a, b) => {
  const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1])
  const x1 = Math.max(a[0] + a[2], b[0] + b[2]), y1 = Math.max(a[1] + a[3], b[1] + b[3])
  return [x, y, x1 - x, y1 - y]
}


const CURVE_STEPS = 16

/** The polygon a closed subpath traces, with each curve sampled. @param {string} d @returns {number[][]} */
function flatten(d) {
  const points = []
  for (const segment of parsePath(d).segments) {
    if (segment.type === 'Z') continue
    if (segment.type === 'M' || segment.type === 'L') { points.push(segment.p); continue }
    for (let step = 1; step <= CURVE_STEPS; step++) {
      const t = step / CURVE_STEPS, u = 1 - t
      if (segment.type === 'Q') {
        const { p, c, end } = segment
        points.push([0, 1].map(k => u * u * p[k] + 2 * u * t * c[k] + t * t * end[k]))
      } else if (segment.type === 'C') {
        const { p, c1, c2, end } = segment
        points.push([0, 1].map(k => u * u * u * p[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * end[k]))
      }
    }
  }
  return points
}

/** The signed area of a polygon. @param {number[][]} points */
function signedAreaOf(points) {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    area += a[0] * b[1] - b[0] * a[1]
  }
  return area / 2
}

/** Whether `point` lies inside the polygon through `points`, by the even-odd rule.
 * @param {number[]} point @param {number[][]} points */
function inside(point, points) {
  let hit = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j]
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit
  }
  return hit
}

/** Whether segment ab properly crosses segment cd. @param {number[]} a @param {number[]} b @param {number[]} c @param {number[]} d */
function crosses(a, b, c, d) {
  const side = (/** @type {number[]} */ p, /** @type {number[]} */ q, /** @type {number[]} */ r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0
}

/** Whether any edge of one polygon properly crosses an edge of the other. @param {number[][]} one @param {number[][]} other */
function edgesCross(one, other) {
  for (let i = 0; i < one.length; i++) {
    for (let j = 0; j < other.length; j++) {
      if (crosses(one[i], one[(i + 1) % one.length], other[j], other[(j + 1) % other.length])) return true
    }
  }
  return false
}

/** Whether `inner` lies wholly inside `outer`: every vertex is inside and no edge crosses.
 * @param {number[][]} outer @param {number[][]} inner */
function contains(outer, inner) {
  return inner.every(point => inside(point, outer)) && !edgesCross(outer, inner)
}

/** The closed subpaths of a piece, each starting at M. @param {string} d @returns {string[]} */
const splitSubpaths = d => d.match(/M[^M]*/g) ?? []

/**
 * A drawing part as document pieces and stroke groups. A part with stroke groups becomes one piece
 * per closed contour, so each group names piece indices. Under the nonzero rule a contour is a cut
 * (a counter) when the contours that wholly enclose it wind to a nonzero total and its own winding
 * cancels it. Cuts erase every positive piece of the component, so a part where a cut meets a
 * positive contour that does not enclose it keeps its compound path and has no stroke groups.
 * Parts without groups keep their compound path.
 * @param {{ d: string, cut?: boolean, strokes?: [number, number[]][] }} part @param {string} d
 * @returns {{ pieces: LocalPiece[], strokes?: { id: string, pieces: number[] }[] }}
 */
function partGeometry(part, d) {
  if (part.cut || !part.strokes?.length) return { pieces: [{ d, fillRule: 'nonzero', cut: Boolean(part.cut) }] }
  const groups = part.strokes
  const shared = groups.flatMap(([, group]) => group).some((contour, index, all) => all.indexOf(contour) !== index)
  if (shared) return { pieces: [{ d, fillRule: 'nonzero' }] }
  const subpaths = splitSubpaths(d)
  const contours = subpaths.length
  if (!contours || part.strokes.some(([, group]) => group.some(index => !Number.isInteger(index) || index < 0 || index >= contours))) {
    return { pieces: [{ d, fillRule: 'nonzero' }] }
  }
  const polygons = subpaths.map(flatten)
  const turns = polygons.map(polygon => Math.sign(signedAreaOf(polygon)))
  const enclosers = polygons.map((polygon, index) => polygons.map((_, at) => at).filter(at => at !== index && contains(polygons[at], polygon)))
  const cuts = polygons.map((_, index) => {
    const winding = enclosers[index].reduce((sum, at) => sum + turns[at], 0)
    return winding !== 0 && winding + turns[index] === 0
  })
  const meets = (/** @type {number} */ one, /** @type {number} */ other) => edgesCross(polygons[one], polygons[other]) || contains(polygons[one], polygons[other]) || contains(polygons[other], polygons[one])
  const erased = cuts.some((cut, index) => cut && polygons.some((_, at) => at !== index && !cuts[at] && !enclosers[index].includes(at) && meets(index, at)))
  if (erased) return { pieces: [{ d, fillRule: 'nonzero' }] }
  /** @type {LocalPiece[]} */
  const pieces = subpaths.map((subpath, index) => ({ d: subpath, fillRule: 'nonzero', cut: cuts[index] }))
  const strokes = part.strokes.map(([id, group]) => ({ id: String(id), pieces: [...group] }))
  return { pieces, strokes }
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
 * The source a document renderer needs from a separated composer drawing. `sketch` is
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
      const region = Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0
        ? /** @type {Box} */ ([...box])
        : null
      if (!region) issues.push(`leaf ${leaf} has no layout box`)
      info.set(node.id, { node, leaf, region })
      return region
    }
    if (node.kind === 'group') {
      const region = walk(/** @type {Node} */ (node.child))
      info.set(node.id, { node, leaf: null, region })
      return region
    }
    let region = null
    for (const child of node.children ?? []) {
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
      const child = /** @type {Node} */ (node.child)
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
    // An Emoji part has no outlines: it is drawn as text in its box, so it carries no path.
    if (part.d !== '') {
      try { checkPath(part.d) } catch {
        issues.push(`part leaf ${leaf} has path data that is not a path`)
        return
      }
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

  /** @param {Node} node @returns {{ pieces: LocalPiece[], strokes?: StrokeGroup[] } | null} */
  const geometry = node => {
    const at = info.get(node.id)
    if (!at || at.leaf === null || !at.region) return null
    const list = parts.get(at.leaf)
    const matrix = localOf(at.region)
    if (!list?.length || !matrix) return null
    try {
      /** @type {LocalPiece[]} */
      const pieces = []
      /** @type {StrokeGroup[]} */
      const strokes = []
      /** @type {Map<string, number>} */
      const counts = new Map()
      const made = list.map(part => {
        const result = partGeometry(part, transformPath(part.d, matrix).d)
        for (const stroke of result.strokes ?? []) counts.set(stroke.id, (counts.get(stroke.id) ?? 0) + 1)
        return result
      })
      // Glyphs number their strokes independently, so an ID that more than one part uses is
      // qualified by the part's index and every stroke stays addressable.
      made.forEach((result, part) => {
        const offset = pieces.length
        pieces.push(...result.pieces)
        for (const stroke of result.strokes ?? []) {
          strokes.push({ id: (counts.get(stroke.id) ?? 0) > 1 ? `${part}:${stroke.id}` : stroke.id, pieces: stroke.pieces.map(index => index + offset) })
        }
      })
      return strokes.length ? { pieces, strokes } : { pieces }
    } catch (error) {
      if (error instanceof TypeError) return null
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
    // Each node's leaf and region, for a view that draws something beside the ink in a leaf's frame.
    info,
    partsByLeaf: parts,
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
