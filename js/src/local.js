// @ts-check
import { isNode, parseDescription as parse, splitDescription, tonesOf, withoutMarks, writeDescription as write } from './tree.js'
import { isComponentForm, isAtomicForm, isGroupedForm } from './component-forms.js'
import { hasPaletteGlyph } from './palette.js'
import { hasBundledGlyph } from './bundled-coverage.js'
import { grassShape } from './variants.js'
import { hasNewKorean } from './new-korean.js'
import { hasUnicodeGlyph } from './unicode.js'

/** Whether every filled leaf has bundled outlines.
 *  @param {string} sequence @param {boolean} [separate] @param {boolean} [unicode] @param {string} [fontStyle]
 *  @returns {boolean} */
export function onlyBundled(sequence, separate = false, unicode = false, fontStyle = 'sans') {
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
    if (isAtomicForm(write(node), fontStyle) || (separate ? isGroupedForm : isComponentForm)(write(node), fontStyle)) { filled = true; return true }
    // What ㇯ leaves of a character is read from the character's description and cuts, which only
    // the export holds: its outlines alone do not draw it.
    if (isNode(node) && node.op === '㇯') return false
    if (isNode(node)) return node.parts.every(local)
    filled = true
    return (unicode && (hasUnicodeGlyph(node) || node === '艹' && hasUnicodeGlyph('⺾'))) || ((unicode || fontStyle === 'sans') && hasPaletteGlyph(node)) || hasBundledGlyph('tangut', node) || hasBundledGlyph('jurchen', node) || hasBundledGlyph('bopomofo', node) || hasBundledGlyph('small-seal', node) || hasNewKorean(node) || hasBundledGlyph('shuishu', node)
  }
  return local(tree) && filled
}
