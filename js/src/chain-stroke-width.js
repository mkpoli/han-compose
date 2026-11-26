import { rings } from './geometry.js'

/**
 * Map the outline of a swept stroke along its new length while retaining its
 * pen width across the sweep. A dot stretched from the corner to the foot of
 * 又 can travel several times its original length. Sampling both sides keeps
 * its changing thickness and the bow of the original outline.
 * @param {any} glyph
 * @param {((v: number) => number)[]} maps
 * @param {number} slope The sign of the stroke's overall slope in font space.
 */
export function sweepMap(glyph, maps, slope) {
  const [left, bottom, right, top] = glyph.box
  const dx = right - left, dy = slope * (top - bottom)
  const length = Math.hypot(dx, dy)
  if (!length || !dx || !dy) return null
  const ux = dx / length, uy = dy / length
  // u follows the sweep; v is perpendicular to it, both in the native em.
  const polygons = /** @type {number[][]} */ (rings(glyph.contours, glyph.contours.map((/** @type {any} */ c) => c.light), 12))
    .map(poly => poly.map((_, i) => {
      const x = poly[i & ~1], y = poly[i | 1]
      return i % 2 ? -uy * x + ux * y : ux * x + uy * y
    }))
  const us = polygons.flatMap(poly => poly.filter((_, i) => !(i % 2)))
  const lo = Math.min(...us), hi = Math.max(...us)
  if (!(hi > lo)) return null
  const samples = 65, step = (hi - lo) / (samples - 1)
  const centers = Array.from({ length: samples }, (_, j) => {
    const u = lo + Math.max(0.001, Math.min(samples - 1.001, j)) * step
    let low = Infinity, high = -Infinity
    for (const poly of polygons) for (let i = 0; i < poly.length; i += 2) {
      const n = (i + 2) % poly.length, a = poly[i], b = poly[n]
      if ((a <= u && u < b) || (b <= u && u < a)) {
        const v = poly[i + 1] + (u - a) / (b - a) * (poly[n + 1] - poly[i + 1])
        low = Math.min(low, v)
        high = Math.max(high, v)
      }
    }
    return (low + high) / 2
  })
  if (!centers.every(Number.isFinite)) return null
  const middle = (/** @type {number} */ u) => {
    const t = Math.max(0, Math.min(samples - 1, (u - lo) / step)), a = Math.min(samples - 2, Math.floor(t))
    const v = centers[a] + (t - a) * (centers[a + 1] - centers[a])
    return [maps[0](ux * u - uy * v), maps[1](uy * u + ux * v), v]
  }
  return (/** @type {number} */ x, /** @type {number} */ y) => {
    const u = ux * x + uy * y, v = -uy * x + ux * y
    const [cx, cy, center] = middle(u), start = middle(u - step), end = middle(u + step)
    const dx = end[0] - start[0], dy = end[1] - start[1], norm = Math.hypot(dx, dy)
    const px = maps[0](x), py = maps[1](y)
    if (!norm) return [px, py]
    const nx = -dy / norm, ny = dx / norm
    const offset = (px - cx) * nx + (py - cy) * ny
    const limit = Math.abs(v - center)
    const excess = Math.sign(offset) * Math.max(0, Math.abs(offset) - limit)
    return [px - nx * excess, py - ny * excess]
  }
}

/** A rising-entry sweep taken from the side or foot of a character retains
 * its entry and terminal shape when used at a steeper angle.
 * @param {any} glyph @param {number[]} from @param {number[]} to */
export function risingSweepMap(glyph, from, to) {
  const lines = rings(glyph.contours, glyph.contours.map((/** @type {any} */ c) => c.light), 12)
  const xs = lines.flatMap(line => /** @type {number[]} */ (line).filter((_, i) => !(i % 2)))
  const lo = Math.min(...xs), hi = Math.max(...xs)
  const at = (/** @type {number} */ x) => {
    const ys = []
    for (const line of lines) for (let i = 0; i < line.length; i += 2) {
      const j = (i + 2) % line.length, a = line[i], b = line[j]
      if ((a <= x && x < b) || (b <= x && x < a)) ys.push(line[i + 1] + (x - a) / (b - a) * (line[j + 1] - line[i + 1]))
    }
    return (Math.min(...ys) + Math.max(...ys)) / 2
  }
  const first = lo + (hi - lo) * 0.01, last = hi - (hi - lo) * 0.01
  const y0 = at(first), y1 = at(last), len = Math.hypot(last - first, y1 - y0)
  const dx = to[0] - from[0], dy = to[1] - from[1], reach = Math.hypot(dx, dy)
  if (!Number.isFinite(len) || !len || !reach) return null
  const ux = (last - first) / len, uy = (y1 - y0) / len
  return (/** @type {number} */ x, /** @type {number} */ y) => {
    const t = ((x - first) * ux + (y - y0) * uy) / len
    const v = -(x - first) * uy + (y - y0) * ux
    return [from[0] + t * dx - v * dy / reach, from[1] + t * dy + v * dx / reach]
  }
}
