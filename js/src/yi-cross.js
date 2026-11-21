// @ts-nocheck
import { derived, mapped, partInk, partOf, placed } from './geometry.js'
import { hexOf } from './sha256.js'

// The unencoded 弋 form uses the same 十 and hook as ⿽戈十 (𢦏).
// FangSong draws 𢦏 as the frame of 戴. Its inner 異 is outside the selection.
const forms = {
  sans: { digest: 'd26b6ef7e5890cb0d66621d22a2da89e51b468386401dba1273388508d4d8d0f', outer: [0, 1, 2], ten: [3, 4] },
  serif: { digest: 'f11daabbc6ac15c7cbff98c6d91fbb5c23a91a149a1f887c1972ba0f483094a9', outer: [0, 2, 3], ten: [1, 5] },
  fangsong: { digest: '106a25d96cdd4f0f419767c92cf1d46d5391d27179f6b2422b0053d8a83f3c5d', dot: 7,
    hook: [[0, 3], [6, 14], [32, 59], [70, 80]], cross: [[14, 32]] },
  regular: { digest: '2c79ad8bf5b9bebaa68741710a8fe51f09974e0798941894b6d23f15df6ed433', dot: 1,
    hook: [[0, 7], [30, 48], [57, 70], [77, 80]], cross: [[7, 30]] },
  'pen-writing': { digest: 'ccb55af7bfe9e26ad40cec8d3c22bce14cf34a7909a6fa0fd28d4c8fe40497e2', dot: 1,
    hook: [[13, 31], [42, 60], [100, 133]], cross: [[60, 100]] },
}

export function yiCrossDonor(node, style) {
  return node[0] === '⿽' && node[1] === '弋' && node[2] === '十' && !node.note && forms[style]
    ? (style === 'fangsong' ? '戴' : '𢦏') : null
}

// In the joined outlines, reconnect the boundaries of the hook on either side
// of the omitted slash. Each range runs between two on-curve command endpoints.
function cutContour(contour, ranges) {
  const ops = [], light = [], heavy = []
  let offset = 0, section = 0
  for (const [i, command] of contour.ops.entries()) {
    const next = offset + 2 * command[1]
    const [start, end] = ranges[section]
    if (i >= start) {
      const from = i === start ? next - 2 : offset
      ops.push(i === start ? [section ? 'L' : 'M', 1, false] : command)
      light.push(...contour.light.subarray(from, next))
      heavy.push(...contour.heavy.subarray(from, next))
    }
    if (i === end && ++section === ranges.length) break
    offset = next
  }
  return { ops, light: Float64Array.from(light), heavy: Float64Array.from(heavy), width: contour.width }
}

export function yiCrossParts(composer, node, region) {
  const style = composer.fontStyle, host = yiCrossDonor(node, style)
  if (!host || [host, '弋', '十'].some(ch => composer.excluded(ch))) return null
  const record = composer.glyphRecord(host), form = forms[style]
  if (!record || hexOf(JSON.stringify(record.p)) !== form.digest) return null
  const donor = partOf(record), c = donor.contours
  const groups = form.outer
    ? [form.outer.map(i => c[i]), form.ten.map(i => c[i])]
    : [[cutContour(c[0], form.hook), c[form.dot]], [cutContour(c[0], form.cross)]]
  // The FangSong reference stretches the 戴 frame to its cell. The four whole
  // glyphs are fitted and weighted by the normal native-glyph path.
  const whole = host === '戴' ? placed(donor, donor.box, region, composer.ink(host), 'instance 戴')
    : composer.place(donor, region, composer.ink(host), 'glyph 𢦏')
  if (composer.weighted && !composer.partial) {
    const stroke = composer.stroke
    composer.balance([whole])
    composer.stroke = stroke
  }
  return groups.map((group, index) => {
    const part = derived(donor, group)
    const target = mapped(part.box, donor.box, whole.target)
    return { ...placed(part, part.box, target, partInk(part), (index ? '十' : '弋') + ' from ' + host, whole.weight), fixed: true }
  })
}
