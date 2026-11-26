import { derived, mapped, partInk, partOf, placed } from './geometry.js'
import { hexOf } from './sha256.js'

// The five glyphs in RCC sighting 2875 show the sweep crossing the last
// downstroke of ㇋. The folded stroke extends below the junction on the left.
// https://rare.glyphatlas.org/en/entry/2711#sighting-2875
export const walkingYou = '⿺#(㇋乀)由'
const operands = ['#(㇋乀)', '㇋', '乀', '由']
/** @type {Record<string, [string, string, number[], number[]][]>} */
const cuts = {
  regular: [['廸', '8a70c838e829ec6b5227d60619f140cfa0606d8e4b31b296c1b113920a8438de', [0], [1, 2, 3, 4, 5]]],
  fangsong: [
    ['廻', '63cf5ed51792c8cba15db0ca97d5c2bd758c2ad364a4e6fd2a966f89d71cae61', [0], []],
    ['迪', 'e1f6b56e37645cd7d2e544638b251e3ecb79ce27d7871ed80516cdd71c7d081e', [], [1, 3, 4, 5]],
  ],
  'pen-writing': [['廸', 'ef14dfc19db2f5da28a37af260d11ed1a975a5253f58219b5f8878c0523cd00e', [1], [0, 2, 3, 4, 5]]],
}

// Ink bounds of the outer and inner parts in the first sighting glyph, y upwards.
const frame = [5, -43, 45, -2]
// The brush faces rise earlier along the sweep. Raise the lower edge of 由
// by three scan pixels to retain the gap beside its lower-left corner.
const slots = [[5, -43, 45, -5], [21, -33.5, 44, -2]]

/** @param {string} style */
export const walkingYouDonors = style => Object.hasOwn(cuts, style) ? cuts[style].map(([char]) => char) : []

/** @param {import('./compose.js').Composer} composer @param {number[]} region */
export function walkingYouParts(composer, region) {
  const entries = Object.hasOwn(cuts, composer.fontStyle) && cuts[composer.fontStyle]
  if (!entries || [walkingYou, ...operands].some(ch => composer.excluded(ch))) return null
  const parts = []
  for (const [char, digest, outer, inner] of entries) {
    if (composer.excluded(char)) return null
    const record = composer.glyphRecord(char)
    if (record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== digest) return null
    const glyph = partOf(record)
    for (const [rccLeaf, indices] of [outer, inner].entries()) {
      if (!indices.length) continue
      const piece = derived(glyph, indices.map(i => glyph.contours[i]))
      const target = mapped(slots[rccLeaf], frame, region)
      const origin = (rccLeaf ? '由' : '#(㇋乀)') + ' from ' + char
      parts.push({ ...placed(piece, piece.box, target, partInk(piece), origin), rccLeaf, fixed: true })
    }
  }
  return parts
}
