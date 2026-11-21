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

// 哉 has its own 十 and 口 proportions. Cut the complete enclosing form here
// so a separately fitted 口 cannot move away from its place under the bar.
const mouthForms = {
  sans: { digest: '4a088ae5cb05d7f5324c84b429ed28dd1c53ae60785ddcbb86953862c8e70524', outer: [0, 1, 2], ten: [3, 4], mouth: [5, 6] },
  serif: { digest: 'dd207011e0373378195366c7dc3cf35b90e070c294db6837aaf5f7328e2d7a01', outer: [0, 2, 3], ten: [1, 8], mouth: [5, 6, 7] },
  fangsong: { digest: 'bec910e337f626a5fea56fa9c11e1553c4aac82b61bf4e5adafd64b41e270250', dot: 3, mouth: [1, 2],
    hook: [[0, 5], [9, 23], [52, 78], [86, 95]], cross: [[23, 52]] },
  regular: { digest: '0c3a1765e49d19bcfce15b9e1c6ad3fc3b4045003e84155567369353e116cba1', dot: 3, mouth: [1, 2],
    hook: [[34, 73], [91, 121], [132, 152]], cross: [[0, 34], [152, 152]] },
  'pen-writing': { digest: 'cd13e9ff48f0a506fc91947eaff4bb3c07becb0f6a44a8262a4f4c49ee6055a0', dot: 1, mouth: [2, 3],
    hook: [[0, 13], [36, 46], [50, 60], [66, 67]], cross: [[13, 36]] },
}

const isYiCross = node => node?.[0] === '⿽' && node[1] === '弋' && node[2] === '十' && !node.note

export function yiCrossDonor(node, style) {
  if (!forms[style]) return null
  if (node[0] === '⿹' && node[2] === '口' && !node.note && isYiCross(node[1])) return '哉'
  return isYiCross(node) ? (style === 'fangsong' ? '戴' : '𢦏') : null
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
  if (!host || [host, '弋', '十'].some(ch => composer.excluded(ch)) || (host === '哉' && composer.excluded('口'))) return null
  const record = composer.glyphRecord(host), form = (host === '哉' ? mouthForms : forms)[style]
  if (!record || hexOf(JSON.stringify(record.p)) !== form.digest) return null
  const donor = partOf(record), c = donor.contours
  const groups = form.outer
    ? [form.outer.map(i => c[i]), form.ten.map(i => c[i])]
    : [[cutContour(c[0], form.hook), c[form.dot]], [cutContour(c[0], form.cross)]]
  if (form.mouth) groups.push(form.mouth.map(i => c[i]))
  // The FangSong reference stretches the 戴 frame to its cell. The four whole
  // glyphs are fitted and weighted by the normal native-glyph path.
  const whole = host === '戴' ? placed(donor, donor.box, region, composer.ink(host), 'instance 戴')
    : composer.place(donor, region, composer.ink(host), 'glyph ' + host)
  if (composer.weighted && !composer.partial) {
    const stroke = composer.stroke
    composer.balance([whole])
    composer.stroke = stroke
  }
  return groups.map((group, index) => {
    const part = derived(donor, group)
    const target = mapped(part.box, donor.box, whole.target)
    return { ...placed(part, part.box, target, partInk(part), '弋十口'[index] + ' from ' + host, whole.weight), fixed: true }
  })
}
