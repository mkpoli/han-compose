// @ts-check
import clipper from 'clipper-lib'
import { ASCENT, pathRings } from './geometry.js'

/** Union the original flattened Bézier contours in fixed point. Boundary correspondence
 * sees subpixel edges and the actual counter topology of overlapping strokes.
 * @param {number[][]} rings (flat x,y pairs, y down) */
export function inkPolygons(rings) {
  const paths = rings.map((r) => {
    const pts = []
    for (let i = 0; i < r.length; i += 2) pts.push({ X: Math.round(r[i] * 4096), Y: Math.round(r[i + 1] * 4096) })
    return pts
  })
  const engine = new clipper.Clipper()
  engine.AddPaths(paths, clipper.PolyType.ptSubject, true)
  const tree = new clipper.PolyTree()
  engine.Execute(clipper.ClipType.ctUnion, tree, clipper.PolyFillType.pftNonZero, clipper.PolyFillType.pftNonZero)
  return clipper.JS.PolyTreeToExPolygons(tree).map((p) =>
    [p.outer, ...p.holes].map((r) => {
      const ring = r
        .slice()
        .reverse()
        .map((p) => [p.X / 4096, p.Y / 4096])
      return [...ring, ring[0]]
    })
  )
}

/** Remove almost-collinear samples within a geometric tolerance; keep both halves
 * of the closed ring so the starting sample has the same error bound as the others.
 * @param {number[][]} ring @param {number} tolerance */
function simplify(ring, tolerance) {
  const last = ring.length - 1,
    middle = Math.floor(last / 2)
  const keep = new Uint8Array(ring.length)
  const stack = [
    [0, middle],
    [middle, last]
  ]
  keep[0] = keep[middle] = keep[last] = 1
  while (stack.length) {
    const [a, b] = /** @type {number[]} */ (stack.pop())
    const x = ring[a][0],
      y = ring[a][1],
      dx = ring[b][0] - x,
      dy = ring[b][1] - y
    const length = dx * dx + dy * dy
    let far = tolerance * tolerance,
      split = -1
    for (let i = a + 1; i < b; i++) {
      const px = ring[i][0] - x,
        py = ring[i][1] - y
      const t = length ? Math.min(1, Math.max(0, (px * dx + py * dy) / length)) : 0
      const distance = (px - t * dx) ** 2 + (py - t * dy) ** 2
      if (distance > far) {
        far = distance
        split = i
      }
    }
    if (split >= 0) {
      keep[split] = 1
      stack.push([a, split], [split, b])
    }
  }
  const reduced = ring.slice(0, -1).filter((_, i) => keep[i])
  return reduced.length >= 3 ? reduced : ring.slice(0, -1)
}

/** A smooth SVG outline with bounded corner rounding. Gentle turns use quadratic
 * joins; a serif, stroke tip or square corner keeps its vertex.
 * @param {number[][]} ring @param {number[]} box SVG [left,top,width,height]
 * @param {number} xScale @param {number} yScale @param {number} pad */
export function outlinePath(ring, box, xScale, yScale, pad) {
  const points = simplify(ring, 0.3).reverse()
  if (points.length < 3) return ''
  const xy = (/** @type {number} */ x, /** @type {number} */ y) =>
    Math.round((box[0] + (x - pad) * xScale) * 100) / 100 +
    ' ' +
    Math.round((box[1] + (y - pad) * yScale) * 100) / 100
  let d = ''
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i],
      p = points[(i + points.length - 1) % points.length],
      n = points[(i + 1) % points.length]
    const ax = p[0] - x,
      ay = p[1] - y,
      bx = n[0] - x,
      by = n[1] - y
    const la = Math.hypot(ax, ay),
      lb = Math.hypot(bx, by)
    const sharp = !la || !lb || (ax * bx + ay * by) / (la * lb) > -0.58
    if (sharp) d += (i ? 'L' : 'M') + xy(x, y)
    else {
      const a = Math.min(0.5, 3 / la),
        b = Math.min(0.5, 3 / lb)
      d += (i ? 'L' : 'M') + xy(x + ax * a, y + ay * a) + 'Q' + xy(x, y) + ' ' + xy(x + bx * b, y + by * b)
    }
  }
  return d + 'Z'
}

/** Sample the opposing ink edge along an inward normal. Use a local thickness for
 * the offset so a hairline beside a heavy stem survives thinning. Subdivide long
 * straight segments too: their middle can have a different thickness from the tip.
 * @param {number[][][]} rings */
export function weightVectors(rings) {
  const edges = rings.flatMap((r) =>
    r.slice(0, -1).map((p, i) => [p[0], p[1], r[i + 1][0] - p[0], r[i + 1][1] - p[1]])
  )
  return rings.map((ring) => {
    const points = ring.slice(0, -1),
      n = points.length
    const normals = points.map(([x, y], i) => {
      const a = points[(i + n - 1) % n],
        b = points[(i + 1) % n]
      const ax = x - a[0],
        ay = y - a[1],
        bx = b[0] - x,
        by = b[1] - y
      const al = Math.hypot(ax, ay) || 1,
        bl = Math.hypot(bx, by) || 1
      const dx = ax / al + bx / bl,
        dy = ay / al + by / bl,
        len = Math.hypot(dx, dy) || 1
      return [-dy / len, dx / len]
    })
    const widths = points.map(([x, y], i) => {
      const [nx, ny] = normals[i]
      let width = 96
      for (const [a, b, dx, dy] of edges) {
        const det = dx * ny - dy * nx
        if (Math.abs(det) < 1e-10) continue
        const t = ((a - x) * dy - (b - y) * dx) / det
        const u = ((b - y) * nx - (a - x) * ny) / det
        if (t > 0.02 && t < width && u >= 0 && u <= 1) width = t
      }
      return width
    })
    const typical = widths.slice().sort((a, b) => a - b)[n >> 1] || 1
    // At a junction a normal may suddenly see down the neighbouring stem instead
    // of across its own. Bound the change in diameter by distance along the edge.
    const local = widths.map((w) => Math.min(w, typical * 1.6))
    for (const dir of [1, -1])
      for (let j = 0; j < 2 * n; j++) {
        const i = dir === 1 ? j % n : n - 1 - (j % n),
          prev = (i - dir + n) % n
        const step = Math.hypot(points[i][0] - points[prev][0], points[i][1] - points[prev][1])
        local[i] = Math.min(local[i], local[prev] + 0.85 * step)
      }
    const vectors = normals.map(([nx, ny], i) => [(nx * local[i]) / 2, (ny * local[i]) / 2])
    return vectors.map((v, i) =>
      v.map(
        (x, k) =>
          (vectors[(i + n - 2) % n][k] +
            4 * vectors[(i + n - 1) % n][k] +
            6 * x +
            4 * vectors[(i + 1) % n][k] +
            vectors[(i + 2) % n][k]) /
          16
      )
    )
  })
}

/** Constrain ink to a band either side of the limiting outline as a share vanishes.
 * Different sets of masters can have different contour correspondences, even for a
 * near-zero additional share. The band has zero width on the simplex boundary.
 * @param {string} drawing @param {string} boundary @param {number} radius */
export function limitDisplacement(drawing, boundary, radius) {
  if (radius < 0.01) return boundary
  const scale = 256
  /** @param {string} d */
  function paths(d) {
    return pathRings(d, 12).map((/** @type {number[]} */ r) => {
      const pts = []
      for (let i = 0; i < r.length; i += 2)
        pts.push({ X: Math.round(r[i] * scale), Y: Math.round((ASCENT - r[i + 1]) * scale) })
      return pts
    })
  }
  /** @param {clipper.Paths} a @param {clipper.Paths} b @param {clipper.ClipType} operation */
  function combine(a, b, operation) {
    const clip = new clipper.Clipper()
    clip.AddPaths(a, clipper.PolyType.ptSubject, true)
    clip.AddPaths(b, clipper.PolyType.ptClip, true)
    /** @type {clipper.Paths} */
    const out = []
    clip.Execute(operation, out, clipper.PolyFillType.pftNonZero, clipper.PolyFillType.pftNonZero)
    return out
  }
  const union = clipper.ClipType.ctUnion
  const edge = combine(paths(boundary), [], union)
  if (!edge.length) return drawing
  // A wide band tolerates a coarser outline and arc. Offsetting every vertex of a
  // detailed outline by a large radius otherwise costs seconds in overlap resolution.
  const slack = Math.max(0.1, radius / 64) * scale
  const offset = new clipper.ClipperOffset(2, slack)
  // A piece smaller than the slack cleans away to nothing; the band cannot bound it.
  const coarse = clipper.Clipper.CleanPolygons(edge, slack).filter((/** @type {unknown[]} */ r) => r.length > 2)
  if (!coarse.length) return drawing
  offset.AddPaths(coarse, clipper.JoinType.jtRound, clipper.EndType.etClosedPolygon)
  /** @type {clipper.Paths} */
  const inside = []
  /** @type {clipper.Paths} */
  const outside = []
  offset.Execute(inside, -radius * scale)
  offset.Execute(outside, radius * scale)
  const ink = combine(paths(drawing), outside, clipper.ClipType.ctIntersection)
  return combine(ink, inside, union)
    .map(
      (r) =>
        r
          .map(
            ({ X, Y }, i) =>
              (i ? 'L' : 'M') + Math.round((X / scale) * 100) / 100 + ' ' + Math.round((Y / scale) * 100) / 100
          )
          .join('') + 'Z'
    )
    .join('')
}
