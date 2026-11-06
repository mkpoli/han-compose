// @ts-check
import coverage from '../data/palette/bundled-coverage.json' with { type: 'json' }
/** Exact scalar outlines available to the offline preview.
 * @param {'tangut' | 'bopomofo' | 'small-seal' | 'shuishu' | 'jurchen'} bundle
 * @param {string} key
 */
export function hasBundledGlyph(bundle, key) {
  if ([...key].length !== 1) return false
  const cp = /** @type {number} */ (key.codePointAt(0))
  return coverage[bundle].some(([first, last]) => cp >= first && cp <= last)
}
