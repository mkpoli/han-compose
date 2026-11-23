// @ts-nocheck: the corrections move placed parts, whose contours are the geometry module’s arrays.
// Corrections for a component the font draws as a cut, where a stroke of one operand runs into
// another, a bar is longer than the pair it belongs to, or a dot is taken from a 捺. Each names the
// description it corrects, the SHA-256 outlines of the glyphs it was read against, and the parts it
// changes; an export drawing other outlines keeps the font's cut. The parts are plain placed pieces,
// so the corrections work wherever the description is drawn, at any depth.
import { derived, fitted, makePart, mapped, partOf, placed, pointsBox, union } from './geometry.js'
import { hexOf } from './sha256.js'

// Interpolation factors for the hosted 口 outlines when fitted beside 乎.
const mouthWeights = {
  sans: ['412b5a81c5efb7a5f824853645e81e3aea284eb92b129004596757cdba72cc17', 1.5],
  serif: ['dde421f19453a0eee88caff584e339a24fd70d66f40710f20349f3294afab006', 1.3],
  fangsong: ['e6685a3625d9c79a9f80323a1a4aa9fe41a9abbefce6d69ecc42ce06b27d045d', 1.65],
  'pen-writing': ['068b4bb60a0c0088ab291df86718480e499001dddeb79758e9e1054ddf3104af', -1.4],
}

const FANGSONG_FRAME = {
  ops: [['M', 1], ['L', 1], ['L', 1], ['C', 3], ['C', 3], ['L', 1], ['C', 3], ['C', 3], ['C', 3], ['L', 1], ['L', 1], ['L', 1], ['C', 3], ['C', 3], ['L', 1], ['C', 3], ['C', 3], ['L', 1], ['C', 3], ['C', 3], ['L', 1], ['C', 3], ['L', 1], ['C', 3], ['C', 3], ['L', 1], ['L', 1], ['L', 1], ['L', 1], ['L', 1], ['C', 3], ['C', 3], ['L', 1], ['C', 3], ['C', 3], ['C', 3], ['L', 1], ['L', 1], ['C', 3], ['C', 3], ['C', 3], ['C', 3], ['L', 1]],
  light: Float64Array.from([371.60, 101.90, 374.00, 105.90, 377.20, 110.70, 419.47, 92.63, 451.43, 80.13, 473.10, 73.20, 477.30, 75.87, 479.40, 79.33, 479.40, 83.60, 482.60, 101.90, 486.80, 123.17, 489.43, 139.10, 490.50, 149.70, 495.77, 197.03, 499.20, 233.17, 500.80, 258.10, 502.40, 272.43, 503.20, 286.77, 503.20, 301.10, 504.80, 329.80, 504.80, 334.60, 351.80, 326.70, 304.00, 323.00, 254.77, 322.05, 206.40, 319.10, 123.20, 314.03, 77.37, 310.70, 68.90, 309.10, 68.10, 251.70, 68.10, 220.37, 68.63, 173.37, 69.70, 110.70, 70.77, 68.17, 71.30, 36.53, 71.30, 15.80, 64.20, 11.10, 56.80, 15.83, 49.13, 22.07, 41.20, 29.80, 33.27, 37.47, 25.60, 45.03, 18.20, 52.50, 23.70, 73.20, 27.43, 86.47, 29.30, 100.57, 29.30, 115.50, 27.70, 170.40, 26.63, 220.40, 25.57, 257.60, 24.50, 282.00, 22.97, 317.07, 15.33, 347.10, 1.60, 372.10, 0.00, 376.10, 7.10, 380.80, 58.60, 341.80, 233.00, 351.40, 350.20, 359.30, 375.60, 360.90, 411.80, 364.37, 458.80, 369.70, 468.33, 370.23, 477.33, 373.17, 485.80, 378.50, 507.20, 392.00, 525.13, 380.87, 547.30, 364.93, 573.70, 344.20, 572.63, 340.47, 571.60, 338.07, 570.60, 337.00, 558.93, 326.40, 551.80, 309.93, 549.20, 287.60, 534.10, 166.50, 524.60, 87.60, 520.40, 56.20, 509.30, 29.63, 491.30, 7.90, 489.17, 4.70, 487.20, 2.70, 485.40, 1.90, 483.53, 1.10, 480.50, 0.70, 476.30, 0.70, 446.17, 37.37, 411.27, 71.10, 371.60, 101.90, 371.60, 101.90]),
}
FANGSONG_FRAME.heavy = FANGSONG_FRAME.light.slice()
FANGSONG_FRAME.width = null

/** The scale a placed part is drawn at, along x and y. */
const scaleOf = part => [(part.target[2] - part.target[0]) / Math.max(part.source[2] - part.source[0], 1),
  (part.target[3] - part.target[1]) / Math.max(part.source[3] - part.source[1], 1)]

/** A contour's box where the part is drawn: target units, y up. */
function boxIn(part, contour) {
  const [sx, sy] = scaleOf(part), b = pointsBox(contour.light), t = part.target, s = part.source
  return [t[0] + (b[0] - s[0]) * sx, t[1] + (b[1] - s[1]) * sy, t[0] + (b[2] - s[0]) * sx, t[1] + (b[3] - s[1]) * sy]
}
const boxOf = part => {
  const boxes = part.part.contours.map(contour => boxIn(part, contour))
  return [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])),
    Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))]
}
const widthOf = box => box[2] - box[0]
const heightOf = box => box[3] - box[1]
const centreX = box => (box[0] + box[2]) / 2
const centreY = box => (box[1] + box[3]) / 2

/** The part drawn from `origin`, where a description drew it so. */
const partFrom = (parts, origin) => parts.find(part => part.origin === origin)

/** The contours of a part as wide horizontals, by the box each is drawn in: bars of a glyph. */
function barsOf(part) {
  const width = widthOf(boxOf(part))
  return part.part.contours.map((contour, index) => ({ index, box: boxIn(part, contour) }))
    .filter(({ box }) => widthOf(box) > 0.5 * width && heightOf(box) < 0.2 * widthOf(box))
    .sort((a, b) => a.box[1] - b.box[1])
}

/** The lowest ink on the vertical line through `xTarget`: under a roof's legs, its bar's underside. */
function inkBottomAt(part, xTarget) {
  const [sx, sy] = scaleOf(part), x = part.source[0] + (xTarget - part.target[0]) / sx
  let low = Infinity
  for (const contour of part.part.contours) {
    const light = contour.light, n = light.length / 2
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, x1 = light[i * 2], y1 = light[i * 2 + 1], x2 = light[j * 2], y2 = light[j * 2 + 1]
      if (x1 === x2 || (x1 - x) * (x2 - x) > 0) continue
      const y = y1 + (y2 - y1) * (x - x1) / (x2 - x1)
      if (y < low) low = y
    }
  }
  return low === Infinity ? boxOf(part)[1] : part.target[1] + (low - part.source[1]) * sy
}

/** The lowest edge of a part's wide ink: its lowest bar, under any thin stroke that runs past it. */
function wideBottom(part) {
  const width = widthOf(boxOf(part))
  const boxes = part.part.contours.map(contour => boxIn(part, contour)).filter(box => widthOf(box) > 0.5 * width)
  return boxes.length ? Math.min(...boxes.map(box => box[1])) : boxOf(part)[1]
}

/** Where a vertical line at `x` crosses a part's outlines, in its own units: the highest crossing
 *  below `limit`, or null. */
function topEdgeBelow(part, x, limit) {
  let high = null
  for (const contour of part.part.contours) {
    const light = contour.light, n = light.length / 2
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, x1 = light[i * 2], y1 = light[i * 2 + 1], x2 = light[j * 2], y2 = light[j * 2 + 1]
      if (x1 === x2 || (x1 - x) * (x2 - x) > 0) continue
      const y = y1 + (y2 - y1) * (x - x1) / (x2 - x1)
      if (y < limit && (high === null || y > high)) high = y
    }
  }
  return high
}

/** Where a horizontal line at `y` runs through a part's ink, in its own units: [left, right] spans
 *  of the light master, or of the `heavy` one. */
function inkAcross(part, y, heavy = false) {
  const xs = []
  for (const contour of part.part.contours) {
    const points = heavy ? contour.heavy ?? contour.light : contour.light, n = points.length / 2
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, x1 = points[i * 2], y1 = points[i * 2 + 1], x2 = points[j * 2], y2 = points[j * 2 + 1]
      if (y1 === y2 || (y1 - y) * (y2 - y) > 0) continue
      xs.push(x1 + (x2 - x1) * (y - y1) / (y2 - y1))
    }
  }
  xs.sort((a, b) => a - b)
  return Array.from({ length: Math.floor(xs.length / 2) }, (_, i) => [xs[i * 2], xs[i * 2 + 1]])
}

/** The one stroke a horizontal line crosses `up` of the way up a part, in its own units: its left
 *  edge, width and middle, or null where the line crosses no ink or several strokes. */
function strokeAt(part, up, heavy = false) {
  const spans = inkAcross(part, part.source[1] + up * heightOf(part.source), heavy)
  if (spans.length !== 1) return null
  const [left, right] = spans[0]
  return { left, width: right - left, middle: (left + right) / 2 }
}

/** `part` narrowed to `width` of its own units by drawing in the ink left of `from`: what stands
 *  right of `from` keeps its shape, and the scale falls away evenly leftwards from there, so a
 *  sweeping stroke turns tighter without a corner. The ink left of `from` keeps at least 30% of its
 *  extent. The part's source becomes the narrowed outline's box. */
function drawnIn(part, from, width) {
  const [x0, y0, x1, y1] = part.source, room = from - x0
  const mean = Math.max(0.3, (width - (x1 - from)) / room)
  if (!(room > 0) || mean >= 1) return part
  const end = Math.max(2 * mean - 1, mean / 2), start = 2 * mean - end
  const across = (/** @type {number} */ x) => {
    const t = from - x
    return t <= 0 ? x : from - (t <= room ? start * t + (end - start) * t * t / (2 * room) : mean * room + end * (t - room))
  }
  const contours = part.part.contours.map(contour => {
    const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
    for (let i = 0; i < light.length; i += 2) { light[i] = across(light[i]); heavy[i] = across(heavy[i]) }
    return { ...contour, light, heavy }
  })
  const source = [from - mean * room, y0, x1, y1]
  return { ...revised(part, contours, source.slice()), source }
}

/** 止's strokes in its own units, read from the points of its outline however the face splits it
 *  into contours: the stem's edges (the ink nearest its head, just below the head), the base's top
 *  between the left stroke and the stem, the right bar's span and the left stroke's top. Null for
 *  an outline without them. */
function stopLayout(part) {
  const points = part.part.contours.flatMap(({ light }) => Array.from({ length: light.length / 2 }, (_, i) => [light[i * 2], light[i * 2 + 1]]))
  const [x0, y0, x1, y1] = pointsBox(points.flat()), width = x1 - x0, height = y1 - y0
  const head = points.filter(([, y]) => y > y0 + 0.85 * height)
  if (!head.length) return null
  const headX = head.reduce((sum, [x]) => sum + x, 0) / head.length, away = ([l, r]) => Math.max(l - headX, headX - r, 0)
  const span = inkAcross(part, y0 + 0.8 * height).sort((a, b) => away(a) - away(b))[0]
  if (!span) return null
  const stem = (span[0] + span[1]) / 2
  const right = points.filter(([x, y]) => x > stem + 0.1 * width && y > y0 + 0.2 * height && y < y0 + 0.8 * height)
  const left = points.filter(([x, y]) => x < stem - 0.1 * width && y > y0 + 0.3 * height)
  if (!right.length || !left.length) return null
  const between = (Math.max(...left.map(([x]) => x)) + span[0]) / 2
  const baseTop = topEdgeBelow(part, between, y0 + 0.2 * height)
  if (baseTop === null) return null
  return { stem, width, baseTop, bar: [Math.min(...right.map(([, y]) => y)), Math.max(...right.map(([, y]) => y))], leftTop: Math.max(...left.map(([, y]) => y)) }
}

/** `part` with every point moved along y by `move(x, y, box)`, in the part's own units; `box` is
 *  the box of the point's contour. */
function shifted(part, move) {
  const contours = part.part.contours.map(contour => {
    const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light), box = pointsBox(contour.light)
    for (let i = 0; i < light.length; i += 2) {
      const dy = move(light[i], light[i + 1], box)
      light[i + 1] += dy
      heavy[i + 1] += dy
    }
    return { ...contour, light, heavy }
  })
  return revised(part, contours)
}

/** A part with some contours replaced; the part's flags stay, and its box unless `box` is given. */
function revised(part, contours, box = part.part.box.slice()) {
  const out = derived(part.part, contours, box)
  if (part.fixed) out.fixed = true
  if (part.strokes) out.strokes = part.strokes
  return { ...part, part: out }
}

/** `part` with the named contours' top (y above `yTarget`) cut off at that height. */
export function clippedAbove(part, indices, yTarget) {
  const [, sy] = scaleOf(part)
  const y = part.source[1] + (yTarget - part.target[1]) / sy
  const contours = part.part.contours.slice()
  for (const index of indices) {
    const contour = contours[index]
    const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
    for (let i = 1; i < light.length; i += 2) {
      if (light[i] > y) light[i] = y
      if (heavy[i] > y) heavy[i] = y
    }
    contours[index] = { ...contour, light, heavy }
  }
  return revised(part, contours)
}

/** `part` with the named contours lowered by `drop` in the target, along y, keeping their columns;
 *  a negative `drop` raises them. */
export function lowered(part, indices, drop) {
  const [, sy] = scaleOf(part)
  if (!drop || !(sy > 0)) return part
  const contours = part.part.contours.slice()
  for (const index of indices) {
    const contour = contours[index]
    const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
    for (let i = 1; i < light.length; i += 2) {
      light[i] = light[i] - drop / sy
      heavy[i] = heavy[i] - drop / sy
    }
    contours[index] = { ...contour, light, heavy }
  }
  return revised(part, contours)
}

/** `part` with the named contours' height changed about their centre, along y. */
export function heightened(part, indices, factor) {
  const contours = part.part.contours.slice()
  for (const index of indices) {
    const contour = contours[index], box = pointsBox(contour.light), middle = (box[1] + box[3]) / 2
    const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
    for (let i = 1; i < light.length; i += 2) {
      light[i] = middle + (light[i] - middle) * factor
      heavy[i] = middle + (heavy[i] - middle) * factor
    }
    contours[index] = { ...contour, light, heavy }
  }
  return revised(part, contours)
}

/** `part` with the named contour moved to span `from`–`to` in the target, along x, keeping its rows. */
export function respanned(part, index, from, to) {
  const [sx] = scaleOf(part), contour = part.part.contours[index]
  const box = pointsBox(contour.light)
  const at = part.source[0] + (from - part.target[0]) / sx
  const scale = ((to - from) / sx) / Math.max(box[2] - box[0], 1)
  const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
  for (let i = 0; i < light.length; i += 2) {
    light[i] = at + (light[i] - box[0]) * scale
    heavy[i] = at + (heavy[i] - box[0]) * scale
  }
  const contours = part.part.contours.slice()
  contours[index] = { ...contour, light, heavy }
  return revised(part, contours)
}

/** `part` without the named contours. */
export function withoutContours(part, indices) {
  const drop = new Set(indices)
  return revised(part, part.part.contours.filter((_, index) => !drop.has(index)))
}

/** The 丶 glyph in `band`: at its own em size where that fits, as large as the band allows
 *  otherwise, standing on the band's bottom as a dot does. A cut of a 丶 that the font drew as a
 *  捺 (遝's lower dot) keeps the slash's shape; the glyph has the dot's. */
export function dotIn(composer, band) {
  const glyph = composer.glyph('丶')
  if (!glyph) return null
  const width = glyph.box[2] - glyph.box[0], height = glyph.box[3] - glyph.box[1]
  const face = composer.face
  const fit = Math.min((band[2] - band[0]) / width, (band[3] - band[1]) / height)
  const em = Math.min(face[2] - face[0], face[3] - face[1]) / 1000
  const scale = Math.min(fit, em), middle = (band[0] + band[2]) / 2
  const target = [middle - width * scale / 2, band[1], middle + width * scale / 2, band[1] + height * scale]
  return placed(glyph, glyph.box, target, composer.ink('丶'), 'dot 丶')
}

/**
 * The corrections, by description. `glyphs` ties each to the outlines it was read against.
 * A correction that cannot find the parts it names leaves the drawing as it is.
 */
export const COMPONENT_FIXES = {
  '⿱一丛': {
    glyphs: { '丛': ['6101a4a331e919f7901aefbd3fb9feaec8802bb6daef6a46bea98fab1d35f811', 'dfc25b96a72d8ac1aa6559b6223e05b939b4899098b70cf468fb889a233a6b1f'] },
    apply(parts, composer) {
      const [bar, lower] = parts
      if (!['sans', 'serif'].includes(composer.fontStyle) || parts.length !== 2 || lower.origin !== 'glyph 丛') return parts
      // Inset the two people between the bars. The broad bottom contour is 丛’s own 一.
      const [l, b, r, t] = lower.source
      const bottomInset = composer.fontStyle === 'serif' ? 0.09 : 0.06
      return [bar, shifted(lower, (_x, y, box) => widthOf(box) > 0.8 * (r - l)
        ? 0 : bottomInset * (t - b) - 0.14 * (y - b))]
    },
  },
  '⿰未⿱成公': {
    glyphs: { '未': '86de49086c3f6a0d4443132473553216c9228682c8a129c9f76ae916b99cb427' },
    apply(parts, composer) {
      if (composer.fontStyle !== 'pen-writing' || composer.excluded('未') || parts.length !== 3 || parts[0].origin !== 'host 㲠') return parts
      // 㲠 supplies a squat upper-left 未. Its broad bars grow heavy when stretched to a full column.
      const [wei, cheng, gong] = parts
      const glyph = composer.glyph('未')
      // Keep the host cut in the group's weight calculation so 成 and 公 retain their original ink.
      const finishOutline = part => {
        const [left, bottom, right, top] = part.target
        const inset = 0.06 * (top - bottom)
        return placed(glyph, glyph.box, [left, bottom + inset, right, top - inset], composer.ink('未'), 'glyph 未', [-0.7, -0.25])
      }
      return [{ ...wei, finishOutline }, cheng, gong]
    },
  },
  // 𠷃 (BabelStone: ⿰口⿳穴𠆢又) has a broad, shallow 又. Its component's
  // proportions also occur in 𥔉. Keep both inner parts within 穴's outer span.

  // As in 堇's lower body, 口 crosses the stem above both of 土's horizontal bars.
  '⿻口土': {
    glyphs: { '口': '412b5a81c5efb7a5f824853645e81e3aea284eb92b129004596757cdba72cc17',
      '土': '9c2d33ff79e57ea5d21a905b5a319697d917da892271e6cfffae7c5581898373' },
    apply(parts, composer) {
      const mouth = partFrom(parts, 'glyph 口'), earth = partFrom(parts, 'glyph 土')
      if (!mouth || !earth) return parts
      const [x, y, right, top] = composer.face, width = right - x, height = top - y
      const mouthTarget = [x + 0.14 * width, y + 0.46 * height, right - 0.14 * width, y + 0.86 * height]
      let body = { ...earth, target: [x + 0.02 * width, y, right - 0.02 * width, top] }
      const bars = barsOf(body)
      if (bars.length > 1) {
        const upper = bars.at(-1)
        body = respanned(body, upper.index, x + 0.08 * width, right - 0.08 * width)
        body = lowered(body, [upper.index], Math.max(0, centreY(upper.box) - (y + 0.25 * height)))
      }
      return parts.map(part => part === mouth ? { ...part, target: mouthTarget } : part === earth ? body : part)
    },
  },
  // 卝's terminals must clear 干's first bar, as the right side of 哶 does.
  // A whole 鰥 cut stretches the left strokes and carries a sweeping lower stroke.
  // Keep 遝’s left strokes and stem, and replace both right strokes with compact 丶 glyphs.
  // Use 呼’s own spacing when both upper pieces came from that glyph.
  '⿱呼乙': {
    glyphs: {},
    apply(parts, composer) {
      const [left, right, bottom] = parts
      if (composer.fontStyle === 'regular' && parts.length === 2 && left.origin === 'glyph 呼') {
        const [x, y, end, top] = left.target
        const foot = Math.max(y, right.target[3] + 0.05 * (top - right.target[1]))
        if (foot >= top) return parts
        const upper = { ...left, target: [x, foot, end, top] }
        if (!matches({ glyphs: { '呼': '6b1060852f4620bd5824536997f9105af07b09003e159930435718d8a51d291a' } }, composer)) return [upper, right]
        // Lower the two contours of 口, and move 乎 and its dots together.
        const dx = 0.03 * widthOf(left.source), dy = -0.025 * heightOf(left.source)
        const contours = left.part.contours.map((c, i) => {
          const mouth = i < 2
          const offsetX = mouth ? 0 : dx, offsetY = mouth ? -0.09 * heightOf(left.source) : dy
          const shift = coords => coords.map((v, j) => v + (j % 2 ? offsetY : offsetX))
          return { ...c, light: shift(c.light), heavy: shift(c.heavy) }
        })
        const source = union(contours.map(c => pointsBox(c.light)))
        const [x0, y0, x1, y1] = right.target, inset = 0.10 * (x1 - x0)
        return [{ ...upper, source, target: mapped(source, left.source, upper.target),
          part: { ...left.part, box: source, contours } }, { ...right, target: [x0 + inset, y0, x1 - inset, y1] }]
      }
      if (parts.length !== 3 || left.origin !== 'host 呼' || right.origin !== 'host 呼') return parts
      const host = union([left.source, right.source]), row = union([left.target, right.target])
      const gap = Math.max(0, right.target[0] - left.target[2])
      row[1] = Math.max(row[1], bottom.target[3] + gap)
      if (row[1] >= row[3]) return parts
      const face = composer.fontStyle
      if (face === 'fangsong' && !composer.excluded('呼') &&
          matches({ glyphs: { '呼': '7dad688f1c5b8a9dafc7284970077d1ba7d4b50ef36240ae67b2d0ec9bed711d' } }, composer)) {
        const glyph = composer.glyph('呼')
        const frame = [bottom.target[0], bottom.target[1], bottom.target[2], row[3] + 0.025 * heightOf(row)]
        return [
          { ...right, part: glyph, source: glyph.box, native: composer.ink('呼'), origin: 'glyph 呼',
            target: mapped([0.06, 0.36, 0.94, 1], [0, 0, 1, 1], frame), weight: [0, 0], fixed: true },
          { ...bottom, target: mapped([0.16, 0, 0.86, 0.33], [0, 0, 1, 1], frame) },
        ]
      }
      if (composer.excluded('口')) return parts
      const mouth = composer.glyph('口')
      if (!mouth) return parts
      const mouthBox = mapped(left.source, host, row), rightBox = mapped(right.source, host, row)
      // The cuts can overlap in 呼. Leave room for the wider corners of a standalone 口.
      mouthBox[2] = Math.min(mouthBox[2], rightBox[0] - gap)
      if (mouthBox[0] >= mouthBox[2]) return parts
      const lip = placed(mouth, mouth.box, fitted(mouth.box, mouthBox, 1), composer.ink('口'), 'glyph 口')
      // WenKai’s second master draws a lighter mouth, so its heavier setting is below zero.
      const setting = mouthWeights[composer.fontStyle]
      if (setting && matches({ glyphs: { '口': setting[0] } }, composer)) {
        lip.weight = [setting[1], setting[1]]
        lip.fixed = true
      }
      const hu = { ...right, target: rightBox }
      if (face === 'serif') {
        const frame = [bottom.target[0], bottom.target[1], bottom.target[2], row[3]]
        return [
          { ...lip, target: mapped([0.085, 0.58, 0.36, 0.91], [0, 0, 1, 1], frame) },
          { ...hu, target: mapped([0.39, 0.41, 0.94, 1], [0, 0, 1, 1], frame) },
          { ...bottom, target: mapped([0.09, 0, 0.94, 0.37], [0, 0, 1, 1], frame) },
        ]
      }
      if (face === 'pen-writing') {
        const fittedBox = fitted(hu.source, rightBox, 1.25)
        const inset = (widthOf(rightBox) - widthOf(fittedBox)) / 2
        lip.target = [lip.target[0] + inset, lip.target[1], lip.target[2] + inset, lip.target[3]]
        hu.target = fittedBox
      }
      if (composer.fontStyle === 'pen-writing' && matches({ glyphs: { '呼': 'bfc223bec870e2306976f48830406872284ae282c08cc697bf4127fa55b44779' } }, composer)) {
        hu.weight = [-0.6, -0.6]
        hu.fixed = true
      }
      return [lip, hu, bottom]
    },
  },
  // ⿱一心: the top 一 is cut from a host whose bar fills a tall teacher band. In the two static
  // Kai faces it comes out much thicker than 心's strokes. The face's own 一 gives the bar its
  // height at the band's width. Regular Kai lowers it into the spare space above 心.
  // Fangsong’s learned 芯 overlaps the 亘 band, so lower the peak while holding the baseline.
  '⿱一心': {
    glyphs: {},
    apply(parts, composer) {
      if (parts.length !== 2) return parts
      const [top, heart] = parts
      if (composer.fontStyle === 'fangsong' && top.origin === 'learned 亘' && heart.origin === 'learned 芯') {
        const [x, base, end, peak] = heart.target
        const ceiling = top.target[1] - 0.08 * (top.target[3] - base)
        if (ceiling >= peak || ceiling <= base) return parts
        return [top, { ...heart, target: [x, base, end, ceiling] }]
      }
      if (composer.fontStyle !== 'regular' && composer.fontStyle !== 'pen-writing') return parts
      const bar = composer.glyph('一')
      if (!bar) return parts
      const ownWidth = bar.box[2] - bar.box[0], ownHeight = bar.box[3] - bar.box[1]
      const width = top.target[2] - top.target[0]
      if (!(ownWidth > 0 && width > 0)) return parts
      const height = ownHeight * width / ownWidth
      const spare = Math.max(0, heightOf(top.target) - height)
      const peak = top.target[3] - (composer.fontStyle === 'regular' ? 0.65 * spare : 0)
      return [{ ...top, target: [top.target[0], peak - height, top.target[2], peak], fixed: true }, heart]
    },
  },
  // ⿻日丿: the 丿 comes from 屮, where it stands as tall as the glyph; over 日 it runs out above
  // the top horizontal. It is cut off at the underside of that bar.
  '⿻日丿': {
    glyphs: { '甲': 'db4b5893a98a4005abf097b7100d8f9cf6eff88240aceb25c7b474b1ce9ce3ef',
      '屮': '52041b363c2da211e721574b5136ec16e60fc243bffae7d6116ff071ac0498d1' },
    apply(parts) {
      const frame = partFrom(parts, 'overlay 甲'), slash = partFrom(parts, 'overlay 屮')
      if (!frame || !slash) return parts
      const bars = barsOf(frame)
      if (!bars.length) return parts
      const top = Math.max(...frame.part.contours.map(c => boxIn(frame, c)[3]))
      const thickness = Math.min(...bars.map(({ box }) => heightOf(box)))
      return parts.map(part => part === slash ? clippedAbove(part, part.part.contours.map((_, i) => i), top - thickness) : part)
    },
  },
  // ⿻二丿: 二 drawn on its own has its lower line sitting lower than 龵 draws the pair under a
  // 丿 — the font lifts that line towards the upper one. The lower bar keeps its width and rises.
  // ⿻一止 as the lower part of 𡋨 and 𢓩 draws it: the 一 crosses the stem a third of the way down,
  // leaving the head of 止 above it. Below the crossing, 止's right bar and left stroke sit as 正
  // sets them between its top line and base: the bar 46% of the way down that gap, the left stroke
  // starting 28.5% down. The strokes are found by where the outline's points lie, so a face that
  // joins 止 into one outline moves the same strokes. The left stroke is shortened below its head,
  // which keeps its shape.
  '⿻一止': {
    glyphs: { '止': ['d9cf7eaf2648b8013a21bd390043e9d8f757f7af0f35af748ec96357a65ea6d0', '5c3b9c7da7f4c9120ea1966ca6f3c7ffebfe374b344fff5e3e9b4ece8440201f',
      '057fcad4bac3a40f3749acaaec39e7beff5e18d0e01deb18b074bc3e06367174', '2e7bfdb342d36055f8d4138b9b64ceaa892cc6504d62ea76c696800d6faf3221'] },
    apply(parts) {
      const stop = partFrom(parts, 'glyph 止'), bar = parts.find(part => part !== stop)
      if (!stop || !bar || heightOf(bar.target) > 0.2 * widthOf(bar.target)) return parts
      const [, y, , top] = boxOf(stop), height = top - y, thickness = heightOf(bar.target)
      const across = (/** @type {number} */ down) => ({ ...bar, target: [bar.target[0], top - down * height - thickness / 2, bar.target[2], top - down * height + thickness / 2] })
      const layout = stopLayout(stop)
      if (!layout) return parts
      const { stem, width, baseTop, leftTop } = layout, [low, high] = layout.bar, band = (high - low) / 2
      const line = across(0.33), [, sy] = scaleOf(stop)
      const under = stop.source[1] + (line.target[1] - stop.target[1]) / sy, gap = under - baseTop
      const drop = (low + high) / 2 - (under - 0.46 * gap), rise = under - 0.285 * gap - leftTop
      const neck = leftTop - 0.15 * (leftTop - baseTop), stretch = (neck + rise - baseTop) / (neck - baseTop) - 1
      // A contour of its own moves whole; in a joined outline, the points on the stroke's side do.
      const body = shifted(stop, (x, y, box) => {
        if (y > low - band && y < high + band && (x > stem || box[1] > low - band && box[3] < high + band)) return -drop
        if (y > baseTop && (x < stem - 0.1 * width || box[2] < stem)) return y >= neck ? rise : (y - baseTop) * stretch
        return 0
      })
      return parts.map(part => part === stop ? body : part === bar ? line : part)
    },
  },
  // ⿱𠂉一: the cut of 監's right side leaves the 一 short; as the component's lower line it runs
  // out to the face's right edge, five percent in from the left.
  // ⿱𠂉丶: the 丶 is taken from 遝, whose lower dot is a 捺, and fills the band as one. The 丶
  // glyph is reduced within the local face and lifted, as 今 and 厶 set the dot.
  // ⿸⿹丅丿丨, the G-source left part of 𡉹, 𣂘 and 𥘱 (T writes ⿸⿹丅丿丶, 示 under its top bar),
  // after SimSun-ExtB's drawing: the bar spans the cell from 6% in and the stem stands at its middle.
  // The 丿 and the 丨 hang either side of the stem from 24% below the top, the 丿 down to 7% above
  // the foot and the 丨, the face's own glyph, to 11% above it. The three strokes share one width.
  // The 丿 and the 丨 are drawn at the scale that gives them the stem's, which a static face keeps;
  // a weighted face's balance then restores the stem's own width at any scale as far as the heavy
  // master reaches, and weights the two as it weights the stem. Of the white between the cell's
  // left edge and the stem, less the 丿's stroke, 38% lies between the 丿's head and the stem, and
  // the tail is drawn in to the rest, so the head keeps its weight. Of the white between the stem
  // and the cell's right edge, less the 丨, 53% lies between the stem and the 丨, and no less than
  // 0.8 of a stroke where heavy strokes fill a narrow cell.
  '⿸⿹丅丿丨': {
    glyphs: {
      '丅': ['78dcd9aa0146cd9317b3cb7455389db2cc8f21df17d072493358c5efb0ed98fd', 'f2668a2d4aa3d88c538ddcecd7a48f607521f1be4f5e4b53d786ff9de7d8445d',
        'c855dc3aa69a0b863c3062a014e876708b73d2b3b213773f679529340d4dcbdf', '5c45e7e1ea0d588d8d6d80706db05a36fee0b6ff51766d296d908483d81db0b8'],
      '丿': ['be6e7c77ed22a138be59cae82446668db20e3f4a9ecd6cf3beaa3e60b9777751', '12e1853850e8835f94404d0791cbab5c3699809e4343e8e04a636126138fa7d9',
        '28ae5a6b2a054b8427219468f99f957470444028396162ba75dfa52335a4016e', 'ea4cd61f8ca90215144de4b8b1f0e4387c61097afd0b5820c7bb204d5c75d46e'],
      '丨': ['7a86fb1164e56134835216c1085defdbce640b035e60a788677eb53f6af77129', '9e418e5a6f65e3857fb1f5e8b976250e544ee7cdaaecde9555f6e854ca884f1c',
        '5ee12cda66677f02028da080932fc19f68bd23c83e5d30d11cf5509060aca6ae', 'aabe4c0f157f163a2d1a12310696bebac525fadea126faa8ad176029dc6bfc37'],
    },
    apply(parts, composer, region = composer.face) {
      const tee = partFrom(parts, 'glyph 丅'), slash = partFrom(parts, 'glyph 丿'), stroke = parts.find(part => part !== tee && part !== slash)
      const glyph = composer.glyph('丨')
      if (!tee || !slash || !stroke || parts.length !== 3 || !glyph) return parts
      const source = union(glyph.contours.map(contour => pointsBox(contour.light)))
      // The 丿 and the 丨 carry 丅's ink, and the 丨 a box of 丅's breadth, so the balance weights
      // them as it weights the stem and stops them at the heavy master where it stops the stem.
      const line = { ...placed(derived(glyph, glyph.contours, source), source, source, tee.native, 'glyph 丨'), balanceBox: tee.source.slice() }
      const stem = strokeAt(tee, 0.5), head = strokeAt(slash, 0.75), own = strokeAt(line, 0.5)
      if (!stem || !head || !own) return parts
      const [x, y, right, top] = region, width = right - x, height = top - y
      const bar = { ...tee, target: [x + 0.06 * width, y, right, top] }, [sx] = scaleOf(bar)
      // The width the strokes end at, and where the stem stands.
      const thick = composer.weighted ? Math.min(stem.width, (strokeAt(tee, 0.5, true) ?? stem).width * sx) : stem.width * sx
      const middle = bar.target[0] + (stem.middle - tee.source[0]) * sx
      const headScale = sx * stem.width / head.width, lineScale = sx * stem.width / own.width
      const headAt = middle - thick - 0.38 * Math.max(0, middle - x - 1.5 * thick)
      const slashRight = headAt + (slash.source[2] - head.middle) * headScale
      // The head is kept whole in the master it is drawn from, the heavy one's being the wider.
      const from = composer.weighted ? Math.min(head.left, strokeAt(slash, 0.75, true)?.left ?? head.left) : head.left
      const drawn = drawnIn(slash, from, (slashRight - x) / headScale)
      // The 丨's box at the width it ends at shares the white; its stroke's middle is placed from that.
      const ended = thick / own.width, white = Math.max(0, right - middle - thick / 2 - widthOf(source) * ended)
      const lineAt = middle + thick / 2 + Math.min(white, Math.max(0.53 * white, 0.8 * thick)) + (own.middle - source[0]) * ended
      const lineLeft = lineAt - (own.middle - source[0]) * lineScale
      return [bar,
        { ...drawn, native: tee.native, target: [Math.max(x, slashRight - widthOf(drawn.source) * headScale), y + 0.07 * height, slashRight, top - 0.24 * height] },
        { ...line, target: [lineLeft, y + 0.11 * height, lineLeft + widthOf(source) * lineScale, top - 0.24 * height] }]
    },
  },
  // The vertical hook projects above the bent bar, including when used inside C078.
  // 㐧 supplies the proportions: a long projecting hook head and a diagonal
  // starting under the bar. The generic surround shrinks this body twice.
  '⿹⿻乛亅㇒': {
    glyphs: { '乛': 'a69b2b57b6cd11538bdc7c7167de84cd8a7230733fde05a719ad938a26e8eeee',
      '亅': '94220e40be5cc0d543297333f960bf55dee8a8f099224a03ca973429aeeab603' },
    apply(parts, composer, region = composer.face) {
      const bar = partFrom(parts, 'glyph 乛'), hook = partFrom(parts, 'glyph 亅'), slash = partFrom(parts, 'glyph ㇒')
      if (!bar || !hook || !slash) return parts
      const [x, y, right, top] = region, width = right - x, height = top - y
      const targets = new Map([
        [bar, [x, y + 0.46 * height, right, y + 0.70 * height]],
        [hook, [x + 0.28 * width, y, x + 0.58 * width, top]],
        [slash, [x, y + 0.12 * height, x + 0.61 * width, y + 0.66 * height]],
      ])
      return parts.map(part => targets.has(part) ? { ...part, target: targets.get(part) } : part)
    },
  },
  // 鬲 supplies the complete lower frame. Fit it to the enclosing component’s full height.
  '⿵𦉪丅': {
    glyphs: { '鬲': '77e24fb157b9a4fff77f27a1a31f1fb9b9ca21bc332dd18809015d3f0214a9a6' },
    apply(parts, composer) {
      const frame = partFrom(parts, 'glyph 𦉪'), glyph = composer.glyph('鬲')
      if (!frame || !glyph) return parts
      const contours = [1, 2, 3, 4, 5, 8].map(index => glyph.contours[index])
      const source = union(contours.map(contour => pointsBox(contour.light)))
      const target = boxOf(frame)
      return [placed(derived(glyph, contours, source), source, target, composer.ink('鬲'), 'body 鬲')]
    },
  },
  // 鬲 supplies the complete 𦉪 frame with its inner 丿 and 乚, as for ⿵𦉪丅. 十 stands in 鬲’s own
  // 丅 cross: its bar joins the two inner strokes’ feet the way the font draws them, and its vertical
  // runs on above the bar, between 丿 and 乚, as 十’s stem does. The strokes keep the frame’s
  // proportions and its weight, so a frame fitted into a narrow or compressed cell stays in scale.
  '⿵𦉪十': {
    glyphs: {
      '鬲': [
        '77e24fb157b9a4fff77f27a1a31f1fb9b9ca21bc332dd18809015d3f0214a9a6',
        'f2cce4e4b895cb546341399693139fdbb7478ff5c02f2c9c565a3817099bbc91',
        'de5606e4968f68067080c0219e1634cc3622f007c35c8936df34e55186b7f88f',
      ],
      '十': [
        'ce6ceba94c9cff059884ae9f408b550499c7fd68870f52d4b58249bc654f8c48',
        '8ba0401e9267ccab67dd66212c1cb4d456dec0c706ea12d995a7ec7493512d3f',
        'ebfb2d357226098f7d3a9b935c7bebbadc5d33eff8def385a7af697e5b356e5c',
      ],
    },
    apply(parts, composer) {
      // The frame, the 丅 bar and stem 鬲 draws, and the 十 contour that is the bar: Sans orders 十
      // as bar then stem, Serif as stem then bar.
      const faces = {
        9: { frame: [3, 4, 5, 8], bar: 0, geBar: 1, geStem: 2, barBox: [286, 34, 720, 90] },
        10: { frame: [3, 4, 8, 9], bar: 1, geBar: 0, geStem: 1, barBox: [270, 96, 754, 166], stemBox: [452, -65, 537, 300], rise: 0.12 },
      }
      const frame = partFrom(parts, 'glyph 𦉪'), body = composer.glyph('鬲'), cross = composer.glyph('十')
      // Zhuque's frame is 鬲's lower part, and its 十 is one outline: set the whole glyph in the
      // frame, its bar under the inner strokes and its stem on the frame's middle.
      const learned = parts.find(part => /鬲/.test(part.origin)) ?? null
      if (learned && cross && cross.contours.length < 2) {
        const ten = partFrom(parts, 'glyph 十'), t = boxOf(learned)
        if (ten) {
          // The face's own lower frame, cut clean of the ¥: a traced outline in a 574 by 392 box.
          const from = [0, 0, 574, 392]
          const clean = placed(makePart([FANGSONG_FRAME], from), from, t, composer.ink('鬲'), 'designed 鬲')
          // 穴's two legs stand under the frame's top bar, the 儿 the face draws in its 𦉪.
          const cave = composer.glyph('穴')
          const legs = cave ? placed(derived(cave, [0, 1].map(i => cave.contours[i]), union([0, 1].map(i => pointsBox(cave.contours[i].light)))),
            union([0, 1].map(i => pointsBox(cave.contours[i].light))), [t[0] + 0.08 * (t[2] - t[0]), t[1] + 0.08 * (t[3] - t[1]), t[2] - 0.08 * (t[2] - t[0]), t[1] + 0.52 * (t[3] - t[1])], composer.ink('穴'), 'designed 穴') : null
          const c = cross.box, width = 0.50 * (t[2] - t[0]), scale = width / Math.max(c[2] - c[0], 1)
          const height = (c[3] - c[1]) * scale, bar = c[1] + 0.45 * (c[3] - c[1])
          const want = t[1] + 0.16 * (t[3] - t[1])
          const x0 = (t[0] + t[2]) / 2 - width / 2, y0 = want - (bar - c[1]) * scale
          const out = parts.map(part => part === ten ? placed(cross, c, [x0, y0, x0 + width, y0 + height], composer.ink('十'), 'glyph 十') : part === learned ? clean : part)
          return legs ? [...out, legs] : out
        }
      }
      const face = body && faces[body.contours.length]
      if (!frame || !face || !cross || cross.contours.length < 2) return parts
      const bar = cross.contours[face.bar], stem = cross.contours[1 - face.bar]
      const barSource = pointsBox(bar.light), stemSource = pointsBox(stem.light)
      // An export of another face would pass the digests with the two strokes swapped.
      if (widthOf(barSource) <= heightOf(barSource) || heightOf(stemSource) <= widthOf(stemSource)) return parts
      const contours = face.frame.map(index => body.contours[index])
      const source = union(contours.map(contour => pointsBox(contour.light)))
      const target = boxOf(frame)
      const geBar = pointsBox(body.contours[face.geBar].light)
      const geStem = pointsBox(body.contours[face.geStem].light)
      const top = Math.max(...contours.map(contour => pointsBox(contour.light)[3]))
      // 十's vertical runs a little over half way up the room above the bar, under the frame's top.
      const stemTop = geBar[3] + (face.rise ?? 0.18) * (top - geBar[3])
      const stemTarget = face.stemBox ?? [geStem[0], geStem[1], geStem[2], stemTop]
      if (face.stemBox) stemTarget[3] = stemTop
      const stroke = (contour, box) => {
        const from = pointsBox(contour.light)
        const out = placed(derived(cross, [contour], from), from, mapped(box, source, target), composer.ink('十'), 'glyph 十')
        // The bar and stem are the frame's own strokes: they keep its weight rather than taking one
        // of their own, so they stay in scale when the frame is fitted into a small cell.
        out.fixed = true
        return out
      }
      return [placed(derived(body, contours, source), source, target, composer.ink('鬲'), 'body 鬲'),
        stroke(bar, face.barBox), stroke(stem, stemTarget)]
    },
  },
  // ⿰𠄠𠄠: the pair is set as one cell each, and the two 𠄠 meet with only a sliver between
  // them. 臼 sets its inner bars at 0.12 of the face apart; the pair keeps that distance, taking it
  // from their inner ends so the outer edges stay where the layout put them.
  '⿰𠄠𠄠': {
    glyphs: { '𠄠': 'cd8c6569945d1d15acf7c0bcd567dbb4491a257ac4ef5bb80a45aa409493fe7e' },
    apply(parts) {
      const pair = parts.filter(part => part.origin === 'glyph 𠄠')
      if (pair.length !== 2) return parts
      const [left, right] = [...pair].sort((a, b) => centreX(a.target) - centreX(b.target))
      const a = boxOf(left), b = boxOf(right), gap = b[0] - a[2]
      const want = 0.12 * (b[2] - a[0])
      if (!(want > gap)) return parts
      const extra = (want - gap) / 2
      const wider = [
        { ...left, target: [left.target[0], left.target[1], left.target[2] - extra, left.target[3]] },
        { ...right, target: [right.target[0] + extra, right.target[1], right.target[2], right.target[3]] },
      ]
      return parts.map(part => part === left ? wider[0] : part === right ? wider[1] : part)
    },
  },
  // ⿳𰀉冖木: the three host cuts meet at their boxes, but the 冖 is a roof, so its box's foot is
  // its legs while the wood under it starts at the bar's underside, leaving a band of white inside
  // the roof. The 冖 is raised to 𰀉's lowest bar where it stands short, and the 木 is stretched to
  // the bar's underside, so the three join and the wood still reaches the face's foot.
  // ⿱𰀁口: the 口 is cut from 吂, where it fills the band below as a narrow, shallow box, so
  // under 𰀁 the top overhangs it as 亮 and 凉 never let it. The 口 takes the cell's foot and the
  // width and height 亮's 口 has; 𰀁 keeps a short stem below its lower bar, clear of 口.
  '⿱𰀁口': {
    glyphs: { '𤆖': 'e2341850ee010f94f376c8724147025f713626cbdb97a050d310fb33ed9d5c74',
      '吂': 'f5b707cdf67842858aacb756da8c6aeeb61982cfa5925930403ae59616acfa10' },
    apply(parts, composer, region = composer.face) {
      const top = partFrom(parts, 'learned 𤆖'), mouth = partFrom(parts, 'learned 吂')
      if (!top || !mouth) return parts
      const face = region, width = face[2] - face[0], height = face[3] - face[1]
      const middle = (face[0] + face[2]) / 2
      const lower = { ...mouth, target: [middle - 0.355 * width, face[1], middle + 0.355 * width,
        face[1] + 0.38 * height] }
      // 𤆖 joins both bars and the stem in one contour. Move the lower bar's
      // vertices together, including its stem junction, to preserve its thickness.
      const contours = top.part.contours.map(contour => {
        const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
        for (let i = 0; i < light.length; i += 2) {
          const x = contour.light[i], y = contour.light[i + 1]
          // Stop the stem at 口's top edge; it reaches the mouth without running inside it.
          if (y < 150) { light[i + 1] = 150; heavy[i + 1] = 116; continue }
          if (y !== 400 && y !== 471) continue
          const dx = x === 135 ? -63 : x === 884 ? 56 : 0
          light[i] += dx; heavy[i] += dx
          light[i + 1] -= 40; heavy[i + 1] -= 40
        }
        return { ...contour, light, heavy }
      })
      // The stem overlaps the 口's top edge, as 吉 joins its two parts.
      const upper = { ...revised(top, contours), target: [top.target[0], lower.target[3] - 0.03 * height,
        top.target[2], top.target[3]] }
      return parts.map(part => part === mouth ? lower : part === top ? upper : part)
    },
  },
  // ⿵冂丨: the 丨 is laid in the frame's lower middle with its top short of the bar. In 㒳 and
  // 麗 a vertical inside 冂 hangs from the top bar; this one is raised to the frame's top, where the
  // bar hides its end and the stroke reads as joined.
  '⿵冂丨': {
    glyphs: { '円': '86e9d56419bf78529599d260ae57dd0a9c3cd6c9ac4b4bbe853207586e403f23',
      '丨': '7a86fb1164e56134835216c1085defdbce640b035e60a788677eb53f6af77129' },
    apply(parts) {
      const frame = partFrom(parts, 'learned 円'), bar = partFrom(parts, 'glyph 丨')
      if (!frame || !bar) return parts
      const target = [bar.target[0], bar.target[1], bar.target[2], frame.target[3]]
      return parts.map(part => part === bar ? { ...part, target } : part)
    },
  },
  // ⿹丅丿: the ⿹ leaves its opening at the lower left, but 丿 is set on the right, floating clear
  // of the cross. In 第 and 弔's 𢎨 the falling stroke stands left of the stem, below the bar: a
  // short, shallow ㇒, not a 刀 cut squeezed upright. It is drawn from the ㇒ glyph at that lean.
  // ⿵𠆢丶: the 丶 is cut from a 捺 and fills its band as a long slash. Under 𠆢 it is the dot
  // of 厶, as 能 and 熊 set it; the 丶 glyph stands in, sized to the band and standing on its foot.
  // 𡱃 compresses the cap above a taller 巾; the centre stem reaches its falling tip.
  // 監 supplies either a single right-hand cut or two separate strokes. Split the cut before
  // sizing the pair, so 臣 stays compact and the lower 一 spans the right column.

  // The three columns of ⿲木十木 share by ink, leaving the middle 十 a sliver. The middle takes
  // 90% of the gap the two 木 leave, centered; a designer's row of three gives it that room.
  '⿲木十木': {
    glyphs: {},
    apply(parts) {
      if (parts.length !== 3) return parts
      const [left, middle, right] = parts
      const lo = left.target[2], hi = right.target[0]
      if (!(hi > lo)) return parts
      const width = Math.max(middle.target[2] - middle.target[0], (hi - lo) * 0.9)
      const cx = (lo + hi) / 2
      middle.target = [cx - width / 2, middle.target[1], cx + width / 2, middle.target[3]]
      return parts
    },
  },
}

/** Whether `composer`'s glyphs are the outlines a correction was read against. */
function matches(fix, composer) {
  return Object.entries(fix.glyphs).every(([ch, digests]) => {
    const record = composer.glyphRecord(ch)
    return record && [digests].flat().includes(hexOf(JSON.stringify(record.p)))
  })
}

/** `parts`, with the correction a description carries applied where the outlines are the ones it
 *  was read against. */
export function componentFix(sequence, parts, composer, region = composer.face) {
  const fix = COMPONENT_FIXES[sequence]
  return fix && matches(fix, composer) ? fix.apply(parts, composer, region) : parts
}
