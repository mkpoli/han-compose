// @ts-nocheck
// Loose marks drawn after a description: a voicing dot, a tone mark, a tone letter or a superscript.
// The shapes come from the same outlines as components (Noto Sans CJK, Jigmo, Unifont and the other
// pinned faces); where they sit follows what the mark is. A combining mark sits over or under the
// whole drawing, centered. A kana voicing mark, a spacing accent, a tone letter and a superscript sit
// beside the drawing, at the upper right; a Hangul tone mark sits at the left, where the syllable's
// tone is written. Marks that sit beside the drawing reserve a margin: `markFace` shrinks the
// character into the rest of the box, so the mark stands outside it instead of over its strokes.
import { placed } from './geometry.js'

const KANA = /^[\u3099\u309A]$/u
const KANA_SPACING = /^[\u309B\u309C]$/u
const HANGUL = /^[\u302E\u302F]$/u
const ATTACHED = /^\p{M}$/u

/** How a loose mark is drawn: `attached` sits over or under the drawing, `kana`, `spacing` and
 *  `hangul` beside it. @param {string} char */
export function markKind(char) {
  if (KANA.test(char)) return 'kana'
  if (KANA_SPACING.test(char)) return 'spacing'
  if (HANGUL.test(char)) return 'hangul'
  return ATTACHED.test(char) ? 'attached' : 'spacing'
}

/** Whether a mark sits beside the drawing, in the margin the character leaves for it. @param {string} char */
export const isOutbound = char => markKind(char) !== 'attached'

/** Whether a mark's outline lies below the baseline, so it hangs under the drawing. @param {*} part */
const hangsBelow = part => part.box[3] <= 0

/**
 * The box the description draws in when its outbound marks take a margin: the character shrinks toward
 * the corner opposite the marks, leaving them outside its ink. `box` is the marks' box in `frame`
 * (font units, y up). Answers `{ face, scale, side }`; scale 1 leaves `frame` as it is.
 * @param {number[]} frame
 * @param {number[]} box
 */
export function markFace(frame, box) {
  const [x0, y0, x1, y1] = frame
  const width = x1 - x0, height = y1 - y0
  if (width <= 0 || height <= 0) return { face: frame, scale: 1, side: 'right' }
  const gap = Math.min(width, height) * 0.06
  const clamp = value => Math.max(0.5, Math.min(1, value))
  const left = (box[0] + box[2]) / 2 < (x0 + x1) / 2
  if (left) {
    // A mark at the left keeps the character to its right: shrink toward the bottom right.
    const scale = clamp((x1 - (box[2] + gap)) / width)
    const top = y0 + (height - height * scale) / 2
    return { face: scale < 1 ? [x1 - width * scale, top, x1, top + height * scale] : frame, scale, side: 'left' }
  }
  // A mark at the upper right leaves room either to the left of it or below it; the larger scale
  // that clears one of the two is the least shrink.
  const sx = (box[0] - gap - x0) / width, sy = (box[1] - gap - y0) / height
  const scale = clamp(Math.max(sx, sy))
  return { face: scale < 1 ? [x0, y0, x0 + width * scale, y0 + height * scale] : frame, scale, side: 'right' }
}

/**
 * The loose marks of a description as placed parts: `placed` records the composer draws with everything
 * else, origin `mark <char>`. `frame` is the character box in font units (y up) the marks that sit
 * beside the drawing use; `attachedFrame` is the box the combining marks sit over, smaller when the
 * character makes room for them. Marks with no outline in the loaded data are left out, so a preview
 * keeps the drawing it has.
 * @param {import('./compose.js').Composer} composer
 * @param {string} marks
 * @param {number[]} [frame]
 * @param {number[]} [attachedFrame]
 */
export function markParts(composer, marks, frame = composer.face, attachedFrame = frame) {
  const [x0, y0, x1, y1] = frame
  const width = x1 - x0, height = y1 - y0
  const base = height / 900, inset = height * 0.02
  const [ax0, ay0, ax1, ay1] = attachedFrame
  const aWidth = ax1 - ax0, aHeight = ay1 - ay0
  const aBase = aHeight / 900, aInset = aHeight * 0.02
  /** @type {{ char: string, part: any, kind: string }[]} */
  const glyphs = []
  for (const char of marks) {
    const part = composer.glyph(char)
    if (part) glyphs.push({ char, part, kind: markKind(char) })
  }
  if (!glyphs.length) return []
  /** @type {{ part: any, target: number[], char: string }[]} */
  const targets = []

  /** How large one mark is drawn against the character box. */
  const sizeOf = g => g.kind === 'kana' ? base : KANA_SPACING.test(g.char) ? base * 0.75 : base * 0.68

  // A row of marks at the upper right, top aligned. The row keeps to a corner of the frame.
  const row = glyphs.filter(g => g.kind === 'spacing' || g.kind === 'kana')
  if (row.length) {
    const natural = Math.min(...row.map(sizeOf))
    const gapAt = width * 0.02
    const widthAt = row.reduce((sum, g) => sum + (g.part.box[2] - g.part.box[0]), 0) + gapAt * (row.length - 1)
    const maxHeightAt = Math.max(...row.map(g => g.part.box[3] - g.part.box[1]))
    const scale = Math.min(natural, width * 0.3 / Math.max(widthAt, 1), height * 0.3 / Math.max(maxHeightAt, 1))
    const gap = gapAt * (scale / natural)
    const total = row.reduce((sum, g) => sum + (g.part.box[2] - g.part.box[0]) * scale, 0) + gap * (row.length - 1)
    let x = x1 - inset - total
    for (const g of row) {
      const w = (g.part.box[2] - g.part.box[0]) * scale, h = (g.part.box[3] - g.part.box[1]) * scale
      targets.push({ ...g, target: [x, y1 - inset - h, x + w, y1 - inset] })
      x += w + gap
    }
  }

  // A combining mark over the drawing, centered, its run stacking upwards; it may overlap the ink.
  const above = glyphs.filter(g => g.kind === 'attached' && !hangsBelow(g.part))
  if (above.length) {
    let scale = aBase * 0.85
    const room = aHeight * 0.34
    let heights = above.map(g => (g.part.box[3] - g.part.box[1]) * scale)
    let total = heights.reduce((sum, h) => sum + h, 0)
    if (total > room) {
      scale *= room / total
      heights = above.map(g => (g.part.box[3] - g.part.box[1]) * scale)
      total = heights.reduce((sum, h) => sum + h, 0)
    }
    let y = ay1 - aInset - total
    for (const g of above) {
      const h = (g.part.box[3] - g.part.box[1]) * scale, w = (g.part.box[2] - g.part.box[0]) * scale
      const x = (ax0 + ax1) / 2 - w / 2
      targets.push({ ...g, target: [x, y, x + w, y + h] })
      y += h
    }
  }

  // A combining mark under the drawing, centered; its run stacks downwards, inside the character box.
  const below = glyphs.filter(g => g.kind === 'attached' && hangsBelow(g.part))
  if (below.length) {
    let scale = aBase * 0.85
    const room = aHeight * 0.34
    let heights = below.map(g => (g.part.box[3] - g.part.box[1]) * scale)
    let total = heights.reduce((sum, h) => sum + h, 0)
    if (total > room) {
      scale *= room / total
      heights = below.map(g => (g.part.box[3] - g.part.box[1]) * scale)
      total = heights.reduce((sum, h) => sum + h, 0)
    }
    let y = ay0 + aInset
    for (const g of [...below].reverse()) {
      const h = (g.part.box[3] - g.part.box[1]) * scale, w = (g.part.box[2] - g.part.box[0]) * scale
      const x = (ax0 + ax1) / 2 - w / 2
      targets.push({ ...g, target: [x, y, x + w, y + h] })
      y += h
    }
  }

  // Hangul tone marks at the left, centered on the character, a stack fitted to the box.
  const hangul = glyphs.filter(g => g.kind === 'hangul')
  if (hangul.length) {
    const scale0 = base * 0.8, gap0 = height * 0.03
    const heightAt = hangul.reduce((sum, g) => sum + (g.part.box[3] - g.part.box[1]) * scale0, 0) + gap0 * (hangul.length - 1)
    const maxWidthAt = Math.max(...hangul.map(g => g.part.box[2] - g.part.box[0]))
    const scale = Math.min(scale0, height * 0.45 / Math.max(heightAt, 1), width * 0.15 / Math.max(maxWidthAt, 1))
    const gap = gap0 * (scale / scale0)
    const heights = hangul.map(g => (g.part.box[3] - g.part.box[1]) * scale)
    let top = (y0 + y1) / 2 + (heights.reduce((sum, h) => sum + h, 0) + gap * (hangul.length - 1)) / 2
    heights.forEach((h, i) => {
      const g = hangul[i], w = (g.part.box[2] - g.part.box[0]) * scale
      targets.push({ ...g, target: [x0 + inset, top - h, x0 + inset + w, top] })
      top -= h + gap
    })
  }

  return targets.map(({ char, part, target }) => placed(part, part.box, target, 0, `mark ${char}`))
}
