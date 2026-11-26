// @ts-nocheck
import { derived, segments } from './geometry.js'

const cache = new WeakMap()

// Subdivide both masters at the same parameter on the light master's curve.
function split(points, t) {
  let row = points
  const first = [row[0]], second = [row.at(-1)]
  while (row.length > 1) {
    row = row.slice(1).map(([x, y], i) => [
      row[i][0] + t * (x - row[i][0]), row[i][1] + t * (y - row[i][1]),
    ])
    first.push(row[0])
    second.push(row.at(-1))
  }
  return [first, second.reverse()]
}

function divide(edge, t) {
  const [lo, hi] = split(edge.light, t), [loHeavy, hiHeavy] = split(edge.heavy, t)
  return [{ light: lo, heavy: loHeavy }, { light: hi, heavy: hiHeavy }]
}

// Between coordinate extrema, every vertical scanline crosses a curve at most
// once, and its ink bounds are given by its endpoints.
function extrema(coords) {
  if (coords.length < 3) return []
  const differences = coords.slice(1).map((v, i) => v - coords[i])
  const [c, d, e] = differences
  const a = differences.length === 3 ? c - 2 * d + e : 0
  const b = (d - c) * (differences.length === 3 ? 2 : 1)
  const disc = b * b - 4 * a * c
  if (Math.abs(a) < 1e-10) return b ? [-c / b] : []
  if (disc < 0) return []
  const root = Math.sqrt(disc)
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
}

function monotoneEdges(contour) {
  const light = segments(contour.ops, contour.light), heavy = segments(contour.ops, contour.heavy)
  const edges = []
  for (let i = 1; i <= light.length; i++) {
    const from = i - 1, to = i % light.length
    const close = i === light.length
    let edge = { light: [light[from][1].at(-1), ...light[to][1]],
      heavy: [heavy[from][1].at(-1), ...heavy[to][1]] }
    if (close && edge.light[0].every((v, axis) => v === edge.light[1][axis]) &&
        edge.heavy[0].every((v, axis) => v === edge.heavy[1][axis])) continue
    const stops = [0, 1].flatMap(axis => extrema(edge.light.map(p => p[axis])))
      .filter(t => t > 0 && t < 1).sort((a, b) => a - b)
    let previous = 0
    for (const t of stops) {
      if (t - previous < 1e-9) continue
      const [first, rest] = divide(edge, (t - previous) / (1 - previous))
      edges.push(first)
      edge = rest
      previous = t
    }
    edges.push(edge)
  }
  return edges
}

function crossing(edge, x) {
  const points = edge.light, start = points[0][0], end = points.at(-1)[0]
  if (!(Math.min(start, end) < x && x < Math.max(start, end))) return null
  if (points.length === 2) return (x - start) / (end - start)
  let a = 0, b = 1
  for (let i = 0; i < 32; i++) {
    const t = (a + b) / 2
    const at = split(points, t)[0].at(-1)[0]
    if ((at < x) === (start < end)) a = t
    else b = t
  }
  return (a + b) / 2
}

function lowestCrossing(edges, x) {
  let bottom = Infinity
  for (const edge of edges) {
    const point = edge.light[0]
    if (Math.abs(point[0] - x) < 1e-7) bottom = Math.min(bottom, point[1])
    const t = crossing(edge, x)
    if (t !== null) bottom = Math.min(bottom, split(edge.light, t)[0].at(-1)[1])
  }
  return bottom
}

function floorTerminal(outlines, [left, bottom, right, top]) {
  const width = right - left, height = top - bottom
  for (const fraction of [0.78, 0.84, 0.72, 0.88]) {
    const cut = left + fraction * width
    for (const { contour, edges, level } of outlines) {
      if (!level) continue
      const pieces = edges.flatMap(edge => {
        const t = crossing(edge, cut)
        return t === null ? [edge] : divide(edge, t)
      })
      const beyond = pieces.map(({ light }) => (light[0][0] + light.at(-1)[0]) / 2 > cut + 1e-7)
      for (let start = 0; start < pieces.length; start++) {
        if (!beyond[start] || beyond[(start + pieces.length - 1) % pieces.length]) continue
        let end = start, low = Infinity, high = -Infinity, reach = cut
        do {
          const [x, y] = pieces[end].light.at(-1)
          reach = Math.max(reach, x)
          low = Math.min(low, y)
          high = Math.max(high, y)
          end = (end + 1) % pieces.length
        } while (beyond[end])
        const floor = Math.max(pieces[start].light[0][1], pieces[end].light[0][1])
        if (low <= bottom + 0.12 * height && floor <= bottom + 0.23 * height &&
            high <= bottom + 0.50 * height && high >= floor + 0.045 * height && reach >= left + 0.88 * width) {
          return { contour, pieces, start, end, reach, high, floor }
        }
      }
    }
  }
  return null
}

function fitHook(glyph, tip, [left, bottom, right, top]) {
  const width = right - left, height = top - bottom, bodyShare = 0.52
  const pressed = x => left + bodyShare * (x - left)
  const shift = right - tip.reach
  const contours = glyph.contours.map(contour => {
    if (contour !== tip.contour) {
      const body = points => points.map((v, i) => i % 2 ? v : pressed(v))
      return { ...contour, light: body(contour.light), heavy: body(contour.heavy) }
    }
    const ops = [], light = [], heavy = []
    // Start where the inner and outer lips of the existing floor separate.
    // A straight extension at each cut joins the unchanged tip to the body.
    for (let j = 0; j < tip.pieces.length; j++) {
      const i = (tip.start + j) % tip.pieces.length, edge = tip.pieces[i]
      const distal = tip.start < tip.end ? i >= tip.start && i < tip.end : i >= tip.start || i < tip.end
      const move = ([x, y]) => [distal ? x + shift : pressed(x), y]
      if (!j || i === tip.end) {
        ops.push([j ? 'L' : 'M', 1, false])
        light.push(...move(edge.light[0]))
        heavy.push(...move(edge.heavy[0]))
      }
      const n = edge.light.length - 1
      ops.push(['LQC'[n - 1], n, false])
      for (let k = 1; k <= n; k++) {
        light.push(...move(edge.light[k]))
        heavy.push(...move(edge.heavy[k]))
      }
    }
    return { ...contour, ops, light: Float64Array.from(light), heavy: Float64Array.from(heavy) }
  })
  return { part: derived(glyph, contours), room: [
    left + width * (bodyShare + 0.035), Math.max(tip.high + 0.025 * height, tip.floor + 0.05 * height),
    right - 0.025 * width, top - 0.035 * height,
  ] }
}

export function hookFloor(glyph) {
  if (cache.has(glyph)) return cache.get(glyph)
  const outlines = glyph.contours.map(contour => ({ contour, edges: monotoneEdges(contour) }))
  const extrema = outlines.flatMap(({ edges }) => edges.map(edge => edge.light[0]))
  const xs = extrema.map(p => p[0]), ys = extrema.map(p => p[1])
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  const [left, bottom, right, top] = box
  for (const outline of outlines) {
    // The baseline of 戈 slopes to the right across this span, whereas the
    // returning floor of 見, 元 and 光 is approximately level in all five faces.
    const y0 = lowestCrossing(outline.edges, left + 0.68 * (right - left))
    const y1 = lowestCrossing(outline.edges, left + 0.81 * (right - left))
    outline.level = Math.abs(y0 - y1) <= 0.028 * (top - bottom)
  }
  const tip = floorTerminal(outlines, box)
  const result = tip && fitHook(glyph, tip, box)
  cache.set(glyph, result)
  return result
}
