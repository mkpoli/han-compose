// @ts-nocheck: the corrections move placed parts, whose contours are the geometry module’s arrays.
// Corrections for a component the font draws as a cut, where a stroke of one operand runs into
// another, a bar is longer than the pair it belongs to, or a dot is taken from a 捺. Each names the
// description it corrects, the SHA-256 outlines of the glyphs it was read against, and the parts it
// changes; an export drawing other outlines keeps the font's cut. The parts are plain placed pieces,
// so the corrections work wherever the description is drawn, at any depth.
import { derived, mapped, partOf, placed, pointsBox, union } from './geometry.js'
import { hexOf } from './sha256.js'

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

/** 止's strokes in its own units, read from the points of its outline however the face splits it
 *  into contours: the stem's centre (its head's mean x), the base's top between the left stroke and
 *  the stem, the right bar's span and the left stroke's top. Null for an outline without them. */
function stopLayout(part) {
  const points = part.part.contours.flatMap(({ light }) => Array.from({ length: light.length / 2 }, (_, i) => [light[i * 2], light[i * 2 + 1]]))
  const [x0, y0, x1, y1] = pointsBox(points.flat()), width = x1 - x0, height = y1 - y0
  const head = points.filter(([, y]) => y > y0 + 0.85 * height)
  const stem = head.reduce((sum, [x]) => sum + x, 0) / head.length
  const right = points.filter(([x, y]) => x > stem + 0.1 * width && y > y0 + 0.2 * height && y < y0 + 0.8 * height)
  const left = points.filter(([x, y]) => x < stem - 0.1 * width && y > y0 + 0.3 * height)
  if (!head.length || !right.length || !left.length) return null
  const between = (Math.max(...left.map(([x]) => x)) + Math.min(...head.map(([x]) => x))) / 2
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

/** A part with some contours replaced; the part's box and flags stay. */
function revised(part, contours) {
  const out = derived(part.part, contours, part.part.box.slice())
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

/** `part` with the named contours' width changed about their centre, along x. */
export function narrowed(part, indices, factor) {
  const [sx] = scaleOf(part)
  const contours = part.part.contours.slice()
  for (const index of indices) {
    const contour = contours[index], box = pointsBox(contour.light), middle = (box[0] + box[2]) / 2
    const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
    for (let i = 0; i < light.length; i += 2) {
      light[i] = middle + (light[i] - middle) * factor
      heavy[i] = middle + (heavy[i] - middle) * factor
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
  // ⿸⿹丅丿丨: the 丿 fills the left of the cell, so the opening the ⿹ leaves is the right side of
  // 丅's vertical. 丨 stands there, its head under the bar and its foot off the cell's bottom. Every
  // sample sets the fourth stroke right of the stem: in 𡉹 the stem runs x225–289 and the stroke
  // x352–416.
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
