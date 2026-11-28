// @ts-nocheck
import { joinedDrawing, mapped, partInk, placed } from './geometry.js'

// Measured ink boxes in a 1000-unit em. Each row belongs to one leaf of the written IDS.
const specimens = {
  // 𤬑
  '⿱㼌瓜': {
    styles: ['fangsong', 'pen-writing'],
    cells: [
      [['瓜', [46, 401, 472, 829]], ['瓜', [520, 401, 946, 829]]],
      [['瓜', [118, -72, 889, 361]]],
    ],
  },
  // JYN00001
  '⿹⿺㇉一卄': {
    styles: ['serif', 'fangsong', 'pen-writing'],
    cells: [
      [['㇉', [337, -65, 927, 802]]],
      [['一', [418, 603, 757, 718]]],
      [['一', [38, 122, 605, 210]], ['丨', [274, 35, 348, 318]], ['丨', [461, 7, 533, 310]]],
    ],
  },
}
const roots = new Set(Object.keys(specimens).map(key => [...key][0]))
export const containsSpecimen = (key, style) => Object.entries(specimens).some(([seq, plan]) => plan.styles.includes(style) && key.includes(seq))

export function specimenFor(node, style, keyOf) {
  if (!Array.isArray(node) || !roots.has(node[0])) return null
  const spec = specimens[keyOf(node)]
  return spec?.styles.includes(style) ? spec.cells : null
}

export function specimenParts(composer, node, region, keyOf) {
  const cells = specimenFor(node, composer.fontStyle, keyOf)
  if (!cells) return null
  for (const ch of node.flat(Infinity)) if (composer.excluded(ch)) return null
  const out = []
  for (const cell of cells) {
    const pieces = []
    for (const [ch, box] of cell) {
      if (composer.excluded(ch)) return null
      const glyph = composer.glyph(ch)
      if (!glyph) return null
      // The Serif hook returns farther right than the two brush hooks in the specimen.
      // Extend the right post of 卄 until its foot meets that return.
      const target = composer.fontStyle === 'serif' && ch === '丨' && cell.length === 3 && pieces.length === 2
        ? [box[0] + 132, box[1] - 45, box[2] + 132, box[3]] : box
      const weight = ch === '瓜' && composer.fontStyle === 'pen-writing' && cell.length === 1 ? [0.54, 0] : [0, 0]
      pieces.push({ ...placed(glyph, glyph.box, mapped(target, [0, -120, 1000, 880], region),
        partInk(glyph), `glyph ${ch}`, weight), fixed: true })
    }
    out.push(pieces.length === 1 ? pieces[0] : joinedDrawing(pieces, `components ${cell.map(([ch]) => ch).join('')}`))
  }
  return out
}
