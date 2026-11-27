// @ts-nocheck
// Shape-specific font-derived forms. Keep the caller's IDS; encoded counterparts can vary by region.
import { containsRateForm } from './rate-forms.js'
import generated from './component-forms.json' with { type: 'json' }
import overrides from './component-forms-overrides.json' with { type: 'json' }
import inwardGrass from './inward-grass-forms.json' with { type: 'json' }
import splitGrass from './split-grass-forms.json' with { type: 'json' }
import dotForms from './ucv-dot-forms.json' with { type: 'json' }
import muNet from './mu-net-forms.json' with { type: 'json' }
import numbered from '../data/numbered-forms.json' with { type: 'json' }
import { joinedComponentForm } from './constructs.js'
import waterEnclosure from './water-enclosure.json' with { type: 'json' }
import constants from './constants.json' with { type: 'json' }
import { WINDING, commands, derived, makePart, mapped, partInk, placed, svgPath, union, windingOf, wound } from './geometry.js'

// Forms cut by hand from TW-Kai and the components every face draws from them, outside the
// generated Noto and brush forms.
const data = {
  ...generated,
  forms: { ...generated.forms, ...overrides.forms },
  native: { ...generated.native, ...overrides.native },
  sources: { ...generated.sources, ...overrides.sources },
  donors: { ...generated.donors, ...overrides.donors },
  force: { ...generated.force, ...overrides.force },
  replace: { ...generated.replace, ...overrides.replace },
}
const formOf = groups => {
  const parts = groups.map(group => makePart(group.map(([ops, points]) => ({ ops: commands(ops), light: points, heavy: points }))))
  // A form's groups were cut from one glyph: its outermost contour winds them all alike, and a
  // group that is a counter stays opposite the groups it sits in.
  const back = windingOf(parts.flatMap(part => part.contours.map(c => c.light)))
  if (back && back !== WINDING) for (const part of parts) part.reverse = true
  return { parts, frame: union(parts.map(p => p.box)), ink: parts.reduce((n, p) => n + partInk(p), 0) }
}
// A `native` form gives a description its parts and nothing else: an encoded character that holds it
// keeps its own glyph, and the layout reads what the export records of the description.
const styles = Object.fromEntries(Object.entries(data.forms).map(([style, forms]) => [style,
  new Map(Object.entries(forms).map(([text, groups]) => [text, { ...formOf(groups), native: data.native?.[style]?.includes(text) ?? false }]))]))
for (const [style, groups] of Object.entries(splitGrass)) styles[style].set('⺿', formOf(groups))
for (const [style, groups] of Object.entries(inwardGrass)) styles[style].set('⻀', formOf(groups))
// Adobe-Japan1 and Hanyo-Denshi register each of the two dot orientations.
for (const [style, characters] of Object.entries(dotForms.dots)) {
  for (const [char, pair] of Object.entries(characters)) {
    pair.forEach((contours, i) => {
      const form = { ...formOf([contours]), atomic: true }
      for (const selector of [0xE0100 + i, 0xE0102 + i]) {
        styles[style].set(char + String.fromCodePoint(selector), form)
      }
    })
  }
}
// Whole-character fits for composed IDS. Leave operand-based layouts to the normal renderer.
for (const [style, sequences] of Object.entries(dotForms.ids)) {
  for (const [sequence, contours] of Object.entries(sequences)) {
    styles[style].set(sequence, formOf([contours]))
  }
}
// The manuscript's water, enclosing 木 and net. Both descriptions share the same outlines.
for (const [style, groups] of Object.entries(muNet)) {
  const form = formOf(groups)
  styles[style].set('⿰氵⿺木罒', form)
  const [water, wood, net] = groups
  styles[style].set('⿺沐罒', formOf([[...water, ...wood], net]))
}
// 潮語十五音: the bends sit above the sweeping foot of 水. Zhuque supplies both bends from 巛.
for (const [style, groups] of Object.entries(waterEnclosure)) styles[style].set('⿺水巜', { ...formOf(groups), donors: ['水', style === 'fangsong' ? '巛' : '巜'] })
// Numbered components draw in the palette tile only. Keeping their forms out of `styles` leaves the
// composer's glyph records reachable for separated and cell layouts; the sequence itself draws from
// `numbered-sans-outlines.json.gz` in the surface source.
const numberedStyles = Object.fromEntries(Object.entries(numbered.forms).map(([style, entries]) => [style,
  new Map(Object.entries(entries).map(([text, groups]) => [text, formOf(groups)]))]))
const numberedDrawing = (text, style) => numberedStyles[style]?.get(text) ?? null
const positions = Object.fromEntries(Object.entries(data.positions ?? {}).map(([style, entries]) => [style,
  new Map(Object.entries(entries).map(([name, group]) => [name,
    wound(makePart(group.map(([ops, points]) => ({ ops: commands(ops), light: points, heavy: points }))))]))]))
const editorialForms = new Map(Object.entries(data.editorial ?? {}).flatMap(([id, entry]) => entry.forms.map(text => [text, id])))
/** Faces whose bundled forms come only from their own font: Noto's must not stand in for them. @param {string} style */
export const ownFormsOnly = style => style === 'regular' || style === 'pen-writing' || style === 'fangsong'
const forms = style => styles[style] ?? (ownFormsOnly(style) ? null : styles.sans)
export const containsComponentForm = (text, style = 'sans') => containsRateForm(text) || [...(forms(style)?.entries() ?? [])].some(([key, form]) => !form.native && text.includes(key))
export const isAtomicForm = (text, style) => forms(style)?.get(text)?.atomic === true
export const isGroupedForm = (text, style = 'sans') => (forms(style)?.get(text)?.parts.length ?? 0) > 1
export const isComponentForm = (text, style = 'sans') => forms(style)?.has(text) ?? false
/** Whether `text` has a native form in `style`: one that keeps what the export knows of it. */
export const isNativeForm = (text, style = 'sans') => forms(style)?.get(text)?.native ?? false
/** Whether `text` holds a component whose form replaces the encoded character's own outline. */
export const hasForcedForms = style => Boolean(data.force?.[style]?.length || data.replace?.[style]?.length)
export const containsForcedForm = (text, style = 'sans') =>
  (data.force?.[style] ?? []).some(form => text.includes(form))
/** A character whose own glyph is kept, with only a component replaced. */
export const isForcedCharacter = (text, style = 'sans') => (data.replace?.[style] ?? []).includes(text)
export function componentRecord(text, style = 'sans') {
  const form = forms(style)?.get(text)
  // A cut form carries what the layout reads of its component: usual boxes by place and shape features.
  return form ? { ink: form.ink, o: form.parts.reduce((n, p) => n + p.contours.length, 0), ...form.record } : null
}
/**
 * Forms cut from characters for components no code point names (a zi.tools stroke chain, a CHISE
 * entity), by their own text, loaded with `custom-forms.json.gz` once a sequence names one. A form
 * written above stays where both have one; TW-Kai, Wen Kai and Fangsong take none, having no cut of their own.
 * @param {{ forms?: Record<string, Record<string, { g: any[], from: string, face: string, record?: object }>> }} data
 */
export function addCutForms(data) {
  for (const [style, entries] of Object.entries(data?.forms ?? {})) {
    const map = ownFormsOnly(style) ? null : styles[style]
    if (!map) continue
    for (const [text, entry] of Object.entries(entries)) {
      if (!map.has(text)) map.set(text, { ...formOf(entry.g), origin: `${entry.face}: ${text}, cut from ${entry.from}`, record: entry.record })
    }
  }
}
export function componentParts(text, region = constants.face, style = 'sans', atRoot = true, exclude = undefined) {
  const form = forms(style)?.get(text)
  if (!form || form.donors?.some(char => exclude?.has(char))) return null
  const { frame, ink } = form
  const parts = joinedComponentForm(text, style, form.parts)
  // Preserve the source font's em and placement for standalone forms. A crop
  // stays floating in that character space;
  // complete native glyphs retain their designed proportions and side bearings.
  // Nested forms use the description's contextual row/column allocation.
  const target = atRoot ? mapped(frame, constants.face, region) : region
  const font = style === 'regular' ? 'TW-Kai' : style === 'pen-writing' ? 'Kureedo' : style === 'fangsong' ? 'Zhuque Fangsong' : `Noto ${style === 'serif' ? 'Serif' : 'Sans'} CJK`
  const editorial = editorialForms.get(text)
  const origin = form.origin ?? (editorial ? `${editorial} editorial (${font}): ${text}`
    : text === '⿰冫⿱丿丶' || text === '⿰冫⿾冫' ? 'four-dot repetition' : `${font}: ${text}`)
  return parts.map(part => ({ ...placed(part, part.box, mapped(part.box, frame, target), ink, origin), fixed: true }))
}
export function componentDrawing(text, style = 'sans') {
  const form = numberedDrawing(text, style)
  if (form) {
    const parts = form.parts.map(part => placed(part, part.box, mapped(part.box, form.frame, constants.face), form.ink, `${style}: ${text}`))
    return { d: svgPath(parts), approximate: [] }
  }
  const parts = componentParts(text, constants.face, style)
  return parts ? { d: svgPath(parts), approximate: [] } : null
}

/** A native contextual cut fitted to a caller's placement, with its own stroke weights. */
export function componentPosition(name, target, style = 'sans', designHeight = null) {
  let part = positions[style]?.get(name)
  const originalInk = part && partInk(part)
  if (part && name === '儿:under-bar' && designHeight !== null) part = weightedLegs(part, style, designHeight)
  return part ? { ...placed(part, part.box, target, originalInk, style === 'pen-writing' ? `Kureedo ${name}` : `Noto ${style} ${name}`), fixed: true, inkLength: originalInk } : null
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
