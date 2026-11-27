import { cutContours, derived, mapped, partInk, partOf, placed } from './geometry.js'
import { hexOf } from './sha256.js'
import { reconnectStroke } from './stroke-donors.js'

export const walkingYou = '⿺#(㇋乀)由'
const operands = [walkingYou, '#(㇋乀)', '㇋', '乀', '由']

// Printed R+0A97: https://rare.glyphatlas.org/en/entry/2711#sighting-2875
// For handwriting, follow the short entry into the sweep seen in each face’s 迪.
// Cut the continuation below that join from 廴 in the same face’s 延.
/** @typedef {{ yan: string, contour: number, runs: number[][], inner: string,
 * digest: string, body: number[], inside: number[] }} WalkingCut */
/** @type {Record<string, WalkingCut>} */
const cuts = {
  regular: {
    yan: '1ccb6a08140282e5618bc5995684e35a89ce32a52df2289ba5d87637abfac21b',
    contour: 0, runs: [[0, 0, 96], [0, 113, 130]], inside: [.371, .260, .987, 1],
    inner: '廸', digest: '8a70c838e829ec6b5227d60619f140cfa0606d8e4b31b296c1b113920a8438de', body: [1, 2, 3, 4, 5],
  },
  fangsong: {
    yan: '949fd016fee24cc06b7e419fe1b59417e449f51aeff8e9437f144a013500afcc',
    contour: 0, runs: [[0, 0, 45]], inside: [.403, .255, .987, 1],
    inner: '迪', digest: 'e1f6b56e37645cd7d2e544638b251e3ecb79ce27d7871ed80516cdd71c7d081e', body: [1, 3, 4, 5],
  },
  'pen-writing': {
    yan: '38e04fa183b046237dc974dc1d15b8199c2de7a432867935d9de42386df4dde8',
    contour: 1, runs: [[1, 0, 55], [1, 62, 76]], inside: [.360, .271, .987, 1],
    inner: '廸', digest: 'ef14dfc19db2f5da28a37af260d11ed1a975a5253f58219b5f8878c0523cd00e', body: [0, 2, 3, 4, 5],
  },
}
const unit = [0, 0, 1, 1]
const frame = [0, 0, 1, .958]
/** @type {WeakMap<object, any>} */
const pieces = new WeakMap()

/** @param {string} style */
export const walkingYouDonors = style => Object.hasOwn(cuts, style) ? ['延', cuts[style].inner] : []

/** @param {import('./compose.js').Composer} composer @param {number[]} region */
export function walkingYouParts(composer, region) {
  const donors = walkingYouDonors(composer.fontStyle)
  if (!donors.length || [...operands, ...donors].some(ch => composer.excluded(ch))) return null
  const cut = cuts[composer.fontStyle], parts = []
  for (const [rccLeaf, char] of donors.entries()) {
    const record = composer.glyphRecord(char)
    if (record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== (rccLeaf ? cut.digest : cut.yan)) return null
    const glyph = partOf(record)
    let piece = pieces.get(glyph)
    if (!piece) {
      piece = cutContours(glyph, rccLeaf ? cut.body : [cut.contour])
      if (!rccLeaf) {
        const edge = reconnectStroke(glyph.contours, cut.runs)
        piece = { ...derived(piece, [edge]), strokes: piece.strokes }
      }
      pieces.set(glyph, piece)
    }
    const target = mapped(rccLeaf ? cut.inside : frame, unit, region)
    const origin = (rccLeaf ? '由' : '#(㇋乀)') + ' from ' + char
    parts.push({ ...placed(piece, piece.box, target, partInk(piece), origin), rccLeaf, fixed: true })
  }
  return parts
}
