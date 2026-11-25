// @ts-nocheck
import { drawnContours, groupRings, makePart, mapped, partInk, placed, pointsBox, rings, runsBack, union } from './geometry.js'

const eye = t => Array.isArray(t) && !t.note && t[0] === '⿵' && t[1] === '冂' && t[2] === '三'
const stack = t => Array.isArray(t) && !t.note && (t[0] === '⿱' || t[0] === '⿳')
const endsInEye = t => eye(t) || (stack(t) && endsInEye(t.at(-1)))
export const leafCount = t => Array.isArray(t) ? t.slice(1).reduce((n, leaf) => n + leafCount(leaf), 0) : 1

/** The enclosure and the separate leaf that supplies its baseline, in reading order. */
export function eyeBaseline(node) {
  if (!Array.isArray(node) || node.note) return null
  if (node[0] === '⿺' && node[1] === '丄' && endsInEye(node[2])) {
    return { eye: leafCount(node) - 2, base: 0, char: '丄' }
  }
  if (stack(node)) {
    let n = 0
    for (let i = 1; i < node.length - 1; i++) {
      n += leafCount(node[i])
      const lower = node[i + 1]
      const char = stack(lower) && lower[1] === '一' ? '一' : lower
      if (endsInEye(node[i]) && (char === '一' || char === '𡭕')) return { eye: n - 2, base: n, char }
    }
  }
  return null
}

/** Find a join at this node or inside an enclosing stack. Position the original complete
 * stack before changing its strokes so a join cannot resize the other rows. */
export function eyeInStack(node) {
  const match = eyeBaseline(node)
  if (match || !stack(node)) return match
  let offset = 0, found = null
  for (const child of node.slice(1)) {
    const nested = eyeInStack(child)
    if (nested) {
      if (found) return null // Each child resolves its own baseline.
      found = { ...nested, eye: offset + nested.eye, base: offset + nested.base }
    }
    offset += leafCount(child)
  }
  return found
}

const bounds = p => union(groupRings([p], 16).map(pointsBox))
const glyphBounds = p => union(rings(p.contours, p.contours.map(c => c.light), 16).map(pointsBox))
const fixed = (p, target, origin) => ({ ...placed(p, glyphBounds(p), target, partInk(p), origin), fixed: true })

// Clip at a scanline above the hook. Place both cut faces inside the baseline ink.
function clipFeet(ring, y) {
  const points = []
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const x0 = ring[j], y0 = ring[j + 1], x1 = ring[i], y1 = ring[i + 1]
    if ((y0 < y) !== (y1 < y)) points.push(x0 + (x1 - x0) * (y - y0) / (y1 - y0), y)
    if (y1 >= y) points.push(x1, y1)
  }
  return points
}

function crossings(polys, axis, level) {
  const hits = []
  for (const p of polys) {
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const a = p[j + axis], b = p[i + axis]
      if ((a > level) === (b > level)) continue
      hits.push(p[j + 1 - axis] + (p[i + 1 - axis] - p[j + 1 - axis]) * (level - a) / (b - a))
    }
  }
  return hits.sort((a, b) => a - b)
}

function outline(polys) {
  return makePart(polys.map(p => ({ ops: Array.from({ length: p.length / 2 }, (_, i) => [i ? 'L' : 'M', 1]),
    light: p, heavy: p, width: null })))
}

const mean = (a, b) => (a + b) / 2

/** Join the five horizontal levels (cap, three crossbars and baseline) between two unhooked walls. */
export function joinEye(parts, match) {
  const { eye: i, base: j, char } = match
  const wall = parts[i], bars = parts[i + 1], base = parts[j]
  if (!wall || !bars || !base || bars.part.contours.length !== 3 || [wall, bars, base].some(p => p.cut || p.flips?.length)) return null
  const wallRings = groupRings([wall], 16), foot = groupRings([base], 16)
  const oldBox = union(wallRings.map(pointsBox)), baseBox = union(foot.map(pointsBox))
  const [x0, y0, x1, top] = oldBox
  // A standalone baseline projects on both sides. 丄 also leaves its upright free on the left.
  const width = baseBox[2] - baseBox[0]
  let l = Math.max(x0, baseBox[0] + width * (char === '丄' ? .38 : .075))
  const r = Math.min(x1, baseBox[2] - width * .075)
  if (char === '丄') {
    // Clear the pointed head of the independent upright above the common foot.
    const upper = foot.flatMap(p => p.filter((_, i) => i % 2 === 0 && p[i + 1] > baseBox[1] + .4 * (baseBox[3] - baseBox[1])))
    if (upper.length) l = Math.max(l, Math.max(...upper) + .035 * width)
  }
  if (r <= l || top <= y0) return null
  const land = x => {
    const hits = crossings(foot, 0, x)
    if (hits.length < 2) return NaN
    return char === '𡭕' ? mean(hits.at(-1), hits.at(-2)) : mean(hits[0], hits[1])
  }
  const ly = land(l + .035 * (r - l)), ry = land(r - .035 * (r - l))
  if (!Number.isFinite(ly + ry) || Math.max(ly, ry) >= top) return null
  const floor = x => ly + (ry - ly) * (x - l) / (r - l)
  const cut = y0 + .32 * (top - y0)
  const trimmed = wallRings.map(p => clipFeet(p, cut)).filter(p => p.length >= 6).map(p => {
    const out = []
    for (let k = 0; k < p.length; k += 2) {
      const x = l + (r - l) * (p[k] - x0) / (x1 - x0), y = floor(x)
      out.push(x, y + (top - y) * (p[k + 1] - cut) / (top - cut))
    }
    return out
  })
  if (!trimmed.length) return null
  const cap = outline(trimmed)
  const capHits = crossings(trimmed, 0, mean(l, r))
  if (capHits.length < 2) return null
  const ceiling = capHits.at(-2), bottom = mean(ly, ry)
  const strips = groupRings([bars], 16).sort((a, b) => pointsBox(a)[1] - pointsBox(b)[1])
  const crossbars = []
  for (const [n, p] of strips.entries()) {
    const y = bottom + (ceiling - bottom) * (n + 1) / 4
    const edges = crossings(trimmed, 1, y)
    if (edges.length < 4) return null
    const left = mean(edges[0], edges[1]), right = mean(edges.at(-2), edges.at(-1))
    const [a, b, c, d] = pointsBox(p)
    if (c <= a || d <= b) return null
    // The terminal serifs disappear into the walls. Keep the shaft's native thickness and angle.
    const from = a + .14 * (c - a), to = c - .20 * (c - a)
    const seg = []
    for (let k = 0; k < p.length; k += 2) {
      seg.push(left + (right - left) * Math.max(0, Math.min(1, (p[k] - from) / (to - from))), y + p[k + 1] - mean(b, d))
    }
    crossbars.push(seg)
  }
  const lines = outline(crossbars), out = parts.slice()
  out[i] = { ...wall, ...fixed(cap, glyphBounds(cap), wall.origin) }
  out[i + 1] = { ...bars, ...fixed(lines, glyphBounds(lines), bars.origin) }
  return out
}

/** Place a finished group in the original ink footprint when its widest element was the old frame. */
export function fitEye(parts, original, face, region) {
  const extent = union(parts.map(bounds)), frame = mapped(union(original.map(bounds)), face, region)
  return parts.map(p => {
    const points = drawnContours(p)
    const g = makePart(p.part.contours.map((c, i) => ({ ...c, light: points[i], heavy: points[i] })), null, runsBack(p))
    return { ...fixed(g, mapped(bounds(p), extent, frame), p.origin), ...(p.leaf === undefined ? {} : { leaf: p.leaf }) }
  })
}


/** The export may spell 𡭕 as its native 一 and 小 outlines. The two cuts still belong to
 * the single written operand; keep normal stroke winding when combining their outlines. */
export function singleFoot(parts, j) {
  const pair = parts.slice(j, j + 2)
  const g = outline(pair.flatMap(p => groupRings([p], 16)))
  return [...parts.slice(0, j), fixed(g, glyphBounds(g), '𡭕 from 一 and 小'), ...parts.slice(j + 2)]
}

export function firstFoot(parts, match) {
  const { base: j, eye: i } = match, out = parts.map(p => ({ ...p }))
  const extent = union([bounds(out[i]), bounds(out[j]), bounds(out[j + 1])])
  const fit = (n, seat) => {
    const p = out[n], g = outline(groupRings([p], 16))
    out[n] = fixed(g, mapped(seat, [0, 0, 1, 1], extent), p.origin)
  }
  fit(i, [.13, .39, .87, 1])
  fit(j, [.045, .34, .955, .405])
  fit(j + 1, [.17, 0, .83, .305])
  return out
}
