import { fill, groupRings, pointsBox, union } from './geometry.js'

// calibrate-columns: upper quartile of the tenth-percentile clearance, and lower
// quartile of the nearest clearance, as fractions of a native pair's visible width.
/** @type {Record<string, number[]>} */
export const columnClearance = { serif: [0.088, 0.011], 'pen-writing': [0.104, 0.028] }
const size = 250, maxStretch = 1.06

/** Settle independently placed columns after their final stroke weights are known.
 * @param {any[][][]} rows @param {any[]} parts @param {string} style */
export function settleColumns(rows, parts, style) {
  if (!rows.length) return
  const widths = new Map(parts.map(p => [p, p.target[2] - p.target[0]]))
  for (const groups of rows) {
    let run = []
    for (let i = 1; i <= groups.length; i++) {
      const pair = i < groups.length && columnPair(groups[i - 1], groups[i], widths, columnClearance[style])
      if (pair) run.push(pair)
      else if (run.length) {
        fitRun(groups.slice(i - run.length - 1, i), run, widths)
        run = []
      }
    }
  }
}

/** @param {any[]} left @param {any[]} right @param {Map<any, number>} widths @param {number[]} clearance */
function columnPair(left, right, widths, [broad, nearest]) {
  const parts = [...left, ...right]
  if (!left.length || !right.length || parts.some(p => !widths.has(p) || p.fixed || p.cut || p.flips ||
    p.nativeAspect || p.weightLimit || p.finishOutline || p.empty !== undefined || p.operandOnly)) return
  // Two cuts from one native character already share its designed spacing.
  if (/^(learned|host) /.test(parts[0].origin) && parts.every(p => p.origin === parts[0].origin)) return
  const rings = [left, right].map(group => groupRings(group, 24))
  if (!rings.every(group => group.length)) return
  const boxes = rings.map(group => union(group.map(pointsBox)))
  const [l, r] = boxes, frame = union(boxes), width = frame[2] - frame[0]
  if (!(width > 0 && frame[3] > frame[1] && l[0] < r[0] && l[2] < r[2])) return
  const [a, b] = rings.map(group => fill(group, size, frame)), gaps = []
  const occupied = [0, 0], split = [0, 0]
  for (let y = 0; y < size; y++) {
    const rows = [a, b].map(mask => mask.subarray(y * size, (y + 1) * size))
    const first = rows.map(row => row.indexOf(1)), last = rows.map(row => row.lastIndexOf(1))
    for (let i = 0; i < 2; i++) if (first[i] >= 0) {
      occupied[i]++
      const white = rows[i].indexOf(0, first[i])
      if (white >= 0 && white < last[i]) split[i]++
    }
    if (last[0] >= 0 && first[1] >= 0) gaps.push((first[1] - last[0]) / size)
  }
  // A lone upright or diagonal would spend the added width on its stroke. Only
  // expand columns that have white space between strokes on at least 1/4 of their rows.
  if (gaps.length < 5 || split.some((n, i) => 4 * n < occupied[i])) return
  gaps.sort((a, b) => a - b)
  const distance = width * Math.min(gaps[Math.floor(gaps.length / 10)] - broad, gaps[0] - nearest)
  if (distance > 0) return { boxes, distance }
}

/** Remove the excess at adjacent seams together, then restore the row's original
 * ink width in one affine transform. The middle of a ternary row gets the same scale
 * as its neighbours. Nested rows share one stretch budget.
 * @param {any[][]} groups @param {any[]} seams @param {Map<any, number>} widths */
function fitRun(groups, seams, widths) {
  const boxes = [seams[0].boxes[0], ...seams.map(s => s.boxes[1])]
  const left = boxes[0][0], right = boxes.at(-1)[2], width = right - left
  const total = seams.reduce((sum, seam) => sum + seam.distance, 0)
  let scale = 1, offset = 0
  for (const [i, group] of groups.entries()) {
    // An overhang may reach beyond the last shared scanline. Keep it within both edges.
    if (offset > 0) scale = Math.min(scale, (boxes[i][0] - left) / offset)
    if (total > offset) scale = Math.min(scale, (right - boxes[i][2]) / (total - offset))
    for (const p of group) {
      const current = p.target[2] - p.target[0], original = widths.get(p) ?? 0
      if (!(original > 0)) return
      scale = Math.min(scale, width / total * (1 - current / (original * maxStretch)))
    }
    offset += seams[i]?.distance ?? 0
  }
  if (!(scale > 0)) return
  const stretch = width / (width - scale * total)
  offset = 0
  for (const [i, group] of groups.entries()) {
    for (const p of group) {
      const [x0, y0, x1, y1] = p.target
      p.target = [left + (x0 - left - offset) * stretch, y0, left + (x1 - left - offset) * stretch, y1]
    }
    offset += scale * (seams[i]?.distance ?? 0)
  }
}
