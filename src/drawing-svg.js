// @ts-check
// A drawing as a file of its own: an SVG of its ink on a background, with the placeholders of empty
// slots, the way the editor draws them. Nothing but SVG commands and finite numbers reaches the
// file, whatever the drawing holds.
import { placeholder, STROKE } from './slot-placeholder.js'

/** The filter that turns an emoji's ink into a hole in what ㇯ subtracts it from. */
export const EMOJI_CUT_MATRIX = '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'

/** Font size that draws an emoji's ink the shorter side of its box across: Noto Emoji's glyphs fill
 *  the em square, 2,080 of its 2,048 units against an advance of 2,784, so a size of 1 draws 0.73 of
 *  the box, and 1/0.73 the whole box. */
export const EMOJI_SCALE = 1.36

/** Where an emoji stands in its box: `{ x, y, size }`, its middle and its font size, all finite.
 *  @param {{ box?: number[] } | null | undefined} item @returns {{ x: number, y: number, size: number }} */
export function emojiPlace(item) {
  const [x, y, width, height] = [0, 1, 2, 3].map(at => { const value = Number(item?.box?.[at]); return Number.isFinite(value) ? value : 0 })
  return { x: x + width / 2, y: y + height / 2, size: Math.max(0, Math.min(width, height) * EMOJI_SCALE) }
}

/** Reflect an emoji around the centre of its layout box; a box that is not four finite numbers has no reflection.
 * @param {{ box?: number[], flip?: [boolean, boolean] }} item */
export function emojiTransform(item) {
  const [flipX, flipY] = item.flip ?? []
  if (!flipX && !flipY) return ''
  const box = Array.isArray(item.box) ? item.box.slice(0, 4) : []
  if (box.length < 4 || !box.every(value => Number.isFinite(Number(value)))) return ''
  const [x, y, width, height] = box.map(value => Math.round(Number(value) * 1000) / 1000)
  return `translate(${flipX ? 2 * x + width : 0} ${flipY ? 2 * y + height : 0}) scale(${flipX ? -1 : 1} ${flipY ? -1 : 1})`
}

/** Path data with nothing but its commands and numbers. @param {unknown} d */
const pathData = d => String(d ?? '').replace(/[\t\n\r]/g, ' ').replace(/[^MLHVCSQTAZmlhvcsqtaz0-9.,eE+\- ]/g, '')
/** A transform list with nothing but SVG transform functions: its letters, numbers, spaces, commas and brackets. @param {unknown} t */
const transformData = t => String(t ?? '').slice(0, 500).replace(/[^a-zA-Z0-9()., -]/g, '')
/** A colour as an SVG attribute takes it: `#rgb`, `#rrggbb`, `#rrggbbaa` or `currentColor`; anything else is refused. @param {unknown} value @param {string | null} fallback */
const colour = (value, fallback) => /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|currentcolor)$/i.test(String(value ?? '')) ? /** @type {string} */ (value) : fallback

/**
 * @typedef {object} DrawingForSvg
 * @property {string} d
 * @property {string} [cut]
 * @property {{ index: number, box: number[] }[]} [slots]
 * @property {number[] | null} [stroke]
 * @property {{ d: string, cut?: boolean, leaf?: number }[]} [parts]
 * @property {(string | null)[]} [transforms]
 * @property {{ text: string, box: number[], part?: number, flip?: [boolean, boolean], cut?: boolean, restored?: boolean }[]} [emoji]
 */

/**
 * A drawing as a file of its own: an SVG of its ink in `ink` on `background` (none for a transparent
 * one), `padding` the share of the 1000-unit box added on each side, `size` its width and height in
 * pixels. Empty slots are left out unless `placeholders`, which draws each as the editor does, in the
 * ink at half strength.
 * @param {DrawingForSvg} drawing
 * @param {{ background?: string | null, ink?: string, padding?: number, size?: number, placeholders?: boolean, idPrefix?: string }} [options]
 * @returns {string}
 */
export function drawingSvg(drawing, { background = null, ink = '#000000', padding = 0, size = 1000, placeholders = false, idPrefix = '' } = {}) {
  // A page may hold several drawings: their mask and filter ids are prefixed to keep them apart.
  /** @param {string} name */
  const id = name => `${String(idPrefix).replace(/[^a-zA-Z0-9_:.-]/g, '')}${name}`
  const cutId = id('cut'), filterId = id('emoji-cut-ink')
  // Every number written is a finite number, whatever it was handed.
  /** @param {unknown} value @param {number} fallback */
  const num = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
  const pad = Math.round(Math.max(0, Math.min(num(padding, 0), 0.5)) * 1000 * 100) / 100
  size = Math.max(1, Math.round(num(size, 1000)))
  const span = 1000 + 2 * pad, fill = colour(ink, '#000000')
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${span} ${span}" width="${size}" height="${size}">`]
  const back = background === null ? null : colour(background, null)
  if (back) out.push(`<rect x="${-pad}" y="${-pad}" width="${span}" height="${span}" fill="${back}"/>`)
  const d = pathData(drawing.d), cut = pathData(drawing.cut)
  // A view may hand over one transform per drawn part, to move, scale or turn a component. A cut
  // drawing stays merged: its mask is taken across parts.
  const transforms = Array.isArray(drawing.transforms) ? drawing.transforms : null
  const pieces = Array.isArray(drawing.parts) ? drawing.parts : null
  const emoji = drawing.emoji ?? []
  const hasCut = Boolean(cut || emoji.some(item => item.cut))
  /** Whether an emoji names a drawn part, so it paints in that part's turn. @param {{ part?: number }} item */
  const inPart = item => Number.isInteger(item.part) && /** @type {number} */ (item.part) >= 0 && /** @type {number} */ (item.part) < (pieces?.length ?? 0)
  const groupedEmoji = Boolean(!hasCut && emoji.length && pieces?.every(piece => Number.isInteger(piece.leaf))
    && emoji.some(item => inPart(item)))
  const split = !hasCut && (groupedEmoji || transforms?.some(transform => typeof transform === 'string' && transform))
    && pieces?.every(piece => typeof piece.d === 'string')
  /**
   * @param {{ text: string, box: number[], flip?: [boolean, boolean], cut?: boolean, part?: number }} item
   * @param {string} [attribute]
   */
  const textOf = (item, attribute = '') => {
    if (typeof item.text !== 'string') return ''
    const { x, y, size } = emojiPlace(item)
    const text = item.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const reflect = emojiTransform(item)
    return `<text${attribute}${reflect ? ` transform="${reflect}"` : ''} x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-family="system-ui, sans-serif">${text}</text>`
  }
  if (hasCut) {
    if (emoji.some(item => item.cut)) out.push(`<filter id="${filterId}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${EMOJI_CUT_MATRIX}"/></filter>`)
    out.push(`<mask id="${cutId}"><rect x="${-pad}" y="${-pad}" width="${span}" height="${span}" fill="#fff"/>`)
    if (cut) out.push(`<path d="${cut}" fill="#000"/>`)
    for (const item of emoji.filter(item => item.cut)) out.push(textOf(item, ` filter="url(#${filterId})"`))
    out.push('</mask>')
  }
  if (split && pieces) {
    // Parts are drawn in the order the drawing gives them: an overlay's top piece last.
    const order = pieces.map((piece, index) => ({ piece, index }))
    for (const { piece, index } of order) {
      const items = groupedEmoji ? emoji.filter(candidate => candidate.part === index) : []
      const path = pathData(piece.d)
      const content = items.length ? items.map(item => textOf(item)).join('') : path ? `<path d="${path}" fill="${fill}"/>` : ''
      if (!content) continue
      const transform = transformData(transforms?.[index])
      out.push(transform ? `<g transform="${transform}">${content}</g>` : content)
    }
  } else if (d) out.push(`<path d="${d}" fill="${fill}"${hasCut ? ` mask="url(#${cutId})"` : ''}/>`)
  for (const item of emoji) {
    if (item.cut || (split && groupedEmoji && inPart(item))) continue
    const content = textOf(item, hasCut && !item.restored ? ` mask="url(#${cutId})"` : '')
    if (!content) continue
    const part = item.part ?? -1
    const transform = part >= 0 && transforms ? transformData(transforms[part]) : ''
    out.push(transform ? `<g transform="${transform}">${content}</g>` : content)
  }
  if (placeholders) for (const slot of drawing.slots ?? []) {
    const box = (slot.box ?? []).slice(0, 4).map((/** @type {unknown} */ v) => num(v, 0))
    if (box.length < 4) continue
    const p = placeholder(box, num(drawing.stroke?.[0], STROKE))
    /** @param {number} v */ const r = v => Math.round(v * 100) / 100
    out.push(`<rect x="${r(p.x)}" y="${r(p.y)}" width="${r(p.width)}" height="${r(p.height)}" rx="${r(p.rx)}" fill="none" stroke="${fill}" stroke-opacity="0.5" stroke-width="${r(p.dot)}" stroke-linecap="round" pathLength="${p.dots}" stroke-dasharray="0 1"/>`)
  }
  out.push('</svg>')
  return out.join('')
}
