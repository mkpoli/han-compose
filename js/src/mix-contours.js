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

/** Join two rings into one along a slit of no width, placed where `free` says another
 * face leaves the ink between them open. Null when no such place is near.
 * @param {number[][]} one @param {number[][]} other closed rings
 * @param {(point: number[]) => boolean} free @param {boolean} nested `other` is a counter of `one`
 * @param {boolean} [loose] join at the nearest place when none is open */
function slit(one, other, free, nested, loose = false) {
  const a = dense(one, 2)
  let b = dense(other, 2)
  if (turning(a) * turning(b) > 0 === nested) b = b.reverse()
  /** @type {{ i: number, j: number, gap: number }[]} */
  const nearest = a.map((p, i) => {
    let j = 0,
      gap = Infinity
    b.forEach((q, k) => {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1])
      if (d < gap) {
        gap = d
        j = k
      }
    })
    return { i, j, gap }
  })
  const least = Math.min(...nearest.map((n) => n.gap))
  let best = null,
    most = nested ? 0.99 : 0.79
  for (const n of nearest) {
    if (n.gap > 2.5 * least + 2) continue
    const p = a[n.i],
      q = b[n.j]
    let open = 0
    for (let t = 1; t <= 5; t++)
      open += free([p[0] + ((q[0] - p[0]) * t) / 6, p[1] + ((q[1] - p[1]) * t) / 6]) ? 0.2 : 0
    if (open > most + 1e-9 || (best && Math.abs(open - most) < 1e-9 && n.gap < best.gap)) {
      most = open
      best = n
    }
  }
  if (!best && !loose) return null
  const { i, j } = best ?? nearest.reduce((least, n) => (n.gap < least.gap ? n : least))
  const joined = [...a.slice(0, i + 1), ...b.slice(j), ...b.slice(0, j + 1), ...a.slice(i)]
  return [...joined, joined[0]]
}

/** Faces that close a counter another face leaves open (a bar that stops short of its
 * frame) have more rings than it. Slit their extra counters into the ring the open face
 * draws, so every face has the same rings and the gap opens with that face's share.
 * @param {number[][][][]} faces each face's frame and counters
 * @returns {number[][][][] | null} */
function sameCounters(faces) {
  const fewest = faces.reduce((best, rings, f) => (rings.length < faces[best].length ? f : best), 0)
  const [frame, ...open] = faces[fewest]
  const out = faces.map((rings, f) => {
    if (f === fewest || rings.length === faces[fewest].length) return rings
    let outer = rings[0]
    /** @type {number[][][][]} */
    const groups = open.map(() => [])
    for (const counter of rings.slice(1)) {
      const points = counter.slice(0, -1)
      const mid = [0, 1].map((k) => points.reduce((sum, p) => sum + p[k], 0) / points.length)
      const votes = new Map()
      for (const p of [mid, ...points.map((q) => [(q[0] + mid[0]) / 2, (q[1] + mid[1]) / 2])]) {
        const where = inside(p, frame) ? open.findIndex((ring) => inside(p, ring)) : -2
        if (where !== -1) votes.set(where, (votes.get(where) ?? 0) + 1)
      }
      if (!votes.size) return null
      const [where] = [...votes].sort((x, y) => y[1] - x[1])[0]
      if (where === -2) {
        const joined = slit(
          outer,
          counter,
          (p) => !inside(p, frame) || open.some((ring) => inside(p, ring)),
          true
        )
        if (!joined) return null
        outer = joined
      } else groups[where].push(counter)
    }
    /** @type {number[][][]} */
    const counters = []
    for (const [k, group] of groups.entries()) {
      if (!group.length) return null
      let merged = group[0]
      const left = group.slice(1)
      while (left.length) {
        const index = left.findIndex((counter) => slit(merged, counter, (p) => inside(p, open[k]), false))
        if (index < 0) return null
        merged = /** @type {number[][]} */ (slit(merged, left[index], (p) => inside(p, open[k]), false))
        left.splice(index, 1)
      }
      counters.push(merged)
    }
    return [outer, ...counters]
  })
  return out.every(Boolean) ? /** @type {number[][][][]} */ (out) : null
}

/** Faces that draw as one island what another draws as several (a stroke that touches
 * its neighbour in one face and stands clear in another) get the same islands: the
 * separate pieces are joined by a thread of no width where the fused face has ink, and
 * the thread thickens with that face's share. Null when the faces split the ink in
 * ways that are not one a coarser form of the other.
 * @param {number[][][][][]} polygons each face's islands
 * @returns {number[][][][][][] | null} per island, each face's one island */
export function joinIslands(polygons) {
  const fewest = polygons.reduce((best, islands, f) => (islands.length < polygons[best].length ? f : best), 0)
  const whole = polygons[fewest]
  if (!whole.length) return null
  const ink = (/** @type {number[][][]} */ island) => (/** @type {number[]} */ p) =>
    inside(p, island[0]) && !island.slice(1).some((ring) => inside(p, ring))
  const faces = polygons.map((islands, f) => {
    if (f === fewest) return whole
    /** @type {number[][][][][]} */
    const groups = whole.map(() => [])
    for (const island of islands) {
      const points = dense(island[0], 3)
      const mid = [0, 1].map((k) => points.reduce((sum, p) => sum + p[k], 0) / points.length)
      const votes = whole.map(
        (other) => points.filter((p) => ink(other)([(2 * p[0] + mid[0]) / 3, (2 * p[1] + mid[1]) / 3])).length
      )
      const most = Math.max(...votes)
      // A thin stroke can lie wholly beside the ink it belongs to; it goes with the nearest.
      const apart = whole.map((other) =>
        Math.min(
          ...dense(other[0], 3).map((q) =>
            Math.min(...points.map((p) => Math.hypot(p[0] - q[0], p[1] - q[1])))
          )
        )
      )
      groups[most ? votes.indexOf(most) : apart.indexOf(Math.min(...apart))].push(island)
    }
    /** @type {number[][][][]} */
    const out = []
    for (const [k, group] of groups.entries()) {
      if (!group.length) return null
      let outer = group[0][0]
      const left = group.slice(1)
      while (left.length) {
        outer = /** @type {number[][]} */ (
          slit(outer, /** @type {number[][][]} */ (left.shift())[0], ink(whole[k]), false, true)
        )
      }
      out.push([outer, ...group.flatMap((island) => island.slice(1))])
    }
    return out
  })
  if (faces.some((face) => !face)) return null
  return whole.map((_, k) => faces.map((face) => [/** @type {number[][][][]} */ (face)[k]]))
}

/** Compute correspondences and local stroke widths once, independently of the controls.
 * @param {number[][][][][]} polygons */
export function prepareCorrespondence(polygons) {
  if (!polygons.length || !polygons.every((p) => p.length === 1)) return null
  let joined = false
  if (!polygons.every((p) => p[0].length === polygons[0][0].length)) {
    const same = sameCounters(polygons.map((p) => p[0]))
    if (!same) return null
    polygons = same.map((rings) => [rings])
    joined = true
  }
  const holes = matchRegions(
    polygons.map((p) => p[0].slice(1)),
    (r) => r
  )
  if (!holes) return null
  const ordered = polygons.map((p, i) => [p[0][0], ...holes[i]])
  const faces = ordered
  const sampled = /** @type {number[][][][]} */ (
    ordered[0].map((_, j) => alignRings(ordered.map((rings) => rings[j])))
  )
  if (sampled.some((ring) => !ring)) return null
  if (joined) {
    // Joined rings are long and winding. Keep the match only when the even mix is one
    // clean island holding about the ink the faces hold.
    const even = sampled.map((ring) =>
      ring[0].map((_, i) => [0, 1].map((k) => ring.reduce((sum, face) => sum + face[i][k], 0) / ring.length))
    )
    const held = (/** @type {number[][][]} */ rings) =>
      Math.abs(
        rings.slice(1).reduce((sum, ring) => sum - Math.abs(turning(ring)), Math.abs(turning(rings[0])))
      )
    const mean = faces.reduce((sum, _, f) => sum + held(sampled.map((ring) => ring[f])), 0) / faces.length
    if (tangled(even) || Math.abs(held(even) - mean) > 0.025 * mean) return null
  }
  const aligned = faces.map((_, f) => {
    const rings = sampled.map((ring) => ring[f])
    const vectors = weightVectors(rings.map((r) => [...r, r[0]]))
    return rings.map((r, j) => r.map((p, i) => [...p, ...vectors[j][i]]))
  })
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
