// @ts-nocheck
import { joinedDrawing, mapped, partInk, placed } from './geometry.js'

// Measured ink boxes in a 1000-unit em. Each row belongs to one leaf of the written IDS.
const specimens = {
  // 園
  '⿴囗⿱エン': {
    styles: ['regular'],
    cells: [
      [['囗', [113, -71, 900, 801]]],
      [['エ', [253, 395, 753, 636]]],
      [['ン', [261, 87, 740, 347]]],
    ],
  },
  // JYN00003
  '⿳宀⿰丨⿴⿻冂一一⿹𠃌灬': {
    styles: ['fangsong', 'regular'],
    cells: [
      [['宀', [96, 570, 877, 849]]],
      [['丨', [237, 201, 295, 550]]],
      [['冂', [389, 203, 648, 628]]],
      [['一', [389, 433, 644, 490]]],
      [['一', [389, 314, 644, 367]]],
      [['𠃌', [235, -88, 854, 291]]],
      [['灬', [141, 18, 673, 157]]],
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
      pieces.push({ ...placed(glyph, glyph.box, mapped(box, [0, -120, 1000, 880], region),
        partInk(glyph), `glyph ${ch}`), fixed: true })
    }
    out.push(pieces.length === 1 ? pieces[0] : joinedDrawing(pieces, `components ${cell.map(([ch]) => ch).join('')}`))
  }
  return out
}
