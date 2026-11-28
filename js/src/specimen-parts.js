// @ts-nocheck
import { hexOf } from './sha256.js'
import { derived, joinedDrawing, mapped, partOf, partInk, placed } from './geometry.js'

// Measured ink boxes in a 1000-unit em. Each row belongs to one leaf of the written IDS.
const specimens = {
  // 壥
  '⿰土㕓': {
    styles: ['fangsong'],
    cells: [
      [['土', [10, 65, 328, 783], { host: '地', fallbackBox: [10, 65, 302, 783], digest: '6fd8d0c376ff12525c4fd7e26fd930c043f303b424f62fb2d1159ca0cc4933ae', indices: [1] }]],
      [['厂', [232, -81, 974, 830], { host: '厘', digest: '6118bc69b8bee48fd4afb61eec210a8803d92b95e3095678abb5c50e4ae2f707', indices: [0] }], ['墨', [434, -68, 976, 645]]],
    ],
  },
  // 𤬑
  '⿱㼌瓜': {
    styles: ['fangsong', 'pen-writing'],
    cells: [
      [['瓜', [46, 401, 472, 829]], ['瓜', [520, 401, 946, 829]]],
      [['瓜', [118, -72, 889, 361]]],
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
    for (const [ch, box, donor] of cell) {
      if (composer.excluded(ch)) return null
      const record = donor && !composer.excluded(donor.host) ? composer.glyphRecord(donor.host) : null
      const useCut = record?.v === 1 && hexOf(JSON.stringify(record.p)) === donor.digest
      const parent = useCut ? partOf(record) : null
      const glyph = parent ? derived(parent, donor.indices.map(i => parent.contours[i])) : composer.glyph(ch)
      if (!glyph) return null
      const weight = ch === '瓜' && composer.fontStyle === 'pen-writing' && cell.length === 1 ? [0.54, 0] : [0, 0]
      pieces.push({ ...placed(glyph, glyph.box, mapped(parent ? box : donor?.fallbackBox ?? box, [0, -120, 1000, 880], region),
        partInk(glyph), parent ? `${ch} from ${donor.host}` : `glyph ${ch}`, weight), fixed: true })
    }
    const origin = cell.some(([, , donor]) => donor)
      ? pieces.map(p => p.origin).join(' + ')
      : `components ${cell.map(([ch]) => ch).join('')}`
    out.push(pieces.length === 1 ? pieces[0] : joinedDrawing(pieces, origin))
  }
  return out
}
