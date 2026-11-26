// @ts-check
import { settledRings, weightVectors } from './mix-outline.js'
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

/** Arc-length access to a closed ring whose last point repeats its first.
 * @param {number[][]} ring */
function measured(ring) {
  const cumulative = [0]
  for (let i = 1; i < ring.length; i++)
    cumulative.push(cumulative[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]))
  const length = cumulative[cumulative.length - 1] || 1
  /** @param {number} s */
  const at = (s) => {
    s = ((s % length) + length) % length
    let lo = 0,
      hi = cumulative.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cumulative[mid] <= s) lo = mid
      else hi = mid
    }
    const t = (s - cumulative[lo]) / (cumulative[hi] - cumulative[lo] || 1)
    return [ring[lo][0] + (ring[hi][0] - ring[lo][0]) * t, ring[lo][1] + (ring[hi][1] - ring[lo][1]) * t]
  }
  return { cumulative, length, at }
}

/** The vertices where the outline turns: stroke ends, joints and serif tips. A round
 * tip yields the few vertices where it turns most.
 * @param {number[][]} ring @param {ReturnType<typeof measured>} line */
function corners(ring, line) {
  const reach = Math.max(1.2, Math.min(3.5, line.length / 24))
  /** @type {{ s: number, p: number[], turn: number }[]} */
  const found = []
  for (let i = 0; i < ring.length - 1; i++) {
    const s = line.cumulative[i],
      p = ring[i],
      a = line.at(s - reach),
      b = line.at(s + reach)
    const ax = p[0] - a[0],
      ay = p[1] - a[1],
      bx = b[0] - p[0],
      by = b[1] - p[1]
    const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by)
    if (Math.abs(turn) > 0.55) found.push({ s, p, turn })
  }
  // Keep the sharpest vertex of each cluster.
  return found.filter(
    (c, i) =>
      !found.some((o, j) => {
        if (i === j) return false
        const gap = Math.abs(o.s - c.s),
          near = Math.min(gap, line.length - gap) < reach
        return (
          near && (Math.abs(o.turn) > Math.abs(c.turn) || (Math.abs(o.turn) === Math.abs(c.turn) && j < i))
        )
      })
  )
}

/** The centre of the outline's length, which does not move when an edge gains vertices.
 * @param {number[][]} ring */
function centre(ring) {
  let x = 0,
    y = 0,
    total = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i],
      b = ring[i + 1],
      length = Math.hypot(b[0] - a[0], b[1] - a[1])
    x += (length * (a[0] + b[0])) / 2
    y += (length * (a[1] + b[1])) / 2
    total += length
  }
  return total ? [x / total, y / total] : ring[0].slice(0, 2)
}

/** Resample closed rings of several faces to a common point list. Corners that the
 * faces share become anchors, and each span between anchors is divided evenly along
 * every face. A straight edge therefore blends into a straight edge, and a corner one
 * face lacks (a serif tip) shrinks onto the edge that replaces it.
 * Returns null when no alignment keeps the halfway outline simple.
 * @param {number[][][]} rings one ring per face @returns {number[][][] | null} */
export function alignRings(rings) {
  // The face with the most corners is the reference whichever faces join it, so two
  // faces are matched the same way alone and among others.
  const detail = rings.map((ring) => corners(ring, measured(ring)).length)
  const order = rings.map((_, f) => f).sort((a, b) => detail[b] - detail[a] || a - b)
  const aligned = alignTo(order.map((f) => rings[f]))
  if (!aligned) return null
  const out = rings.map(() => /** @type {number[][]} */ ([]))
  order.forEach((f, k) => (out[f] = aligned[k]))
  return out
}

/** @param {number[][][]} rings the reference first @returns {number[][][] | null} */
function alignTo(rings) {
  const lines = rings.map(measured)
  const mids = rings.map(centre)
  const turns = rings.map((ring, f) =>
    corners(ring, lines[f]).map((c) => ({ ...c, q: [c.p[0] - mids[f][0], c.p[1] - mids[f][1]] }))
  )
  const ref = lines[0]
  const sizes = rings.map(
    (ring) =>
      Math.hypot(
        ...[0, 1].map((k) => Math.max(...ring.map((p) => p[k])) - Math.min(...ring.map((p) => p[k])))
      ) || 1
  )
  const size = sizes[0]
  // Open the reference at a seam in its widest corner-free stretch.
  const own = turns[0].map((c) => c.s / ref.length).sort((a, b) => a - b)
  let seam = 0,
    widest = -1
  own.forEach((u, i) => {
    const next = i + 1 < own.length ? own[i + 1] : own[0] + 1
    if (next - u > widest) {
      widest = next - u
      seam = (u + next) / 2
    }
  })
  const wrapped = (/** @type {number} */ u) => u - Math.floor(u)
  const base = turns[0].map((c) => ({ ...c, u: wrapped(c.s / ref.length - seam) })).sort((a, b) => a.u - b.u)
  // Each face maps the reference's position u to its own position v. A dense
  // alignment of position and direction finds where the reference's outline lies on
  // the face; a corner of each that meets there becomes an anchor.
  const count = 160
  const feature = (/** @type {number} */ f, /** @type {number} */ t) => {
    const line = lines[f],
      s = t * line.length,
      p = line.at(s),
      a = line.at(s - 1.5),
      b = line.at(s + 1.5)
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy) || 1
    return [p[0] - mids[f][0], p[1] - mids[f][1], dx / len, dy / len]
  }
  const heading = 0.02 * size * size
  const apart = (/** @type {number[]} */ a, /** @type {number[]} */ b) =>
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + heading * (1 - a[2] * b[2] - a[3] * b[3])
  const along = Array.from({ length: count }, (_, i) => feature(0, seam + i / count))
  const ax = new Float64Array(count),
    ay = new Float64Array(count),
    adx = new Float64Array(count),
    ady = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    ax[i] = along[i][0]
    ay[i] = along[i][1]
    adx[i] = along[i][2]
    ady[i] = along[i][3]
  }
  const matches = rings.map((_, f) => {
    if (!f) return []
    const samples = Array.from({ length: count }, (_, i) => feature(f, i / count))
    let offset = 0,
      best = Infinity
    for (let k = 0; k < count; k++) {
      let score = 0
      for (let i = 0; i < count; i += 4) score += apart(along[i], samples[(i + k) % count])
      if (score < best) {
        best = score
        offset = k
      }
    }
    const bx = new Float64Array(count),
      by = new Float64Array(count),
      bdx = new Float64Array(count),
      bdy = new Float64Array(count)
    for (let j = 0; j < count; j++) {
      const s = samples[(j + offset) % count]
      bx[j] = s[0]
      by[j] = s[1]
      bdx[j] = s[2]
      bdy[j] = s[3]
    }
    const previous = new Float64Array(count + 1).fill(Infinity),
      current = previous.slice()
    const direction = new Uint8Array(count * count)
    previous[0] = 0
    for (let i = 0; i < count; i++) {
      const x0 = ax[i],
        y0 = ay[i],
        dx0 = adx[i],
        dy0 = ady[i],
        row = i * count
      current[0] = Infinity
      for (let j = 0; j < count; j++) {
        const diagonal = previous[j],
          above = previous[j + 1] + 0.5,
          left = current[j] + 0.5
        const low = diagonal <= above ? (diagonal <= left ? diagonal : left) : above <= left ? above : left
        direction[row + j] = low === diagonal ? 0 : low === above ? 1 : 2
        const ux = x0 - bx[j],
          uy = y0 - by[j]
        current[j + 1] = low + ux * ux + uy * uy + heading * (1 - dx0 * bdx[j] - dy0 * bdy[j])
      }
      previous.set(current)
    }
    // The face position each reference sample lands on.
    const lands = new Float64Array(count + 1)
    const hits = new Float64Array(count)
    let i = count - 1,
      j = count - 1
    while (i >= 0 && j >= 0) {
      lands[i] += j
      hits[i]++
      const step = direction[i * count + j]
      if (step !== 2) i--
      if (step !== 1) j--
    }
    for (let k = 0; k < count; k++) lands[k] = (lands[k] / (hits[k] || 1) + offset) / count
    lands[count] = lands[0] + 1
    const landing = (/** @type {number} */ u) => {
      const x = u * count,
        lo = Math.min(count - 1, Math.floor(x))
      return lands[lo] + (x - lo) * (lands[lo + 1] - lands[lo])
    }
    const line = lines[f]
    // Where on the reference a face position lands, the inverse of `landing`.
    const origin = (/** @type {number} */ v) => {
      const x = lands[0] + wrapped(v - lands[0])
      let k = 0
      while (k < count - 1 && lands[k + 1] < x) k++
      return (k + (x - lands[k]) / (lands[k + 1] - lands[k] || 1)) / count
    }
    const reach = Math.max(0.04, 6 / ref.length)
    const theirs = turns[f]
      .map((c) => ({ ...c, v: c.s / line.length, u: wrapped(origin(c.s / line.length)) }))
      .sort((a, b) => a.u - b.u)
    // Pair corners in order: near each other along the outline, alike in place and turn.
    const price = (/** @type {number} */ i, /** @type {number} */ j) => {
      const a = base[i],
        b = theirs[j],
        slip = Math.abs(a.u - b.u)
      if (a.turn * b.turn < 0 || slip > 2 * reach) return Infinity
      return (
        (slip / reach) ** 2 +
        ((a.q[0] - b.q[0]) ** 2 + (a.q[1] - b.q[1]) ** 2) / (0.1 * size) ** 2 +
        0.5 * (a.turn - b.turn) ** 2
      )
    }
    const skip = 1.5
    const n = base.length,
      m = theirs.length
    const total = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
    for (let i = 1; i <= n; i++) total[i][0] = i * skip
    for (let j = 1; j <= m; j++) total[0][j] = j * skip
    for (let i = 1; i <= n; i++)
      for (let j = 1; j <= m; j++)
        total[i][j] = Math.min(
          total[i - 1][j - 1] + price(i - 1, j - 1),
          total[i - 1][j] + skip,
          total[i][j - 1] + skip
        )
    /** @type {number[][]} */
    const pairs = []
    for (let i = n, j = m; i > 0 && j > 0;) {
      const cost = price(i - 1, j - 1)
      if (total[i][j] === total[i - 1][j - 1] + cost) {
        const corner = base[i - 1],
          v = theirs[j - 1].v
        pairs.push([corner.u, lands[0] + wrapped(v - lands[0]), cost])
        i--
        j--
      } else if (total[i][j] === total[i - 1][j] + skip) i--
      else j--
    }
    pairs.reverse()
    // Keep the anchors that advance along the face.
    for (let k = 1; k < pairs.length;) {
      if (pairs[k][1] <= pairs[k - 1][1] + 1e-4) pairs.splice(k, 1)
      else k++
    }
    while (pairs.length > 1 && pairs[pairs.length - 1][1] >= pairs[0][1] + 1 - 1e-4) pairs.pop()
    // Between two anchors, corners left over on both sides pair up in order when
    // each side has as many, turning the same way, and sitting near each other in
    // both space and span position (so opposite ends of a long wall cannot collapse).
    if (pairs.length) {
      const free = (/** @type {number} */ from, /** @type {number} */ to, /** @type {0|1} */ side) =>
        (side
          ? turns[f].map((c) => ({ at: c.s / line.length, turn: c.turn, q: c.q }))
          : base.map((c) => ({ at: c.u, turn: c.turn, q: c.q }))
        )
          .map((c) => ({ ...c, at: from + wrapped(c.at - from) }))
          .filter((c) => c.at > from + 1e-4 && c.at < to - 1e-4)
          .sort((a, b) => a.at - b.at)
      /** @type {number[][]} */
      const extra = []
      for (let k = 0; k < pairs.length; k++) {
        const from = pairs[k],
          to = k + 1 < pairs.length ? pairs[k + 1] : [pairs[0][0] + 1, pairs[0][1] + 1]
        const ours = free(from[0], to[0], 0),
          theirs = free(from[1], to[1], 1)
        const spanU = to[0] - from[0],
          spanV = to[1] - from[1]
        const near = (
          /** @type {{ at: number, turn: number, q: number[] }} */ c,
          /** @type {{ at: number, turn: number, q: number[] }} */ t
        ) => {
          if (c.turn * t.turn <= 0) return false
          const normDist = Math.hypot(
            c.q[0] / sizes[0] - t.q[0] / sizes[f],
            c.q[1] / sizes[0] - t.q[1] / sizes[f]
          )
          if (normDist > 0.25) return false
          const slip =
            Math.abs((c.at - from[0]) / (spanU || 1) - (t.at - from[1]) / (spanV || 1)) *
            Math.max(spanU, spanV)
          return slip <= 2 * reach
        }
        if (ours.length && ours.length === theirs.length && ours.every((c, i) => near(c, theirs[i])))
          ours.forEach((c, i) => {
            const normDist = Math.hypot(
              c.q[0] / sizes[0] - theirs[i].q[0] / sizes[f],
              c.q[1] / sizes[0] - theirs[i].q[1] / sizes[f]
            )
            extra.push([c.at, theirs[i].at, Math.max(reach, (normDist / 0.1) ** 2)])
          })
      }
      pairs.push(...extra)
      pairs.sort((a, b) => a[0] - b[0])
    }
    // Long stretches without a shared corner follow the dense alignment.
    const filled = []
    const stretch = 0.08
    const ends = pairs.length
      ? [...pairs, [pairs[0][0] + 1, pairs[0][1] + 1, 0]]
      : [
          [0, landing(0), 0],
          [1, landing(0) + 1, 0]
        ]
    if (!pairs.length) filled.push(ends[0])
    for (let k = 0; k + 1 < ends.length; k++) {
      const from = ends[k],
        to = ends[k + 1]
      if (pairs.length) filled.push(from)
      const pieces = Math.floor((to[0] - from[0]) / stretch)
      for (let t = 1; t <= pieces; t++) {
        const u = from[0] + ((to[0] - from[0]) * t) / (pieces + 1)
        const v = landing(u - Math.floor(u)) + Math.floor(u)
        const before = filled[filled.length - 1]
        if (v > before[1] + 1e-4 && v < to[1] - 1e-4) filled.push([u, v, reach / 2])
      }
    }
    return filled
      .map(([u, v, cost]) => (u >= 1 ? [u - 1, v - 1, cost] : [u, v, cost]))
      .sort((a, b) => a[0] - b[0])
  })
  // Without a shared corner, rotate by the offset that brings evenly spaced points closest.
  const rotated = (/** @type {number} */ f) => {
    const probes = 48
    let best = Infinity,
      offset = 0
    for (let k = 0; k < probes; k++) {
      let score = 0
      for (let i = 0; i < probes; i += 2) {
        const a = ref.at((i / probes + seam) * ref.length),
          b = lines[f].at(((i + k) / probes) * lines[f].length)
        score += (a[0] - mids[0][0] - b[0] + mids[f][0]) ** 2 + (a[1] - mids[0][1] - b[1] + mids[f][1]) ** 2
      }
      if (score < best) {
        best = score
        offset = k / probes
      }
    }
    return [[0, offset, 0]]
  }
  const knotted = (/** @type {number[][]} */ pairs, /** @type {number} */ f) => {
    if (!f)
      return [
        [-1, -1 + seam],
        [2, 2 + seam]
      ]
    const first = pairs[0],
      last = pairs[pairs.length - 1]
    return [[last[0] - 1, last[1] - 1], ...pairs, [first[0] + 1, first[1] + 1]]
  }
  /** Piecewise-linear lookup along `from`, returning the other coordinate.
   * @param {number[][]} knots @param {number} x @param {0|1} from */
  const lookup = (knots, x, from) => {
    const to = 1 - from
    let k = 1
    while (k < knots.length - 1 && knots[k][from] < x) k++
    const lo = knots[k - 1],
      hi = knots[k]
    return lo[to] + ((x - lo[from]) / (hi[from] - lo[from] || 1)) * (hi[to] - lo[to])
  }
  const build = (/** @type {number[][][]} */ maps) => {
    const stops = [0, 1, ...base.map((c) => c.u)]
    rings.forEach((_, f) => {
      if (!f) return
      const knots = maps[f],
        low = knots[1][1]
      for (const c of turns[f])
        stops.push(wrapped(lookup(knots, low + wrapped(c.s / lines[f].length - low), 1)))
      for (const [u] of knots) if (u >= 0 && u <= 1) stops.push(u)
    })
    /** @type {number[]} */
    const sorted = []
    for (const u of stops.sort((a, b) => a - b))
      if (!sorted.length || (u - sorted[sorted.length - 1] > 1e-5 && u < 1 - 1e-5)) sorted.push(u)
    sorted.push(1)
    const out = rings.map(() => /** @type {number[][]} */ ([]))
    for (let k = 0; k + 1 < sorted.length; k++) {
      const spans = rings.map((_, f) => [lookup(maps[f], sorted[k], 0), lookup(maps[f], sorted[k + 1], 0)])
      const steps = Math.max(
        1,
        Math.min(256, Math.ceil(Math.max(...spans.map(([a, b], f) => (b - a) * lines[f].length)) / 1.4))
      )
      for (let t = 0; t < steps; t++)
        rings.forEach((_, f) => {
          const [a, b] = spans[f]
          out[f].push(lines[f].at((a + ((b - a) * t) / steps) * lines[f].length))
        })
    }
    return out
  }
  // A wrong anchor folds the halfway outline over itself. Drop the costliest anchors
  // of a face until its blend with the reference is a simple outline again.
  const pairs = matches.map((list, f) => (list.length || !f ? list : rotated(f)))
  for (let attempt = 0; ; attempt++) {
    const out = build(pairs.map(knotted))
    const halfway = (/** @type {number} */ f) =>
      out[0].map((p, i) => [(p[0] + out[f][i][0]) / 2, (p[1] + out[f][i][1]) / 2])
    let folded = rings.findIndex((_, f) => f && crosses(halfway(f)))
    // Three or more faces can also fold where each pair alone does not.
    if (folded < 0 && rings.length > 2) {
      const even = out[0].map((_, i) =>
        [0, 1].map((k) => out.reduce((sum, face) => sum + face[i][k], 0) / out.length)
      )
      if (crosses(even)) {
        const costliest = pairs.map((list) => Math.max(0, ...list.map((pair) => pair[2])))
        folded = costliest.indexOf(Math.max(...costliest.slice(1)), 1)
      }
    }
    if (folded < 0) return out
    if (attempt > 12 || pairs[folded].length < 2) {
      if (pairs[folded].length === 1 && pairs[folded][0][2] === 0) return null
      pairs[folded] = rotated(folded)
      continue
    }
    const worst = pairs[folded].reduce((k, pair, i, all) => (pair[2] > all[k][2] ? i : k), 0)
    pairs[folded] = pairs[folded].filter((_, i) => i !== worst)
  }
}

/** Whether a frame and its counters no longer make one island: a ring crosses itself
 * or another, or a counter has left the frame.
 * @param {number[][][]} rings the frame first, without the repeated closing point */
export function tangled(rings) {
  if (rings.some(crosses)) return true
  const [frame, ...counters] = rings
  const within = (/** @type {number[]} */ [x, y]) => {
    let inside = false
    for (let i = 0, j = frame.length - 1; i < frame.length; j = i++) {
      const a = frame[i],
        b = frame[j]
      if (a[1] > y !== b[1] > y && x < a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) inside = !inside
    }
    return inside
  }
  if (counters.some((ring) => !within(ring[0]))) return true
  const side = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number[]} */ c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const boxes = rings.map(ringBox)
  for (let r = 0; r < rings.length; r++)
    for (let q = r + 1; q < rings.length; q++) {
      const [left, top, right, bottom] = boxes[q]
      if (boxes[r][0] > right || boxes[r][2] < left || boxes[r][1] > bottom || boxes[r][3] < top) continue
      const one = rings[r],
        other = rings[q]
      for (let i = 0; i < one.length; i++) {
        const a = one[i],
          b = one[(i + 1) % one.length]
        if (Math.max(a[0], b[0]) < left || Math.min(a[0], b[0]) > right) continue
        if (Math.max(a[1], b[1]) < top || Math.min(a[1], b[1]) > bottom) continue
        for (let j = 0; j < other.length; j++) {
          const c = other[j],
            d = other[(j + 1) % other.length]
          if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0]))
            continue
          if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true
        }
      }
    }
  return false
}

/** Whether a closed outline crosses itself.
 * @param {number[][]} ring */
function crosses(ring) {
  const n = ring.length
  const side = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number[]} */ c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  if (n <= 96) {
    for (let i = 0; i < n; i++) {
      const a = ring[i],
        b = ring[(i + 1) % n]
      const ax0 = a[0] < b[0] ? a[0] : b[0],
        ax1 = a[0] > b[0] ? a[0] : b[0]
      const ay0 = a[1] < b[1] ? a[1] : b[1],
        ay1 = a[1] > b[1] ? a[1] : b[1]
      for (let j = i + 2; j < n; j++) {
        if (!i && j === n - 1) continue
        const c = ring[j],
          d = ring[(j + 1) % n]
        if (ax1 < (c[0] < d[0] ? c[0] : d[0]) || (c[0] > d[0] ? c[0] : d[0]) < ax0) continue
        if (ay1 < (c[1] < d[1] ? c[1] : d[1]) || (c[1] > d[1] ? c[1] : d[1]) < ay0) continue
        if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true
      }
    }
    return false
  }
  const minX = new Float64Array(n),
    maxX = new Float64Array(n),
    minY = new Float64Array(n),
    maxY = new Float64Array(n)
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n]
    minX[i] = a[0] < b[0] ? a[0] : b[0]
    maxX[i] = a[0] > b[0] ? a[0] : b[0]
    minY[i] = a[1] < b[1] ? a[1] : b[1]
    maxY[i] = a[1] > b[1] ? a[1] : b[1]
  }
  order.sort((p, q) => minX[p] - minX[q])
  for (let u = 0; u < n; u++) {
    const i = order[u],
      a = ring[i],
      b = ring[(i + 1) % n]
    const mx1 = maxX[i],
      my0 = minY[i],
      my1 = maxY[i]
    for (let v = u + 1; v < n; v++) {
      const j = order[v]
      if (minX[j] > mx1) break
      if (minY[j] > my1 || my0 > maxY[j]) continue
      const diff = i > j ? i - j : j - i
      if (diff <= 1 || diff === n - 1) continue
      const c = ring[j],
        d = ring[(j + 1) % n]
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true
    }
  }
  return false
}

/** @param {number[][]} ring */
function sampleCount(ring) {
  const perimeter = ring.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - ring[i][0], p[1] - ring[i][1]), 0)
  return Math.max(12, Math.min(512, Math.ceil(perimeter / 1.4)))
}

/** @param {number[][]} ring */
function ringBox(ring) {
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    bottom = -Infinity
  for (const [px, py] of ring) {
    x = Math.min(x, px)
    y = Math.min(y, py)
    right = Math.max(right, px)
    bottom = Math.max(bottom, py)
  }
  return [x, y, right, bottom]
}

/** Minimum-cost one-to-one assignment via the Hungarian algorithm (O(n^3)).
 * @param {number[][]} cost n x n nonnegative cost matrix
 * @returns {number[]} column index assigned to each row */
function assignMinCost(cost) {
  const n = cost.length
  const u = new Float64Array(n + 1),
    v = new Float64Array(n + 1)
  const p = new Int32Array(n + 1),
    way = new Int32Array(n + 1)
  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Float64Array(n + 1).fill(Infinity)
    const used = new Uint8Array(n + 1)
    do {
      used[j0] = 1
      const i0 = p[j0]
      let delta = Infinity,
        j1 = 0
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else minv[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }
  const result = Array.from({ length: n }, () => 0)
  for (let j = 1; j <= n; j++) result[p[j] - 1] = j - 1
  return result
}

/** Pair islands (or counters) by the distance between their bounding boxes.
 * Minimizes total squared distance so a uniform shift never swaps two neighbours.
 * @template T @param {T[][]} faces @param {(item:T)=>number[][]} ringOf */
export function matchRegions(faces, ringOf) {
  const bounds = (/** @type {T} */ item) => ringBox(ringOf(item))
  const refs = faces[0].map(bounds)
  const n = refs.length
  if (faces.some((f) => f.length !== n)) return null
  return faces.map((face, f) => {
    if (!f || n <= 1) return face.slice()
    const boxes = face.map(bounds)
    const dist = refs.map((ref) => boxes.map((b) => ref.reduce((d, v, k) => d + (v - b[k]) ** 2, 0)))
    return assignMinCost(dist).map((j) => face[j])
  })
}

/** Group islands across faces whose island counts differ. Islands whose boxes mostly
 * overlap within `reach` share a group, so a stroke that one face joins to its
 * neighbour takes only those islands out of contour matching. Every group holds at
 * least one island of every face.
 * @template T @param {T[][]} faces @param {(item:T)=>number[][]} ringOf @param {number} reach
 * @returns {T[][][]} */
export function groupRegions(faces, ringOf, reach) {
  const nodes = faces.flatMap((face, f) =>
    face.map((item) => {
      const [x, y, right, bottom] = ringBox(ringOf(item))
      return { f, item, box: [x - reach, y - reach, right + reach, bottom + reach] }
    })
  )
  const parent = nodes.map((_, i) => i)
  const root = (/** @type {number} */ i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]]
    return i
  }
  const area = (/** @type {number[]} */ b) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1])
  for (let a = 0; a < nodes.length; a++)
    for (let b = a + 1; b < nodes.length; b++) {
      if (nodes[a].f === nodes[b].f) continue
      const p = nodes[a].box,
        q = nodes[b].box
      const shared = area([
        Math.max(p[0], q[0]),
        Math.max(p[1], q[1]),
        Math.min(p[2], q[2]),
        Math.min(p[3], q[3])
      ])
      if (shared > 0.5 * Math.min(area(p), area(q))) parent[root(a)] = root(b)
    }
  /** @type {Map<number, typeof nodes>} */
  const byRoot = new Map()
  nodes.forEach((node, i) => byRoot.set(root(i), [...(byRoot.get(root(i)) ?? []), node]))
  const groups = [...byRoot.values()]
  const centre = (/** @type {typeof nodes} */ group) => {
    const xs = group.flatMap((n) => [n.box[0], n.box[2]]),
      ys = group.flatMap((n) => [n.box[1], n.box[3]])
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  }
  // An island with no counterpart in some face joins the nearest group.
  for (;;) {
    const lone = groups.findIndex((group) => faces.some((_, f) => !group.some((n) => n.f === f)))
    if (lone < 0 || groups.length === 1) break
    const [group] = groups.splice(lone, 1)
    const from = centre(group)
    let nearest = 0,
      best = Infinity
    groups.forEach((other, i) => {
      const to = centre(other),
        distance = Math.hypot(to[0] - from[0], to[1] - from[1])
      if (distance < best) {
        best = distance
        nearest = i
      }
    })
    groups[nearest].push(...group)
  }
  return groups.map((group) => faces.map((_, f) => group.filter((n) => n.f === f).map((n) => n.item)))
}

/** Whether a point lies inside a closed ring.
 * @param {number[]} point @param {number[][]} ring */
function inside([x, y], ring) {
  let within = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j]
    if (a[1] > y !== b[1] > y && x < a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) within = !within
  }
  return within
}

/** @param {number[][]} ring */
const turning = (ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length]
    return sum + p[0] * q[1] - q[0] * p[1]
  }, 0)

/** A ring's points without the closing one, with no two further apart than `step`.
 * @param {number[][]} ring @param {number} step */
function dense(ring, step) {
  /** @type {number[][]} */
  const out = []
  for (let i = 0; i + 1 < ring.length; i++) {
    const a = ring[i],
      b = ring[i + 1],
      pieces = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step))
    for (let t = 0; t < pieces; t++)
      out.push([a[0] + ((b[0] - a[0]) * t) / pieces, a[1] + ((b[1] - a[1]) * t) / pieces])
  }
  return out
}

/** Trim the stub a cut leaves on the body. A stroke that lands on the body at a slant is
 * narrowest short of its tip, so the cut there leaves the tip on the body as a stub, which
 * stands proud once the stroke blends away. Each end of the body's cut slides back along its
 * outline to where the closing line meets the outline at the gentlest angle. The stroke keeps
 * the cut it had: its outline is the one that matches its counterpart in the other faces.
 * @param {{ points: number[][], labels: number[] }} body open run of points, closed from its last to its first
 * @param {number} width the cut's length
 * @param {number[][]} ring the ring being cut, whose ink the closing line stays in
 * @param {number[][][]} clear rings the closing line may not enter */
function trimStub(body, width, ring, clear) {
  const pts = body.points,
    size = pts.length
  // A stub is a nub a few points long; a longer run past the cut is a stroke of the body's own.
  const reach = 4
  if (size < 2 * reach + 12) return
  /** Unsigned turn from one direction to the next. */
  const bend = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number[]} */ c) => {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      vx = c[0] - b[0],
      vy = c[1] - b[1]
    return Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy))
  }
  /** The sharper of the turns onto and off the line closing `pts[hi]` to `pts[lo]`. */
  const sharpest = (/** @type {number} */ lo, /** @type {number} */ hi) =>
    Math.max(bend(pts[hi - 2], pts[hi], pts[lo]), bend(pts[hi], pts[lo], pts[lo + 2]))
  // The slide has to leave the outline running nearly straight through the closing line,
  // and clearly straighter than the cut did.
  let least = Math.min(0.4, sharpest(0, size - 1) - 0.3),
    head = 0,
    tail = 0
  for (let lo = 0; lo <= reach; lo++)
    for (let back = 0; back <= reach; back++) {
      if (!lo && !back) continue
      const hi = size - 1 - back
      const a = pts[hi],
        b = pts[lo]
      const length = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (length < 1 || length > 3 * width) continue
      const worst = sharpest(lo, hi)
      if (worst >= least) continue
      const steps = Math.max(4, Math.ceil(length / 1.5))
      let sound = true
      for (let t = 1; t < steps && sound; t++) {
        const p = [a[0] + ((b[0] - a[0]) * t) / steps, a[1] + ((b[1] - a[1]) * t) / steps]
        sound = inside(p, ring) && !clear.some((other) => inside(p, other))
      }
      if (!sound) continue
      least = worst
      head = lo
      tail = back
    }
  if (!head && !tail) return
  body.points = pts.slice(head, size - tail)
  body.labels = body.labels.slice(head, size - tail)
}

/** Cut a ring at its necks into one ring per target. Each point goes with the target it
 * lies in or nearest to; the ring is then cut along the narrowest chord that leaves the
 * points of every target together on one side, until each piece holds one target. Null
 * when no chord parts the targets.
 * @param {number[][]} ring closed
 * @param {{ ring: number[][], solid: boolean }[]} targets closed rings; a solid one claims the points inside it
 * @param {boolean} within whether a chord runs inside the ring (through its ink or its counter) or outside it (across a bay)
 * @param {boolean} cap bow the smaller piece's cut end outward, so it overlaps what it left
 * @param {number[][][]} [clear] rings no chord may touch
 * @returns {number[][][] | null} per target, a closed ring */
function cutRing(ring, targets, within, cap, clear = []) {
  const points = dense(ring, 3)
  const marks = targets.map((target) => dense(target.ring, 3))
  const tangents = (/** @type {number[][]} */ pts) => {
    const n = pts.length
    return pts.map((_, i) => {
      const a = pts[(i + n - 1) % n],
        b = pts[(i + 1) % n]
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = Math.hypot(dx, dy) || 1
      return [dx / len, dy / len]
    })
  }
  const pTan = within ? null : tangents(points)
  const mTan = within ? null : marks.map(tangents)
  const ringSign = turning(ring) > 0 ? 1 : -1
  const labels = points.map((p, pi) => {
    const [tx, ty] = pTan ? pTan[pi] : [0, 0]
    let best = 0,
      least = Infinity
    targets.forEach((target, k) => {
      let d = Infinity
      if (target.solid && within && inside(p, target.ring)) d = 0
      if (d > 0) {
        const m = marks[k],
          mt = mTan?.[k]
        let nearestDist = Infinity,
          nearestAlign = 0
        for (let qi = 0; qi < m.length; qi++) {
          const q = m[qi]
          const dist = Math.hypot(q[0] - p[0], q[1] - p[1])
          if (mt) {
            const align = tx * mt[qi][0] + ty * mt[qi][1]
            if (dist < nearestDist) {
              nearestDist = dist
              nearestAlign = align
            }
            const score = dist + (align < 0 ? 40 * (1 - align) : 8 * (1 - align))
            if (score < d) d = score
          } else if (dist < d) {
            d = dist
          }
        }
        // On an outer frame, exterior stem walls can lie inside a wider donor's counter;
        // only grant zero distance when the outward normal enters the counter AND the nearest
        // counter wall runs in the same direction (not reversed on the outside of the stem).
        if (!within && target.solid && inside(p, target.ring) && nearestAlign > 0) {
          const outPt = [p[0] + ringSign * ty * 1.5, p[1] - ringSign * tx * 1.5]
          if (inside(outPt, target.ring)) d = 0
        }
      }
      if (d < least) {
        least = d
        best = k
      }
    })
    return best
  })
  /** @type {(number[][] | undefined)[]} */
  const out = targets.map(() => undefined)
  /** @type {{ points: number[][], labels: number[] }[]} */
  const pieces = [{ points, labels }]
  while (pieces.length) {
    const piece = /** @type {{ points: number[][], labels: number[] }} */ (pieces.pop())
    const size = piece.points.length
    const held = [...new Set(piece.labels)]
    if (held.length === 1) {
      if (out[held[0]] || size < 3) return null
      out[held[0]] = [...piece.points, piece.points[0]]
      continue
    }
    // How many points of each target lie before each position.
    const before = held.map((label) => {
      const sums = [0]
      for (const l of piece.labels) sums.push(sums[sums.length - 1] + (l === label ? 1 : 0))
      return sums
    })
    /** @type {{ i: number, j: number, width: number, cost: number }[]} */
    const chords = []
    for (let i = 0; i < size; i++)
      for (let j = i + 6; j < size; j++) {
        if (size - (j - i) < 6) continue
        const dx = piece.points[j][0] - piece.points[i][0],
          dy = piece.points[j][1] - piece.points[i][1]
        if (dx > 56 || dx < -56 || dy > 56 || dy < -56) continue
        const width = Math.hypot(dx, dy)
        if (width > 56) continue
        // Points i..j-1 on one side, the rest on the other; the share of a target left
        // on the wrong side counts against the chord.
        let stray = 0,
          here = 0,
          there = 0
        for (const sums of before) {
          const inner = sums[j] - sums[i],
            outer = sums[size] - inner
          stray = Math.max(stray, Math.min(inner, outer) / sums[size])
          if (inner > outer) here++
          else there++
        }
        if (!here || !there || stray > 0.3) continue
        chords.push({ i, j, width, cost: width * (1 + 2 * stray) + 30 * stray })
      }
    chords.sort((a, b) => a.cost - b.cost)
    const chord = chords.find(({ i, j }) => {
      const a = piece.points[i],
        b = piece.points[j]
      const side = (/** @type {number[]} */ p, /** @type {number[]} */ q, /** @type {number[]} */ r) =>
        (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
      const apart = (/** @type {number[]} */ p, /** @type {number[]} */ q) =>
        side(a, b, p) * side(a, b, q) > 0 ||
        side(p, q, a) * side(p, q, b) > 0 ||
        Math.max(p[0], q[0]) < Math.min(a[0], b[0]) ||
        Math.min(p[0], q[0]) > Math.max(a[0], b[0]) ||
        Math.max(p[1], q[1]) < Math.min(a[1], b[1]) ||
        Math.min(p[1], q[1]) > Math.max(a[1], b[1])
      // The chord stays on its side of the ring, meets the piece only at its ends and
      // touches nothing it must keep clear of.
      return (
        [1, 2, 3].every((t) => {
          const p = [a[0] + ((b[0] - a[0]) * t) / 4, a[1] + ((b[1] - a[1]) * t) / 4]
          return inside(p, ring) === within && !clear.some((other) => inside(p, other))
        }) &&
        piece.points.every((p, k) => {
          const next = (k + 1) % size
          return k === i || k === j || next === i || next === j || apart(p, piece.points[next])
        }) &&
        clear.every((other) => other.every((p, k) => !k || apart(other[k - 1], p)))
      )
    })
    if (!chord) return null
    let { i, j } = chord
    // When cutting an open counter across the gap between a bar tip and a stem wall,
    // center the chord on the bar tip's midpoint and its perpendicular stem projection
    // so the blended bar joins symmetrically instead of biting into one flank.
    if (!cap && chord.width > 1) {
      const pts = piece.points,
        n = pts.length
      const mod = (/** @type {number} */ k) => ((k % n) + n) % n
      const at = (/** @type {number} */ idx) => pts[mod(idx)]
      const ux = (pts[j][0] - pts[i][0]) / chord.width,
        uy = (pts[j][1] - pts[i][1]) / chord.width
      const findFlank = (
        /** @type {number} */ idx,
        /** @type {number} */ dir,
        /** @type {number} */ cx,
        /** @type {number} */ cy
      ) => {
        let dist = 0
        for (let step = 0; step < n / 2 && dist <= 24; step++) {
          const cur = idx + dir * step
          const p0 = at(cur)
          if (step > 0) dist += Math.hypot(p0[0] - at(cur - dir)[0], p0[1] - at(cur - dir)[1])
          if (dist > 24) break
          let ahead = cur + dir,
            span = Math.hypot(at(ahead)[0] - p0[0], at(ahead)[1] - p0[1])
          for (let k = 1; k < 12 && span < 3; k++) {
            ahead += dir
            span = Math.hypot(at(ahead)[0] - p0[0], at(ahead)[1] - p0[1])
          }
          if (span > 0.5) {
            const dx = at(ahead)[0] - p0[0],
              dy = at(ahead)[1] - p0[1]
            if ((dx * cx + dy * cy) / span < -0.58) return step
          }
        }
        return -1
      }
      const findStem = (
        /** @type {number} */ idx,
        /** @type {number[]} */ target,
        /** @type {number} */ cx,
        /** @type {number} */ cy
      ) => {
        const origin = at(idx)
        const want = (target[0] - origin[0]) * -cy + (target[1] - origin[1]) * cx
        let bestIdx = idx,
          bestErr = Math.abs(want)
        for (const dir of [-1, 1]) {
          let dist = 0
          for (let step = 1; step < n / 2; step++) {
            const p0 = at(idx + dir * (step - 1)),
              p1 = at(idx + dir * step)
            dist += Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
            if (dist > 26) break
            const along = (p1[0] - origin[0]) * cx + (p1[1] - origin[1]) * cy
            if (Math.abs(along) > Math.max(6, chord.width * 0.65)) break
            const perp = (p1[0] - origin[0]) * -cy + (p1[1] - origin[1]) * cx
            const err = Math.abs(perp - want)
            if (err < bestErr) {
              bestErr = err
              bestIdx = mod(idx + dir * step)
            }
          }
        }
        return bestIdx
      }
      const iFwd = findFlank(i, 1, ux, uy),
        iBack = findFlank(i, -1, ux, uy)
      const jFwd = findFlank(j, 1, -ux, -uy),
        jBack = findFlank(j, -1, -ux, -uy)
      const iTip = iFwd >= 0 && iBack >= 0,
        jTip = jFwd >= 0 && jBack >= 0
      let ni = i,
        nj = j
      if (iTip && !jTip) {
        ni = mod(i + Math.round((iFwd - iBack) / 2))
        nj = findStem(j, pts[ni], ux, uy)
      } else if (jTip && !iTip) {
        nj = mod(j + Math.round((jFwd - jBack) / 2))
        ni = findStem(i, pts[nj], -ux, -uy)
      }
      if (ni !== i || nj !== j) {
        const lo = Math.min(ni, nj),
          hi = Math.max(ni, nj)
        const a = pts[lo],
          b = pts[hi]
        let stray = 0,
          here = 0,
          there = 0
        for (const sums of before) {
          const inner = sums[hi] - sums[lo],
            outer = sums[size] - inner
          stray = Math.max(stray, Math.min(inner, outer) / sums[size])
          if (inner > outer) here++
          else there++
        }
        const side = (/** @type {number[]} */ p, /** @type {number[]} */ q, /** @type {number[]} */ r) =>
          (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
        const apart = (/** @type {number[]} */ p, /** @type {number[]} */ q) =>
          side(a, b, p) * side(a, b, q) > 0 ||
          side(p, q, a) * side(p, q, b) > 0 ||
          Math.max(p[0], q[0]) < Math.min(a[0], b[0]) ||
          Math.min(p[0], q[0]) > Math.max(a[0], b[0]) ||
          Math.max(p[1], q[1]) < Math.min(a[1], b[1]) ||
          Math.min(p[1], q[1]) > Math.max(a[1], b[1])
        if (
          hi - lo >= 6 &&
          size - (hi - lo) >= 6 &&
          here &&
          there &&
          stray <= 0.3 &&
          Math.hypot(b[0] - a[0], b[1] - a[1]) <= 56 &&
          [1, 2, 3].every((t) => {
            const p = [a[0] + ((b[0] - a[0]) * t) / 4, a[1] + ((b[1] - a[1]) * t) / 4]
            return inside(p, ring) === within && !clear.some((other) => inside(p, other))
          }) &&
          pts.every((p, k) => {
            const next = (k + 1) % n
            return k === lo || k === hi || next === lo || next === hi || apart(p, pts[next])
          }) &&
          clear.every((other) => other.every((p, k) => !k || apart(other[k - 1], p)))
        ) {
          i = lo
          j = hi
        }
      }
    }
    const sides = [
      { points: piece.points.slice(i, j + 1), labels: piece.labels.slice(i, j + 1) },
      {
        points: [...piece.points.slice(j), ...piece.points.slice(0, i + 1)],
        labels: [...piece.labels.slice(j), ...piece.labels.slice(0, i + 1)]
      }
    ]
    // Each target goes whole to the side that holds most of it.
    const first = new Set(held.filter((_, k) => 2 * (before[k][j] - before[k][i]) > before[k][size]))
    sides.forEach((side, n) => {
      const own = held.filter((label) => first.has(label) === !n)
      const counts = own.map((label) => side.labels.filter((l) => l === label).length)
      const most = own[counts.indexOf(Math.max(...counts))]
      side.labels = side.labels.map((label) => (own.includes(label) ? label : most))
    })
    // Each side closes along the chord from its last point to its first. Points along it
    // let a later cut end there, and bow the smaller side's end out over what it left,
    // far enough to stay joined when a lighter weight draws both pieces back.
    const small = Math.abs(turning(sides[0].points)) <= Math.abs(turning(sides[1].points)) ? 0 : 1
    const depth = cap ? Math.min(chord.width / 4, 4) : 0
    if (cap) trimStub(sides[1 - small], chord.width, ring, clear)
    sides.forEach((side, n) => {
      const from = side.points[side.points.length - 1],
        to = side.points[0]
      const steps = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 3))
      const centre = [0, 1].map((k) => side.points.reduce((sum, p) => sum + p[k], 0) / side.points.length)
      const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
      const away = Math.hypot(mid[0] - centre[0], mid[1] - centre[1]) || 1
      const other = [...sides[1 - n].points, sides[1 - n].points[0]]
      const bow =
        n === small &&
        depth &&
        inside(
          [0, 1].map((k) => mid[k] + ((mid[k] - centre[k]) / away) * depth),
          other
        )
          ? depth
          : 0
      const ends = [side.labels[side.labels.length - 1], side.labels[0]]
      for (let t = 1; t < steps; t++) {
        const out = bow * Math.sin((Math.PI * t) / steps)
        side.points.push(
          [0, 1].map((k) => from[k] + ((to[k] - from[k]) * t) / steps + ((mid[k] - centre[k]) / away) * out)
        )
        side.labels.push(ends[2 * t < steps ? 0 : 1])
      }
    })
    pieces.push(...sides)
  }
  return out.every(Boolean) ? /** @type {number[][][]} */ (out) : null
}

/** Faces that draw as one island what another draws as several (a stroke that runs
 * into its neighbour in one face and stands clear in another) get the same islands: the
 * fused island is cut at the junction, so each stroke blends with its own counterpart.
 * Null when the faces split the ink in ways that are not one a coarser form of the other.
 * @param {number[][][][][]} polygons each face's islands
 * @returns {number[][][][][][] | null} per island, each face's one island */
export function splitIslands(polygons) {
  const finest = polygons.reduce((best, islands, f) => (islands.length > polygons[best].length ? f : best), 0)
  const fine = polygons[finest]
  if (!fine.length || polygons.some((islands) => !islands.length)) return null
  const faces = polygons.map((islands, f) => {
    if (f === finest) return fine
    if (islands.length === fine.length) return matchRegions([fine, islands], (p) => p[0])?.[1] ?? null
    const outlines = islands.map((island) => dense(island[0], 3))
    const owners = fine.map((island) => {
      const points = dense(island[0], 3)
      const mid = [0, 1].map((k) => points.reduce((sum, p) => sum + p[k], 0) / points.length)
      const votes = islands.map(
        (other) =>
          points.filter((p) => {
            const q = [(2 * p[0] + mid[0]) / 3, (2 * p[1] + mid[1]) / 3]
            return inside(q, other[0]) && !other.slice(1).some((ring) => inside(q, ring))
          }).length
      )
      const most = Math.max(...votes)
      if (most) return votes.indexOf(most)
      // A thin stroke can lie wholly beside the ink it belongs to; it goes with the nearest.
      const apart = outlines.map((outline) =>
        Math.min(...outline.map((q) => Math.min(...points.map((p) => Math.hypot(p[0] - q[0], p[1] - q[1])))))
      )
      return apart.indexOf(Math.min(...apart))
    })
    /** @type {number[][][][]} */
    const out = []
    for (const [x, island] of islands.entries()) {
      const mine = owners.flatMap((owner, j) => (owner === x ? [j] : []))
      if (!mine.length) return null
      if (mine.length === 1) {
        out[mine[0]] = island
        continue
      }
      const pieces = cutRing(
        island[0],
        mine.map((j) => ({ ring: fine[j][0], solid: true })),
        true,
        true,
        island.slice(1)
      )
      if (!pieces) return null
      mine.forEach((j, k) => (out[j] = [pieces[k]]))
      // No cut touches a counter, so each lies whole in one piece.
      for (const hole of island.slice(1)) {
        const k = pieces.findIndex((piece) => inside(hole[0], piece))
        if (k < 0) return null
        out[mine[k]].push(hole)
      }
    }
    return out
  })
  if (faces.some((face) => !face)) return null
  return fine.map((_, j) => faces.map((face) => [/** @type {number[][][][]} */ (face)[j]]))
}

/** Map one ring from a source bounding box into a destination bounding box.
 * @param {number[][]} ring @param {number[]} dst @param {number[]} [src] */
function fitRingToBox(ring, dst, src = ringBox(ring)) {
  const sw = src[2] - src[0] || 1,
    sh = src[3] - src[1] || 1
  const dw = dst[2] - dst[0] || 1,
    dh = dst[3] - dst[1] || 1
  return ring.map(([x, y]) => [dst[0] + ((x - src[0]) * dw) / sw, dst[1] + ((y - src[1]) * dh) / sh])
}

/** Lazily yield candidate merged-counter topologies: slit each closed bar of a finer face
 * at the stem wall where a coarser face leaves that bar open, so every face shares the
 * open-bar topology and the bar slides across the gap at full thickness without a pinched thread.
 * @param {number[][][][]} faces each face's frame and counters
 * @returns {Generator<number[][][][], void, void>} candidate face lists to try in order */
function* mergeCounterCandidates(faces) {
  const coarsest = faces.reduce((best, rings, f) => (rings.length < faces[best].length ? f : best), 0)
  const coarse = faces[coarsest]

  const side = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number[]} */ c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const segHits = (
    /** @type {number[]} */ a,
    /** @type {number[]} */ b,
    /** @type {number[]} */ c,
    /** @type {number[]} */ d
  ) => {
    if (
      Math.max(a[0], b[0]) < Math.min(c[0], d[0]) ||
      Math.max(c[0], d[0]) < Math.min(a[0], b[0]) ||
      Math.max(a[1], b[1]) < Math.min(c[1], d[1]) ||
      Math.max(c[1], d[1]) < Math.min(a[1], b[1])
    )
      return false
    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0
  }
  const dirAt = (/** @type {number[][]} */ pts, /** @type {number} */ idx, /** @type {1|-1} */ stepDir) => {
    const n = pts.length,
      origin = pts[idx]
    let k = idx,
      span = 0
    for (let s = 1; s < n / 2 && span < 5; s++) {
      k = (((idx + stepDir * s) % n) + n) % n
      span = Math.hypot(pts[k][0] - origin[0], pts[k][1] - origin[1])
    }
    if (span < 0.5) return [0, 0]
    return [(pts[k][0] - origin[0]) / span, (pts[k][1] - origin[1]) / span]
  }
  const stepAlong = (
    /** @type {number[][]} */ pts,
    /** @type {number} */ start,
    /** @type {1|-1} */ dir,
    /** @type {number} */ dist
  ) => {
    const n = pts.length
    let walked = 0,
      cur = start
    for (let s = 0; s < n - 2; s++) {
      const next = (((cur + dir) % n) + n) % n
      const seg = Math.hypot(pts[next][0] - pts[cur][0], pts[next][1] - pts[cur][1])
      if (walked + seg >= dist) {
        const t = seg ? (dist - walked) / seg : 0
        return {
          pt: [
            pts[cur][0] + (pts[next][0] - pts[cur][0]) * t,
            pts[cur][1] + (pts[next][1] - pts[cur][1]) * t
          ],
          skip: s + 1
        }
      }
      walked += seg
      cur = next
    }
    return null
  }

  /** Splice two rings across a closed bar at its open-in-coarse stem wall.
   * Outer frames and holes share one ink-side handedness (`sign = 1` when ink is left of
   * each edge, `-1` when right), so one junction formula handles both hole+hole and frame+hole merges.
   * @param {number[][]} r1 @param {number[][]} r2 @param {number[][]} guideRing
   * @param {boolean} guideIsHole @param {number[][][]} regCoarse @param {number[][][]} allRings
   * @param {1 | -1} sign */
  const splicePair = (r1, r2, guideRing, guideIsHole, regCoarse, allRings, sign) => {
    const p1 = dense(r1, 2),
      p2 = dense(r2, 2)
    const n1 = p1.length,
      n2 = p2.length
    if (n1 < 6 || n2 < 6) return null
    const b1Before = p1.map((_, i) => dirAt(p1, i, -1))
    const b1After = p1.map((_, i) => dirAt(p1, i, 1))
    const b2Before = p2.map((_, i) => dirAt(p2, i, -1))
    const b2After = p2.map((_, i) => dirAt(p2, i, 1))

    // Only real stem-to-bar inner corners can anchor a slit (rejects diagonals across straight walls).
    /** @type {number[]} */
    const iCorners = []
    for (let i = 0; i < n1; i++)
      if (sign * (-b1Before[i][0] * b1After[i][1] + b1Before[i][1] * b1After[i][0]) >= 0.45) iCorners.push(i)
    /** @type {number[]} */
    const jCorners = []
    for (let j = 0; j < n2; j++)
      if (sign * (-b2Before[j][0] * b2After[j][1] + b2Before[j][1] * b2After[j][0]) >= 0.45) jCorners.push(j)
    if (!iCorners.length || !jCorners.length) return null

    const isCoarseWhite = (/** @type {number[]} */ pt) =>
      guideIsHole ? inside(pt, guideRing) : !inside(pt, guideRing)
    const isCoarseInk = (/** @type {number[]} */ pt) =>
      guideIsHole
        ? !inside(pt, guideRing)
        : inside(pt, regCoarse[0]) && !regCoarse.slice(1).some((h) => inside(pt, h))

    const box1 = ringBox(r1),
      box2 = ringBox(r2)
    const spanAlong = (
      /** @type {number[]} */ box,
      /** @type {number[]} */ origin,
      /** @type {number} */ ux,
      /** @type {number} */ uy
    ) => {
      let lo = Infinity,
        hi = -Infinity
      for (const x of [box[0], box[2]])
        for (const y of [box[1], box[3]]) {
          const p = (x - origin[0]) * ux + (y - origin[1]) * uy
          if (p < lo) lo = p
          if (p > hi) hi = p
        }
      return [lo, hi]
    }

    /** @type {{ i: number, j: number, cost: number }[]} */
    const cands = []
    for (const i of iCorners) {
      const a = p1[i]
      for (const j of jCorners) {
        const b = p2[j]
        const dx = b[0] - a[0],
          dy = b[1] - a[1]
        if (dx > 40 || dx < -40 || dy > 40 || dy < -40) continue
        const d = Math.hypot(dx, dy)
        if (d < 1.5 || d > 40) continue
        const ux = dx / d,
          uy = dy / d
        // Entering p1[i] (-b1Before) and leaving p2[j] (b2After) continue along the stem wall.
        const stemIn = -(b1Before[i][0] * ux + b1Before[i][1] * uy)
        const stemOut = b2After[j][0] * ux + b2After[j][1] * uy
        if (stemIn < 0.7 || stemOut < 0.7) continue
        // Bar extends along b = sign * (-uy, ux) (into bar ink).
        const bx = -uy * sign,
          by = ux * sign
        const bar1 = b1After[i][0] * bx + b1After[i][1] * by
        const bar2 = b2Before[j][0] * bx + b2Before[j][1] * by
        if (bar1 < 0.45 || bar2 < 0.45) continue

        // An open bar end in the coarse face leaves a continuous white channel parallel to a->b
        // with solid coarse ink (the stem) behind it. Extending into the adjacent counters
        // rejects closed bar ends even when the coarse bar is shifted vertically.
        const [min1] = spanAlong(box1, a, ux, uy)
        const [, max2] = spanAlong(box2, a, ux, uy)
        const reach1 = Math.max(0, -min1)
        const reach2 = Math.max(0, max2 - d)
        const uSamples = [
          -Math.min(5, reach1 * 0.8),
          -1,
          d * 0.25,
          d * 0.5,
          d * 0.75,
          d + 1,
          d + Math.min(5, reach2 * 0.8)
        ]
        const wideSamples = [
          -Math.min(28, reach1 * 0.45),
          -Math.min(28, reach1 * 0.8),
          d + Math.min(28, reach2 * 0.45),
          d + Math.min(28, reach2 * 0.8)
        ]
        let channelK = Infinity,
          bestWide = -1
        for (let k = -6; k <= 18; k += 1.5) {
          const ox = a[0] + bx * k,
            oy = a[1] + by * k
          let open = true
          for (const s of uSamples) {
            if (!isCoarseWhite([ox + ux * s, oy + uy * s])) {
              open = false
              break
            }
          }
          if (!open) continue
          let wideHits = 0
          for (const s of wideSamples) if (isCoarseWhite([ox + ux * s, oy + uy * s])) wideHits++
          if (wideHits > bestWide || (wideHits === bestWide && Math.abs(k - 3) < Math.abs(channelK - 3))) {
            bestWide = wideHits
            channelK = k
          }
        }
        if (!Number.isFinite(channelK)) continue
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        let stemHits = 0
        for (const dk of [3, 6, 10, 14, 18]) {
          const sk = channelK - dk
          if (isCoarseInk([mid[0] + bx * sk, mid[1] + by * sk])) stemHits++
        }
        if (!stemHits) continue

        const alignCost = (2 - stemIn - stemOut) * 18 + (2 - bar1 - bar2) * 10
        const gapCost = Math.abs(channelK - 3) * 0.5 + (4 - bestWide) * 8
        cands.push({ i, j, cost: d + alignCost + gapCost })
      }
    }
    cands.sort((x, y) => x.cost - y.cost)
    const frameRing = allRings[0]
    for (const { i, j, cost } of cands) {
      const a = p1[i],
        b = p2[j]
      const inkOk = [1, 2, 3].every((t) => {
        const q = [a[0] + ((b[0] - a[0]) * t) / 4, a[1] + ((b[1] - a[1]) * t) / 4]
        return inside(q, frameRing) && !allRings.slice(1).some((h) => inside(q, h))
      })
      if (!inkOk) continue
      let hit = false
      for (const other of allRings) {
        for (let k = 0; k + 1 < other.length; k++) {
          if (segHits(a, b, other[k], other[k + 1])) {
            hit = true
            break
          }
        }
        if (hit) break
      }
      if (hit) continue
      const off1 = stepAlong(p1, i, 1, 0.15)
      const off2 = stepAlong(p2, j, -1, 0.15)
      if (!off1 || !off2) continue
      /** @type {number[][]} */
      const merged = [off1.pt]
      for (let s = off1.skip; s <= n1; s++) merged.push(p1[(i + s) % n1])
      for (let s = 0; s <= n2 - off2.skip; s++) merged.push(p2[(j + s) % n2])
      merged.push(off2.pt)
      if (merged.length >= 6 && !crosses(merged))
        return { ring: [...merged, merged[0]], cost, key: [a[0], a[1], b[0], b[1]] }
    }
    return null
  }

  const ownersFor = (/** @type {number[][][]} */ rings, /** @type {boolean} */ preferClosed) =>
    preferClosed && coarse.length > 1
      ? rings.map((counter, j) => {
          if (!j) return 0
          const closedBoxes = coarse.slice(1).map(ringBox)
          const [x0, y0, x1, y1] = ringBox(counter)
          const cx = (x0 + x1) / 2,
            cy = (y0 + y1) / 2
          let best = 1,
            least = Infinity
          closedBoxes.forEach((b, idx) => {
            const dx = Math.max(0, b[0] - cx, cx - b[2]),
              dy = Math.max(0, b[1] - cy, cy - b[3])
            const d =
              dx * dx + dy * dy + 0.01 * ((cx - (b[0] + b[2]) / 2) ** 2 + (cy - (b[1] + b[3]) / 2) ** 2)
            if (d < least) {
              least = d
              best = idx + 1
            }
          })
          return best
        })
      : rings.map((counter, j) => {
          if (!j) return 0
          const points = counter.slice(0, -1)
          const mid = [0, 1].map((k) => points.reduce((sum, p) => sum + p[k], 0) / points.length)
          const votes = new Map()
          for (const p of [mid, ...points.map((q) => [(q[0] + mid[0]) / 2, (q[1] + mid[1]) / 2])]) {
            const within = coarse.findIndex((ring, x) => x && inside(p, ring))
            const where = within > 0 ? within : inside(p, coarse[0]) ? -1 : 0
            if (where >= 0) votes.set(where, (votes.get(where) ?? 0) + 1)
          }
          return votes.size ? [...votes].sort((x, y) => y[1] - x[1])[0][0] : -1
        })

  const beforeKey = (/** @type {number[]} */ p, /** @type {number[]} */ q) => {
    for (let k = 0; k < 4; k++) if (Math.abs(p[k] - q[k]) > 1e-6) return p[k] < q[k]
    return false
  }

  const buildFromOwners = (/** @type {(number[] | null)[]} */ allOwners) => {
    const out = faces.map((rings, f) => {
      if (f === coarsest) return rings
      if (rings.length === coarse.length) {
        const matched = matchRegions([coarse.slice(1), rings.slice(1)], (r) => r)
        return matched ? [rings[0], ...matched[1]] : null
      }
      const owners = allOwners[f]
      if (!owners || owners.includes(-1)) return null
      /** @type {number[][][]} */
      const result = []
      for (let x = 0; x < coarse.length; x++) {
        const mine = owners.flatMap((owner, j) => (owner === x ? [j] : []))
        if (!mine.length) return null
        if (mine.length === 1) {
          result[x] = rings[mine[0]]
          continue
        }
        let guide = coarse[x]
        let regCoarse = coarse
        if (x > 0) {
          const boxes = mine.map((j) => ringBox(rings[j]))
          guide = fitRingToBox(coarse[x], [
            Math.min(...boxes.map((b) => b[0])),
            Math.min(...boxes.map((b) => b[1])),
            Math.max(...boxes.map((b) => b[2])),
            Math.max(...boxes.map((b) => b[3]))
          ])
        } else {
          const srcBox = ringBox(coarse[0]),
            dstBox = ringBox(rings[0])
          regCoarse = coarse.map((r) => fitRingToBox(r, dstBox, srcBox))
          guide = regCoarse[0]
        }
        const sign = turning(rings[0]) < 0 ? 1 : -1
        const pool = mine.map((j) => rings[j])
        while (pool.length > 1) {
          /** @type {{ ring: number[][], cost: number, key: number[], a: number, b: number } | null} */
          let best = null
          for (let a = 0; a < pool.length; a++) {
            for (let b = 0; b < pool.length; b++) {
              if (a === b) continue
              const candidate = splicePair(pool[a], pool[b], guide, x > 0, regCoarse, rings, sign)
              if (
                candidate &&
                (!best ||
                  candidate.cost < best.cost - 1e-6 ||
                  (Math.abs(candidate.cost - best.cost) <= 1e-6 && beforeKey(candidate.key, best.key)))
              )
                best = { ...candidate, a, b }
            }
          }
          if (!best) return null
          const { a, b, ring: spliced } = best
          const next = pool.filter((_, idx) => idx !== a && idx !== b)
          next.push(spliced)
          pool.length = 0
          pool.push(...next)
        }
        result[x] = pool[0]
      }
      return result
    })
    return out.every(Boolean) ? /** @type {number[][][][]} */ (out) : null
  }

  /** @type {(number[] | null)[] | null} */
  let closedOwners = null
  if (coarse.length > 1) {
    closedOwners = faces.map((rings, f) =>
      f === coarsest || rings.length === coarse.length ? null : ownersFor(rings, true)
    )
    const closed = buildFromOwners(closedOwners)
    if (closed) yield closed
  }
  const votedOwners = faces.map((rings, f) =>
    f === coarsest || rings.length === coarse.length ? null : ownersFor(rings, false)
  )
  const sameOwners =
    closedOwners !== null &&
    votedOwners.every(
      (o, f) =>
        o === closedOwners[f] ||
        (o !== null &&
          closedOwners[f] !== null &&
          o.length === closedOwners[f].length &&
          o.every((v, i) => v === /** @type {number[]} */ (closedOwners[f])[i]))
    )
  if (!sameOwners) {
    const voted = buildFromOwners(votedOwners)
    if (voted) yield voted
  }
}

/** Map a group of target counters into the bounding box of the merged counter they
 * divide, so a face that shifts a counter stack still places each target in its bay.
 * @param {number[][]} ring @param {number[][][]} targetRings */
function fitTargets(ring, targetRings) {
  const dst = ringBox(ring)
  const boxes = targetRings.map(ringBox)
  const src = [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3]))
  ]
  const sw = src[2] - src[0] || 1,
    sh = src[3] - src[1] || 1
  const dw = dst[2] - dst[0] || 1,
    dh = dst[3] - dst[1] || 1
  return targetRings.map((r) =>
    r.map(([x, y]) => [dst[0] + ((x - src[0]) * dw) / sw, dst[1] + ((y - src[1]) * dh) / sh])
  )
}

/** Faces that leave open a counter another face closes (a bar that stops short of its
 * frame) have fewer rings than it. Cut their rings at the gaps, so every face has the
 * counters of the face with most, each blending with its own counterpart.
 * @param {number[][][][]} faces each face's frame and counters
 * @returns {number[][][][] | null} */
function splitCounters(faces) {
  const finest = faces.reduce((best, rings, f) => (rings.length > faces[best].length ? f : best), 0)
  const fine = faces[finest]
  const tryOwners = (/** @type {number[][][]} */ rings, /** @type {number[]} */ owners) => {
    if (owners.includes(-1)) return null
    /** @type {number[][][]} */
    const cut = []
    for (const [x, ring] of rings.entries()) {
      const mine = owners.flatMap((owner, j) => (owner === x ? [j] : []))
      if (!mine.length) return null
      if (mine.length === 1) {
        cut[mine[0]] = ring
        continue
      }
      const raw = mine.map((j) => fine[j])
      const mapped = x > 0 ? fitTargets(ring, raw) : raw
      const pieces = cutRing(
        ring,
        mapped.map((r, k) => ({ ring: r, solid: mine[k] > 0 })),
        x > 0,
        false
      )
      if (!pieces) return null
      mine.forEach((j, k) => (cut[j] = pieces[k]))
    }
    return cut
  }
  const out = faces.map((rings, f) => {
    if (f === finest) return rings
    if (rings.length === fine.length) {
      const matched = matchRegions([fine.slice(1), rings.slice(1)], (r) => r)
      return matched ? [rings[0], ...matched[1]] : null
    }
    const owners = fine.map((counter, j) => {
      if (!j) return 0
      const points = counter.slice(0, -1)
      const mid = [0, 1].map((k) => points.reduce((sum, p) => sum + p[k], 0) / points.length)
      const votes = new Map()
      for (const p of [mid, ...points.map((q) => [(q[0] + mid[0]) / 2, (q[1] + mid[1]) / 2])]) {
        const within = rings.findIndex((ring, x) => x && inside(p, ring))
        const where = within > 0 ? within : inside(p, rings[0]) ? -1 : 0
        if (where >= 0) votes.set(where, (votes.get(where) ?? 0) + 1)
      }
      return votes.size ? [...votes].sort((x, y) => y[1] - x[1])[0][0] : -1
    })
    const first = tryOwners(rings, owners)
    if (first) return first
    // When a shifted counter stack lands outside the coarse counter that actually holds it,
    // assign every fine counter to its nearest closed counter and cut with registered boxes.
    if (rings.length > 1) {
      const closedBoxes = rings.slice(1).map(ringBox)
      const closedOwners = fine.map((counter, j) => {
        if (!j) return 0
        const [x0, y0, x1, y1] = ringBox(counter)
        const cx = (x0 + x1) / 2,
          cy = (y0 + y1) / 2
        let best = 1,
          least = Infinity
        closedBoxes.forEach((b, idx) => {
          const dx = Math.max(0, b[0] - cx, cx - b[2]),
            dy = Math.max(0, b[1] - cy, cy - b[3])
          const d = dx * dx + dy * dy + 0.01 * ((cx - (b[0] + b[2]) / 2) ** 2 + (cy - (b[1] + b[3]) / 2) ** 2)
          if (d < least) {
            least = d
            best = idx + 1
          }
        })
        return best
      })
      return tryOwners(rings, closedOwners)
    }
    return null
  })
  return out.every(Boolean) ? /** @type {number[][][][]} */ (out) : null
}

/** Compute correspondences and local stroke widths once, independently of the controls.
 * @param {number[][][][][]} polygons each face's one island
 * @param {boolean} [cut] the islands were cut from larger ones */
export function prepareCorrespondence(polygons, cut = false) {
  if (!polygons.length || !polygons.every((p) => p.length === 1)) return null
  /** A face's ink, and how much its outline turns in all.
   * @param {number[][][]} rings */
  const held = (rings) =>
    Math.abs(rings.slice(1).reduce((sum, ring) => sum - Math.abs(turning(ring)), Math.abs(turning(rings[0]))))
  const winding = (/** @type {number[][][]} */ rings) =>
    rings.reduce(
      (sum, ring) =>
        sum +
        ring.reduce((bends, p, i) => {
          const a = ring[(i + ring.length - 2) % ring.length],
            b = ring[(i + 2) % ring.length]
          const turn = Math.atan2(b[1] - p[1], b[0] - p[0]) - Math.atan2(p[1] - a[1], p[0] - a[0])
          return bends + Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)))
        }, 0),
      0
    )
  /** Match the rings point for point; how far the even mix strays from the faces.
   * @param {number[][][][]} faces each face's frame and counters, alike in number
   * @param {boolean} cutTo the counters already stand in one order
   * @param {boolean} check compute crossing, ink and turning guards */
  const matchOf = (faces, cutTo, check) => {
    const holes = cutTo
      ? faces.map((rings) => rings.slice(1))
      : matchRegions(
          faces.map((rings) => rings.slice(1)),
          (r) => r
        )
    if (!holes) return null
    const ordered = faces.map((rings, i) => [rings[0], ...holes[i]])
    const sampled = /** @type {number[][][][]} */ (
      ordered[0].map((_, j) => alignRings(ordered.map((rings) => rings[j])))
    )
    if (sampled.some((ring) => !ring)) return null
    if (!check) return { sampled, crossed: false, ink: 0, wander: 0 }
    const blendAt = (/** @type {number[]} */ shares) =>
      sampled.map((ring) =>
        ring[0].map((_, i) =>
          [0, 1].map((k) => ring.reduce((sum, face, f) => sum + shares[f] * face[i][k], 0))
        )
      )
    const even = blendAt(faces.map(() => 1 / faces.length))
    const each = faces.map((_, f) => sampled.map((ring) => ring[f]))
    const mean = (/** @type {(rings: number[][][]) => number} */ of) =>
      each.reduce((sum, rings) => sum + of(rings), 0) / faces.length
    const outerSign = Math.sign(turning(even[0]))
    const signedInk = (/** @type {number[][][]} */ list) =>
      Math.abs(list.reduce((sum, ring) => sum + turning(ring) * outerSign, 0))
    const settled = (/** @type {number[][][]} */ list) =>
      settledRings(list.map((r) => [...r, r[0]])).map((r) => r.slice(0, -1))
    const settledEven = cutTo ? settled(even) : even
    let crossed =
      tangled(even) || (cutTo && settledEven.filter((r) => Math.sign(turning(r)) === outerSign).length !== 1)
    // A moving counter can clear a narrow frame bridge at 50/50 yet sever it at an intermediate share.
    // Near an open face, cut counters may legitimately meet one another across their gap,
    // so intermediate probes require each ring to stay simple and the settled frame to stay one island.
    // Scale probe count with counter travel relative to counter width so a small counter cannot jump a bridge.
    if (!crossed && faces.length > 1) {
      let maxRatio = 1
      if (cutTo && sampled.length > 1) {
        for (let r = 1; r < sampled.length; r++) {
          const boxes = sampled[r].map(ringBox)
          for (let f1 = 0; f1 < boxes.length; f1++) {
            const b1 = boxes[f1],
              w1 = b1[2] - b1[0],
              h1 = b1[3] - b1[1]
            for (let f2 = f1 + 1; f2 < boxes.length; f2++) {
              const b2 = boxes[f2],
                w2 = b2[2] - b2[0],
                h2 = b2[3] - b2[1]
              const travel = Math.hypot(
                (b1[0] + b1[2] - b2[0] - b2[2]) / 2,
                (b1[1] + b1[3] - b2[1] - b2[3]) / 2
              )
              const minDim = Math.max(4, Math.min(w1, h1, w2, h2))
              if (travel / minDim > maxRatio) maxRatio = travel / minDim
            }
          }
        }
      }
      const steps = Math.min(12, Math.max(3, Math.ceil(maxRatio) + 1))
      const sharesList =
        faces.length === 2
          ? Array.from({ length: steps }, (_, m) => (m + 1) / (steps + 1))
              .filter((t) => Math.abs(t - 0.5) > 1e-4)
              .map((t) => [t, 1 - t])
          : faces.flatMap((_, f) => {
              const s = 0.75,
                rest = (1 - s) / (faces.length - 1)
              return [faces.map((__, k) => (k === f ? s : rest))]
            })
      for (const shares of sharesList) {
        if (crossed) break
        const probe = blendAt(shares)
        if (cutTo) {
          const settledProbe = settled(probe)
          crossed =
            probe.some(crosses) ||
            settledProbe.filter((r) => Math.sign(turning(r)) === outerSign).length !== 1 ||
            probe.slice(1).some((hole) => !inside(hole[0], probe[0]))
        } else {
          crossed = tangled(probe)
        }
      }
    }
    const eachArea = cutTo
      ? each.reduce((sum, list) => sum + signedInk(settled(list)), 0) / faces.length
      : mean(held)
    return {
      sampled,
      crossed,
      ink: eachArea ? Math.abs((cutTo ? signedInk(settledEven) : held(even)) - eachArea) / eachArea : 1,
      wander: winding(even) / mean(winding) - 1
    }
  }
  const rings = polygons.map((p) => p[0])
  const alike = rings.every((face) => face.length === rings[0].length)
  // Faces that differ in their counters prefer slitting closed bars at the stem wall
  // where a coarser face leaves them open (so bars slide at full thickness across the gap),
  // falling back to cutting the open counters when slitting does not yield a clean blend.
  let match = null
  if (alike) {
    match = matchOf(rings, false, cut)
    if (match && cut && (match.crossed || match.wander > 0.05)) return null
  } else {
    for (const candidate of mergeCounterCandidates(rings)) {
      const m = matchOf(candidate, true, true)
      if (m && !m.crossed && m.wander <= 0.05 && m.ink <= 0.05) {
        match = m
        break
      }
    }
    if (!match) {
      const split = splitCounters(rings)
      const m = split && matchOf(split, true, true)
      if (m && !m.crossed && m.wander <= 0.05 && m.ink <= 0.05) match = m
    }
  }
  if (!match) return null
  const { sampled } = match
  const faces = polygons
  /** @type {number[][][][] | undefined} */
  let vectors
  return (/** @type {number[]} */ shares, /** @type {number} */ weight) => {
    const dw = weight - 1
    if (dw && !vectors)
      vectors = faces.map((_, f) => weightVectors(sampled.map((ring) => [...ring[f], ring[f][0]])))
    const rings = sampled.map((ring, j) => {
      const mixed = ring[0].map((_, i) => {
        let x = 0,
          y = 0
        for (let f = 0; f < faces.length; f++) {
          const [a, b] = ring[f][i]
          if (dw && vectors) {
            const [dx, dy] = vectors[f][j][i]
            x += shares[f] * (a + dx * dw)
            y += shares[f] * (b + dy * dw)
          } else {
            x += shares[f] * a
            y += shares[f] * b
          }
        }
        return [x, y]
      })
      return [...mixed, mixed[0]]
    })
    // Counters cut from one another meet along the cut, and a lighter weight laps them.
    return alike ? rings : settledRings(rings)
  }
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
  const normals = weightVectors(smooth)
  const prepared = rings.map((ring, r) => {
    const lengths = ring.slice(1).map(([x, y], i) => Math.hypot(x - ring[i][0], y - ring[i][1]))
    const length = lengths.reduce((a, b) => a + b, 0),
      vectors = normals[r]
    let distance = 0
    return ring.slice(0, -1).map(([x, y], i) => {
      const at = length ? (distance / length) * vectors.length : 0
      const lo = Math.floor(at),
        fraction = at - lo
      const a = vectors[lo % vectors.length],
        b = vectors[(lo + 1) % vectors.length]
      distance += lengths[i]
      return [x, y, a[0] + fraction * (b[0] - a[0]), a[1] + fraction * (b[1] - a[1])]
    })
  })
  return (/** @type {number} */ weight) =>
    prepared.map((r) => {
      const pts = r.map(([x, y, dx, dy]) => [x + dx * (weight - 1), y + dy * (weight - 1)])
      return [...pts, pts[0]]
    })
}
