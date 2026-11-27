import { backwards, pointsBox, rings, segments, union } from './geometry.js'

/** The midpoint across a stem at a given position along it.
 * @param {number[][]} outlines @param {number} axis @param {number} station */
function midpoint(outlines, axis, station) {
  const normal = 1 - axis
  const hits = []
  for (const ring of outlines) {
    for (let i = 0; i < ring.length; i += 2) {
      const j = (i + 2) % ring.length, a = ring[i + axis], b = ring[j + axis]
      if (Math.min(a, b) <= station && station < Math.max(a, b)) {
        hits.push(ring[i + normal] + (ring[j + normal] - ring[i + normal]) * (station - a) / (b - a))
      }
    }
  }
  if (hits.length !== 2) return null
  return (hits[0] + hits[1]) / 2
}

/** A tip shared with another source centerline, including an interior T join.
 * @param {number[]} vertex @param {number[][]} neighbors */
export function meetsSourceStroke(vertex, neighbors) {
  return neighbors.some(line => {
    for (let i = 2; i < line.length; i += 2) {
      const x = line[i - 2], y = line[i - 1], dx = line[i] - x, dy = line[i + 1] - y
      const length = dx * dx + dy * dy
      const t = length ? Math.max(0, Math.min(1, ((vertex[0] - x) * dx + (vertex[1] - y) * dy) / length)) : 0
      if (Math.hypot(vertex[0] - x - t * dx, vertex[1] - y - t * dy) <= 2) return true
    }
    return false
  })
}

/** Place an own-face 一 or 丨 on a straight source segment. The two midpoint
 * samples align its trunk while retaining its native taper, tip and bow.
 * @param {number[]} line @param {any[]} stems @param {number[]} lightRadii @param {number[]} heavyRadii @param {boolean[]} joins */
export function nativeAxisContours(line, stems, lightRadii, heavyRadii, joins) {
  const dx = line[line.length - 2] - line[0], dy = line[line.length - 1] - line[1]
  const axis = Math.abs(dx) >= Math.abs(dy) ? 0 : 1, normal = 1 - axis
  if (line.some((v, i) => i % 2 === normal && Math.abs(v - line[normal]) > 0.1)) return null
  const donor = stems[normal]
  if (!donor?.contours.length) return null
  const along = axis === 0 ? dx : dy
  if (Math.abs(along) < 1) return null
  /** @param {'light' | 'heavy'} master @param {number[]} radii */
  const transform = (master, radii) => {
    const points = donor.contours.map((/** @type {any} */ c) => c[master])
    const outlines = rings(donor.contours, points)
    const box = union(outlines.map(pointsBox))
    // The glyph's natural writing direction is rightwards for 一 and downwards for 丨.
    const start = axis === 0 ? box[axis] : box[axis + 2]
    const span = axis === 0 ? box[axis + 2] - start : box[axis] - start
    if (!span) return null
    const near = midpoint(outlines, axis, start + span * 0.2)
    const far = midpoint(outlines, axis, start + span * 0.8)
    if (near === null || far === null) return null
    const scale = Math.min(1, Math.max(0.65, Math.sqrt(Math.abs(along / span))))
    const overhang = Math.sign(along) * radii[axis]
    return points.map((/** @type {Float64Array} */ contour) => {
      const projected = contour.slice()
      for (let i = 0; i < projected.length; i += 2) {
        const t = (contour[i + axis] - start) / span
        const center = near + (t - 0.2) * (far - near) / 0.6
        const from = joins[0] ? 0.13 : 0, to = joins[1] ? 0.87 : 1
        const u = Math.max(0, Math.min(1, (t - from) / (to - from)))
        const offset = (contour[i + normal] - center) * scale
        projected[i + axis] = line[axis] + u * along + (2 * u - 1) * overhang
        // A serif or pen entry inside another stroke ends at the joint.
        projected[i + normal] = line[normal] + (t < from || t > to
          ? Math.max(-radii[normal], Math.min(radii[normal], offset)) : offset)
      }
      return projected
    })
  }
  const light = transform('light', lightRadii), heavy = transform('heavy', heavyRadii)
  if (!light || !heavy) return null
  return donor.contours.map((/** @type {any} */ c, /** @type {number} */ i) => {
    if (!donor.reverse) return { ...c, light: light[i], heavy: heavy[i] }
    // A mixed straight/curved frame must add ink at every intersection.
    const reverse = (/** @type {Float64Array} */ points) => /** @type {[string, number[][]][]} */ (backwards(segments(c.ops, points)))
    const lo = reverse(light[i]), hi = reverse(heavy[i])
    return {
      ops: lo.map(([op, pts]) => [op, pts.length, false]),
      light: Float64Array.from(lo.flatMap(([, pts]) => pts.flat())),
      heavy: Float64Array.from(hi.flatMap(([, pts]) => pts.flat())),
      width: c.width,
    }
  })
}
