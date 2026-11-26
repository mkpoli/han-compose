// @ts-nocheck
import { derived, fill, mapped, rings } from './geometry.js'

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

function fits(sums, rows, left, top, width, height, leftClearance = 1) {
  const stride = grid + 1
  for (const [y, first, last] of rows) {
    const x0 = Math.max(0, Math.floor(left + first * width / innerGrid) - leftClearance)
    const x1 = Math.min(grid, Math.ceil(left + last * width / innerGrid) + 1)
    const y0 = Math.max(0, Math.floor(top + y * height / innerGrid) - 1)
    const y1 = Math.min(grid, Math.ceil(top + (y + 1) * height / innerGrid) + 1)
    if (sums[y1 * stride + x1] - sums[y1 * stride + x0] -
        sums[y0 * stride + x1] + sums[y0 * stride + x0] > 0) return false
  }
  return true
}

// Each occupied row of the inner glyph faces a different part of the body.
// Measure the facing gap at its ink edge. The outermost extent of the hook
// supplies the opposite edge of the open room above the tip.
function balanceSides(sums, rows, seat, region) {
  const [left, bottom, right, high] = mapped(seat, region, [0, 0, grid, grid])
  const width = right - left, height = high - bottom, top = grid - high, stride = grid + 1
  const offsets = []
  for (const [row, first, last] of rows) {
    const y = Math.floor(top + (row + 0.5) * height / innerGrid)
    if (y < 0 || y >= grid) continue
    const l = left + first * width / innerGrid, r = left + last * width / innerGrid
    const upper = y * stride, lower = upper + stride
    let x = Math.min(grid, Math.floor(l))
    const count = sums[lower + x] - sums[upper + x]
    if (!count) continue
    while (x > 0 && sums[lower + x - 1] - sums[upper + x - 1] === count) x--
    offsets.push((l - x - (grid - r)) / 2)
  }
  if (!offsets.length) return seat
  offsets.sort((a, b) => a - b)
  const target = Math.round(offsets[Math.floor(offsets.length / 2)])
  for (let shift = Math.min(target, Math.floor(left)); shift > 0; shift -= 0.5) {
    if (fits(sums, rows, left - shift, top, width, height, 2)) {
      // When the nearest body stroke limits the move, retain breathing room
      // there even though the broader central gap could accommodate more.
      const eased = shift * 0.8
      const offset = shift < target && fits(sums, rows, left - eased, top, width, height, 2) ? eased : shift
      return mapped([left - offset, bottom, right - offset, high], [0, 0, grid, grid], region)
    }
  }
  return seat
}

/** Lower a fitted leaf toward the hook floor while keeping its strokes clear of the bend and tip. */
export function lowerHookSeat(frame, frameBox, inner, innerBox, seat, region, floor) {
  const floorY = region[1] + (floor - frameBox[1]) * (region[3] - region[1]) / (frameBox[3] - frameBox[1])
  const drop = Math.min(grid * 0.093, grid * ((seat[1] - floorY) / (region[3] - region[1]) - 0.09))
  const [x, y, right, high] = mapped(seat, region, [0, 0, grid, grid])
  const sums = frameInk(frame, frameBox), rows = innerProfile(inner, innerBox)
  if (!(drop >= 1)) return balanceSides(sums, rows, seat, region)
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
  return balanceSides(sums, rows, best, region)
}

// Open the three counters of 自. Y displacements remain constant across
// ink bands, so its crossbars and the short stroke above the roof keep
// their native thickness at the original placement scale.
export function tallHookSelf(frame, frameBox, inner, box, seat, region) {
  const [x, bottom, right, top] = mapped(seat, region, [0, 0, grid, grid])
  const height = top - bottom
  // 𦤲 (⿺覺自) in Plangothic: inner ink 731 units / frame ink 909.
  const growth = Math.min(grid * 0.804 - height, grid * 0.98 - top)
  if (growth < 1) return null

  const size = 256, mask = silhouette(inner, box, size)
  const column = Math.floor(size * 0.53), gaps = []
  let start = -1, entered = false
  for (let row = 0; row < size; row++) {
    if (mask[(size - 1 - row) * size + column]) {
      if (start >= 0) gaps.push([start / size, row / size])
      start = -1
      entered = true
    } else if (entered && start < 0) start = row
  }
  if (gaps.length < 3) return null
  // Sloping brush bars can extend above or below the centre sample.
  // Use the middle of each white band to leave both edges intact.
  const counters = gaps.slice(0, 3).map(([lo, hi]) => {
    const inset = (hi - lo) * 0.15
    return [lo + inset, hi - inset]
  })
  const stretch = y => counters.reduce((sum, [lo, hi]) =>
    sum + Math.min(1, Math.max(0, (y - lo) / (hi - lo))), 0) / 3
  const sums = frameInk(frame, frameBox)
  const sourceHeight = box[3] - box[1]
  for (let gain = growth; gain >= 1; gain -= 2) {
    const factor = gain / height
    const contours = inner.contours.map(c => {
      const light = c.light.slice(), heavy = c.heavy.slice()
      for (let i = 1; i < light.length; i += 2) {
        const shift = sourceHeight * factor * stretch((light[i] - box[1]) / sourceHeight)
        light[i] += shift
        heavy[i] += shift
      }
      return { ...c, light, heavy }
    })
    const source = [box[0], box[1], box[2], box[3] + sourceHeight * factor]
    const part = derived(inner, contours, source)
    if (fits(sums, innerProfile(part, source), x, grid - top - gain, right - x, height + gain)) {
      return { part, source, factor }
    }
  }
  return null
}
