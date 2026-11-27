import { derived, mapped, partInk, partOf, placed } from './geometry.js'
import { recordedInkBox } from './chain-ink.js'
import cuts from './host-chain-cuts.json' with { type: 'json' }
import { recordedNativeRecord } from './recorded-native.js'
import { reconnectStroke } from './stroke-donors.js'
import { hexOf } from './sha256.js'
import { parseChain } from './stroke-chain.js'

// Yi Bai, ids_lv2.txt, 2597437b. 馬 is ⿹⿷#(-一丨b𠃌)𰀁灬 and
// 島 is ⿱丿⿹⿷⿴#(一-𠃍丨b𠃌)一一山.
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv2.txt
const standardHosts = new Set(['#(-一丨b𠃌)', '#(一-𠃍丨b𠃌)'])

// Yi Bai, ids_lv0.txt at 2597437b, identifies the two sides of 亞, the
// frame of 臼, the triangle in 㐃, unhooked 了(s), the lower part of 之, and the two 辶
// forms. ⻎ in the Noto faces carries the bent stroke used by the H record.
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv0.txt
// Numbers select whole contours. Runs join the original light and heavy
// outline across the two ends of an attached stroke or bar.
const nativeCuts = /** @type {Record<string, {host: string, uprightGap?: Record<string, number[]>, faces: Record<string, [string, string | string[], (number | number[][])[]]>}>} */ (/** @type {unknown} */ (cuts))

/** @param {any} node @param {string} style */
export function chainHost(node, style) {
  return nativeCuts[node]?.faces[style]?.[0]
}

/** The two 亞 cuts have an upright on each side of a clear vertical strip.
 * Enlarge that strip to reach the standalone aspect ratio. The native strokes
 * outside it keep one scale in x and y, including their caps and serifs.
 * @param {any} piece @param {number[]} gap @param {number[]} box */
function widenUprightGap(piece, [left, right], box) {
  const [x0, y0, x1, y1] = piece.box
  const extra = (y1 - y0) * (box[2] - box[0]) / (box[3] - box[1]) - (x1 - x0)
  if (extra <= 0) return piece
  const spread = (/** @type {Float64Array} */ points) => points.map((v, i) =>
    i % 2 ? v : v + extra * Math.max(0, Math.min(1, (v - left) / (right - left))))
  return derived(piece, piece.contours.map((/** @type {any} */ c) =>
    ({ ...c, light: spread(c.light), heavy: spread(c.heavy) })))
}

// Both the standalone frame and the partitioned 馬 in R+07B4 use this outline.
/** @param {any} record @param {[string, string | string[], (number | number[][])[]] | undefined} cut
 * @param {string} digest */
function matchingPiece(record, cut, digest) {
  if (!cut || !(Array.isArray(cut[1]) ? cut[1].includes(digest) : cut[1] === digest)) return null
  const glyph = partOf(record)
  return derived(glyph, cut[2].map(index => typeof index === 'number'
    ? glyph.contours[index] : reconnectStroke(glyph.contours, index)))
}

/** @param {any} record @param {string} style */
export function horseFrame(record, style) {
  if (record?.v !== 1) return null
  return matchingPiece(record, nativeCuts['#(-一丨b𠃌)'].faces[style], hexOf(JSON.stringify(record.p)))
}

/** Place a leaf drawn from an attested host whose frame has its own contours.
 * @param {import('./compose.js').Composer} composer
 * @param {any} node @param {number[]} region @param {boolean} atRoot @param {string} [written] */
export function hostChainParts(composer, node, region, atRoot, written = node) {
  const source = nativeCuts[node]
  const cut = source?.faces[composer.fontStyle]
  const char = cut?.[0] ?? (standardHosts.has(node) ? source.host : undefined)
  if (!char || composer.excluded(node) || composer.excluded(char) || (source && composer.excluded(source.host))) return null
  const chain = parseChain(node)
  if (!chain || chain.strokes.some(({ char }) => composer.excluded(char))) return null
  const live = composer.glyphRecord(char)
  const record = live?.v === 1 ? live : cut && recordedNativeRecord(composer.fontStyle, char)
  if (!record) return null
  const digest = hexOf(JSON.stringify(record.p))
  let native = matchingPiece(record, cut, digest)
  // The original two Noto cuts were selected by their outline digest alone.
  if (!native && standardHosts.has(node)) {
    native = matchingPiece(record, source.faces.sans, digest) ?? matchingPiece(record, source.faces.serif, digest)
  }
  if (!native) return null
  const gap = source?.uprightGap?.[composer.fontStyle]
  const frame = gap && atRoot ? recordedInkBox(composer, written) : null
  const piece = gap && frame ? widenUprightGap(native, gap, frame) : native
  const target = atRoot ? mapped(frame ?? piece.box, composer.C.face, region) : region
  return [placed(piece, piece.box, target, partInk(piece), `chain ${node}, cut from ${char}`)]
}
