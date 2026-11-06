// @ts-check
// The Unicode script a component belongs to, and the scripts a description holds: what groups a
// palette, and what a script-specific source is asked for.
import ranges from '../data/unicode/script-ranges.json' with { type: 'json' }
import { isNewKorean, isShuishu } from './tree.js'

/** @param {string} char @returns {string | null} */
export function characterScript(char) {
  const cp = char.codePointAt(0)
  if (cp === undefined) return null
  if (cp >= 0x3d000 && cp <= 0x3fc3f) return 'seal'
  if (isShuishu(char)) return 'shuishu'
  if (cp >= 0x31c0 && cp <= 0x31ef) return 'strokes'
  if (cp >= 0x30 && cp <= 0x39) return 'latin'
  if (isNewKorean(char)) return 'hangul'
  let lo = 0, hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, [first, last, script] = ranges[mid]
    if (cp < /** @type {number} */ (first)) hi = mid - 1
    else if (cp > /** @type {number} */ (last)) lo = mid + 1
    else {
      if (script === 'Zyyy' || script === 'Zinh') return null
      return /** @type {Record<string, string>} */ ({ Hani: 'han', Latn: 'latin', Cyrl: 'cyrillic', Hang: 'hangul', Bopo: 'bopomofo', Tang: 'tangut', Jurc: 'jurchen', Kana: 'kana', Hira: 'kana', Hans: 'han', Hant: 'han' })[/** @type {string} */ (script)] ?? /** @type {string} */ (script)
    }
  }
  return null
}
export { partScript, treeScript } from './part-script.js'
