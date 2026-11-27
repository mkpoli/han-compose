import { centre, cutContours, derived, fitted, mapped, partInk, partOf, placed } from './geometry.js'
import { exportInkBox, recordedInkBox } from './chain-ink.js'
import { drawingChain } from './chain-corrections.js'
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
const nativeCuts = /** @type {Record<string, {host: string, standaloneNativeSize?: boolean, uprightGap?: Record<string, number[]>, strokeSpans?: Record<string, number[][][]>, standalonePen?: Record<string, {scale: number, rise: number}>, hookRun?: Record<string, number[]>, faces: Record<string, [string, string | string[], (number | number[][])[]]>}>} */ (/** @type {unknown} */ (cuts))

/** @param {any} node @param {string} style */
export function chainHost(node, style) {
  return nativeCuts[node]?.faces[style]?.[0]
}

/** A one-leaf grid uses the same native frame as ordinary standalone composition.
 * @param {import('./compose.js').Composer} composer @param {string} written @param {number[]} region */
export function standaloneHostParts(composer, written, region) {
  const node = drawingChain(written)
  return nativeCuts[node]?.standaloneNativeSize && !composer.excluded(written)
    ? hostChainParts(composer, node, region, true, written) : null
}

/** Place the complete native glyph so its bearings and weight survive layout.
 * Editable leaves take the final contours and transform of that same placement.
 * @param {import('./compose.js').Composer} composer @param {any} glyph @param {number[]} region
 * @param {string} host @param {string[]} leaves @param {number[][] | ((glyph: any) => any[])} groups */
export function partitionChainHost(composer, glyph, region, host, leaves, groups) {
  const whole = composer.place(glyph, region, composer.ink(host), `glyph ${host}`)
  if (!composer.separate) return [whole]
  const leafParts = (/** @type {any} */ final) => {
    const pieces = typeof groups === 'function' ? groups(final) : groups.map(indices => cutContours(final, indices))
    return pieces.map((piece, i) => [piece, `${leaves[i]} from ${host}`])
  }
  return [{ ...whole, rccLeaf: 0, rccLeafCount: leaves.length, leafParts }]
}

// In 官 the body sits under the roof. In 氾 the three water strokes and
// the two-stroke body share the placement of the native character.
const contextSpellings = new Map()
for (const recipe of [
  { style: 'regular', host: '官', op: '⿱', side: '宀', body: '㠯', chain: '#(一-𠃍丨b一-𠃍)', alias: '#(丨𠃍一𠃍一^v,0>4,3v4)' },
  { style: 'fangsong', host: '氾', op: '⿰', side: '氵', body: '㔾', chain: '#(-𠃌乚)', alias: '#(𠃌乚^)' },
]) {
  const strokes = parseChain(recipe.chain)?.strokes.map(stroke => stroke.char) ?? []
  for (const written of [recipe.chain, recipe.alias, recipe.body]) {
    const key = recipe.op + recipe.side + written
    const inputs = [key, recipe.host, recipe.side, recipe.body]
    if (written !== recipe.body) inputs.push(written, recipe.chain, recipe.op + recipe.side + recipe.chain, ...strokes)
    contextSpellings.set(key, { ...recipe, written, inputs })
  }
}

/** @param {string} key @param {string} style */
export function hostContextDonors(key, style) {
  const context = contextSpellings.get(key)
  return context?.style === style ? [context.host] : []
}

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function hostContextParts(composer, key, region) {
  const context = contextSpellings.get(key)
  if (!context || composer.fontStyle !== context.style) return null
  const { style, host, chain, side, written, inputs } = context
  if (inputs.some((/** @type {string} */ input) => composer.excluded(input))) return null
  const record = composer.glyphRecord(host), cut = nativeCuts[chain].faces[style]
  if (record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== cut[1]) return null
  const glyph = partOf(record), bodyContours = /** @type {number[]} */ (cut[2])
  // These bodies own whole contours. Every remaining contour belongs to the other operand.
  const sideContours = Array.from({ length: glyph.contours.length }, (_, i) => i).filter(i => !bodyContours.includes(i))
  return partitionChainHost(composer, glyph, region, host, [side, written], [sideContours, bodyContours])
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

/** Share the size change between the registered spans on each axis. A hook
 * attached to a widening bar moves horizontally with its anchor. The range
 * addresses the packed donor's [contour, first point, last point, anchor point].
 * @param {any} piece @param {number[][][]} spans @param {number[]} box @param {number[]} [hookRun]
 * @param {{scale: number, rise: number}} [pen] */
function fitStrokeSpans(piece, spans, box, hookRun, pen) {
  // A wide standalone Kai 㠯 retains the rising bars of 官. Allocate their
  // rise inside the target height before distributing space between counters.
  const scale = pen?.scale ?? 1
  const growth = spans.map((_, axis) =>
    (box[axis + 2] - box[axis]) / scale - (piece.box[axis + 2] - piece.box[axis]))
  const rise = growth[0] > 0 ? pen?.rise ?? 0 : 0
  growth[1] -= growth[0] * rise
  const shifts = spans.map((ranges, axis) => Math.max(growth[axis] / ranges.length, ...ranges.map(([lo, hi]) => lo - hi)))
  /** @param {number} axis @param {number} station */
  function shiftAt(axis, station) {
    let shift = 0
    for (const [lo, hi] of spans[axis]) shift += shifts[axis] * Math.max(0, Math.min(1, (station - lo) / (hi - lo)))
    return shift
  }
  return derived(piece, piece.contours.map((/** @type {any} */ c, /** @type {number} */ index) => {
    const hook = hookRun?.[0] === index ? hookRun : null
    /** @param {Float64Array} points */
    const stretch = points => points.map((value, i) => {
      const axis = i % 2
      const inHook = hook && axis === 0 && i >= 2 * hook[1] && i <= 2 * hook[2]
      // Carry the grown master by the same offsets so the donor retains its brush weight.
      const station = inHook ? c.light[2 * hook[3]] : hook ? c.light[i] : value
      const incline = axis === 1 && rise ? rise * shiftAt(0, points[i - 1]) : 0
      return value + shiftAt(axis, station) + incline
    })
    return { ...c, light: stretch(c.light), heavy: stretch(c.heavy) }
  }))
}

/** A nested frame can be narrowed or stacked again after its first placement.
 * Fit the finished slot with one pen scale. Keep at least half of every free span
 * so shortening the bars leaves room between their joins and terminals.
 * @param {any} part @param {number[][][]} spans */
function fitNestedStrokeSpans(part, spans) {
  const widths = [part.target[2] - part.target[0], part.target[3] - part.target[1]]
  if (widths.some(width => width <= 0)) return {}
  const native = part.part
  const scale = Math.min(1, ...spans.map((ranges, axis) => {
    const extent = native.box[axis + 2] - native.box[axis]
    // A translated inner hook projects into the free span beside its stem.
    // Scale a narrow slot uniformly to preserve that opening at the heaviest master.
    if (axis === 0 && part.hookRun) return widths[axis] / extent
    const shortest = Math.min(...ranges.map(([lo, hi]) => hi - lo))
    return widths[axis] / (extent - ranges.length * shortest / 2)
  }))
  const outline = fitStrokeSpans(native, spans, [0, 0, widths[0] / scale, widths[1] / scale], part.hookRun)
  return { part: outline, source: outline.box }
}

/** Apply registered span adjustments once, when the final slot is known and
 * before the composer chooses weights for the resulting proportions.
 * @param {any[]} parts */
export function fitNestedHostChains(parts) {
  for (const part of parts) if (part.strokeSpans) {
    Object.assign(part, fitNestedStrokeSpans(part, part.strokeSpans))
    delete part.strokeSpans
    delete part.hookRun
  }
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

/** The same flat foot serves as its own component and as the second operand in 乐.
 * @param {any} record */
export function leFrameCut(record) {
  if (record?.v !== 1) return null
  const digest = hexOf(JSON.stringify(record.p))
  for (const [face, [host, hash, indices]] of Object.entries(nativeCuts['#(丿𠃊)'].faces)) {
    if (host === '乐' && hash === digest) return { face, indices }
  }
  return null
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
  const origin = `chain ${node}, cut from ${char}`
  if (atRoot && source.standaloneNativeSize) {
    // The turn in 乐 spans the character. In isolation keep its width, height
    // and brush weight together, moving only its centre into the writing face.
    const from = centre(native.box), to = centre(composer.C.face)
    const frame = native.box.map((edge, i) => edge - from[i % 2] + to[i % 2])
    const target = fitted(native.box, mapped(frame, composer.C.face, region), 1)
    return [{ ...placed(native, native.box, target, partInk(native), origin), fixed: true, standaloneNativeSize: true }]
  }
  const gap = source?.uprightGap?.[composer.fontStyle]
  const spans = source.strokeSpans?.[face], hookRun = source.hookRun?.[face]
  // The exact donor has already passed all exclusions. Its standalone size
  // also applies when the caller excludes an unrelated glyph.
  let frame = atRoot && spans ? exportInkBox(composer.data?.manifest, written)
    : atRoot && gap ? recordedInkBox(composer, written) : null
  const pen = source.standalonePen?.[face]
  if (atRoot && pen && !frame) {
    const encoded = composer.glyphRecord(source.host)
    const original = encoded?.v === 1 ? partOf(encoded).box : native.box
    frame = fitted(original, composer.C.face, composer.C.STRETCH)
  }
  let piece = native
  if (spans && frame) piece = fitStrokeSpans(native, spans, frame, hookRun, pen)
  else if (gap && frame) piece = widenUprightGap(native, gap, frame)
  const target = atRoot ? mapped(frame ?? piece.box, composer.C.face, region) : region
  const placedFrame = placed(piece, piece.box, target, partInk(piece), origin)
  if (spans && !atRoot) return [{ ...placedFrame, strokeSpans: spans, hookRun }]
  return [placedFrame]
}
