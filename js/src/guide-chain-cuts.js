import { derived, mapped, partInk, partOf, placed } from './geometry.js'
import { hexOf } from './sha256.js'
import { reconnectStroke } from './stroke-donors.js'

// Bai IDS guide §5.1, examples E009 and E00C (NightFurySL2001).
// https://nightfurysl2001.github.io/bai-ids/
// The cuts use the identified export outlines of 卬 and 母. In 母, each
// brush face draws the middle bar into both walls, with two counters.
const angled = '#(丿𠄌)'
const crossed = '#(-𠃌𠃊x0)'
const sources = new Map([
  [angled, { char: '卬', strokes: ['丿', '𠄌'] }],
  [crossed, { char: '母', strokes: ['𠃌', '𠃊'] }],
])
const angleCuts = new Map([
  ['766d4a1d9e457e41ba58231752f7382e764aec9149f8a09e45d58d68462429dd', [0, 2, 4]],
  ['29cc69b308e450249c83acfdabdb6d9feb968e599724511beb37080b1667f805', [2, 4, 5]],
  ['6395c859ef7228eca12bb693f54910d54db9109b009350cd77737161099c76ab', [0]],
  ['997c594d8172ffe7c1c8a05e48acf0f5e16575626d274198f6bbbac9545287a2', [1]],
  ['86c5c1cfd14b5f45f9b9d46471fa8cbb5691731831b38501e5af1b33c7ed3458', [0]],
])
const mother = new Map([
  ['cd5175c00bb55c4f932869d683312df979fcf09d7196600c7bf26e600d1727f9', [0, 1, 3, 4]],
  ['9fe924a9f84d5fa862e61a639b8f6c18562a42de23464e491342cf48c9b4b940', [2, 4, 5, 6]],
])

// Each run is [contour, first endpoint, last endpoint] through explicit
// pen segments. Keep the wall ends and reconnect across the omitted bar.
const joined = new Map([
  ['197b1ca06dae39d189ca6374f7525b1d8d2512c74ac643f8aa9e68fb97e7831d', [
    [[2, 18, 83], [2, 99, 126], [2, 0, 0]],
    [[3, 5, 15], [3, 0, 3], [4, 1, 12], [4, 0, 0]],
  ]],
  ['7c4f06fd121cb502ab303b66e70a04d3077585e935a696207657b3a4999ebe4b', [
    [[0, 61, 76], [0, 0, 19], [0, 29, 48]],
    [[1, 2, 6], [3, 0, 3]],
  ]],
  ['fa6a177837fe28f3f4f1d02c2645c6e20b5e2544de9cf75b07ca93750f4890ee', [
    [[0, 19, 36], [0, 49, 73], [0, 0, 9]],
    [[1, 4, 6], [1, 0, 3], [3, 1, 6]],
  ]],
])

/** @param {string} key */
export const guideChainDonor = key => sources.get(key)?.char

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region @param {boolean} [atRoot] */
export function guideChainParts(composer, key, region, atRoot = false) {
  const source = sources.get(key)
  if (!source || [key, source.char, ...source.strokes].some(stroke => composer.excluded(stroke))) return null
  const record = composer.glyphRecord(source.char)
  if (record?.v !== 1) return null
  const digest = hexOf(JSON.stringify(record.p))
  const indices = (key === angled ? angleCuts : mother).get(digest)
  const reconnects = key === crossed ? joined.get(digest) : null
  if (!indices && !reconnects) return null

  const glyph = partOf(record)
  const contours = indices ? indices.map(i => glyph.contours[i])
    : (reconnects ?? []).map(runs => reconnectStroke(glyph.contours, runs))
  const piece = derived(glyph, contours)
  // 卬 compresses the frame into half an em. Restore the standalone proportions
  // measured from the Bai guide U+E009 before matching the face's ink metrics.
  let target = region
  if (atRoot) {
    const face = composer.C.face
    const box = key === angled ? [133, -59, 882, 825] : piece.box
    target = mapped(box, face, region)
  }
  return [placed(piece, piece.box, target, partInk(piece), `chain ${key}, cut from ${source.char}`)]
}
