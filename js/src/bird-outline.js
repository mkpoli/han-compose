// @ts-nocheck
import cuts from './bird-outline-cuts.json' with { type: 'json' }
import { derived, fitted, mapped, partInk, partOf, placed, pointsBox, union } from './geometry.js'
import { splitBirdCrest } from './bird-crest.js'
import { hexOf } from './sha256.js'

const frame = '#(-𠃌㇉)'
const eye = `⿴${frame}丶`
const feet = `⿹${eye}灬`
const bird = `⿱丿${feet}`
const chicken = `⿰又${bird}`

// The frame and eye appear in Yi Bai's description of 岛. For the four-dot
// composition, 鸡 supplies the compact right-hand 鸟 as well as its neighbouring 又.
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv1.txt#L3740
const groups = new Map([
  [frame, ['frame']], [eye, ['frame', 'eye']], [feet, ['frame', 'eye', 'dots']],
  [bird, ['crest', 'frame', 'eye', 'dots']],
  [chicken, ['left', 'crest', 'frame', 'eye', 'dots']],
])
const donorsForDots = style => style === 'fangsong' ? '鴨' : '鳮'

export function birdOutlineDonors(key, style) {
  const order = groups.get(key)
  if (!order || !Object.hasOwn(cuts, style)) return []
  const host = order.includes('left') ? '鸡' : '鸟'
  return order.includes('dots') ? [host, donorsForDots(style)] : [host]
}

const digests = new WeakMap()
function verified(composer, char, spec) {
  if (composer.excluded(char)) return null
  const record = composer.glyphRecord(char)
  if (record?.v !== 1) return null
  if (!digests.has(record)) digests.set(record, hexOf(JSON.stringify(record.p)))
  return digests.get(record) === spec.digest ? partOf(record) : null
}

// Bounds in pixels, y upwards, within the marked 106 × 127 photograph of the shop sign.
// 🌐昭和亡太郎🌐, 俗体字寻觅之旅, 2020-06-16.
// https://rare.glyphatlas.org/en/entry/2329#sighting-2467
const signBox = [15, -118, 94, -17]
const signFrame = [51, -118, 94, -37]
const signDots = [[34, -109, 44, -93], [47, -105, 59, -89],
  [57, -100, 68, -86], [68, -95, 80, -81]]

// The hand-painted row begins under 又. All four marks fall right, and their tops rise
// toward the hook. The native bird’s second mark supplies the first right-falling dot.
function signDotRow(dots) {
  const ordered = dots.contours.slice().sort((a, b) => pointsBox(a.light)[0] - pointsBox(b.light)[0])
  const contours = signDots.map((slot, i) => {
    const original = ordered[Math.max(i, 1)]
    const [x0, y0, x1, y1] = pointsBox(original.light)
    const fit = points => points.map((v, j) => j % 2
      ? slot[1] + (v - y0) * (slot[3] - slot[1]) / (y1 - y0)
      : slot[0] + (v - x0) * (slot[2] - slot[0]) / (x1 - x0))
    return { ...original, light: fit(original.light), heavy: fit(original.heavy) }
  })
  return derived(dots, contours)
}

function signParts(glyph, pieces, dots, dotDonor, region) {
  const framePart = derived(glyph, pieces.frame), frameBox = framePart.box
  const crestPart = derived(glyph, pieces.crest), nativeTop = crestPart.box[3]
  const nativeFrameTop = frameBox[3]
  // Carry the portion above the head to the sign's higher crest. Points in the shared
  // crest/frame junction keep the same transform on both sides of the cut.
  const factor = (signBox[3] - signFrame[3]) / (signFrame[3] - signFrame[1]) *
    (frameBox[3] - frameBox[1]) / (nativeTop - nativeFrameTop)
  const extend = points => points.map((v, i) => i % 2 && v > nativeFrameTop
    ? nativeFrameTop + (v - nativeFrameTop) * factor : v)
  const crest = derived(glyph, pieces.crest.map(c => ({ ...c, light: extend(c.light), heavy: extend(c.heavy) })))
  const row = signDotRow(dots)
  const parts = [derived(glyph, pieces.left), crest, framePart, derived(glyph, pieces.eye), row]
  const slots = [[15, -98, 49, -38], mapped(crest.box, frameBox, signFrame), signFrame, [54, -62, 70, -46], row.box]
  return parts.map((part, i) => ({
    ...placed(part, part.box, mapped(slots[i], signBox, region), partInk(part),
      `host ${i === 4 ? dotDonor : '鸡'}`), fixed: true,
  }))
}

// Index cuts follow the exact contour order of the five font exports. A joined
// crest is divided at its two junctions so 丿 and the frame can be edited separately.
export function birdOutlineParts(composer, key, region) {
  if (key === chicken && [key, '又', '丿', '丶', '灬'].some(ch => composer.excluded(ch))) return null
  const [char, dotDonor] = birdOutlineDonors(key, composer.fontStyle)
  if (!char || [frame, '𠃌', '㇉'].some(stroke => composer.excluded(stroke))) return null
  const specs = cuts[composer.fontStyle], spec = specs[char]
  const glyph = verified(composer, char, spec)
  if (!glyph) return null
  const order = groups.get(key)
  const pick = indices => indices.map(i => glyph.contours[i])
  const pieces = { left: pick(spec.left), frame: pick(spec.frame), eye: pick([spec.eye]) }
  if (spec.crest === null) {
    const split = splitBirdCrest(pieces.frame[0], composer.fontStyle, char)
    if (!split) return null
    const [crest, body] = split
    pieces.crest = [crest]
    pieces.frame = [body]
  } else pieces.crest = pick([spec.crest])

  let dots
  if (dotDonor) {
    const cut = specs[dotDonor]
    const source = verified(composer, dotDonor, cut)
    if (!source) return null
    dots = derived(source, cut.dots.map(i => source.contours[i]))
  }
  if (key === chicken) return signParts(glyph, pieces, dots, dotDonor, fitted(glyph.box, region, composer.C.STRETCH))
  const parts = order.map(group => group === 'dots' ? dots : derived(glyph, pieces[group]))
  const boxes = parts.map(part => part.box)
  if (dots) {
    const [, bottom, , top] = dots.box
    // The standalone bird keeps the footprint of its original horizontal bar.
    const [left, , right] = pointsBox(glyph.contours[spec.bar].light)
    const rise = spec.frameUnderside === undefined ? 0 : spec.frameUnderside - specs[dotDonor].frameUnderside
    boxes[boxes.length - 1] = [left, bottom + rise, right, top + rise]
  }
  const bounds = union(boxes)
  const target = fitted(bounds, region, composer.C.STRETCH)
  return parts.map((part, i) => ({
    ...placed(part, part.box, mapped(boxes[i], bounds, target), partInk(part),
      `host ${order[i] === 'dots' ? dotDonor : char}`), fixed: true,
  }))
}
