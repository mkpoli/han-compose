// @ts-nocheck
import { backwards, EM_BOX, makePart, segments, wound } from './geometry.js'

// U+2155A is ⿱夂見 in data/vocab/han-ids.tsv (G and T). In encoded 𡕚,
// the wide 夂 occupies the top two-fifths. Its ends descend beside 見.
export function stackedHookPart(top, base) {
  if (![top, base].every(p => p?.contours.length && p.box[2] > p.box[0] && p.box[3] > p.box[1])) return null
  const [left, bottom, right, topY] = EM_BOX
  const height = topY - bottom
  const stack = (part, low, high) => {
    const [x0, y0, x1, y1] = part.box
    const sx = (right - left) / (x1 - x0), sy = (high - low) / (y1 - y0)
    const place = points => Float64Array.from(points, (v, i) =>
      i % 2 ? low + (v - y0) * sy : left + (v - x0) * sx)
    return part.contours.map(contour => {
      let { ops, light, heavy } = contour
      if (Boolean(part.reverse) !== Boolean(base.reverse)) {
        const lo = backwards(segments(ops, light)), hi = backwards(segments(ops, heavy))
        ops = lo.map(([op, points]) => [op, points.length, false])
        light = lo.flatMap(([, points]) => points.flat())
        heavy = hi.flatMap(([, points]) => points.flat())
      }
      const width = contour.width?.map((w, i) => w * (i ? sy : sx))
      return { ops, light: place(light), heavy: place(heavy), width }
    })
  }
  return wound(makePart([
    ...stack(top, bottom + 0.58 * height, topY),
    ...stack(base, bottom, bottom + 0.60 * height),
  ]))
}
