// @ts-nocheck
import { hexOf } from './sha256.js'
import { brushQiRows } from './qi-brush-cuts.js'
import { backwards, crossings, segments, windingOf, derived, drawnContours, makePart, mapped, partInk, placed, pointsBox, rings, union } from './geometry.js'

export const qiReference = '⿳吅犬吅'
const sequences = new Set(['⿳吅犬𫩏', '⿳吅太吅', '⿳吅𡗜吅', '⿳吅大𫩏', '⿳𫩏犬吅', '⿳𫩏大吅'])
export const isQiFamily = node => Array.isArray(node) && !node.note && node.length === 4 && sequences.has(node.join(''))

export function qiFamilyDonors(node) {
  if (!isQiFamily(node)) return []
  return [qiReference, '器', '器', '吅', '犬', ...(node.includes('𫩏') ? ['丨'] : []), ...(node[2] === '𡗜' ? ['半'] : [])]
}

const inkRings = part => rings(part.contours, part.contours.map(c => c.light), 16)
const bounds = part => union(inkRings(part).map(pointsBox))
const unit = [0, 0, 1, 1]

function freeze(piece) {
  const points = drawnContours(piece)
  return makePart(piece.part.contours.map((c, i) => ({ ...c, light: points[i], heavy: points[i] })), null, piece.part.reverse)
}

// Upper mouths, 大, lower mouths and dot in the dotted vessel of each export.
const cuts = {
  // Sans 器
  a2f530a92e83c228d1d1cd79633fbee99221538cd991b81411d37cb8eae32322: [[0, 1, 2, 3], [4, 7, 10], [5, 6, 8, 9], 11],
  // Serif 器
  '1fa82819af58c7d6423d4806e1048d9bd95f488fab391fd374e26bf686bfceea': [[10, 11, 12, 13, 14, 15], [1, 2, 3], [4, 5, 6, 7, 8, 9], 0],
  // Pen 器
  b014e58f7266b4223f742563ad1e519c41a75f3a38c3cab84915f620fdb8b3d1: [[0, 1, 2, 3], [4], [6, 7, 8, 9], 5],
  // Regular 器
  a86b9cb37ed95d18812400359caf143542216b365bf6486b9cc83d16dd528447: [[1, 2, 7, 8], [0], [3, 4, 5, 6], 9],
}

const nativeRows = new WeakMap()
function nativeTemplate(composer) {
  for (const ch of ['器', '器']) {
    if (composer.excluded(ch)) continue
    const record = composer.glyphRecord(ch)
    if (!record || record.v !== 1) continue
    if (!nativeRows.has(record)) {
      const digest = hexOf(JSON.stringify(record.p)), glyph = composer.glyph(ch)
      const cut = cuts[digest]
      const group = indices => derived(glyph, indices.map(i => glyph.contours[i]))
      nativeRows.set(record, cut ? { upper: group(cut[0]), body: group(cut[1]), lower: group(cut[2]), dot: group([cut[3]]) }
        : brushQiRows(glyph, digest))
    }
    if (nativeRows.get(record)) return nativeRows.get(record)
  }
  return null
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

function composedTemplate(reference, middle) {
  if (reference?.length !== 3 || reference.some(p => p.cut || p.flips)) return null
  const [upper, dog, lower] = reference.map(freeze)
  const [x0, y0, x1, y1] = bounds(dog)
  if (middle === '犬') return { upper, lower, dog }
  const dots = dog.contours.filter(c => {
    const b = pointsBox(c.light)
    return b[0] > (x0 + x1) / 2 && b[1] > (y0 + y1) / 2
  })
  if (dots.length !== 1) return null
  return { upper, lower, body: derived(dog, dog.contours.filter(c => c !== dots[0])), dot: derived(dog, dots) }
}

function lowerDotBox(body, dotBox, lower, box) {
  // 太's dot sits below the crossing and above the two lower mouths.
  const x = (box[0] + box[2]) / 2
  const w = dotBox[2] - dotBox[0], h = dotBox[3] - dotBox[1]
  const outline = inkRings(body), floor = bounds(lower)[3]
  const roof = Math.min(...[-.5, 0, .5].map(dx => crossings(outline, 0, x + dx * w)[0]))
  const scale = Math.min(1, .8 * (roof - floor) / h)
  if (!(scale > 0)) return null
  const y = (floor + roof) / 2
  return [x - w * scale / 2, y - h * scale / 2, x + w * scale / 2, y + h * scale / 2]
}

function centre({ body, dot, lower, dog }, ch, composer, native) {
  if (dog) return dog
  if (ch === '大') return body
  if (ch === '犬') return derived(body, [...body.contours, ...dot.contours])
  const dotBox = bounds(dot), box = union([bounds(body), dotBox])
  if (ch === '太') {
    const target = native ? lowerDotBox(body, dotBox, lower, box) : mapped([.435, .015, .62, .24], unit, box)
    return target && derived(body, [...body.contours, ...fit(dot, target, body)])
  }
  // 𡗜 has an inward-pointing stroke on each side of 大. 半 supplies both in the current face.
  const half = !composer.excluded('半') && composer.glyph('半')
  const [left, bottom, right, top] = half ? bounds(half) : unit, middle = (left + right) / 2
  const strokes = (half?.contours ?? []).filter(c => {
    const b = pointsBox(c.light)
    return b[1] > bottom + (top - bottom) * .48 && (b[2] < middle || b[0] > middle)
  })
  if (strokes.length !== 2) {
    const whole = composer.glyph(ch)
    return whole && makePart(fit(whole, box), null, whole.reverse)
  }
  if (!native) return derived(body, [...body.contours, ...fit(derived(half, strokes), mapped([.12, .30, .88, .61], unit, box), body)])
  // Place each mark between the crossbar and its adjacent falling stroke.
  const contours = [...body.contours], outline = inkRings(body)
  for (const stroke of strokes) {
    const mark = derived(half, [stroke]), b = bounds(mark)
    const x = box[0] + (box[2] - box[0]) * (b[2] < middle ? .14 : .86)
    const edges = crossings(outline, 0, x)
    if (edges.length < 4) return null
    const bottom = edges[1], top = edges.at(-2), y = (bottom + top) / 2
    const h = Math.min(.78 * (top - bottom), dotBox[3] - dotBox[1]) / 2
    if (!(h > 0)) return null
    const w = Math.min(.44 * (dotBox[2] - dotBox[0]), 1.5 * h)
    contours.push(...fit(mark, [x - w, y - h, x + w, y + h], body))
  }
  return derived(body, contours)
}

export function qiFamilyParts(composer, node, region, measure) {
  const native = nativeTemplate(composer)
  const reference = native ? null : measure(qiReference)
  const template = native ?? composedTemplate(reference, node[2])
  if (!template) return null
  const { upper, lower } = template
  const post = node.includes('𫩏') && !composer.excluded('丨') && composer.glyph('丨')
  const rows = [node[1] === '吅' ? upper : dividedMouth(upper, post), centre(template, node[2], composer, Boolean(native)),
    node[3] === '吅' ? lower : dividedMouth(lower, post)]
  if (rows.some(row => !row)) return null
  const boxes = rows.map(bounds), extent = union(boxes)
  // A stack missing 𡗜 has no previous ink. Use the reference layout for its frame.
  const original = measure(node.join('')) ?? reference ?? measure(qiReference)
  if (!original) return null
  const originalInk = union(original.map(piece => bounds(freeze(piece))))
  const frame = mapped(originalInk, composer.face, region)
  return rows.map((row, i) => ({
    ...placed(row, boxes[i], mapped(boxes[i], extent, frame), partInk(row), node[i + 1] + ' in 器'),
    fixed: true,
  }))
}
