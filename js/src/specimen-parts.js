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
  // 𫜵
  '⿴𰀪⺀': {
    styles: ['fangsong', 'regular'],
    cells: [
      [['丿', [105, 455, 614, 806]], ['丿', [133, -76, 891, 469]]],
      [['丶', [438, 333, 592, 445]], ['丶', [300, 176, 451, 289]]],
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
      let glyph = composer.glyph(ch), origin = `glyph ${ch}`
      if (ch === '丿' && cell.length === 2) {
        const rec = !composer.excluded('彡') && composer.glyphRecord('彡')
        const source = composer.fontStyle === 'fangsong' ? ['c7a877801a49e4366e576bfa213413bd93bcd85de0bb44fe8d31b6e9dbfbb33f', [2, 0]] : ['70c4ce24513a01606667bfa0a4a47821af49d1cf609840de1ef9202852cbc16a', [0, 2]]
        if (rec && hexOf(JSON.stringify(rec.p)) === source[0]) {
          const donor = partOf(rec)
          glyph = derived(donor, [donor.contours[source[1][pieces.length]]])
          origin = 'host 彡'
        }
      }
      if (!glyph) return null
      const weight = ch === '瓜' && composer.fontStyle === 'pen-writing' && cell.length === 1 ? [0.54, 0] : [0, 0]
      pieces.push({ ...placed(glyph, glyph.box, mapped(box, [0, -120, 1000, 880], region),
        partInk(glyph), origin, weight), fixed: true })
    }
    const origin = pieces.every(part => part.origin === 'host 彡') ? 'host 彡' : `components ${cell.map(([ch]) => ch).join('')}`
    out.push(pieces.length === 1 ? pieces[0] : joinedDrawing(pieces, origin))
  }
  return out
}
