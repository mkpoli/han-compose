// @ts-check
import { derived, fill, rings, union } from './geometry.js'

/** A cell of the working em grid in each axis. */
const SIZE = 144

/** In ㇇ the left end of the top bar and the tip of the falling stroke
 * can exchange horizontal order between fonts. Place the bottom tip from
 * its own contour, preserving the axis and thickness of the entire top bar.
 * @param {any} part @param {number} target */
function placeFallingTip(part, target) {
  const outlines = rings(part.contours, part.contours.map((/** @type {any} */ c) => c.light), 12)
  let low = Infinity, high = -Infinity
  for (const line of outlines) for (let j = 1; j < line.length; j += 2) {
    low = Math.min(low, line[j]); high = Math.max(high, line[j])
  }
  if (!(high > low)) return part
  let left = Infinity, right = -Infinity
  for (const line of outlines) for (let j = 0; j < line.length; j += 2) {
    if (line[j + 1] <= low + (high - low) * 0.025) {
      left = Math.min(left, line[j]); right = Math.max(right, line[j])
    }
  }
  const dx = target - (left + right) / 2
  if (Math.abs(dx) < 8 || !Number.isFinite(dx)) return part
  /** @param {Float64Array} points */
  const move = points => points.map((v, k) => k % 2 ? v : v + dx * Math.max(0, Math.min(1, (high - points[k + 1]) / (high - low))))
  return derived(part, part.contours.map((/** @type {any} */ c) => ({ ...c, light: move(c.light), heavy: move(c.heavy) })))
}

/** Restore contact at the chain's declared endpoints where a tapered tip or a
 * slanted cap falls short of the nominal bar intersection. A stroke keeps its
 * other endpoint in place. Both masters carry the same endpoint displacement,
 * limited to its value at the cap for control points beyond the two ends.
 * @param {any[]} parts @param {any} solved @param {number[]} box */
export function fitChainJoins(parts, solved, box) {
  if (parts.length < 2) return parts
  const frame = union(parts.map(part => part.box))
  const step = [(frame[2] - frame[0]) / SIZE, (frame[3] - frame[1]) / SIZE]
  if (!step.every(unit => Number.isFinite(unit) && unit > 0)) return parts
  const fitted = parts.map((part, i) => {
    const stroke = solved.strokes[i]
    const tip = stroke.at[stroke.at.length - 1]
    if (stroke.char === '㇇') return placeFallingTip(part, box[0] + (box[2] - box[0]) * solved.x.get(solved.xs.find(tip)))
    return part
  })
  const masks = fitted.map(part => fill(rings(part.contours, part.contours.map((/** @type {any} */ c) => c.light), 8), SIZE, frame))
  /** @typedef {{ stroke: number, x: number, y: number, dx: number, dy: number }} End */
  /** @type {Map<number, End[]>} */
  const groups = new Map()
  /** @type {End[][]} */
  const ends = parts.map((_, stroke) => {
    const at = solved.strokes[stroke].at
    return [at[0], at[at.length - 1]].map(vertex => {
      const joint = solved.points.find(vertex)
      const x = box[0] + (box[2] - box[0]) * solved.x.get(solved.xs.find(vertex))
      const y = box[3] - (box[3] - box[1]) * solved.y.get(solved.ys.find(vertex))
      const end = { stroke, x: (x - frame[0]) / step[0] - 0.5, y: (frame[3] - y) / step[1] - 0.5, dx: 0, dy: 0 }
      const joined = groups.get(joint) ?? []
      joined.push(end)
      groups.set(joint, joined)
      return end
    })
  })
  let changed = fitted.some((part, i) => part !== parts[i])
  for (const joined of groups.values()) {
    if (joined.length < 2) continue
    const { x, y } = joined[0]
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    // Find actual ink close to the intersection; the small inset gives a
    // hairline a firm contact even at text sizes. A thin tip uses its center.
    const closest = joined.map(() => Infinity)
    let overlap = Infinity, common = -1
    for (let radius = 8; ; radius *= 2) {
      const x0 = Math.max(0, Math.floor(x - radius)), x1 = Math.min(SIZE - 1, Math.ceil(x + radius))
      const y0 = Math.max(0, Math.floor(y - radius)), y1 = Math.min(SIZE - 1, Math.ceil(y + radius))
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
        const p = py * SIZE + px
        const distance = (px - x) ** 2 + (py - y) ** 2
        let together = true
        for (let i = 0; i < joined.length; i++) {
          const end = joined[i], mask = masks[end.stroke]
          if (!mask[p]) { together = false; continue }
          const inner = px > 0 && px < SIZE - 1 && py > 0 && py < SIZE - 1 &&
            mask[p - 1] && mask[p + 1] && mask[p - SIZE] && mask[p + SIZE]
          if (!inner) together = false
          const score = Math.sqrt(distance) + (inner ? 0 : 3)
          if (score < closest[i]) {
            closest[i] = score
            end.x = px
            end.y = py
          }
        }
        if (together && distance < overlap) { overlap = distance; common = p }
      }
      // A site outside the window cannot beat the chosen contact. Most
      // already-joined bars only need the initial 17 × 17 neighborhood.
      if (overlap <= 25 || Math.max(...closest) + 5 <= radius ||
          (x0 === 0 && y0 === 0 && x1 === SIZE - 1 && y1 === SIZE - 1)) break
    }
    if (!closest.every(Number.isFinite)) continue
    const reach = Math.max(...closest)
    if (Math.sqrt(overlap) <= reach + 5) {
      for (const end of joined) { end.x = common % SIZE; end.y = Math.floor(common / SIZE) }
      continue
    }
    // At a curved entry the closest sites on the two facing contours can lie
    // to one side of the grid vertex. Join there before their tips cross back
    // over one another and enclose a false counter.
    if (joined.length === 2 && joined.every(end => ['丿', '乀'].includes(solved.strokes[end.stroke].char))) {
      const radius = reach + 6
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < 2; i++) {
          const end = joined[i], other = joined[1 - i], mask = masks[end.stroke]
          let best = Infinity
          for (let py = Math.max(1, Math.floor(y - radius)); py <= Math.min(SIZE - 2, y + radius); py++) {
            for (let px = Math.max(1, Math.floor(x - radius)); px <= Math.min(SIZE - 2, x + radius); px++) {
              const p = py * SIZE + px
              if (!mask[p]) continue
              const inner = mask[p - 1] && mask[p + 1] && mask[p - SIZE] && mask[p + SIZE]
              const score = Math.hypot(px - other.x, py - other.y) + 0.05 * Math.hypot(px - x, py - y) + (inner ? 0 : 2)
              if (score < best) { best = score; end.x = px; end.y = py }
            }
          }
        }
      }
    }
    const cx = joined.reduce((sum, end) => sum + end.x, 0) / joined.length
    const cy = joined.reduce((sum, end) => sum + end.y, 0) / joined.length
    for (const end of joined) {
      end.dx = (cx - end.x) * step[0]
      end.dy = (end.y - cy) * step[1]
    }
    changed = true
  }
  if (!changed) return parts
  const adjusted = fitted.map((part, i) => {
    const [a, b] = ends[i]
    if (!(a.dx || a.dy || b.dx || b.dy)) return part
    const ax = frame[0] + (a.x + 0.5) * step[0], ay = frame[3] - (a.y + 0.5) * step[1]
    const vx = (b.x - a.x) * step[0], vy = (a.y - b.y) * step[1]
    const span = vx * vx + vy * vy
    /** @param {Float64Array} points */
    const move = points => {
      const out = new Float64Array(points.length)
      for (let k = 0; k < points.length; k += 2) {
        const x = points[k], y = points[k + 1]
        const t = span ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / span)) : 0.5
        out[k] = x + a.dx + t * (b.dx - a.dx)
        out[k + 1] = y + a.dy + t * (b.dy - a.dy)
      }
      return out
    }
    return derived(part, part.contours.map((/** @type {any} */ c) => ({ ...c, light: move(c.light), heavy: move(c.heavy) })))
  })
  // A join changes the shapes inside the original ink frame. Keep its position
  // and dimensions, including for an input with no recorded standalone metrics.
  const actual = union(adjusted.map(part => part.box))
  const sx = (frame[2] - frame[0]) / (actual[2] - actual[0]), sy = (frame[3] - frame[1]) / (actual[3] - actual[1])
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return parts
  /** @param {Float64Array} points */
  const fit = points => points.map((v, i) => i % 2 ? frame[1] + (v - actual[1]) * sy : frame[0] + (v - actual[0]) * sx)
  return adjusted.map(part => derived(part, part.contours.map((/** @type {any} */ c) => ({ ...c, light: fit(c.light), heavy: fit(c.heavy) }))))
}
