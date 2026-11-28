import { derived, partInk, partOf, pointsBox, segments } from './geometry.js'
import { hexOf } from './sha256.js'
import { siCounterContours } from './si-counter.js'

// 統外字登記, row 579, small parenthesized variant of 巳.
// https://rare.glyphatlas.org/en/entry/3156#sighting-3322
// The attested rightward bend in 匸 and 四: https://www.unicode.org/L2/L2023/23116-unicode-appf.pdf#page=9
export const SI_CHAIN = '#(一-𠃍㇄)'

/** @typedef {{donor: string, hostHash: string, donorHash: string, host: number[], bend: number[], stretch?: number[]}} Cut */
// Each triple selects a contour and two on-curve endpoints on opposite edges of its upright.
/** @type {Record<string, Cut>} */
const cuts = {
  'sans': {
    donor: '匸', host: [2, 2, 30], bend: [1, 2, 27],
    hostHash: 'de0b6d6134cde0e609ddf1a98f62a31050a49b56819903ad1790f1723c3b9faa',
    donorHash: 'df3893e642d8d36acdac89e67a8de03123eb693728784c2ab57f272d15a03986',
  },
  'serif': {
    donor: '匸', host: [1, 2, 22], bend: [1, 4, 26],
    hostHash: '51a7d11c05b489d0305acf48e85192eea2652ab9d1d3890c55d7fc268c10a828',
    donorHash: 'c7bb0e4aee2ed35941778b1ebf9e6157aed8f27ea2d36e7d409f1b7c1c236a32',
  },
  'regular': {
    donor: '匹', host: [0, 12, 49], bend: [0, 36, 67],
    hostHash: '8e72db43ae2788f9ed8084d8b2f61a64067e4d83002f6e093bb07f11e99dbef3',
    donorHash: 'b28ca94670adccf355788413e77e9a665c1e3fba479f3fcb5c83cfa2a3c2e382',
  },
  'fangsong': {
    donor: '四', host: [0, 33, 3], bend: [1, 24, 33], stretch: [26, 28],
    hostHash: '27bb947f9fdd19422d09e77a73cc3d32428c194b1ba2bd3df64ef08fd47f2905',
    donorHash: '33df12917209b063c18cdae6fea39aaaa99f559f331f263251eb1f8440d6d505',
  },
  'pen-writing': {
    donor: '匸', host: [0, 31, 12], bend: [0, 22, 38],
    hostHash: 'a160d275562817e739d6717abcbe8c2464d0990ac52ed945bcbbf7a55217d119',
    donorHash: 'b1fec889891c0d2a7290929f9335180465f407b5e2f3da34d97fe30ab75bdfa1',
  },
}

export const siBendDonor = (/** @type {string} */ style) => cuts[style]?.donor

/** @typedef {[string, number[][]]} Segment */
/** @param {Segment} segment */
const endpoint = ([, points]) => points[points.length - 1]
/** @param {Segment[]} path */
const coordinates = path => Float64Array.from(path.flatMap(([, points]) => points.flat()))

/** Join the incoming and outgoing edges on the upright, above the donor's bend.
 * Only the middle of the short stroke in 四 needs extra length. Its corner and tip
 * travel intact to opposite ends of that span.
 * @param {Segment[]} host @param {Segment[]} donor @param {Cut} cut @returns {Segment[]}
 */
function graftBend(host, donor, cut) {
  const [, start, stop] = cut.host, [, from, to] = cut.bend
  const removed = start <= stop ? host.slice(start, stop + 1) : [...host.slice(start), ...host.slice(0, stop + 1)]
  /** @type {Segment[]} */
  const bend = [['L', [endpoint(donor[from])]], ...donor.slice(from + 1, to + 1)]
  const hostBox = pointsBox(coordinates(removed)), bendBox = pointsBox(coordinates(bend))
  const [outer, inner] = [endpoint(donor[from])[0], endpoint(donor[to])[0]].sort((a, b) => a - b)
  const [left, right] = [endpoint(host[start])[0], endpoint(host[stop])[0]].sort((a, b) => a - b)

  // Match the stem width, then fit the horizontal run to the host's right bearing.
  const stemScale = (right - left) / (inner - outer)
  const [lo, hi] = cut.stretch?.map(index => endpoint(donor[index])[0]) ?? [inner, bendBox[2]]
  const extra = (hostBox[2] - right) - (bendBox[2] - inner)
  const shiftY = hostBox[1] - bendBox[1]
  /** @param {number[]} point */
  const fit = ([x, y]) => [
    x <= inner ? left + (x - outer) * stemScale :
      right + (x - inner) + extra * Math.max(0, Math.min(1, (x - lo) / (hi - lo))),
    y + shiftY,
  ]
  /** @type {Segment[]} */
  const fitted = bend.map(([op, points]) => [op, points.map(fit)])
  if (start <= stop) return [...host.slice(0, start), ...fitted, ...host.slice(stop + 1)]
  return [['M', [endpoint(fitted[fitted.length - 1])]], ...host.slice(stop + 1, start), ...fitted]
}

/** @param {import('./compose.js').Composer} composer */
export function siChainForm(composer) {
  if (!Object.hasOwn(cuts, composer.fontStyle)) return null
  const cut = cuts[composer.fontStyle]
  if ([SI_CHAIN, '巳', '一', '𠃍', '㇄', cut.donor].some(key => composer.excluded(key))) return null
  const host = composer.glyphRecord('巳'), donor = composer.glyphRecord(cut.donor)
  if (host?.v !== 1 || donor?.v !== 1 ||
      hexOf(JSON.stringify(host.p)) !== cut.hostHash || hexOf(JSON.stringify(donor.p)) !== cut.donorHash) return null

  const glyph = partOf(host), contours = siCounterContours(glyph.contours, composer.fontStyle)
  const body = contours[cut.host[0]], stroke = partOf(donor).contours[cut.bend[0]]
  /** @param {'light' | 'heavy'} master */
  const splice = master => graftBend(
    /** @type {Segment[]} */ (segments(body.ops, body[master])),
    /** @type {Segment[]} */ (segments(stroke.ops, stroke[master])), cut)
  const light = splice('light'), heavy = splice('heavy')
  contours[cut.host[0]] = { ...body, ops: light.map(([op, points]) => [op, points.length, false]),
    light: coordinates(light), heavy: coordinates(heavy) }
  const part = { ...derived(glyph, contours, glyph.box), inkLength: partInk(glyph) }
  const { f, u, ink } = composer.rec('巳')
  return { part, f, u, ink, o: contours.length }
}
