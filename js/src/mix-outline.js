// @ts-check
import clipper from 'clipper-lib'
import { ASCENT, pathRings } from './geometry.js'

/** Union the original flattened Bézier contours in fixed point. Boundary correspondence
 * sees subpixel edges and the actual counter topology of overlapping strokes.
 * @param {number[][]} rings (flat x,y pairs, y down) */
export function inkPolygons(rings) {
  const paths = rings.map((r) => {
    const pts = []
    for (let i = 0; i < r.length; i += 2)
      pts.push({ X: Math.round(r[i] * 4096), Y: Math.round(r[i + 1] * 4096) })
    return pts
  })
  const engine = new clipper.Clipper()
  engine.AddPaths(paths, clipper.PolyType.ptSubject, true)
  const tree = new clipper.PolyTree()
  engine.Execute(
    clipper.ClipType.ctUnion,
    tree,
    clipper.PolyFillType.pftNonZero,
    clipper.PolyFillType.pftNonZero
  )
  const areaOf = (/** @type {number[][]} */ ring) => {
    let twice = 0
    for (let i = 0; i + 1 < ring.length; i++)
      twice += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return Math.abs(twice) / 2
  }
  return clipper.JS.PolyTreeToExPolygons(tree).map((p) => {
    const rings = [p.outer, ...p.holes].map((r) => {
      const ring = r
        .slice()
        .reverse()
        .map((pt) => [pt.X / 4096, pt.Y / 4096])
      return [...ring, ring[0]]
    })
    // Drop sub-pixel dust holes left where two strokes barely kiss, while keeping every outer island.
    return [rings[0], ...rings.slice(1).filter((hole) => areaOf(hole) >= 0.5)]
  })
}

/** Rings whose counters may overlap one another, redrawn so that ink is only where the
 * frames cover more than the counters do. Frames turn one way and counters the other.
 * @param {number[][][]} rings closed rings, the first a frame */
export function settledRings(rings) {
  const turn = (/** @type {number[][]} */ ring) =>
    ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length]
      return sum + p[0] * q[1] - q[0] * p[1]
    }, 0)
  const forward = turn(rings[0]) > 0
  const engine = new clipper.Clipper()
  engine.AddPaths(
    rings.map((ring) =>
      ring.slice(0, -1).map(([x, y]) => ({ X: Math.round(x * 4096), Y: Math.round(y * 4096) }))
    ),
    clipper.PolyType.ptSubject,
    true
  )
  const fill = forward ? clipper.PolyFillType.pftPositive : clipper.PolyFillType.pftNegative
  /** @type {{ X: number, Y: number }[][]} */
  const out = []
  engine.Execute(clipper.ClipType.ctUnion, out, fill, fill)
  return out.map((path) => {
    // Clipper turns its frames forward; keep the way the rings came.
    const ring = (forward ? path : path.slice().reverse()).map((p) => [p.X / 4096, p.Y / 4096])
    return [...ring, ring[0]]
  })
}

/** Pieces cut from one island and blended apart leave hairlines between them partway
 * through a mix: the gap that separates them in one face, at a fraction of its width. Gaps
 * narrower than twice `reach` between two such pieces are filled, so the pieces stay joined
 * until the gap is wide enough to read as one. Ink elsewhere is left as it is; slivers
 * thinner than twice `fine` are dropped.
 * @param {number[][][][]} pieces each piece's closed rings, counters turning against their frames
 * @param {boolean[]} cut which pieces were cut from a larger island
 * @param {number} reach @param {number} fine
 * @returns {number[][][]} closed rings */
export function weldedRings(pieces, cut, reach, fine) {
  const all = pieces.flat()
  if (!(reach > 0) || cut.filter(Boolean).length < 2) return all
  const unit = 4096
  const { Clipper, ClipperOffset, ClipType, PolyType, PolyFillType, JoinType, EndType } = clipper
  /** @typedef {{ X: number, Y: number }[][]} Paths */
  const pathsOf = (/** @type {number[][][]} */ rings) =>
    rings.map((ring) =>
      ring.slice(0, -1).map(([x, y]) => ({ X: Math.round(x * unit), Y: Math.round(y * unit) }))
    )
  const clip = (
    /** @type {number} */ type,
    /** @type {Paths} */ subject,
    /** @type {Paths} */ other = []
  ) => {
    const engine = new Clipper()
    engine.AddPaths(subject, PolyType.ptSubject, true)
    if (other.length) engine.AddPaths(other, PolyType.ptClip, true)
    /** @type {Paths} */
    const out = []
    engine.Execute(type, out, PolyFillType.pftNonZero, PolyFillType.pftNonZero)
    return out
  }
  const grown = (/** @type {Paths} */ paths, /** @type {number} */ by) => {
    const offset = new ClipperOffset(8, unit / 16)
    offset.AddPaths(paths, JoinType.jtMiter, EndType.etClosedPolygon)
    /** @type {Paths} */
    const out = []
    offset.Execute(out, by * unit)
    return out
  }
  const boxOf = (/** @type {Paths} */ paths) => {
    const box = [Infinity, Infinity, -Infinity, -Infinity]
    for (const path of paths)
      for (const p of path) {
        box[0] = Math.min(box[0], p.X)
        box[1] = Math.min(box[1], p.Y)
        box[2] = Math.max(box[2], p.X)
        box[3] = Math.max(box[3], p.Y)
      }
    return box
  }
  const whole = clip(ClipType.ctUnion, pathsOf(all))
  const sealed = grown(grown(whole, reach), -reach)
  // What sealing adds, one patch at a time. A patch that touches two cut pieces lies in the
  // gap between them; one that touches a single piece fills a crotch of its own outline.
  const patches = clip(ClipType.ctDifference, sealed, whole)
  const parts = pieces.flatMap((rings, k) => {
    if (!cut[k]) return []
    const paths = clip(ClipType.ctUnion, pathsOf(rings))
    return [{ paths, box: boxOf(paths) }]
  })
  const touch = unit / 2
  const kept = patches.filter((patch) => {
    if (Clipper.Area(patch) <= 0) return false
    const near = grown([patch], 0.5)
    const box = boxOf(near)
    let touched = 0
    for (const part of parts) {
      if (part.box[0] > box[2] || part.box[2] < box[0] || part.box[1] > box[3] || part.box[3] < box[1])
        continue
      const shared = clip(ClipType.ctIntersection, near, part.paths)
      if (shared.some((path) => Math.abs(Clipper.Area(path)) > touch * touch) && ++touched > 1) return true
    }
    return false
  })
  let out = kept.length ? clip(ClipType.ctUnion, [...whole, ...grown(kept, 0.05)]) : whole
  if (fine > 0) out = grown(grown(out, -fine), fine)
  // Clipper turns its frames forward; keep the way the rings came, which other parts share.
  const forward =
    all[0].reduce((sum, p, i) => {
      const q = all[0][(i + 1) % all[0].length]
      return sum + p[0] * q[1] - q[0] * p[1]
    }, 0) > 0
  return out.map((path) => {
    const ring = (forward ? path : path.slice().reverse()).map((p) => [p.X / unit, p.Y / unit])
    return [...ring, ring[0]]
  })
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
  // Offsetting every vertex of a detailed outline by a large radius costs seconds in
  // overlap resolution. Take a first short step at full detail, coarsen that result,
  // and take the rest from it. Coarsening the outline itself would drop thin strokes
  // from the band, and the ink they bound with them.
  const slack = Math.max(0.1, radius / 64) * scale
  const first = Math.min(radius * scale, 2 * slack)
  /** @param {number} sign */
  const grown = (sign) => {
    const near = new clipper.ClipperOffset(2, slack / 4)
    near.AddPaths(edge, clipper.JoinType.jtRound, clipper.EndType.etClosedPolygon)
    /** @type {clipper.Paths} */
    const step = []
    near.Execute(step, sign * first)
    const coarse = clipper.Clipper.CleanPolygons(step, slack / 2).filter(
      (/** @type {unknown[]} */ r) => r.length > 2
    )
    /** @type {clipper.Paths} */
    const out = []
    if (!coarse.length) return out
    const far = new clipper.ClipperOffset(2, slack)
    far.AddPaths(coarse, clipper.JoinType.jtRound, clipper.EndType.etClosedPolygon)
    far.Execute(out, sign * (radius * scale - first))
    return out
  }
  const inside = grown(-1),
    outside = grown(1)
  // The band cannot bound a drawing whose limit it lost.
  if (!outside.length) return drawing
  const ink = combine(paths(drawing), outside, clipper.ClipType.ctIntersection)
  return combine(ink, inside, union)
    .map(
      (r) =>
        r
          .map(
            ({ X, Y }, i) =>
              (i ? 'L' : 'M') +
              Math.round((X / scale) * 100) / 100 +
              ' ' +
              Math.round((Y / scale) * 100) / 100
          )
          .join('') + 'Z'
    )
    .join('')
}
