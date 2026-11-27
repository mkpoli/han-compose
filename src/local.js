// @ts-check
import { resolveYaoForm } from './yao-forms.js'
import { isNode, parseDescription as parse, splitDescription, tonesOf, withoutMarks, writeDescription as write } from './tree.js'
import { isComponentForm, isGroupedForm } from './component-forms.js'
import { u26201Choice } from './u26201-forms.js'
import { exactRateForm } from './rate-forms.js'
import { hasPaletteGlyph } from './palette.js'
import { hasBundledGlyph } from './bundled-coverage.js'
import { grassShape } from './variants.js'
import { chainHost } from './host-chain.js'
import { drawingChain } from './chain-corrections.js'
import { hasNewKorean } from './new-korean.js'
import { hasUnicodeGlyph } from './unicode.js'

/** Whether every filled leaf has bundled outlines.
 *  @param {string} sequence @param {boolean} [separate] @param {boolean} [unicode] @param {string} [fontStyle] @param {boolean} [preferNativeHosts]
 *  @returns {boolean} */
export function onlyBundled(sequence, separate = false, unicode = false, fontStyle = 'sans', preferNativeHosts = false) {
  // A loose mark loads from the bundled Unicode outlines; the description before it decides the rest.
  const { base, marks } = splitDescription(sequence)
  if (marks && ![...marks].every(hasUnicodeGlyph)) return false
  let tree = null
  try { tree = parse(base) } catch { return false }
  if (tree === null) return false
  // A tone mark on a syllable loads like a loose one; the syllable decides the rest.
  if (![...tonesOf(tree)].every(hasUnicodeGlyph)) return false
  let filled = false
  /** @param {import('./tree.js').Part} part */
  const local = part => {
    if (part === null) return true
    const bare = isNode(part) ? part : /** @type {string} */ (withoutMarks(part))
    const node = typeof bare === 'string' ? grassShape(bare) ?? bare : bare
    // A cached component cut can coexist with a cut in the export's own font.
    const key = write(node)
    if ((key === '𦈁' || key === '幺󠄀') && preferNativeHosts) return false
    if (exactRateForm(key) || u26201Choice(key) || resolveYaoForm(key)) { filled = true; return true }
    if (preferNativeHosts && typeof node === 'string' && key.startsWith('#(') && chainHost(drawingChain(key), fontStyle)) return false
    if ((separate ? isGroupedForm : isComponentForm)(key, fontStyle)) { filled = true; return true }
    // What ㇯ leaves of a character is read from the character's description and cuts, which only
    // the export holds: its outlines alone do not draw it.
    if (isNode(node) && node.op === '㇯') return false
    if (isNode(node)) return node.parts.every(local)
    filled = true
    return (unicode && (hasUnicodeGlyph(node) || node === '艹' && hasUnicodeGlyph('⺾'))) || ((unicode || fontStyle === 'sans') && hasPaletteGlyph(node)) || hasBundledGlyph('tangut', node) || hasBundledGlyph('jurchen', node) || (hasBundledGlyph('bopomofo', node) && (fontStyle !== 'fangsong' || !'ㆸㆹㆺㆼㆽㆾㆿ'.includes(node))) || hasBundledGlyph('small-seal', node) || hasNewKorean(node) || hasBundledGlyph('shuishu', node)
  }
  return local(tree) && filled
}
