// @ts-check
// A Hangul syllable as an ideographic description of its letters, by the syllable's 配置: the
// initial stands at the left with a vertical vowel, above a horizontal one; a final goes below,
// and a syllable with a horizontal vowel and a final stacks all three. 가 is ⿰ㄱㅏ, 공 is
// ⿳ㄱㅗㅇ, 않 is ⿱⿰ㅇㅏ⿰ㄴㅎ. Every precomposed syllable of the Hangul Syllable block has one
// description, and the description composes back to it.
//
// Letters are classified as consonants and vowels rather than as initial, medial and final: ㄱ is
// one letter wherever it stands, and its place in the reading order decides the part it plays.
import { composeHangul, toConjoiningJamo } from './hangul.js'
import { isNode, parseDescription as parse } from './tree.js'

/** Compatibility jamo by class, in the order the syllable block indexes them. */
export const COMPAT_INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ']
export const COMPAT_MEDIALS = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ']
export const COMPAT_FINALS = [...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ']

/** Every consonant a syllable is written with, its double letters and clusters included. */
export const HANGUL_CONSONANTS = [...new Set([...COMPAT_INITIALS, ...COMPAT_FINALS])]
/** Every vowel a syllable is written with, the compound ones included. */
export const HANGUL_VOWELS = [...COMPAT_MEDIALS]

/** The two letters a compound vowel or a double final is written with. */
const VOWEL_PARTS = new Map([['ㅘ', 'ㅗㅏ'], ['ㅙ', 'ㅗㅐ'], ['ㅚ', 'ㅗㅣ'], ['ㅝ', 'ㅜㅓ'], ['ㅞ', 'ㅜㅔ'], ['ㅟ', 'ㅜㅣ'], ['ㅢ', 'ㅡㅣ']])
const FINAL_PARTS = new Map([['ㄳ', 'ㄱㅅ'], ['ㄵ', 'ㄴㅈ'], ['ㄶ', 'ㄴㅎ'], ['ㄺ', 'ㄹㄱ'], ['ㄻ', 'ㄹㅁ'], ['ㄼ', 'ㄹㅂ'], ['ㄽ', 'ㄹㅅ'], ['ㄾ', 'ㄹㅌ'], ['ㄿ', 'ㄹㅍ'], ['ㅀ', 'ㄹㅎ'], ['ㅄ', 'ㅂㅅ']])
const VOWEL_OF = new Map([...VOWEL_PARTS].map(([whole, parts]) => [parts, whole]))
const FINAL_OF = new Map([...FINAL_PARTS].map(([whole, parts]) => [parts, whole]))

/** A medial written below the initial: ㅗ ㅛ ㅜ ㅠ ㅡ. Every other medial stands at its right,
 *  including the compound ones, whose first part sits at the lower left. */
const BELOW = new Set(['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ'])

/** Whether a jamo is a consonant or a vowel, or null for any other character.
 * @param {string} letter @returns {'consonant' | 'vowel' | null} */
export function jamoKind(letter) {
  if ([...letter].length !== 1) return null
  if (HANGUL_VOWELS.includes(letter)) return 'vowel'
  if (HANGUL_CONSONANTS.includes(letter)) return 'consonant'
  return null
}

/** The letters of a precomposed syllable, or null for anything else.
 * @param {string} syllable
 * @returns {{ initial: string, medial: string, final: string } | null} */
export function hangulLetters(syllable) {
  const cp = [...syllable].length === 1 ? syllable.codePointAt(0) : undefined
  if (cp === undefined || cp < 0xac00 || cp > 0xd7a3) return null
  const index = cp - 0xac00
  const initial = COMPAT_INITIALS[Math.floor(index / 588)]
  const medial = COMPAT_MEDIALS[Math.floor(index % 588 / 28)]
  const final = index % 28 ? COMPAT_FINALS[index % 28 - 1] : ''
  return initial && medial ? { initial, medial, final } : null
}

/** A letter or a two-letter cluster as one description: ㅘ is ⿰ㅗㅏ, ㄶ is ⿰ㄴㅎ. */
/** @param {string} letters @param {Map<string, string>} parts */
const cluster = (letters, parts) => {
  const split = parts.get(letters)
  return split ? `⿰${split[0]}${split[1]}` : letters
}

/** The description of one syllable's letters, as the syllable's 配置 sets them.
 * @param {string} initial @param {string} medial @param {string} final */
function describeSyllable(initial, medial, final) {
  const vowel = cluster(medial, VOWEL_PARTS)
  const last = final ? cluster(final, FINAL_PARTS) : ''
  if (!last) return BELOW.has(medial) ? `⿱${initial}${vowel}` : `⿰${initial}${vowel}`
  // A vowel below the initial takes the final on a third level; one beside it hangs the final below.
  return BELOW.has(medial) ? `⿳${initial}${vowel}${last}` : `⿱⿰${initial}${vowel}${last}`
}

/** The description of one precomposed Hangul syllable, by its 配置, or null for anything else.
 * @param {string} syllable @returns {string | null} */
export function hangulIdsOf(syllable) {
  const letters = hangulLetters(syllable)
  return letters ? describeSyllable(letters.initial, letters.medial, letters.final) : null
}

/** The leaves of a description in reading order. @param {import('./tree.js').Part} part
 *  @returns {Generator<string>} */
function* flatten(part) {
  if (part === null) return
  if (!isNode(part)) { yield part; return }
  for (const child of part.parts) yield* flatten(child)
}

/** The precomposed syllable a description composes, or null when it does not read as one.
 *  Reading order carries the roles: a consonant, one or two vowels, then no consonant or two.
 *  A part written as a precomposed syllable joins in as its letters, so ⿱아ㄶ reads 않.
 * @param {string} text @returns {string | null} */
export function hangulOfIds(text) {
  // Only a description holding a compatibility jamo can be one; skip the parse for anything else.
  if (!/[\u3131-\u318E]/u.test(text)) return null
  /** @type {import('./tree.js').Part | null} */
  let tree = null
  try { tree = parse(text) } catch { return null }
  if (tree === null) return null
  const letters = [...flatten(tree)].flatMap(leaf => {
    const written = hangulLetters(leaf)
    if (!written) return [...(VOWEL_PARTS.get(leaf) ?? FINAL_PARTS.get(leaf) ?? leaf)]
    const vowel = VOWEL_PARTS.get(written.medial) ?? written.medial
    const final = written.final ? FINAL_PARTS.get(written.final) ?? written.final : ''
    return [written.initial, ...vowel, ...final]
  })
  const kinds = letters.map(jamoKind)
  if (kinds.some(kind => kind === null)) return null
  let at = 0
  if (kinds[at] !== 'consonant') return null
  const initial = letters[at++]
  if (kinds[at] !== 'vowel') return null
  let medial = letters[at++]
  if (kinds[at] === 'vowel') { medial = VOWEL_OF.get(medial + letters[at]) ?? ''; at++ }
  if (!medial) return null
  let final = ''
  if (at < letters.length) {
    if (kinds[at] !== 'consonant') return null
    final = letters[at++]
    if (at < letters.length) final = FINAL_OF.get(final + letters[at++]) ?? ''
    if (!final) return null
  }
  if (at !== letters.length) return null
  const composed = composeHangul(
    toConjoiningJamo(initial, 'L') ?? '',
    toConjoiningJamo(medial, 'V') ?? '',
    final ? toConjoiningJamo(final, 'T') ?? '' : '',
  )
  if (!composed?.precomposed) return null
  // A description reads as the syllable when it names the same letters in the order the syllable
  // sets them: ⿱⿰ㅇㅏㄴㅎ and ⿱⿰ㅇㅏ⿰ㄴㅎ both read 않, while ⿰ㅏㄱ reads nothing.
  return letters.join('') === hangulLetters(composed.text)?.initial + (VOWEL_PARTS.get(medial) ?? medial) + (final ? FINAL_PARTS.get(final) ?? final : '')
    ? composed.text
    : null
}
