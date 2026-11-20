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
  const size = Math.hypot(
    ...[0, 1].map((k) => Math.max(...rings[0].map((p) => p[k])) - Math.min(...rings[0].map((p) => p[k])))
  )
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
    const previous = new Float64Array(count + 1).fill(Infinity),
      current = previous.slice()
    const direction = new Uint8Array(count * count)
    previous[0] = 0
    for (let i = 0; i < count; i++) {
      current[0] = Infinity
      for (let j = 0; j < count; j++) {
        const diagonal = previous[j],
          above = previous[j + 1] + 0.5,
          left = current[j] + 0.5
        const low = Math.min(diagonal, above, left)
        direction[i * count + j] = low === diagonal ? 0 : low === above ? 1 : 2
        current[j + 1] = low + apart(along[i], samples[(j + offset) % count])
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
    // each side has as many, turning the same way.
    if (pairs.length) {
      const free = (/** @type {number} */ from, /** @type {number} */ to, /** @type {0|1} */ side) =>
        (side
          ? turns[f].map((c) => ({ at: c.s / line.length, turn: c.turn }))
          : base.map((c) => ({ at: c.u, turn: c.turn }))
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
        if (ours.length && ours.length === theirs.length && ours.every((c, i) => c.turn * theirs[i].turn > 0))
          ours.forEach((c, i) => extra.push([c.at, theirs[i].at, reach]))
      }
      pairs.push(...extra)
      pairs.sort((a, b) => a[0] - b[0])
    }
    // Long stretches without a shared corner follow the dense alignment.
    const filled = []
    const stretch = 0.2
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
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n]
    for (let j = i + 2; j < n; j++) {
      if (!i && j === n - 1) continue
      const c = ring[j],
        d = ring[(j + 1) % n]
      if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0])) continue
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

/** Pair islands (or counters) by the distance between their bounding boxes.
 * @template T @param {T[][]} faces @param {(item:T)=>number[][]} ringOf */
export function matchRegions(faces, ringOf) {
  const bounds = (/** @type {T} */ item) => ringBox(ringOf(item))
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
  const labels = points.map((p) => {
    let best = 0,
      least = Infinity
    targets.forEach((target, k) => {
      const d =
        target.solid && inside(p, target.ring)
          ? 0
          : Math.min(...marks[k].map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])))
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
        const width = Math.hypot(
          piece.points[j][0] - piece.points[i][0],
          piece.points[j][1] - piece.points[i][1]
        )
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
    const { i, j } = chord
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
    const small = sides[0].points.length <= sides[1].points.length ? 0 : 1
    const depth = cap ? Math.min(chord.width / 4, 4) : 0
    const steps = Math.ceil(chord.width / 3)
    sides.forEach((side, n) => {
      const from = side.points[side.points.length - 1],
        to = side.points[0]
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

/** Faces that leave open a counter another face closes (a bar that stops short of its
 * frame) have fewer rings than it. Cut their rings at the gaps, so every face has the
 * counters of the face with most, each blending with its own counterpart.
 * @param {number[][][][]} faces each face's frame and counters
 * @returns {number[][][][] | null} */
function splitCounters(faces) {
  const finest = faces.reduce((best, rings, f) => (rings.length > faces[best].length ? f : best), 0)
  const fine = faces[finest]
  const out = faces.map((rings, f) => {
    if (f === finest || rings.length === fine.length) return rings
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
      const pieces = cutRing(
        ring,
        mine.map((j) => ({ ring: fine[j], solid: j > 0 })),
        x > 0,
        false
      )
      if (!pieces) return null
      mine.forEach((j, k) => (cut[j] = pieces[k]))
    }
    return cut
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
   * @param {boolean} cutTo the counters already stand in one order */
  const matchOf = (faces, cutTo) => {
    const holes = matchRegions(
      faces.map((rings) => rings.slice(1)),
      (r) => r
    )
    if (!holes) return null
    const ordered = faces.map((rings, i) => [rings[0], ...holes[i]])
    const sampled = /** @type {number[][][][]} */ (
      ordered[0].map((_, j) => alignRings(ordered.map((rings) => rings[j])))
    )
    if (sampled.some((ring) => !ring)) return null
    const even = sampled.map((ring) =>
      ring[0].map((_, i) => [0, 1].map((k) => ring.reduce((sum, face) => sum + face[i][k], 0) / faces.length))
    )
    const each = faces.map((_, f) => sampled.map((ring) => ring[f]))
    const mean = (/** @type {(rings: number[][][]) => number} */ of) =>
      each.reduce((sum, rings) => sum + of(rings), 0) / faces.length
    return {
      sampled,
      crossed: tangled(even),
      ink: Math.abs(held(even) - mean(held)) / mean(held),
      wander: winding(even) / mean(winding) - 1
    }
  }
  const rings = polygons.map((p) => p[0])
  const alike = rings.every((face) => face.length === rings[0].length)
  // Faces that differ in their counters are brought to the same rings by cutting the open ones.
  const same = alike ? rings : splitCounters(rings)
  const match = same && matchOf(same, !alike)
  // Rings that were cut wind in and out of their gaps. Keep the match only when the even
  // mix stays one clean island that holds about the ink, and turns about as much, as the faces.
  if (match && (cut || !alike) && (match.crossed || match.ink > 0.05 || match.wander > 0.05)) return null
  if (!match) return null
  const { sampled } = match
  const faces = polygons
  const aligned = faces.map((_, f) => {
    const rings = sampled.map((ring) => ring[f])
    const vectors = weightVectors(rings.map((r) => [...r, r[0]]))
    return rings.map((r, j) => r.map((p, i) => [...p, ...vectors[j][i]]))
  })
  return (/** @type {number[]} */ shares, /** @type {number} */ weight) => {
    const rings = aligned[0].map((r, j) => {
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
