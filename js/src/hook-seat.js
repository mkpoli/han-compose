// @ts-nocheck
import { fill, mapped, rings } from './geometry.js'

const grid = 240
const innerGrid = 112
const frames = new WeakMap()
const profiles = new WeakMap()

function silhouette(part, box, size) {
  const contours = rings(part.contours, part.contours.map(c => c.light))
  return fill(contours, size, box)
}

// A summed-area table counts frame ink in any rectangle in constant time.
function frameInk(part, box) {
  if (frames.has(part)) return frames.get(part)
  const mask = silhouette(part, box, grid), stride = grid + 1
  const sums = new Uint16Array(stride * stride)
  for (let y = 0; y < grid; y++) {
    let ink = 0
    for (let x = 0; x < grid; x++) {
      ink += mask[y * grid + x]
      sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + ink
    }
  }
  frames.set(part, sums)
  return sums
}

// Keep the envelope of each horizontal strip. A hook must stay outside the
// contents, including the spaces between disconnected strokes on a strip.
function innerProfile(part, box) {
  if (profiles.has(part)) return profiles.get(part)
  const mask = silhouette(part, box, innerGrid), rows = []
  for (let y = 0; y < innerGrid; y++) {
    const row = mask.subarray(y * innerGrid, (y + 1) * innerGrid)
    const left = row.indexOf(1)
    if (left >= 0) rows.push([y, left, row.lastIndexOf(1) + 1])
  }
  profiles.set(part, rows)
  return rows
}

function fits(sums, rows, left, top, width, height) {
  const stride = grid + 1
  for (const [y, first, last] of rows) {
    const x0 = Math.max(0, Math.floor(left + first * width / innerGrid) - 1)
    const x1 = Math.min(grid, Math.ceil(left + last * width / innerGrid) + 1)
    const y0 = Math.max(0, Math.floor(top + y * height / innerGrid) - 1)
    const y1 = Math.min(grid, Math.ceil(top + (y + 1) * height / innerGrid) + 1)
    if (sums[y1 * stride + x1] - sums[y1 * stride + x0] -
        sums[y0 * stride + x1] + sums[y0 * stride + x0] > 0) return false
  }
  return true
}

/** Lower a fitted leaf toward the hook floor while keeping its strokes clear of the bend and tip. */
export function lowerHookSeat(frame, frameBox, inner, innerBox, seat, region, floor) {
  const floorY = region[1] + (floor - frameBox[1]) * (region[3] - region[1]) / (frameBox[3] - frameBox[1])
  const drop = Math.min(grid * 0.093, grid * ((seat[1] - floorY) / (region[3] - region[1]) - 0.09))
  if (!(drop >= 1)) return seat
  const [x, y, right, high] = mapped(seat, region, [0, 0, grid, grid])
  const sums = frameInk(frame, frameBox), rows = innerProfile(inner, innerBox)
  let best = seat, bestScore = 0
  for (const scale of [1, 0.965, 0.93]) {
    const width = (right - x) * scale, height = high - y
    const centre = (x + right - width) / 2
    for (let down = drop; down > 0; down--) {
      for (let shift = 0; shift <= 14; shift++) {
        // Prefer the original size and alignment when two seats lower the glyph comparably.
        const score = down - 0.18 * shift - grid * (1 - scale) * 0.18
        if (score <= bestScore) break
        const left = centre - shift, bottom = y - down
        if (fits(sums, rows, left, grid - bottom - height, width, height)) {
          best = mapped([left, bottom, left + width, bottom + height], [0, 0, grid, grid], region)
          bestScore = score
          break
        }
      }
    }
  }
  return best
}
