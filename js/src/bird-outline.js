// @ts-nocheck
import cuts from './bird-outline-cuts.json' with { type: 'json' }
import { derived, fitted, mapped, partInk, partOf, placed, pointsBox, union } from './geometry.js'
import { splitBirdCrest } from './bird-crest.js'
import { hexOf } from './sha256.js'

const frame = '#(-𠃌㇉)'
const eye = `⿴${frame}丶`
const feet = `⿹${eye}灬`
const bird = `⿱丿${feet}`

// The frame and eye appear in Yi Bai's description of 岛. For the four-dot
// composition, 鸡 supplies the compact right-hand 鸟 as well as its neighbouring 又.
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv1.txt#L3740
const groups = new Map([
  [frame, ['frame']], [eye, ['frame', 'eye']], [feet, ['frame', 'eye', 'dots']],
  [bird, ['crest', 'frame', 'eye', 'dots']],
  [`⿰又${bird}`, ['left', 'crest', 'frame', 'eye', 'dots']],
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

// Index cuts follow the exact contour order of the five font exports. A joined
// crest is divided at its two junctions so 丿 and the frame can be edited separately.
export function birdOutlineParts(composer, key, region) {
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
  const parts = order.map(group => group === 'dots' ? dots : derived(glyph, pieces[group]))
  const boxes = parts.map(part => part.box)
  if (dotDonor && char === '鸟') {
    // The dots come from a right-hand column. Spread them over the width
    // occupied by the final 一 in the face's full-width 鸟.
    const bar = pointsBox(glyph.contours[spec.bar].light)
    boxes[boxes.length - 1] = [bar[0], dots.box[1], bar[2], dots.box[3]]
  }
  if (char === '鸡' && dots) {
    // 鸡 has a shorter lower hook than the traditional bird donors. Leave
    // daylight at Regular's right wall and above FangSong's rising hook tip.
    const [left, bottom, right, top] = dots.box
    if (composer.fontStyle === 'regular') boxes[boxes.length - 1] = [left + 7, bottom, right - 46, top]
    if (composer.fontStyle === 'fangsong') boxes[boxes.length - 1] = [left + 22, bottom + 27, right + 6, top + 27]
  }
  const bounds = char === '鸡' ? glyph.box : union(boxes)
  const target = fitted(bounds, region, composer.C.STRETCH)
  return parts.map((part, i) => ({
    ...placed(part, part.box, mapped(boxes[i], bounds, target), partInk(part),
      `host ${order[i] === 'dots' ? dotDonor : char}`), fixed: true,
  }))
}
