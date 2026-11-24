// @ts-check
// The part a generator repeats: one readable part of a description. It is a component, any whole
// description, or a draft with empty slots — `''` and ⬚ stand for a bare slot — so a generator can
// repeat a nested description (a pyramid of `⿱众⿰众众`) or lay out a scaffold to fill in.
import { parseDescription as parse, writeDescription as write } from './tree.js'

/**
 * The tree of a repeated part, from its text. Throws a TypeError naming `field` when the text is not
 * one readable part; an empty text, or ⬚, is the empty slot `null`.
 * @param {string | null | undefined} text
 * @param {string} field
 * @returns {import('./tree.js').Part}
 */
export function repeatedPart(text, field) {
  const written = String(text ?? '').trim()
  let tree
  try { tree = parse(written) } catch { throw new TypeError(`A ${field} must be one readable part.`) }
  return tree
}

/**
 * `tree` written as one description that reads back as the same tree. Throws a TypeError when it
 * does not: two parts that join into one component (a pair of regional indicators), or loose marks
 * at the end of a part, cannot stand together as written.
 * @param {import('./tree.js').Part} tree
 * @param {string} field
 * @returns {string}
 */
export function repeatedText(tree, field) {
  const text = write(tree)
  let read
  try { read = parse(text) } catch { throw new TypeError(`A ${field} cannot be repeated as written.`) }
  if (write(read) !== text) throw new TypeError(`A ${field} cannot be repeated as written.`)
  return text
}
