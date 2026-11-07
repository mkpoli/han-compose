// @ts-check
// The 二简字 (Second Round draft) glyphs the composer can only approximate: a description such as
// ⿰忄井 for 警 is written out of parts, so the layout stretches a crop of 快 and 阱 into place, and
// the result is no one's handwriting. The draft drew each form whole, and the outlines here are
// those drawings, taken from the glyphs Andrew West's table gives for them.
//
// Glyphs: BabelStone Han PUA by Andrew West, Arphic Public License, fonts/LICENSE-BabelStoneHanPUA.txt.
// Table: https://www.babelstone.co.uk/Fonts/Erjian.html, the entry number of each form.
import glyphs from '../data/erjian-glyphs.json' with { type: 'json' }

/** @typedef {import('./index.js').Drawing} Drawing */

/**
 * Whether a description has a draft glyph of its own.
 * @param {string} sequence
 */
export const hasErjian = sequence => Object.hasOwn(glyphs, sequence)

/**
 * The draft's drawing of a description, in the shape the composer answers with: one whole glyph, so
 * the parts and the placeholders are empty. Null where the draft drew no such form.
 * @param {string} sequence
 * @returns {Drawing | null}
 */
export function erjianDrawing(sequence) {
  const glyph = /** @type {Record<string, { table: string, character: string, codepoint: string, d: string }>} */ (glyphs)[sequence]
  if (!glyph) return null
  return {
    d: glyph.d,
    cut: '',
    slots: [],
    stroke: [70, 70],
    parts: [],
    origins: [`erjian ${glyph.table}`],
    approximate: [],
  }
}

/**
 * The character a draft form was made for, and the table entry and glyph it is recorded under.
 * @param {string} sequence
 */
export function erjianEntry(sequence) {
  const glyph = /** @type {Record<string, { table: string, character: string, codepoint: string }>} */ (glyphs)[sequence]
  if (!glyph) return null
  const { table, character, codepoint } = glyph
  return { table, character, codepoint }
}
