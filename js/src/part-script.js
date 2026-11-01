// @ts-check
// The script a description draws in, from its parts: `treeScript` for a tree, `partScript` for its
// text, `mixed` when the parts are not all of one script.
import { characterScript } from './scripts.js'
import { isNode, parseDescription } from './tree.js'

/** The script a description draws in. @param {string} text */
export function partScript(text) {
  let tree
  try { tree = parseDescription(text) } catch { return null }
  return treeScript(tree)
}

/** The script a tree draws in: one script, `mixed`, or `symbols` when no part names one.
 *  @param {import('./tree.js').Part} tree */
export function treeScript(tree) {
  if (tree === null) return 'symbols'
  const scripts = new Set()
  const walk = node => {
    if (typeof node === 'string') { const script = characterScript(node); if (script) scripts.add(script); return }
    if (isNode(node)) node.parts.forEach(walk)
  }
  walk(tree)
  return scripts.size > 1 ? 'mixed' : /** @type {string | undefined} */ (scripts.values().next().value) ?? 'symbols'
}
