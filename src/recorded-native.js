import data from './recorded-native.json' with { type: 'json' }
import { partOf } from './geometry.js'

const styles = /** @type {Record<string, Record<string, {b: number[], p: string[][]}>>} */ (data.entries)

/** Pinned native outline for a glyph absent from format 7. @param {string} style @param {string} char */
export function recordedNativeRecord(style, char) {
  return Object.hasOwn(styles, style) && Object.hasOwn(styles[style], char) ? styles[style][char] : null
}

/** A whole glyph absent from the exported drawing records, cut from this same face. @param {string} style @param {string} char */
export function recordedNativeGlyph(style, char) {
  const record = recordedNativeRecord(style, char)
  return record ? partOf(record) : null
}
