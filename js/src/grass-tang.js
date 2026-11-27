// @ts-nocheck: the pen glyph records carry both synthetic masters.
import { contourSections, cutContours, derived, drawnContours, groupRings, mapped, partOf, placed, pointsBox, union } from './geometry.js'
import { hexOf } from './sha256.js'

export const isGrassTang = key => key === '䕋' || key === '⿱艹塘'
const outlines = [
  ['䕋', '41fe0e171f99af334c530521fd232c29532c4f566d3435eb8f064f148ce2f740'],
  ['蓎', 'eb7ba05a55801eb372937c7cc2d3162d4aca511c28901a50a5bad7afdfd362fe'],
]
const native = part => placed(part, part.box, part.box, 0, '')
const bounds = group => union(groupRings(group, 24).map(pointsBox))

function contoursIn(part, room) {
  const fitted = { ...part, target: mapped(part.target, bounds([part]), room) }
  const light = drawnContours(fitted), heavy = drawnContours({ ...fitted, weight: [1, 1] })
  return part.part.contours.map((c, i) => ({ ...c, light: light[i], heavy: heavy[i] }))
}

export function penGrassTang(parts, composer, key, balanced = false) {
  if (composer.fontStyle !== 'pen-writing' || composer.partial || !isGrassTang(key) ||
      !parts.length || parts.length > 2 || ['艹', '塘', '䕋', '蓎', '⿱艹塘'].some(c => composer.excluded(c))) return parts
  const records = outlines.map(([c]) => composer.glyphRecord(c))
  if (!records.every((g, i) => g?.v === 1 && hexOf(JSON.stringify(g.p)) === outlines[i][1])) return parts
  const [source, reference] = records.map(g => partOf(g))
  // 蓎 has a detached grass head and a short dot growing from the roof of 广.
  // The two sides of the dot meet the roof at commands 22 and 2.
  const top = native(cutContours(reference, [4]))
  const grass = derived(source, contoursIn(top, mapped(bounds([top]), bounds([native(reference)]), bounds([native(source)]))))
  const dot = native(derived(reference, [contourSections(reference.contours, [5, 22, 26], [5, 0, 2])]))
  // In these verified outlines the old dot is centred at x606. The dot in 蓎
  // projects to x537 inside this head. Their midpoint clears the grass leg and
  // keeps the dot over 唐. Its foot follows the shelf near (571, 500).
  const lower = derived(source, [...source.contours.slice(0, 6), ...contoursIn(dot, [546, 497, 596, 565])])
  const split = parts.length === 2 || (key === '⿱艹塘' && composer.separate)
  const glyphs = split ? [grass, lower] : [derived(source, [...lower.contours, ...grass.contours])]
  const previous = parts.map(p => ({ ...p })), stroke = composer.stroke
  try {
    if (composer.staticFace && !balanced) composer.staticBalance(previous)
  } finally {
    composer.stroke = stroke
  }
  const frame = bounds(previous), model = bounds(glyphs.map(native))
  return glyphs.map((glyph, i) => ({
    ...parts[Math.min(i, parts.length - 1)], part: glyph, source: glyph.box, target: mapped(glyph.box, model, frame),
    origin: split ? ['艹 from 蓎', '塘 from 䕋 and 蓎'][i] : '䕋 with 唐 dot from 蓎', weight: [0, 0], fixed: true,
  }))
}

// Some side-by-side placements seat the complete native glyph directly. Only
// replace the identical decoded glyph. A donor cut may share its origin label.
export function finishGrassTang(part, composer) {
  if (part.origin !== 'glyph 䕋' || part.cut || part.part !== composer.glyph('䕋')) return
  const raw = { ...part, flips: undefined }
  const [drawing] = penGrassTang([raw], composer, '䕋', true)
  if (drawing !== raw) Object.assign(part, drawing, { flips: part.flips })
}
