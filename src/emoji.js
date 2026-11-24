// @ts-check
// Emoji among a description's parts. The composer draws outlines; an Emoji (👩🏽‍💻, 🏳️‍⚧️) has none,
// so it takes an empty slot in a draft of the description: the layout gives it a box like any slot,
// and a view draws the Emoji there as text. A view may also mirror it, half-turn it, cut it by ㇯ or
// lay it over another part, which is what the flags below say.
import { isNode, parseDescription, writeDescription } from './tree.js'

/**
 * An Emoji part of a draft: its text and the slot it stands in.
 * @typedef {object} EmojiPart
 * @property {string} text
 * @property {number} slot The slot's number, in reading order.
 * @property {number} leaf The part's leaf, in reading order.
 * @property {[boolean, boolean]} [flip] Whether it is mirrored across each axis by ⿾ and ⿿ above it.
 * @property {boolean} [cut] Whether ㇯ cuts it away.
 * @property {boolean} [restored] Whether a subtraction inside the cut part puts it back.
 * @property {boolean} [overlay] Whether ⿻ lays it over another part.
 */

const SEGMENT = new Intl.Segmenter('und', { granularity: 'grapheme' })
const START = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*])/u
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u

/** The Emoji sequence a text starts with, or ''. @param {string} text */
export function emojiPrefix(text) {
  if (!START.test(text)) return ''
  const segment = SEGMENT.segment(text)[Symbol.iterator]().next().value?.segment ?? ''
  return EMOJI.test(segment) ? segment : ''
}

/** Whether a part is an Emoji rather than a component: a sequence of one, or one pictograph. @param {string} part */
export const isEmojiPart = part => emojiPrefix(part) === part && ([...part].length > 1 || /\p{Emoji_Presentation}/u.test(part))

/**
 * A draft with its Emoji parts turned into slots, and what each was: `{ sequence, emoji }`, the
 * sequence the composer draws (every Emoji a ⬚) and the Emoji in reading order, each with its slot.
 * A draft that does not read is its own sequence with no Emoji.
 * @param {string} sequence
 * @returns {{ sequence: string, emoji: EmojiPart[] }}
 */
export function emojiSlots(sequence) {
  let tree
  try { tree = parseDescription(sequence) } catch { return { sequence, emoji: [] } }
  /** @type {EmojiPart[]} */
  const emoji = []
  let slot = 0, leaf = 0
  // Each operator toggles the mirrors above it; a subtraction's second operand alternates the cut,
  // and an overlay marks what follows it.
  /**
   * `part` written back with its operators' flips folded into the Emoji below it, each Emoji a slot.
   * @param {import('./tree.js').Part} part @param {boolean} x @param {boolean} y @param {boolean} cut
   * @param {boolean} overlay @param {boolean} restored
   * @returns {import('./tree.js').Part}
   */
  const convert = (part, x, y, cut, overlay, restored) => {
    if (!isNode(part)) {
      const index = leaf++
      if (part === null) { slot++; return null }
      if (!isEmojiPart(part)) return part
      /** @type {EmojiPart} */
      const item = { text: part, slot: slot++, leaf: index }
      if (x || y) item.flip = [x, y]
      if (cut) item.cut = true
      else if (restored) item.restored = true
      if (overlay) item.overlay = true
      emoji.push(item)
      return null
    }
    const flipX = x !== (part.op === '⿾' || part.op === '⿿')
    const flipY = y !== (part.op === '⿿')
    /** @type {import('./tree.js').Part[]} */
    const parts = part.parts.map((child, index) => convert(child, flipX, flipY,
      cut !== (part.op === '㇯' && index === 1), overlay || part.op === '⿻', restored || (part.op === '㇯' && index === 1)))
    return { ...part, parts }
  }
  const drawn = convert(tree, false, false, false, false, false)
  return { sequence: writeDescription(drawn), emoji }
}
