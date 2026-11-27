// @ts-nocheck
import { contourSections as outline, derived, mapped, partInk, partOf, placed } from './geometry.js'
import { hexOf } from './sha256.js'

const shapes = {
  serif: 'a599fa0d779f80e8202f3bd84b1d8faa530ee766cf6d9c09c41957d6ee23ff55',
  fangsong: '82b9705840f951beba0e0ce5c7bafbdc4e5037d4cb5b867e075f34f51150e39d',
  regular: '076ffccea73b98a6117eb417f9c9c2dd04f098f9c74331f01e2edd1f81d999f7',
}

export const usesGhostForm = (node, style) => Object.hasOwn(shapes, style) &&
  node[0] === '⿷' && node[1]?.[0] === '⿱' && node[1][1] === '田' &&
  node[1][2] === '儿' && node[2] === '厶' && !node.note && !node[1].note

function operandContours(c, style) {
  if (style === 'serif') {
    // Contour 8 is the short stroke above 田. Contour 7 is the dot in 厶.
    return [[c[0], c[1], c[2], c[3], c[5]], [c[9], c[10]], [c[4], c[6], c[7]]]
  }
  if (style === 'regular') {
    // 田 and both legs share an outline. Bridge the top stroke (commands 21–40)
    // and keep the four counters with 田. 厶 already has its own contour.
    return [
      [outline(c, [0, 0, 21], [0, 40, 65], [0, 116, 117]), ...c.slice(1, 5)],
      [outline(c, [0, 117, 142], [0, 0, 0]), outline(c, [0, 65, 116])],
      [c[5]],
    ]
  }
  // FangSong joins all three operands. The inner edge of the hook and the
  // upper edge of 厶 share counter 1. Cut both at the same endpoints.
  return [
    [outline(c, [0, 5, 19], [0, 30, 45], [1, 3, 7], [0, 90, 91]), c[2], c[3]],
    [outline(c, [0, 91, 95], [0, 0, 5]), outline(c, [0, 63, 90], [1, 7, 11])],
    [outline(c, [0, 45, 63], [1, 11, 13], [1, 0, 3])],
  ]
}

export function ghostParts(composer, node, region) {
  const style = composer.fontStyle
  if (!usesGhostForm(node, style) || ['鬼', '田', '儿', '厶'].some(ch => composer.excluded(ch))) return null
  const record = composer.glyphRecord('鬼')
  if (!record || hexOf(JSON.stringify(record.p)) !== shapes[style]) return null
  const donor = partOf(record)
  const whole = composer.place(donor, region, composer.ink('鬼'), 'glyph 鬼')
  // Keep the weight of the complete glyph across all three cuts, including Serif's variable master.
  if (composer.weighted && !composer.partial) {
    const stroke = composer.stroke
    composer.balance([whole])
    composer.stroke = stroke
  }
  return operandContours(donor.contours, style).map((contours, i) => {
    const part = derived(donor, contours)
    return { ...placed(part, part.box, mapped(part.box, donor.box, whole.target), partInk(part), '田儿厶'[i] + ' from 鬼', whole.weight), fixed: true }
  })
}
