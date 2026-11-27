import { derived, mapped, partInk, partOf, placed } from './geometry.js'
import { exportInkBox, recordedInkBox } from './chain-ink.js'
import cuts from './host-chain-cuts.json' with { type: 'json' }
import { recordedNativeRecord } from './recorded-native.js'
import { reconnectStroke } from './stroke-donors.js'
import { hexOf } from './sha256.js'
import { parseChain } from './stroke-chain.js'

// Yi Bai, ids_lv2.txt, 2597437b. 馬 is ⿹⿷#(-一丨b𠃌)𰀁灬 and
// 島 is ⿱丿⿹⿷⿴#(一-𠃍丨b𠃌)一一山.
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv2.txt
const notoFallbackFrames = new Set(['#(-一丨b𠃌)', '#(一-𠃍丨b𠃌)'])

// Yi Bai, ids_lv0.txt at 2597437b: 乐 contains #(丿𠃊), 官 contains 㠯,
// 氾 contains 㔾, and 周 contains ⺆. The latter three records supply outlines
// missing from the FangSong export.
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv0.txt#L81
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv0.txt#L3481
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv0.txt#L7743
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv0.txt#L1641
//
// Yi Bai, ids_lv0.txt at 2597437b, identifies the two sides of 亞, the
// frame of 臼, the triangle in 㐃, unhooked 了(s), the lower part of 之, and the two 辶
// forms. ⻎ in the Noto faces carries the bent stroke used by the H record.
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv0.txt
// Numbers select whole contours. Runs join the original light and heavy
// outline across the two ends of an attached stroke or bar.
const nativeCuts = /** @type {Record<string, {host: string, uprightGap?: Record<string, number[]>, strokeSpans?: Record<string, number[][][]>, faces: Record<string, [string, string | string[], (number | number[][])[]]>}>} */ (/** @type {unknown} */ (cuts))

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

/** Share the standalone size change between the recorded spans on each axis.
 * Outside these spans the two masters retain their native terminals and stroke widths.
 * @param {any} piece @param {number[][][]} spans @param {number[]} box */
function fitStrokeSpans(piece, spans, box) {
  const shifts = spans.map((ranges, axis) => {
    const change = (box[axis + 2] - box[axis]) - (piece.box[axis + 2] - piece.box[axis])
    return Math.max(change / ranges.length, ...ranges.map(([lo, hi]) => lo - hi))
  })
  const stretch = (/** @type {Float64Array} */ points) => points.map((value, i) => {
    const axis = i % 2
    let result = value
    for (const [lo, hi] of spans[axis]) {
      result += shifts[axis] * Math.max(0, Math.min(1, (value - lo) / (hi - lo)))
    }
    return result
  })
  return derived(piece, piece.contours.map((/** @type {any} */ c) =>
    ({ ...c, light: stretch(c.light), heavy: stretch(c.heavy) })))
}

/** @param {string} node @param {string} style @param {string} digest @param {boolean} allowNoto */
function cutFace(node, style, digest, allowNoto) {
  const faces = nativeCuts[node].faces
  // Some brush exports return the pinned Sans or Serif outline for this host.
  return (allowNoto ? [style, 'sans', 'serif'] : [style]).find(face => {
    const expected = faces[face]?.[1]
    return Array.isArray(expected) ? expected.includes(digest) : expected === digest
  })
}

/** @param {any} glyph @param {(number | number[][])[]} cuts */
function cutPiece(glyph, cuts) {
  return derived(glyph, cuts.map(index => typeof index === 'number'
    ? glyph.contours[index] : reconnectStroke(glyph.contours, index)))
}

/** Select the frame only after the exact donor has been identified. Layout
 * may adjust its coordinates before the editable operands are cut.
 * @param {any} record @param {string} style @param {boolean} allowNoto */
export function horseFrameCut(record, style, allowNoto) {
  if (record?.v !== 1) return null
  const node = '#(-一丨b𠃌)', face = cutFace(node, style, hexOf(JSON.stringify(record.p)), allowNoto)
  return face ? { face, frame: (/** @type {any} */ glyph) => cutPiece(glyph, nativeCuts[node].faces[face][2]) } : null
}

/** Place a leaf drawn from an attested host whose frame has its own contours.
 * @param {import('./compose.js').Composer} composer
 * @param {any} node @param {number[]} region @param {boolean} atRoot @param {string} [written] */
export function hostChainParts(composer, node, region, atRoot, written = node) {
  const source = nativeCuts[node]
  const cut = source?.faces[composer.fontStyle]
  const char = cut?.[0] ?? (notoFallbackFrames.has(node) ? source.host : undefined)
  if (!char || composer.excluded(node) || composer.excluded(char) || (source && composer.excluded(source.host))) return null
  const chain = parseChain(node)
  if (!chain || chain.strokes.some(({ char }) => composer.excluded(char))) return null
  const live = composer.glyphRecord(char)
  const record = live?.v === 1 ? live : cut && recordedNativeRecord(composer.fontStyle, char)
  if (!record) return null
  const digest = hexOf(JSON.stringify(record.p))
  const face = cutFace(node, composer.fontStyle, digest, notoFallbackFrames.has(node))
  if (!face) return null
  const native = cutPiece(partOf(record), source.faces[face][2])
  const gap = source?.uprightGap?.[composer.fontStyle]
  const spans = source.strokeSpans?.[face]
  // The exact donor has already passed all exclusions. Its standalone size
  // also applies when the caller excludes an unrelated glyph.
  const frame = atRoot && spans ? exportInkBox(composer.data?.manifest, written)
    : atRoot && gap ? recordedInkBox(composer, written) : null
  let piece = native
  if (spans && frame) piece = fitStrokeSpans(native, spans, frame)
  else if (gap && frame) piece = widenUprightGap(native, gap, frame)
  const target = atRoot ? mapped(frame ?? piece.box, composer.C.face, region) : region
  return [placed(piece, piece.box, target, partInk(piece), `chain ${node}, cut from ${char}`)]
}
