// @ts-nocheck
import { hexOf } from './sha256.js'
import { derived, partOf, joinedDrawing, mapped, partInk, placed } from './geometry.js'

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
  // 𰻞
  '⿺辶⿳穴⿰月⿰⿲⿱幺長⿱言馬⿱幺長刂心': {
    styles: ['fangsong', 'regular', 'pen-writing'],
    cells: [
      [['辶', [38, -68, 964, 724]]],
      [['穴', [345, 663, 931, 833]]],
      [['月', [325, 292, 439, 644]]],
      [['幺', [453, 492, 571, 655]]],
      [['長', [452, 273, 575, 481]]],
      [['言', [567, 490, 694, 708]]],
      [['馬', [576, 277, 702, 486]]],
      [['幺', [711, 492, 827, 656]]],
      [['長', [709, 273, 826, 481]]],
      [['刂', [840, 273, 928, 646]]],
      [['心', [352, 151, 928, 263]]],
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
  if (composer.fontStyle === 'pen-writing' && keyOf(node) === '⿺辶⿳穴⿰月⿰⿲⿱幺長⿱言馬⿱幺長刂心' && !composer.excluded('𰻞')) {
    // Eleven disjoint sets cover all 31 contours of the font's own 𰻞, including the counters.
    const native = composer.glyphRecord('𰻞')
    if (native && hexOf(JSON.stringify(native.p)) === 'd574e810412ab42e1b8ae1a37c1bce453ae36d79adf7f71bc8d84579324480d7') {
      const glyph = partOf(native)
      const cuts = [[28, 30], [27, 29], [24, 25, 26], [16], [18], [3, 4, 5, 6, 7, 15],
        [2, 8, 9, 10, 11, 12, 13, 14], [17], [0], [1, 23], [19, 20, 21, 22]]
      return cuts.map(indices => {
        const cut = derived(glyph, indices.map(i => glyph.contours[i]))
        return { ...placed(cut, cut.box, mapped(cut.box, composer.C.face, region),
          partInk(cut), 'host 𰻞'), fixed: true }
      })
    }
  }
  const out = []
  for (const cell of cells) {
    const pieces = []
    for (const [ch, box] of cell) {
      if (composer.excluded(ch)) return null
      const glyph = composer.glyph(ch)
      if (!glyph) return null
      const weight = ch === '瓜' && composer.fontStyle === 'pen-writing' && cell.length === 1 ? [0.54, 0] : [0, 0]
      pieces.push({ ...placed(glyph, glyph.box, mapped(box, [0, -120, 1000, 880], region),
        partInk(glyph), `glyph ${ch}`, weight), fixed: true })
    }
    out.push(pieces.length === 1 ? pieces[0] : joinedDrawing(pieces, `components ${cell.map(([ch]) => ch).join('')}`))
  }
  return out
}
