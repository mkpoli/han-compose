// @ts-nocheck
import { joinedDrawing, mapped, partInk, placed } from './geometry.js'

// Five fits inside the hook. Its usable counter differs across the five outlines.
const guqinFiveBoxes = {
  sans: [300, -13, 721, 227],
  serif: [270, 3, 691, 243],
  fangsong: [325, 10, 715, 216],
  regular: [284, 2, 705, 242],
  'pen-writing': [279, -2, 700, 238],
}

function guqinCells(style) {
  // The Pen export's second master has lighter strokes.
  const direction = style === 'pen-writing' ? -1 : 1
  const leaf = (ch, box, amount) => [[ch, box, [direction * amount, direction * amount]]]
  return [
    leaf('大', [105, 434, 485, 808], 0.12),
    leaf('七', [524, 656, 855, 840], 0.5),
    leaf('六', [505, 421, 887, 633], 0.5),
    leaf('勹', [102, -96, 881, 397], -0.30),
    leaf('五', guqinFiveBoxes[style], 0.25),
  ]
}

// Measured ink boxes in a 1000-unit em. Each row belongs to one leaf of the written IDS.
const specimens = {
  // Guqin
  '〾⿱⿰大⿱七六⿵勹五': {
    styles: ['sans', 'serif', 'fangsong', 'regular', 'pen-writing'],
    cells: guqinCells,
  },
  // 𤬑
  '⿱㼌瓜': {
    styles: ['fangsong', 'pen-writing'],
    cells: [
      [['瓜', [46, 401, 472, 829]], ['瓜', [520, 401, 946, 829]]],
      [['瓜', [118, -72, 889, 361]]],
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
  if (!spec?.styles.includes(style)) return null
  return typeof spec.cells === 'function' ? spec.cells(style) : spec.cells
}

export function specimenParts(composer, node, region, keyOf) {
  const cells = specimenFor(node, composer.fontStyle, keyOf)
  if (!cells) return null
  for (const ch of node.flat(Infinity)) if (composer.excluded(ch)) return null
  const out = []
  for (const cell of cells) {
    const pieces = []
    for (const [ch, box, strokeWeight] of cell) {
      if (composer.excluded(ch)) return null
      const glyph = composer.glyph(ch)
      if (!glyph) return null
      const weight = ch === '瓜' && composer.fontStyle === 'pen-writing' && cell.length === 1 ? [0.54, 0] : [0, 0]
      pieces.push({ ...placed(glyph, glyph.box, mapped(box, [0, -120, 1000, 880], region),
        partInk(glyph), `glyph ${ch}`, strokeWeight ?? weight), fixed: true })
    }
    out.push(pieces.length === 1 ? pieces[0] : joinedDrawing(pieces, `components ${cell.map(([ch]) => ch).join('')}`))
  }
  return out
}
