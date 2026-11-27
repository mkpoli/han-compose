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
  const parts = order.map(group => group === 'dots' ? dots : derived(glyph, pieces[group]))
  const boxes = parts.map(part => part.box)
  if (dots) {
    let [left, bottom, right, top] = dots.box
    // Match the gap in 鳮. Each ordinate marks the underside of the frame
    // directly above the middle of the dot row in its verified outline.
    let rise = spec.frameUnderside === undefined ? 0 : spec.frameUnderside - specs[dotDonor].frameUnderside
    if (char === '鸟') {
      const bar = pointsBox(glyph.contours[spec.bar].light)
      left = bar[0]
      right = bar[2]
    } else if (composer.fontStyle === 'regular') {
      left += 7
      right -= 46
    } else if (composer.fontStyle === 'fangsong') {
      // Clear 又 on the left and the rising tip of 鸡's hook below.
      left += 22
      right += 6
      rise = 27
    }
    boxes[boxes.length - 1] = [left, bottom + rise, right, top + rise]
  }
  const bounds = char === '鸡' ? glyph.box : union(boxes)
  const target = fitted(bounds, region, composer.C.STRETCH)
  return parts.map((part, i) => ({
    ...placed(part, part.box, mapped(boxes[i], bounds, target), partInk(part),
      `host ${order[i] === 'dots' ? dotDonor : char}`), fixed: true,
  }))
}
