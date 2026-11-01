// @ts-check
// The engine's own text layer: a description read, written and measured, the tokens a field edits,
// where a description stops inside longer text (an input method's marked text, ⿰亻哥と), and the loose
// marks that may trail one. It reads the same notation the composer is given: zi.tools stroke chains,
// Emoji and jamo runs as one part, an operator's modifier, a slot (⬚, or ＋ as older drafts write it).
import properties from '../../data/unicode/properties.json' with { type: 'json' }

/** A component: its text, with any variation selector. @typedef {string} Component */
/** @typedef {{ op: string, parts: Part[], note?: string, marks?: string }} Node */
/** @typedef {Component | Node | null} Part A part; null is a slot still to fill. */

/** The operators, by how many operands they take. */
const OPERATORS = new Map([
  ['⿰', 2], ['⿱', 2], ['⿲', 3], ['⿳', 3], ['⿴', 2], ['⿵', 2], ['⿶', 2], ['⿷', 2], ['⿸', 2], ['⿹', 2],
  ['⿺', 2], ['⿻', 2], ['⿼', 2], ['⿽', 2], ['⿾', 1], ['⿿', 1], ['㇯', 2], ['〾', 1],
])
/** A slot still to fill (U+2B1A DOTTED SQUARE), and ＋ as older drafts and links write it. */
export const EMPTY = '⬚'
export const EMPTY_MARKS = [EMPTY, '＋']
/** The operators that take a zi.tools modifier after them: an overlay's matrix, an enclosure's index. */
const MODIFIABLE = new Set(['⿻', '⿴', '⿵', '⿶', '⿷', '⿼', '㇯'])
const MODIFIER = /^[0-9:,._xabcdlr|-]+$/u

/** The letters the New Korean Orthography added, at the proposed allocations. */
const NEW_KOREAN = /[\u{A97D}-\u{A97F}\u{D7C7}\u{D7FC}-\u{D7FE}]/u
/** The Shuishu characters, at the tentative allocations of the proposed block. */
export const SHUISHU = /[\u{1B300}-\u{1B4E5}\u{1B500}-\u{1B52E}]/u
/** Whether `text` holds a Shuishu character. @param {string | null | undefined} text */
export const isShuishu = text => SHUISHU.test(text ?? '')
/** Whether `text` holds one of the New Korean letters. @param {string | null | undefined} text */
export const isNewKorean = text => NEW_KOREAN.test(text ?? '')

const MARK_RANGES = properties.marks
const LETTER_RANGES = properties.letters
const GRAPHIC_RANGES = properties.graphic

/**
 * The character a zi.tools stroke chain names, by its contents (without `#(` and `)`): the strokes in
 * writing order, joined. Only the chains the grammar gives a character are read as one; any other is
 * a shape the composer cannot draw yet. Source: NightFurySL2001, （白式）IDS 延展语法导论,
 * <https://nightfurySl2001.github.io/bai-ids/>, §5.3.
 * @type {Readonly<Record<string, string>>}
 */
export const STROKE_CHAINS = {
  H: '一', S: '丨', P: '丿', N: '乀', D: '丶', T: '㇀', SZ: '㇘',
  Qa: '◝', Qb: '◞', Qc: '◟', Qd: '◜',
  HNg: '⺄', Wg: '㇁', Ng: '㇂', SHw: '㇄', HSH: '㇅', HP: '㇇', HSHwg: '㇈', SHSg: '㇉',
  HST: '㇊', HSHP: '㇋', HPWg: '㇌', HSHw: '㇍', HSHS: '㇎', HN: '乁', J: '㇝', Pg: '㇢',
  HPHwg: '乙', SHwg: '乚', Hg: '乛', Sg: '亅', SH: '𠃊', PH: '𠃋', HSg: '𠃌', HS: '𠃍',
  SHS: '𠃑', ST: '𠄌', HSHSg: '𠄎', '◟◜◝◞z': '〇',
  '丿丿': '𠂆', '-一𠃊': '匚', '-𠃊㇈': '𠤬', '-𠃊㇎z': '𱍫', '𠃍-一㇉': '弓', '𠃍-一乚': '己',
  '一-𠃍乚': '巳', '-丨𠃍-一z': '口', '-乀x1㇇': '又',
}
/**
 * The character the stroke chain starting at `chars[at]` names and where it ends, or null where none
 * starts there or it names none.
 * @param {string[]} chars @param {number} at @returns {{ char: string, end: number } | null}
 */
export function strokeChain(chars, at) {
  if (chars[at] !== '#' || chars[at + 1] !== '(') return null
  const close = chars.indexOf(')', at + 2)
  if (close < 0 || close - at > 40) return null
  const char = STROKE_CHAINS[chars.slice(at + 2, close).join('')]
  return char === undefined ? null : { char, end: close + 1 }
}

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })
const EMOJI_START = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*])/u
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u
/** The Emoji sequence a text starts with, or ''. @param {string} text */
export function emojiPrefix(text) {
  if (!EMOJI_START.test(text)) return ''
  const segment = segmenter.segment(text)[Symbol.iterator]().next().value?.segment ?? ''
  return EMOJI.test(segment) ? segment : ''
}

/** The class of a conjoining jamo, or null for anything else. @param {string | undefined} char */
const jamoClass = char => {
  const cp = char?.codePointAt(0)
  if (cp === undefined || cp === 0x115f || cp === 0x1160) return null
  if ((cp >= 0x1100 && cp <= 0x115e) || (cp >= 0xa960 && cp <= 0xa97c)) return 'L'
  if ((cp >= 0x1161 && cp <= 0x11a7) || (cp >= 0xd7b0 && cp <= 0xd7c6)) return 'V'
  if ((cp >= 0x11a8 && cp <= 0x11ff) || (cp >= 0xd7cb && cp <= 0xd7fb)) return 'T'
  return null
}
/** A jamo run that composes to a syllable, as the one component a field shows: initials, medials, finals.
 *  @param {string[]} chars @param {number} at @returns {{ text: string, end: number } | null} */
export function hangulClusterAt(chars, at) {
  if (jamoClass(chars[at]) !== 'L') return null
  let end = at
  while (jamoClass(chars[end]) === 'L') end++
  if (jamoClass(chars[end]) !== 'V') return null
  while (jamoClass(chars[end]) === 'V') end++
  while (jamoClass(chars[end]) === 'T') end++
  return { text: chars.slice(at, end).join(''), end }
}

/**
 * Whether `char`'s code point lies in one of the sorted `[first, last]` ranges.
 * @param {number[][]} ranges @param {string} char
 */
function inRanges(ranges, char) {
  const point = char.codePointAt(0)
  if (point === undefined) return false
  let lo = 0, hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, [first, last] = ranges[mid]
    if (point < first) hi = mid - 1
    else if (point > last) lo = mid + 1
    else return true
  }
  return false
}

/** How many operands an operator takes; 0 for anything else. @param {string | undefined} char */
export const arity = char => (char === undefined ? 0 : OPERATORS.get(char) ?? 0)

/** Whether `char` is a variation selector. @param {string | undefined} char */
export const isSelector = char => char !== undefined && /^(?:[\uFE00-\uFE0F]|[\u{E0100}-\u{E01EF}])$/u.test(char)

/** Whether `part` is a node. @param {Part | undefined} part @returns {part is Node} */
export const isNode = part => part !== null && typeof part === 'object'

/** Whether `node` is an empty slot, `⬚` or numbered (`⬚0`). @param {unknown} node */
export const isEmpty = node => node === null || typeof node === 'string' && node[0] === EMPTY

/** Whether `char` may stand as a component: a graphic character (or one at a bundled allocation the
 *  engine draws: Small Seal, the New Korean letters, Shuishu) that is no operator and no slot.
 *  @param {string | undefined | null} char */
export function isComponent(char) {
  const first = char && String.fromCodePoint(/** @type {number} */ (char.codePointAt(0)))
  return Boolean(first && (inRanges(GRAPHIC_RANGES, first) || /^[\u{3D000}-\u{3FC3F}]$/u.test(first) || NEW_KOREAN.test(first) || SHUISHU.test(first))
    && !OPERATORS.has(first) && !EMPTY_MARKS.includes(first))
}

/** Whether `char` is an alphabetic or syllabic letter, or a decimal digit. @param {string | undefined | null} char */
export function isLetter(char) {
  const first = char && String.fromCodePoint(/** @type {number} */ (char.codePointAt(0)))
  return Boolean(first && isComponent(first) && (inRanges(LETTER_RANGES, first) || NEW_KOREAN.test(first)))
}

/** Whether `char` may trail a description as a loose mark: a combining mark, a modifier letter, an
 *  accent or tone-letter symbol, a superscript or subscript digit. @param {string | undefined} char */
export const isMark = char => char !== undefined && inRanges(MARK_RANGES, char)

/** Whether `text` is one or more loose marks and nothing else. @param {string | null | undefined} text */
export const isMarks = text => { const chars = [...(text ?? '')]; return chars.length > 0 && chars.every(isMark) }

/** The modifier after an operator at `chars[at]`, or '' where none starts there. @param {string[]} chars @param {number} at */
export function modifierAt(chars, at) {
  if (chars[at] !== '[') return ''
  const end = chars.indexOf(']', at + 1)
  if (end < 0 || end - at > 65) return ''
  const text = chars.slice(at + 1, end).join('')
  return MODIFIER.test(text) ? text : ''
}

/**
 * A description as a tree. An operator missing an operand, and a slot written `⬚` or `＋`, read as
 * null, so a draft is read like a whole description. Loose marks after the last part stay in the
 * text (`splitDescription`) and are not part of the tree. Throws a `SyntaxError` naming what is
 * wrong: a part that is no component, or text that does not hold exactly one description.
 * @param {string} sequence
 * @returns {Part}
 */
export function parseDescription(sequence) {
  const chars = [...sequence]
  let at = 0
  /** @returns {Part} */
  const read = () => {
    const emoji = EMOJI_START.test(chars[at] ?? '') ? emojiPrefix(chars.slice(at).join('')) : ''
    const char = emoji || chars[at]
    at += emoji ? [...emoji].length : 1
    if (char === undefined) return null
    // A stroke chain that names a character stands for that character.
    if (char === '#' && !emoji) {
      const chain = strokeChain(chars, at - 1)
      if (chain) { at = chain.end; return isSelector(chars[at]) ? chain.char + chars[at++] : chain.char }
    }
    const n = arity(char)
    if (!n) {
      if (EMPTY_MARKS.includes(char)) return null
      // An Emoji sequence may hold zero-width joiners; other invisible characters are not components.
      if (!emoji && /[\p{Cc}\p{Cf}\p{Z}]/u.test(char)) throw new SyntaxError(`${JSON.stringify(char)} is not a component.`)
      const cluster = hangulClusterAt(chars, at - 1)
      if (cluster) { at = cluster.end; return cluster.text }
      return !emoji && isSelector(chars[at]) ? char + chars[at++] : char
    }
    const note = MODIFIABLE.has(char) ? modifierAt(chars, at) : ''
    if (note) at += [...note].length + 2
    const parts = Array.from({ length: n }, read)
    return note ? { op: char, parts, note } : { op: char, parts }
  }
  const tree = read()
  if (at < chars.length) throw new SyntaxError(`More follows one description in ${sequence}.`)
  return tree
}

/**
 * An operator with its modifier written after it.
 * @param {Node} node
 */
const operatorText = node => node.op + (node.note && MODIFIER.test(node.note) ? `[${node.note}]` : '')

/** A tree written back as a description, an empty slot as ⬚. @param {Part} tree @returns {string} */
export const writeDescription = tree => isEmpty(tree) ? EMPTY : isNode(tree) ? operatorText(tree) + tree.parts.map(writeDescription).join('') : tree ?? EMPTY

/**
 * Where the description starting at `chars[at]` ends: the index just past it, or -1 where none starts
 * there. Text may run on past it (⿰亻哥 in `⿰亻哥と`, the marked text of an input method). A component
 * takes its variation selector; a stroke chain takes its own and the selector after it.
 * @param {string[]} chars
 * @param {number} [at]
 * @returns {number}
 */
export function descriptionEnd(chars, at = 0) {
  const char = chars[at]
  if (char === undefined) return -1
  const chain = strokeChain(chars, at)
  // A stroke chain stands for the character it names, and takes a variation selector like one.
  if (chain) return isSelector(chars[chain.end]) ? chain.end + 1 : chain.end
  const n = arity(char)
  if (!n) {
    const emoji = EMOJI_START.test(char) ? emojiPrefix(chars.slice(at).join('')) : ''
    if (emoji) return at + [...emoji].length
    if (!isComponent(char) && !EMPTY_MARKS.includes(char)) return -1
    const cluster = hangulClusterAt(chars, at)
    if (cluster) return cluster.end
    return isSelector(chars[at + 1]) ? at + 2 : at + 1
  }
  let end = at + 1
  const note = MODIFIABLE.has(char) ? modifierAt(chars, end) : ''
  if (note) end += [...note].length + 2
  for (let k = 0; k < n && end >= 0; k++) end = descriptionEnd(chars, end)
  return end
}

/**
 * The description a text holds, and the loose marks that trail it: `{ base, marks }`. `base` is the
 * text when no description is found. A mark is kept only on the last part of the description; text
 * after that part is not a description's.
 * @param {string} text
 * @returns {{ base: string, marks: string }}
 */
export function splitDescription(text) {
  const chars = [...text ?? '']
  if (!isMark(chars[chars.length - 1])) return { base: text ?? '', marks: '' }
  const end = descriptionEnd(chars, 0)
  if (end <= 0) return { base: text ?? '', marks: '' }
  let at = end
  while (at < chars.length && isMark(chars[at])) at++
  return at === chars.length ? { base: chars.slice(0, end).join(''), marks: chars.slice(end).join('') } : { base: text ?? '', marks: '' }
}

/**
 * `tree` with `marks` trailing it: a component keeps them in its text, a node in `marks`.
 * @param {Part} tree @param {string} marks @returns {Part}
 */
export function withMarks(tree, marks) {
  if (!marks || tree === null) return tree
  if (typeof tree === 'string') return tree + marks
  return { ...tree, marks: (tree.marks ?? '') + marks }
}

/** A part or a component split at its first character: the base and the loose marks after it.
 *  @param {Part} part @returns {{ base: Part, marks: string }} */
export function splitMarks(part) {
  if (!isNode(part)) return { base: part ?? null, marks: '' }
  const node = { op: part.op, parts: part.parts, ...(part.note ? { note: part.note } : {}) }
  return { base: node, marks: part.marks ?? '' }
}

/** The loose marks a component or a tree carries (`木ˊ`, or a node's `marks`). @param {Part | string} part */
export const marksOf = part => typeof part === 'string' ? splitText(part).marks : splitMarks(part).marks

/** A component's text split at its first character, with any variation selector: the base and the
 *  loose marks after it. A component that is itself a mark keeps it as its base. @param {string} text */
function splitText(text) {
  const chars = [...text]
  let at = 1
  if (isSelector(chars[at])) at++
  return isMark(chars[0]) && chars.length === 1 ? { base: text, marks: '' } : { base: chars.slice(0, at).join(''), marks: chars.slice(at).join('') }
}

/** `part` without its loose marks. @param {Part | string} part */
export const withoutMarks = part => typeof part === 'string' ? splitText(part).base : splitMarks(part).base

/**
 * `tree` with every loose mark hoisted to its root, in reading order, and none left inside: the text
 * of a description carries marks only at its end.
 * @param {Part} tree @returns {Part}
 */
export function normalizeMarks(tree) {
  /** @type {string[]} */
  const found = []
  /** @param {Part} part @returns {Part} */
  const strip = part => {
    if (!isNode(part)) return part
    const parts = part.parts.map(strip)
    if (part.marks) found.push(part.marks)
    return { op: part.op, parts, ...(part.note ? { note: part.note } : {}) }
  }
  const base = strip(tree)
  return found.length ? withMarks(base, found.join('')) : tree
}

/**
 * `tree` with the part at `path` (a list of operand indices) replaced by `part`.
 * @param {Part} tree @param {number[]} path @param {Part} part @returns {Part}
 */
export function replaceAt(tree, path, part) {
  if (!path.length) return part
  if (!isNode(tree)) return tree
  const [head, ...rest] = path
  return { ...tree, parts: tree.parts.map((child, i) => i === head ? replaceAt(child, rest, part) : child) }
}

/**
 * The leaves of a tree in reading order, with their paths: a node's operands, every level down.
 * @param {Part} tree
 * @param {number[]} [path]
 * @returns {{ path: number[], leaf: Part }[]}
 */
export function leaves(tree, path = []) {
  return isNode(tree) ? tree.parts.flatMap((part, i) => leaves(part, [...path, i])) : [{ path, leaf: tree }]
}

/**
 * `text` split into tokens, with UTF-16 offsets that match a native input's, supplementary characters
 * and selectors included: each operator or component a token, an operator's modifier inside its own,
 * and loose marks a token at the end. A draft that does not read has no tokens.
 * @typedef {{ path: number[], start: number, end: number, tokenEnd: number, text: string, noteStart?: number, noteEnd?: number }} Token
 * @param {string} text
 * @returns {Token[]}
 */
export function tokens(text) {
  const chars = [...text ?? '']
  if (!text || descriptionEnd(chars, 0) < 0) return []
  /** @type {Token[]} */
  const out = []
  let at = 0
  /** @param {number[]} path */
  function read(path) {
    const start = at
    const chain = strokeChain(chars, start)
    if (chain) {
      at = chain.end
      if (isSelector(chars[at])) at++
      out.push({ path, start, end: at, tokenEnd: at, text: chars.slice(start, at).join('') })
      return
    }
    const emoji = EMOJI_START.test(chars[at] ?? '') ? emojiPrefix(chars.slice(at).join('')) : ''
    const char = emoji || chars[at]
    const n = arity(char)
    const cluster = hangulClusterAt(chars, at)
    let noteStart = 0, noteEnd = 0
    if (emoji) at += [...emoji].length
    else if (cluster) at = cluster.end
    else {
      if (at < chars.length) at++
      if (n) {
        const note = MODIFIABLE.has(char) ? modifierAt(chars, at) : ''
        if (note) { noteStart = at; at += [...note].length + 2; noteEnd = at }
      } else if (isSelector(chars[at])) at++
    }
    const token = { path, start, end: at, tokenEnd: at, text: chars.slice(start, at).join(''), ...(noteStart ? { noteStart, noteEnd } : {}) }
    out.push(token)
    for (let i = 0; i < n; i++) read([...path, i])
    token.end = at
  }
  read([])
  // Loose marks trail the whole description: they get a token of their own at the end, belonging to
  // the root, while the root's span reaches over them so a selection of the whole still finds it.
  if (out.length && at < chars.length && isMark(chars[at])) {
    out[0].end = chars.length
    out.push({ path: [], start: at, end: chars.length, tokenEnd: chars.length, text: chars.slice(at).join('') })
  }
  return out
}
