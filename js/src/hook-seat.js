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

// The contour cut of 首 in 馗 carries the relative heights of its horns,
// shoulder and eye. Aim for its native share of the frame height.
export function fitHookDonor(frame, frameBox, { part, heightShare }, seat, region) {
  const box = part.box, gridBox = [0, 0, grid, grid]
  const [left, bottom, right, top] = mapped(seat, region, gridBox)
  const width = right - left, center = (left + right) / 2
  const naturalHeight = (seat[2] - seat[0]) * (box[3] - box[1]) / (box[2] - box[0]) *
    grid / (region[3] - region[1])
  const fullHeight = Math.min(naturalHeight, grid * 0.98 - bottom)
  const sums = frameInk(frame, frameBox), rows = innerProfile(part, box)
  let original = null
  for (let height = fullHeight; height >= Math.min(top - bottom, fullHeight); height -= 1) {
    const half = 0.5 * width * height / naturalHeight
    if (fits(sums, rows, center - half, grid - bottom - height, 2 * half, height)) {
      original = [center - half, bottom, center + half, bottom + height]
      break
    }
  }
  // A wider outline can use the space beside the standalone leaf's seat.
  // Keep the floor and right margin visible and move only as far as needed.
  const maxDrop = grid / 16, rightLimit = grid * 0.97
  const offsets = [0, 3, -3, 6, -6, 9, -9, 12, -12]
  const target = Math.min(grid * heightShare, grid * 0.98 - bottom + maxDrop)
  const minimum = original ? original[3] - original[1] : Math.min(top - bottom, fullHeight)
  for (let height = target; height > minimum + 1; height -= 2) {
    const half = 0.5 * width * height / naturalHeight
    const start = Math.min(center, rightLimit - half)
    if (start < center - 15) continue
    const drop = Math.max(0, bottom + height - grid * 0.98)
    for (let down = drop; down <= maxDrop; down += 3) {
      const base = bottom - down
      for (const shift of offsets) {
        const mid = start + shift
        if (mid - half < 0 || mid + half > rightLimit) continue
        if (fits(sums, rows, mid - half, grid - base - height, 2 * half, height, 3)) {
          return mapped([mid - half, base, mid + half, base + height], gridBox, region)
        }
      }
    }
  }
  return original && mapped(original, gridBox, region)
}

// Median inner / whole ink heights from native lower-left hook enclosures.
// 日 uses 旭, 𣄽, 𣆥 and 𣆶 where available; 百 uses 兡 and 瓸.
// Jigmo supplies the missing face measurements for 目 (eight glyphs),
// 白 (three) and 百. Plangothic 𦤲 supplies the established target for 自.
const hookCounters = new Map([
  ['日', { count: 2, height: 0.831, sans: 0.693, serif: 0.758, fangsong: 0.658, regular: 0.566, 'pen-writing': 0.637 }],
  ['百', { count: 2, height: 0.858, sans: 0.744, serif: 0.795, regular: 0.691, 'pen-writing': 0.813 }],
  // 田 in 乪; Jigmo supplies its height where the face lacks 乪.
  ['田', { divided: true, count: 2, height: 0.810, sans: 0.788, serif: 0.853, regular: 0.580, 'pen-writing': 0.789 }],
  // 由 in 鼬; Fangsong draws this enclosure in 迪.
  ['由', { divided: true, count: 2, height: 0.822, sans: 0.809, serif: 0.811, fangsong: 0.802, regular: 0.758, 'pen-writing': 0.793 }],
  ['目', { count: 3, height: 0.857 }],
  ['白', { count: 2, height: 0.852 }],
  ['自', { count: 3, height: 0.804 }],
])

function columnGaps(mask, size, fraction) {
  const column = Math.floor(size * fraction), gaps = []
  let start = -1, entered = false
  for (let row = 0; row < size; row++) {
    if (mask[(size - 1 - row) * size + column]) {
      if (start >= 0) gaps.push([start / size, row / size])
      start = -1
      entered = true
    } else if (entered && start < 0) start = row
  }
  return gaps
}

// On each side of the central upright, locate the gap above the same bar.
// Only their shared vertical span may expand without thickening either half.
function sharedCounterGaps(mask, size, count) {
  const left = columnGaps(mask, size, 0.30), right = columnGaps(mask, size, 0.70)
  if (left.length < count || right.length < count) return []
  const shared = left.slice(0, count).map(([lo, hi], i) =>
    [Math.max(lo, right[i][0]), Math.min(hi, right[i][1])])
  return shared.every(([lo, hi]) => hi > lo) ? shared : []
}

// Open the counters from the baseline upwards. Strokes above the roof,
// including the upright tip of 由, rise with it.
export function openHookCounters(frame, frameBox, inner, box, seat, region, char, fontStyle) {
  const form = hookCounters.get(char)
  if (!form) return null
  const [x, bottom, right, top] = mapped(seat, region, [0, 0, grid, grid])
  const height = top - bottom
  const target = form[fontStyle] ?? form.height
  const growth = Math.min(grid * target - height, grid * 0.98 - top)
  if (growth < 1) return null

  const size = 256, mask = silhouette(inner, box, size)
  const gaps = form.divided ? sharedCounterGaps(mask, size, form.count) : columnGaps(mask, size, 0.53)
  if (gaps.length < form.count) return null
  // Sloping brush bars can extend above or below the sampled gaps.
  // Use the middle of each white band to leave both edges intact.
  const counters = gaps.slice(0, form.count).map(([lo, hi]) => {
    const inset = (hi - lo) * 0.15
    return [lo + inset, hi - inset]
  })
  const stretch = y => counters.reduce((sum, [lo, hi]) =>
    sum + Math.min(1, Math.max(0, (y - lo) / (hi - lo))), 0) / counters.length
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
