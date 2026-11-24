// @ts-check
// A drawing grouped by the leaves it stands under. A drawing comes back with pieces (⿻ draws two
// parts over one another) and, when it can say, with the leaf each piece belongs to; this groups
// the pieces by leaf so a viewer can move, scale or turn one component of a description.

/** The area two [x, y, width, height] boxes share. @param {number[]} a @param {number[]} b */
const shared = (a, b) => {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])
  return w > 0 && h > 0 ? w * h : 0
}
/** The box around [x, y, width, height] boxes. @param {number[][]} boxes */
const around = boxes => {
  const x = Math.min(...boxes.map(b => b[0])), y = Math.min(...boxes.map(b => b[1]))
  return [x, y, Math.max(...boxes.map(b => b[0] + b[2])) - x, Math.max(...boxes.map(b => b[1] + b[3])) - y]
}

/**
 * The drawn parts grouped by the leaf of `leaves` each belongs to: `{ index, parts, box }[]`, `index`
 * the leaf's place in reading order, `parts` the indices into `pieces`, and `box` the box around
 * them. Null when the pieces cannot be told apart by leaf: one piece spans two leaves (the composer
 * drew the whole description as one glyph), or a filled leaf has no piece. A leaf drawn in several
 * pieces groups them together.
 * @param {{ box: number[], leaf?: number }[]} pieces
 * @param {{ index: number, box: number[], empty?: boolean }[]} leaves
 * @returns {{ index: number, parts: number[], box: number[] }[] | null}
 */
export function groupParts(pieces, leaves) {
  if (!Array.isArray(pieces) || !Array.isArray(leaves)) return null
  const filled = leaves.filter(leaf => leaf && !leaf.empty && Array.isArray(leaf.box) && leaf.box.length >= 4
    && leaf.box.slice(0, 4).every(Number.isFinite))
  if (!filled.length || pieces.length < filled.length) return null
  if (!pieces.every(piece => Array.isArray(piece?.box) && piece.box.length >= 4 && piece.box.slice(0, 4).every(Number.isFinite))) return null
  if (pieces.every(piece => Number.isInteger(piece.leaf))) {
    const groups = filled.map(leaf => {
      const parts = pieces.flatMap((piece, i) => piece.leaf === leaf.index ? [i] : [])
      return { index: leaf.index, parts, box: parts.length ? around(parts.map(i => pieces[i].box)) : [] }
    })
    return groups.every(group => group.parts.length) && groups.reduce((sum, group) => sum + group.parts.length, 0) === pieces.length ? groups : null
  }
  // A separated drawing gives each leaf one piece, in reading order. That is the only reliable map
  // when leaves share a box (⿻, an enclosure's outer part): the boxes cannot tell them apart.
  if (pieces.length === filled.length) {
    return filled.map((leaf, i) => ({ index: leaf.index, parts: [i], box: pieces[i].box.slice(0, 4) }))
  }
  /** @type {Map<number, number[]>} */
  const grouped = new Map(filled.map(leaf => [leaf.index, []]))
  for (let i = 0; i < pieces.length; i++) {
    const box = pieces[i]?.box
    if (!Array.isArray(box) || box.length < 4 || !box.slice(0, 4).every(Number.isFinite)) return null
    const shares = filled.map(leaf => ({ index: leaf.index, area: shared(box, leaf.box), leafArea: leaf.box[2] * leaf.box[3] }))
      .sort((a, b) => b.area - a.area)
    const best = shares[0]
    if (!(best.area > 0)) return null
    // A piece lying equally in two leaves belongs to the smaller, inner one when one leaf encloses the
    // other (the part inside an enclosure), and to neither when the leaves are neighbours of a similar
    // size: that is a whole glyph, not a part.
    const near = shares.filter(share => share.area >= best.area * 0.99)
    if (near.length > 1) {
      const smallest = Math.min(...near.map(share => share.leafArea)), largest = Math.max(...near.map(share => share.leafArea))
      if (smallest > largest * 0.75) return null
      const inner = near.reduce((a, b) => a.leafArea <= b.leafArea ? a : b)
      grouped.get(inner.index)?.push(i)
    } else {
      grouped.get(best.index)?.push(i)
    }
  }
  const out = []
  for (const leaf of filled) {
    const parts = grouped.get(leaf.index)
    if (!parts?.length) return null
    out.push({ index: leaf.index, parts, box: around(parts.map(i => pieces[i].box)) })
  }
  return out
}
