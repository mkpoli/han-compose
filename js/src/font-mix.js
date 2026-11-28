// @ts-check
import { compose, sketch } from './loader.js'

export const FONT_STYLES = /** @type {const} */ (['sans', 'serif', 'woodblock', 'fangsong', 'regular', 'pen-writing'])
/** @typedef {typeof FONT_STYLES[number]} FontStyle */
/** @typedef {{ shares: Partial<Record<FontStyle, number>>, weight?: number }} FontMix */

/** Validate before requesting any export. Shares are relative, and weight is a stroke-width multiplier.
 * @param {FontMix} mix */
export function activeFaces({ shares, weight = 1 }) {
  if (!Number.isFinite(weight) || weight < 0.65 || weight > 1.5)
    throw new RangeError('Stroke weight must be between 0.65 and 1.5.')
  if (!shares || Object.keys(shares).some((key) => !FONT_STYLES.some((style) => style === key)))
    throw new TypeError('Unknown font style.')
  const active = FONT_STYLES.map((style) => ({ style, share: shares[style] ?? 0 }))
  if (active.some(({ share }) => !Number.isFinite(share) || share < 0))
    throw new RangeError('Font shares must be finite and nonnegative.')
  const max = Math.max(...active.map((face) => face.share))
  if (!max) throw new RangeError('Give at least one font a positive share.')
  const total = active.reduce((sum, face) => sum + face.share / max, 0)
  return active
    .filter((face) => face.share > 0)
    .map((face) => ({ style: face.style, share: face.share / max / total }))
}

/** Compose from any combination of the five face exports, in a browser or on the server.
 * @param {Partial<Record<FontStyle, Parameters<typeof compose>[0]>>} sources
 * @param {string} sequence @param {FontMix} mix @param {Parameters<typeof compose>[2]} [options] */
export async function composeMixed(sources, sequence, mix, options) {
  const faces = activeFaces(mix)
  const results = await Promise.all(
    faces.map(async ({ style }) => {
      if (!sources[style]) throw new TypeError('Missing source for ' + style)
      const config = { ...options, fontStyle: style }
      const drawing = await compose(sources[style], sequence, config)
      const leaves =
        faces.length === 1 && (mix.weight ?? 1) === 1 ? null : await sketch(sources[style], sequence, config)
      return { drawing, leaves }
    })
  )
  if (faces.length === 1 && (mix.weight ?? 1) === 1) return results[0].drawing
  const { mixDrawings } = await import('./mix-drawings.js')
  return mixDrawings(
    results.map((r) => r.drawing),
    faces.map((face) => face.share),
    mix.weight ?? 1,
    results.map((r) => r.leaves)
  )
}
