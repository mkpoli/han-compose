// @ts-check
import { weightVectors } from './mix-outline.js'
/** Points spaced by arc length, without the duplicate closing point.
 * @param {number[][]} ring @param {number} n */
function sample(ring, n) {
  const cumulative = [0]
  for (let i = 1; i < ring.length; i++)
    cumulative.push(cumulative[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]))
  let j = 1
  return Array.from({ length: n }, (_, i) => {
    const at = (i * cumulative[cumulative.length - 1]) / n
    while (j < ring.length - 1 && cumulative[j] < at) j++
    const t = (at - cumulative[j - 1]) / (cumulative[j] - cumulative[j - 1] || 1)
    return ring[j - 1].map((v, k) => v + (ring[j][k] - v) * t)
  })
}

/** Match a closed contour to the reference, first rotating its seam and then allowing
 * the arc length between matching stroke tips to change by dynamic time warping.
 * @param {number[][]} ref @param {number[][]} points */
function correspondence(ref, points) {
  const n = ref.length
  const cost = (/** @type {number[]} */ a, /** @type {number[]} */ b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
  let start = 0,
    best = Infinity
  for (let offset = 0; offset < n; offset++) {
    let score = 0
    for (let i = 0; i < n; i += 4) score += cost(ref[i], points[(i + offset) % n])
    if (score < best) {
      best = score
      start = offset
    }
  }
  const path = points.slice(start).concat(points.slice(0, start))
  const previous = new Float64Array(n + 1).fill(Infinity),
    current = previous.slice()
  const direction = new Uint8Array(n * n)
  previous[0] = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const diagonal = previous[j],
        above = previous[j + 1] + 1,
        left = current[j] + 1
      const low = Math.min(diagonal, above, left)
      direction[i * n + j] = low === diagonal ? 0 : low === above ? 1 : 2
      current[j + 1] = low + cost(ref[i], path[j])
    }
    previous.set(current)
  }
  // Retain both sides of a many-to-one match. Averaging away the target's
  // intervening points used to cut across serifs immediately before a pure pole.
  /** @type {number[][][]} */
  const runs = ref.map(() => [])
  let i = n - 1,
    j = n - 1
  while (i >= 0 && j >= 0) {
    runs[i].push(path[j])
    const step = direction[i * n + j]
    if (step !== 2) i--
    if (step !== 1) j--
  }
  return runs.map((run) => run.reverse())
}

/** Sample in arc length, because a straight stem might only have its two end vertices.
 * @param {number[][][]} rings @param {number[]} counts */
function withWidths(rings, counts) {
  const sampled = rings.map((r, i) => sample(r, counts[i]))
  const vectors = weightVectors(sampled.map((r) => [...r, r[0]]))
  return sampled.map((r, j) => r.map((p, i) => [...p, ...vectors[j][i]]))
}

/** @param {number[][]} ring */
function sampleCount(ring) {
  const perimeter = ring.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - ring[i][0], p[1] - ring[i][1]), 0)
  return Math.max(12, Math.min(512, Math.ceil(perimeter / 1.4)))
}

/** Pair islands (or counters) by the distance between their bounding boxes.
 * @template T @param {T[][]} faces @param {(item:T)=>number[][]} ringOf */
export function matchRegions(faces, ringOf) {
  const bounds = (/** @type {T} */ item) => {
    const r = ringOf(item)
    let x = Infinity,
      y = Infinity,
      right = -Infinity,
      bottom = -Infinity
    for (const [px, py] of r) {
      x = Math.min(x, px)
      y = Math.min(y, py)
      right = Math.max(right, px)
      bottom = Math.max(bottom, py)
    }
    return [x, y, right, bottom]
  }
  const refs = faces[0].map(bounds)
  if (faces.some((f) => f.length !== refs.length)) return null
  return faces.map((face) => {
    const costs = face
      .flatMap((p, j) => {
        const box = bounds(p)
        return refs.map((ref, i) => ({ i, j, c: ref.reduce((d, v, k) => d + (v - box[k]) ** 2, 0) }))
      })
      .sort((a, b) => a.c - b.c)
    const assigned = new Set(),
      available = new Set(face.keys())
    const ordered = face.slice()
    for (const { i, j } of costs)
      if (!assigned.has(i) && available.delete(j)) {
        assigned.add(i)
        ordered[i] = face[j]
      }
    return ordered
  })
}

/** Compute correspondences and local stroke widths once, independently of the controls.
 * @param {number[][][][][]} polygons */
export function prepareCorrespondence(polygons) {
  if (!polygons.length || !polygons.every((p) => p.length === 1 && p[0].length === polygons[0][0].length))
    return null
  const holes = matchRegions(
    polygons.map((p) => p[0].slice(1)),
    (r) => r
  )
  if (!holes) return null
  const ordered = polygons.map((p, i) => [p[0][0], ...holes[i]])
  const counts = ordered[0].map((_, i) => Math.max(...ordered.map((r) => sampleCount(r[i]))))
  const faces = ordered.map((r) => withWidths(r, counts))
  const ref = faces[0]
  const runs = faces.map((face, f) =>
    face.map((ring, i) => (f ? correspondence(ref[i], ring) : ring.map((p) => [p])))
  )
  // Give every master a knot at every turn of the alignment path, including turns
  // where one master stands still. This makes the blend approach either endpoint.
  const aligned = faces.map(() => ref.map(() => /** @type {number[][]} */ ([])))
  ref.forEach((ring, j) =>
    ring.forEach((_, i) => {
      const slices = runs.map((face) => face[j][i])
      const knots = new Set([0])
      for (const slice of slices) for (let k = 1; k < slice.length; k++) knots.add(k / (slice.length - 1))
      for (const at of [...knots].sort((a, b) => a - b))
        slices.forEach((slice, f) => {
          const u = at * (slice.length - 1),
            lo = Math.floor(u),
            hi = Math.ceil(u)
          aligned[f][j].push(slice[lo].map((v, k) => v + (u - lo) * (slice[hi][k] - v)))
        })
    })
  )
  return (/** @type {number[]} */ shares, /** @type {number} */ weight) =>
    aligned[0].map((r, j) => {
      const mixed = r.map((_, i) => {
        let x = 0,
          y = 0
        for (let f = 0; f < faces.length; f++) {
          const [a, b, dx, dy] = aligned[f][j][i]
          x += shares[f] * (a + dx * (weight - 1))
          y += shares[f] * (b + dy * (weight - 1))
        }
        return [x, y]
      })
      return [...mixed, mixed[0]]
    })
}

/** @param {number[][][]} rings */
export function prepareWeight(rings) {
  // Subpixel level sets retain small changes of direction at scan lines. Filter
  // the tangent on equally spaced samples before using it for a weight offset.
  const smooth = rings.map((r) => {
    const sampled = sample(r, sampleCount(r)),
      n = sampled.length
    const filtered = sampled.map((p, i) =>
      p.map((x, k) => (sampled[(i + n - 1) % n][k] + 2 * x + sampled[(i + 1) % n][k]) / 4)
    )
    return [...filtered, filtered[0]]
  })
  const prepared = withWidths(
    smooth,
    smooth.map((r) => r.length - 1)
  )
  return (/** @type {number} */ weight) =>
    prepared.map((r) => {
      const pts = r.map(([x, y, dx, dy]) => [x + dx * (weight - 1), y + dy * (weight - 1)])
      return [...pts, pts[0]]
    })
}
