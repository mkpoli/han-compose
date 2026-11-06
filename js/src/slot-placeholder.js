// @ts-check
// A box drawn as an empty slot's placeholder: a rounded rectangle outlined in dots a stroke wide,
// inset by half a stroke, with nothing at its centre that could read as a stroke. The editor draws it
// where a description has a slot still to fill; `drawingSvg` draws it into a file.

/** The stroke width a placeholder is drawn with where no drawing gives one: the font's at weight 400. */
export const STROKE = 80

/**
 * A placeholder in `box` ([x, y, width, height], y down): `{ x, y, width, height, rx, dot, gap, dots }`,
 * the rectangle, the dots' width, their spacing and how many go round.
 * @param {number[]} box
 * @param {number} [stroke]
 */
export function placeholder(box, stroke = STROKE) {
  const [bx, by, bw, bh] = box
  const s = Math.max(24, Math.min(stroke, Math.min(bw, bh) / 5))
  const inset = Math.min(s / 2, bw / 4, bh / 4)
  const width = Math.max(bw - 2 * inset, 1), height = Math.max(bh - 2 * inset, 1)
  const rx = Math.min(Math.min(width, height) * 0.18, 3 * s)
  // As many dots as fit the outline at about a stroke and a bit apart, so they close evenly round it.
  const perimeter = 2 * (width + height) - 8 * rx + 2 * Math.PI * rx
  return { x: bx + inset, y: by + inset, width, height, rx, dot: s * 0.42, gap: s * 1.15, dots: Math.max(4, Math.round(perimeter / (s * 1.15))) }
}
