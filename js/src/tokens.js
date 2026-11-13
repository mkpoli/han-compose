// @ts-check
// The tokens of a sequence field: each part, operator and loose mark with the offsets a caret and a
// selection use. The syntax is the text layer's (`tree.js`); a token is one description at one path.
import { EMPTY_MARKS, arity, customAt, emojiPrefix, hangulClusterAt, isMark, isNode, isSelector, isToneMark, modifierAt, parseDescription, strokeChain, takesModifier } from './tree.js'

/**
 * @typedef {{ path: number[], start: number, end: number, tokenEnd: number, text: string, noteStart?: number, noteEnd?: number }} Token
 */

/**
 * `text` split into tokens, with UTF-16 offsets a native input's caret and selection use: each
 * operator (its modifier included) and each component (its variation selector and tone marks, a jamo
 * run or an Emoji sequence whole), and the loose marks at the end as a token of the root. An operand
 * still missing at the end has a token of zero width there. Text that is no description has no tokens.
 * @param {string} text
 * @returns {Token[]}
 */
export function tokens(text) {
  if (!text) return []
  let tree
  try { tree = parseDescription(text) } catch { return [] }
  // The text reads with a custom component as one part, or with its braces, & and # as characters
  // of their own; the tokens follow whichever reading the description took.
  /** @param {import('./tree.js').Part} part @returns {boolean} */
  const custom = part => isNode(part) ? part.parts.some(custom) : typeof part === 'string' && customAt([...part])?.end === [...part].length
  const customs = custom(tree)
  /** @type {Token[]} */
  const out = []
  let at = 0
  /** What follows the offset, by code point. */
  const rest = () => [...text.slice(at)] // oxlint-disable-line unicorn/no-useless-spread -- `text` is a string, and the spread splits it by code point
  /** A variation selector at the offset, stepped over. */
  const selector = () => { const next = rest()[0]; if (isSelector(next)) at += next.length }
  /** Tone marks at the offset, stepped over: they stay with the component before them. */
  const tones = () => { while (isToneMark(rest()[0])) at += 1 }
  /** @param {number[]} path */
  function read(path) {
    const start = at
    const chars = rest()
    // A stroke chain that names a character is one component, its text the chain as written.
    const chain = strokeChain(chars, 0)
    if (chain) {
      at += chars.slice(0, chain.end).join('').length
      selector()
      tones()
      out.push({ path, start, end: at, tokenEnd: at, text: text.slice(start, at) })
      return
    }
    // A component no code point names is one token, in its source's spelling.
    const named = customs ? customAt(chars, 0) : null
    if (named) {
      at += named.text.length
      out.push({ path, start, end: at, tokenEnd: at, text: named.text })
      return
    }
    const char = emojiPrefix(text.slice(at)) || chars[0] || ''
    const n = arity(char)
    const cluster = hangulClusterAt(chars, 0)
    let noteStart = 0, noteEnd = 0
    if (cluster) at += cluster.text.length
    else {
      at += char.length
      if (n) {
        const note = takesModifier(char) ? modifierAt(chars, 1) : ''
        if (note) { noteStart = at; at += note.length + 2; noteEnd = at }
      } else selector()
    }
    // An empty slot keeps a mark out, as it parses.
    if (!n && !EMPTY_MARKS.includes(char)) tones()
    /** @type {Token} */
    const token = { path, start, end: at, tokenEnd: at, text: text.slice(start, at), ...(noteStart ? { noteStart, noteEnd } : {}) }
    out.push(token)
    for (let i = 0; i < n; i++) read([...path, i])
    token.end = at
  }
  read([])
  // Loose marks trail the whole description: they get a token of their own at the end, belonging to
  // the root, while the root's span reaches over them so a selection of the whole still finds it.
  if (at < text.length && isMark(rest()[0])) {
    out[0].end = text.length
    out.push({ path: [], start: at, end: text.length, tokenEnd: text.length, text: text.slice(at) })
  }
  return out
}
