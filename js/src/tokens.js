// @ts-check
// The tokens of a sequence field: each part, operator and loose mark with the offsets a caret and a
// selection use. The syntax is the text layer's (`tree.js`); a token is one description at one path.
import { descriptionEnd, isMark, isNode, parseDescription } from './tree.js'

/**
 * @typedef {{ path: number[], start: number, end: number, tokenEnd: number, text: string, noteStart?: number, noteEnd?: number }} Token
 */

/**
 * `text` split into tokens, with UTF-16 offsets a native input's caret and selection use: each
 * operator (its modifier included) and each component (its variation selector, a jamo run or an
 * Emoji sequence whole), and the loose marks at the end as a token of the root. An operand still
 * missing at the end has a token of zero width there, and so does a slot. Text that is no
 * description has no tokens.
 * @param {string} text
 * @returns {Token[]}
 */
export function tokens(text) {
  const chars = [...text ?? '']
  if (!text) return []
  let tree
  try { tree = parseDescription(text) } catch { return [] }
  /** @type {Token[]} */
  const out = []
  // The offset the tokens read on from: a field's text, in UTF-16 units.
  let at = 0
  /**
   * A component starting at `start` and where it ends: its first character, a variation selector
   * after it, or the whole Emoji sequence, jamo run or stroke chain it is.
   * @param {number} start
   */
  function component(start) {
    const whole = descriptionEnd(chars, start)
    return whole > start ? whole : start + 1
  }
  /**
   * The tokens under `node` at `path`, read from `at` as the parser reads it.
   * @param {import('./tree.js').Part} node @param {number[]} path
   */
  function read(node, path) {
    const start = at
    if (!isNode(node)) {
      // A component's text, however many code points it takes; a slot is an empty span where it stands.
      const end = node === null ? start : component(start)
      // From code points, so no slice can cut a surrogate pair in two.
      out.push({ path, start, end, tokenEnd: end, text: chars.slice(start, end).join('') })
      at = end
      return
    }
    // An operator: its modifier sits between it and its operands.
    /** @type {number} */
    let tokenEnd = start + 1, noteStart = 0, noteEnd = 0
    if (chars[start + 1] === '[') {
      const close = chars.indexOf(']', start + 2)
      if (close > start && close - start <= 65) { noteStart = start + 1; noteEnd = close + 1; tokenEnd = close + 1 }
    }
    /** @type {Token} */
    const token = { path, start, end: 0, tokenEnd, text: chars.slice(start, tokenEnd).join(''), ...(noteStart ? { noteStart, noteEnd } : {}) }
    out.push(token)
    at = tokenEnd
    node.parts.forEach((child, i) => read(child, [...path, i]))
    token.end = at
  }
  read(tree, [])
  // Loose marks trail the whole description: they get a token of their own at the end, belonging to
  // the root, while the root's span reaches over them so a selection of the whole still finds it.
  const root = out[0]
  let mark = at
  while (mark < chars.length && isMark(chars[mark])) mark++
  if (root && mark > root.end) {
    out.push({ path: [], start: root.end, end: mark, tokenEnd: mark, text: chars.slice(root.end, mark).join('') })
    root.end = mark
  }
  return out
}
