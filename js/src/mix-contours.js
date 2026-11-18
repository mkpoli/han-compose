// @ts-check
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
  const result = ref.map(() => [0, 0, 0])
  let i = n - 1,
    j = n - 1
  while (i >= 0 && j >= 0) {
    result[i][0] += path[j][0]
    result[i][1] += path[j][1]
    result[i][2]++
    const step = direction[i * n + j]
    if (step !== 2) i--
    if (step !== 1) j--
  }
  return result.map(([x, y, count]) => [x / count, y / count])
}

/** Interpolate corresponding outer rings and counters when each face has one connected
 * ink region. Separate or touching strokes without this correspondence use the field blend.
 * @param {number[][][][][]} polygons @param {number[]} shares */
export function correspondingInk(polygons, shares) {
  if (!polygons.every((p) => p.length === 1 && p[0].length === polygons[0][0].length)) return null
  // Multiple counters may switch order between masters. Their fields keep them spatially aligned.
  if (polygons[0][0].length > 2) return null
  const rings = polygons[0][0].map((_, index) => {
    const sources = polygons.map((p) => p[0][index])
    const n = Math.min(512, Math.max(64, ...sources.map((r) => r.length)))
    const ref = sample(sources[0], n),
      mixed = ref.map((p) => p.map((v) => v * shares[0]))
    for (let f = 1; f < sources.length; f++) {
      const matched = correspondence(ref, sample(sources[f], n))
      for (let i = 0; i < n; i++)
        for (let axis = 0; axis < 2; axis++) mixed[i][axis] += matched[i][axis] * shares[f]
    }
    return [...mixed, mixed[0]]
  })
  return [rings]
}

/** Squared Euclidean distance transform of a sampled function. Its lower envelope of
 * parabolas gives the minimum cost from any centre in one row or column.
 * @param {Float64Array} grid @param {number} side */
function transform(grid, side) {
  const costs = new Float64Array(side),
    sites = new Int32Array(side),
    breaks = new Float64Array(side + 1)
  for (const stride of [1, side])
    for (let line = 0; line < side; line++) {
      const base = stride === 1 ? line * side : line
      for (let i = 0; i < side; i++) costs[i] = grid[base + i * stride]
      let last = 0
      sites[0] = 0
      breaks[0] = -Infinity
      breaks[1] = Infinity
      for (let i = 1; i < side; i++) {
        let at
        do {
          const j = sites[last]
          at = (costs[i] + i * i - costs[j] - j * j) / (2 * (i - j))
          if (at > breaks[last]) break
          last--
        } while (last >= 0)
        sites[++last] = i
        breaks[last] = at
        breaks[last + 1] = Infinity
      }
      let k = 0
      for (let i = 0; i < side; i++) {
        while (breaks[k + 1] < i) k++
        const j = sites[k]
        grid[base + i * stride] = (i - j) ** 2 + costs[j]
      }
    }
}

/** Reconstruct ink from its inscribed disks, scaling the radius of each maximal disk.
 * Thin strokes retain a centreline even when a neighbouring stem is much thicker.
 * @param {Uint8Array} mask @param {number} side @param {number} weight */
export function weightedField(mask, side, weight) {
  const far = 4 * side * side
  const radius = Float64Array.from(mask, (v) => (v ? far : 0))
  transform(radius, side)
  const cost = new Float64Array(mask.length).fill(far)
  // Keep the ridges of the distance map. Non-maximal disks would restore the original
  // boundary on thinning if every ink pixel were allowed to contribute a disk.
  for (let i = 0; i < mask.length; i++)
    if (mask[i]) {
      const r = Math.sqrt(radius[i])
      const contained = [-1, 1, -side, side].some((d) => Math.sqrt(radius[i + d]) >= r + 0.99)
      if (!contained) cost[i] = -((Math.max(0.5, r - 0.5) * weight) ** 2)
    }
  transform(cost, side)
  return Array.from(cost, (v) => -v)
}
