import data from './recorded-native.json' with { type: 'json' }
import { partOf } from './geometry.js'

const styles = /** @type {Record<string, Record<string, {b: number[], p: string[][]}>>} */ (data.entries)

/** A whole glyph absent from the exported drawing records, cut from this same face. @param {string} style @param {string} char */
export function recordedNativeGlyph(style, char) {
  if (!Object.hasOwn(styles, style) || !Object.hasOwn(styles[style], char)) return null
  return partOf(styles[style][char])
}
