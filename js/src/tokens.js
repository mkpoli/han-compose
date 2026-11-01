// @ts-check
// A description split into the tokens an input field shows and edits: each token a part, an operator,
// or a loose mark trailing the whole, with the UTF-16 offsets a caret and a selection use.
import { arity, isMark, isSelector, parseDescription } from './tree.js'

/**
 * The zi.tools modifier after an operator (`⿻[1:]丨日`): its contents may be a crossing matrix or an
 * index, and it belongs to the operator's token.
 * @param {string} text @param {number} at
 */
const modifierLength = (text, at) => {
  if (text[at] !== '[') return 0
  const end = text.indexOf(']', at + 1)
  if (end < 0 || end - at > 65) return 0
  return /^[0-9:,._xabcdlr|-]+$/u.test(text.slice(at + 1, end)) ? end - at + 1 : 0
}
/** The operators a modifier may follow. */
const MODIFIABLE = new Set(['⿻', '⿴', '⿵', '⿶', '⿷', '⿼', '㇯'])

/** A jamo-filled Hangul syllable written as a run of conjoining jamo, or the first two letters and a
 *  vowel that compose to none: the run is one component when typed that way. @param {string[]} chars */
function hangulClusterAt(chars, at) {
  const cls = char => {
    const cp = char?.codePointAt(0)
    if (cp === undefined) return null
    if ((cp >= 0x1100 && cp <= 0x115e) || (cp >= 0xa960 && cp <= 0xa97c)) return 'L'
    if ((cp >= 0x1161 && cp <= 0x11a7) || (cp >= 0xd7b0 && cp <= 0xd7c6)) return 'V'
    if ((cp >= 0x11a8 && cp <= 0x11ff) || (cp >= 0xd7cb && cp <= 0xd7fb)) return 'T'
    return null
  }
  if (cls(chars[at]) !== 'L') return null
  let end = at
  while (cls(chars[end]) === 'L') end++
  if (cls(chars[end]) !== 'V') return null
  while (cls(chars[end]) === 'V') end++
  while (cls(chars[end]) === 'T') end++
  return { text: chars.slice(at, end).join('') }
}

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })
const EMOJI_START = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*])/u
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u
/** The emoji sequence a text starts with, or ''. @param {string} text */
export function emojiPrefix(text) {
  if (!EMOJI_START.test(text)) return ''
  const segment = segmenter.segment(text)[Symbol.iterator]().next().value?.segment ?? ''
  return EMOJI.test(segment) ? segment : ''
}

/**
 * @typedef {{ path: number[], start: number, end: number, tokenEnd: number, text: string, noteStart?: number, noteEnd?: number }} Token
 */

/**
 * `text` split into tokens, with UTF-16 offsets that match the native input's, supplementary
 * characters and selectors included. A draft that does not read has no tokens. An empty slot takes no
 * width.
 * @param {string} text
 * @returns {Token[]}
 */
export function tokens(text) {
  let tree = null
  try { tree = parseDescription(text) } catch { /* not a draft */ }
  if (!text || tree === null) return []
  /** @type {Token[]} */
  const out = []
  let at = 0
  /** @param {number[]} path */
  function read(path) {
    const start = at
    const char = emojiPrefix(text.slice(at)) || String.fromCodePoint(text.codePointAt(at) ?? 0)
    const n = arity(char)
    const cluster = hangulClusterAt([...text.slice(at)], 0)
    let noteStart = 0, noteEnd = 0
    if (cluster) at += cluster.text.length
    else {
      if (at < text.length) at += char.length
      if (n) {
        const note = MODIFIABLE.has(char) ? modifierLength(text, at) : 0
        if (note) { noteStart = at; at += note; noteEnd = at }
      } else if (isSelector([...text.slice(at)][0])) at += [...text.slice(at)][0].length
    }
    const token = { path, start, tokenEnd: at, end: at, text: text.slice(start, at), ...(noteStart ? { noteStart, noteEnd } : {}) }
    out.push(token)
    for (let i = 0; i < n; i++) read([...path, i])
    token.end = at
  }
  read([])
  // Loose marks trail the whole description: they get a token of their own at the end, belonging to
  // the root, while the root's span reaches over them so a selection of the whole still finds it.
  if (out.length && at < text.length && isMark([...text.slice(at)][0])) {
    out[0].end = text.length
    out.push({ path: [], start: at, tokenEnd: text.length, end: text.length, text: text.slice(at) })
  }
  return out
}
