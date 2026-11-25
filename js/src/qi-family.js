// @ts-nocheck
import { backwards, segments, windingOf, derived, drawnContours, makePart, mapped, partInk, placed, pointsBox, rings, union } from './geometry.js'

export const qiReference = '⿳吅犬吅'
const sequences = new Set(['⿳吅犬𫩏', '⿳吅太吅', '⿳吅𡗜吅', '⿳吅大𫩏', '⿳𫩏犬吅', '⿳𫩏大吅'])
export const isQiFamily = node => Array.isArray(node) && !node.note && node.length === 4 && sequences.has(node.join(''))

export function qiFamilyDonors(node) {
  if (!isQiFamily(node)) return []
  return [qiReference, '吅', '犬', ...(node.includes('𫩏') ? ['丨'] : []), ...(node[2] === '𡗜' ? ['半'] : [])]
}

const inkRings = part => rings(part.contours, part.contours.map(c => c.light), 16)
const bounds = part => union(inkRings(part).map(pointsBox))
const unit = [0, 0, 1, 1]

function freeze(piece) {
  const points = drawnContours(piece)
  return makePart(piece.part.contours.map((c, i) => ({ ...c, light: points[i], heavy: points[i] })), null, piece.part.reverse)
}

function fit(part, target, sameWindingAs = part) {
  const source = bounds(part)
  const reverse = windingOf(inkRings(part)) !== windingOf(inkRings(sameWindingAs))
  return part.contours.map(c => {
    const points = c.light.map((v, i) => {
      const k = i % 2
      return target[k] + (v - source[k]) / (source[k + 2] - source[k]) * (target[k + 2] - target[k])
    })
    if (reverse) {
      const segs = backwards(segments(c.ops, points))
      const reversed = Float64Array.from(segs.flatMap(([, ps]) => ps.flat()))
      return { ...c, ops: segs.map(([op, ps]) => [op, ps.length, false]), light: reversed, heavy: reversed }
    }
    return { ...c, light: points, heavy: points }
  })
}

// Positions where the outline crosses a line parallel to one of its axes.
function crossings(polygons, axis, value) {
  const values = []
  for (const ring of polygons) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const a = ring[i + axis], b = ring[j + axis]
      if ((a > value) === (b > value)) continue
      const other = 1 - axis
      values.push(ring[i + other] + (ring[j + other] - ring[i + other]) * (value - a) / (b - a))
    }
  }
  return values.sort((a, b) => a - b)
}

function dividedMouth(pair, post) {
  const row = bounds(pair), cx = (row[0] + row[2]) / 2
  const contours = pair.contours.filter(c => pointsBox(c.light)[2] < cx)
  if (!contours.length || !post) return null
  const left = derived(pair, contours), polygons = inkRings(left)
  const [x0, y0, x1, y1] = bounds(left), mid = (x0 + x1) / 2
  const vertical = crossings(polygons, 0, mid), horizontal = crossings(polygons, 1, (y0 + y1) / 2)
  if (vertical.length < 4 || horizontal.length < 4) return null
  const innerLeft = horizontal[1], innerRight = horizontal.at(-2)
  if (innerRight <= innerLeft) return null
  const extra = row[2] - row[0] - (x1 - x0)
  // Extend the two bars between the walls. Preserve the widths of both uprights.
  const frame = contours.map(c => {
    const points = c.light.map((v, i) => i % 2 ? v : v + extra * Math.max(0, Math.min(1, (v - innerLeft) / (innerRight - innerLeft))))
    return { ...c, light: points, heavy: points }
  })
  const stem = horizontal.at(-1) - innerRight
  const bottom = (vertical[0] + vertical[1]) / 2, top = (vertical.at(-2) + vertical.at(-1)) / 2
  return makePart([...frame, ...fit(post, [cx - stem / 2, bottom, cx + stem / 2, top], left)], null, pair.reverse)
}

function centre(dog, ch, composer) {
  if (ch === '犬') return dog
  const box = bounds(dog), [x0, y0, x1, y1] = box
  // 犬's upper-right dot is a separate contour in each of the five reference faces.
  const dots = dog.contours.filter(c => {
    const b = pointsBox(c.light)
    return b[0] > (x0 + x1) / 2 && b[1] > (y0 + y1) / 2
  })
  if (dots.length !== 1) return null
  const body = dog.contours.filter(c => c !== dots[0])
  if (ch === '大') return makePart(body, null, dog.reverse)
  if (ch === '太') {
    const moved = fit(derived(dog, dots), mapped([.435, .015, .62, .24], unit, box))
    return makePart([...body, ...moved], null, dog.reverse)
  }
  // 𡗜 has an inward-pointing stroke on each side of 大. 半 supplies both in the current face.
  const half = !composer.excluded('半') && composer.glyph('半')
  if (!half) return null
  const [left, bottom, right, top] = bounds(half), middle = (left + right) / 2
  const strokes = half.contours.filter(c => {
    const b = pointsBox(c.light)
    return b[1] > bottom + (top - bottom) * .48 && (b[2] < middle || b[0] > middle)
  })
  if (strokes.length !== 2) {
    const native = composer.glyph(ch)
    return native && makePart(fit(native, box), null, native.reverse)
  }
  return makePart([...body, ...fit(derived(half, strokes), mapped([.12, .30, .88, .61], unit, box), dog)], null, dog.reverse)
}

export function qiFamilyParts(composer, node, region, reference, original) {
  if (reference.length !== 3 || reference.some(p => p.cut || p.flips)) return null
  const [upper, dog, lower] = reference.map(freeze)
  const post = node.includes('𫩏') && !composer.excluded('丨') && composer.glyph('丨')
  const rows = [node[1] === '吅' ? upper : dividedMouth(upper, post), centre(dog, node[2], composer),
    node[3] === '吅' ? lower : dividedMouth(lower, post)]
  if (rows.some(row => !row)) return null
  const boxes = rows.map(bounds), extent = union(boxes)
  const originalInk = union(original.map(piece => bounds(freeze(piece))))
  const frame = mapped(originalInk, composer.face, region)
  return rows.map((row, i) => ({
    ...placed(row, boxes[i], mapped(boxes[i], extent, frame), partInk(row), node[i + 1] + ' in 器'),
    fixed: true,
  }))
}
