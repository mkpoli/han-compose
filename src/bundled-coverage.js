// @ts-check
import coverage from '../data/palette/bundled-coverage.json' with { type: 'json' }
/** Exact scalar outlines available to the offline preview.
 * @param {'tangut' | 'bopomofo' | 'small-seal' | 'shuishu' | 'jurchen'} bundle
 * @param {string} key A character, or a character and its variation selector.
 */
export function hasBundledGlyph(bundle, key) {
  const [base, selector, ...rest] = [...key]
  if (base === undefined || rest.length) return false
  const name = selector === undefined ? bundle : `${bundle}:${selector.codePointAt(0)?.toString(16)}`
  const cp = /** @type {number} */ (base.codePointAt(0))
  return /** @type {Record<string, number[][]>} */ (coverage)[name]?.some(([first, last]) => cp >= first && cp <= last) ?? false
}
