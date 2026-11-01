// @ts-nocheck
// Shape-specific font-derived forms. Keep the caller's IDS; encoded counterparts can vary by region.
import data from './component-forms.json' with { type: 'json' }
import constants from './constants.json' with { type: 'json' }
import { WINDING, commands, derived, makePart, mapped, partInk, placed, svgPath, union, windingOf, wound } from './geometry.js'

const styles = Object.fromEntries(Object.entries(data.forms).map(([style, forms]) => [style,
  new Map(Object.entries(forms).map(([text, groups]) => {
    const parts = groups.map(group => makePart(group.map(([ops, points]) => ({ ops: commands(ops), light: points, heavy: points }))))
    // A form's groups were cut from one glyph: its outermost contour winds them all alike, and a
    // group that is a counter stays opposite the groups it sits in.
    const back = windingOf(parts.flatMap(part => part.contours.map(c => c.light)))
    if (back && back !== WINDING) for (const part of parts) part.reverse = true
    return [text, { parts, frame: union(parts.map(p => p.box)), ink: parts.reduce((n, p) => n + partInk(p), 0) }]
  }))]))
const positions = Object.fromEntries(Object.entries(data.positions ?? {}).map(([style, entries]) => [style,
  new Map(Object.entries(entries).map(([name, group]) => [name,
    wound(makePart(group.map(([ops, points]) => ({ ops: commands(ops), light: points, heavy: points }))))]))]))
const editorialForms = new Map(Object.entries(data.editorial ?? {}).flatMap(([id, entry]) => entry.forms.map(text => [text, id])))
// Brush forms require an explicit Kureedo entry; bundled Sans forms must not replace them.
const forms = style => styles[style] ?? (style === 'kaisho' ? null : styles.sans)
export const containsComponentForm = (text, style = 'sans') => [...(forms(style)?.keys() ?? [])].some(key => text.includes(key))
export const isGroupedForm = (text, style = 'sans') => (forms(style)?.get(text)?.parts.length ?? 0) > 1
export const isComponentForm = (text, style = 'sans') => forms(style)?.has(text) ?? false
export function componentRecord(text, style = 'sans') {
  const form = forms(style)?.get(text)
  return form ? { ink: form.ink, o: form.parts.reduce((n, p) => n + p.contours.length, 0) } : null
}
export function componentParts(text, region = constants.face, style = 'sans', atRoot = true) {
  const form = forms(style)?.get(text)
  if (!form) return null
  const { parts, frame, ink } = form
  // Preserve the source font's em and placement for standalone forms. A crop
  // stays floating in that character space;
  // complete native glyphs retain their designed proportions and side bearings.
  // Nested forms use the description's contextual row/column allocation.
  const target = atRoot ? mapped(frame, constants.face, region) : region
  const font = style === 'kaisho' ? 'Kureedo' : `Noto ${style === 'serif' ? 'Serif' : 'Sans'} CJK`
  const editorial = editorialForms.get(text)
  const origin = editorial ? `${editorial} editorial (${font}): ${text}`
    : text === '⿰冫⿱丿丶' || text === '⿰冫⿾冫' ? 'four-dot repetition' : `${font}: ${text}`
  return parts.map(part => ({ ...placed(part, part.box, mapped(part.box, frame, target), ink, origin), fixed: true }))
}
export function componentDrawing(text, style = 'sans') {
  const parts = componentParts(text, constants.face, style)
  return parts ? { d: svgPath(parts), approximate: [] } : null
}

/** A native contextual cut fitted to a caller's placement, with its own stroke weights. */
export function componentPosition(name, target, style = 'sans', designHeight = null) {
  let part = positions[style]?.get(name)
  const originalInk = part && partInk(part)
  if (part && name === '儿:under-bar' && designHeight !== null) part = weightedLegs(part, style, designHeight)
  return part ? { ...placed(part, part.box, target, originalInk, style === 'kaisho' ? `Kureedo ${name}` : `Noto ${style} ${name}`), fixed: true, inkLength: originalInk } : null
}

/** Add weight above the original strokes, retaining the native outer edges and tapered sweep. */
function weightedLegs(part, style, height) {
  const sourceHeight = part.box[3] - part.box[1]
  const [native, desired] = style === 'serif' ? [62, 42] : [71, 60]
  const amount = Math.max(0, desired - native * height / sourceHeight) * sourceHeight / height
  if (!amount) return part
  // Keep the original contour intact; overlapping copies add weight on its inner side.
  const contours = [...part.contours]
  for (const contour of part.contours) {
    const pts = contour.light, n = pts.length / 2
    const left = Math.max(...Array.from({ length: n }, (_, i) => pts[i * 2])) < 500
    for (let step = 1; step <= 8; step++) {
      const points = Array.from(pts)
      for (let i = 0; i < n; i++) {
        const x = pts[i * 2], y = pts[i * 2 + 1], room = Math.max(0, part.box[3] - y)
        const taper = left ? Math.max(0, Math.min(1, (x - 85) / 170)) : 1
        const shift = amount * taper * step / 8
        points[i * 2 + 1] = y + (room ? room * shift / (room + shift) : 0)
      }
      contours.push({ ...contour, light: points, heavy: points })
    }
  }
  return derived(part, contours, part.box.slice())
}

export const componentPositionBox = (name, style = 'sans') => positions[style]?.get(name)?.box ?? null
