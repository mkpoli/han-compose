import { cutContours, derived, partOf, segments } from './geometry.js'
import { leFrameCut, partitionChainHost } from './host-chain.js'
import { reconnectStroke } from './stroke-donors.js'

// Yi Bai's default 乐 crosses the flat foot with 亅 above two detached strokes.
// The P form assigns 丨 and 人 to those positions.
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv2.txt#L81
// https://github.com/yi-bai/ids/blob/629d0b74/ids_lv2.txt#L81
const frame = '#(丿𠃊)'
const spellings = new Map([frame, '#(丿𠃊>)'].map(left => [`⿻[1:]亅⿱${left}八`, left]))

/** @param {string} key */
export const leContextDonors = key => spellings.has(key) ? ['乐'] : []

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function leContextParts(composer, key, region) {
  const written = spellings.get(key)
  if (!written || [key, `⿻[1:]亅⿱${frame}八`, `⿱${written}八`, `⿱${frame}八`,
    '乐', '亅', written, frame, '八', '丿', '𠃊'].some(k => composer.excluded(k))) return null
  const record = composer.glyphRecord('乐')
  const cut = leFrameCut(record, composer.fontStyle)
  if (!cut) return null
  const glyph = partOf(record), leaves = ['亅', written, '八']
  composer.nativeEnclosures.add(key)
  if (cut.face === 'sans' || cut.face === 'serif') {
    const frameContours = /** @type {number[]} */ (cut.indices)
    const groups = cut.face === 'sans' ? [[0], frameContours, [2, 3]] : [[5], frameContours, [1, 2]]
    return partitionChainHost(composer, glyph, region, '乐', leaves, groups)
  }
  // In each brush font one contour joins the hook to both sides of the frame.
  // Follow its two complementary runs for 亅, including the original closing edge.
  const runs = /** @type {number[][]} */ (cut.indices[0])
  const [[, a, b], [, c, d]] = [...runs].sort((x, y) => x[1] - y[1])
  return partitionChainHost(composer, glyph, region, '乐', leaves, final => {
    const contour = final.contours[0], end = segments(contour.ops, contour.light).length - 1
    const hook = reconnectStroke(final.contours, [[0, b, c], [0, d, end], [0, 0, a]])
    const foot = reconnectStroke(final.contours, runs)
    return [derived(final, [hook]), derived(final, [foot]), cutContours(final, [1, 2])]
  })
}
