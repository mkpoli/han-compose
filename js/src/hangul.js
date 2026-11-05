// @ts-check
// Hangul jamo composition. A modern initial, medial and final compose to one precomposed syllable
// in the Hangul Syllable block. Old Hangul combinations stay a run of conjoining jamo, which fonts
// shape into one syllable; Unicode does not precompose them. A Middle Korean tone mark (bangjeom)
// follows the syllable it marks.

/** @typedef {'L' | 'V' | 'T'} JamoClass */
/** @typedef {{ text: string, precomposed: boolean }} Composed */

/** @type {ReadonlyArray<readonly [JamoClass, number, number]>} */
const RANGES = [
  ['L', 0x1100, 0x115e], ['L', 0xa960, 0xa97c],
  ['V', 0x1161, 0x11a7], ['V', 0xd7b0, 0xd7c6],
  ['T', 0x11a8, 0x11ff], ['T', 0xd7cb, 0xd7fb],
]
/** Choseong and jungseong fillers do not form a syllable. */
const FILLERS = new Set([0x115f, 0x1160])
const toChars = (/** @type {number} */ first, /** @type {number} */ last) =>
  Array.from({ length: last - first + 1 }, (_, i) => String.fromCodePoint(first + i))

/** The jamo a combiner offers, modern first. */
export const HANGUL_INITIALS = {
  modern: toChars(0x1100, 0x1112),
  historical: [...toChars(0x1113, 0x115e), ...toChars(0xa960, 0xa97c)],
}
export const HANGUL_MEDIALS = {
  modern: toChars(0x1161, 0x1175),
  historical: [...toChars(0x1176, 0x11a7), ...toChars(0xd7b0, 0xd7c6)],
}
export const HANGUL_FINALS = {
  modern: toChars(0x11a8, 0x11c2),
  historical: [...toChars(0x11c3, 0x11ff), ...toChars(0xd7cb, 0xd7fb)],
}

// Compatibility jamo are in the same order as the modern conjoining jamo of their class.
/** @param {string} letters @param {number} first @returns {Map<number, number>} */
const compatibility = (letters, first) => new Map([...letters].map((letter, i) => [letter.codePointAt(0) ?? 0, first + i]))
const COMPATIBILITY = {
  L: compatibility('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', 0x1100),
  V: compatibility('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', 0x1161),
  T: compatibility('ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ', 0x11a8),
}

/** The class of a conjoining jamo, or null for anything else. @param {string | undefined} char @returns {JamoClass | null} */
export function jamoClass(char) {
  const cp = char?.codePointAt(0)
  if (cp === undefined || FILLERS.has(cp)) return null
  for (const [role, first, last] of RANGES) if (cp >= first && cp <= last) return role
  return null
}

/** `char` as a conjoining jamo for `role`, mapping compatibility jamo; null when it cannot take that role.
 * @param {string | undefined} char @param {JamoClass} role @returns {string | null} */
export function toConjoiningJamo(char, role) {
  if (!char) return null
  if (jamoClass(char) === role) return char
  const cp = char.codePointAt(0)
  const mapped = cp === undefined ? undefined : COMPATIBILITY[role].get(cp)
  return mapped === undefined ? null : String.fromCodePoint(mapped)
}

/** The conjoining jamo run starting at `at` that forms one syllable, or null. The run is L* V+ T*.
 * @param {string[]} chars @param {number} at @returns {{ text: string, end: number } | null} */
export function hangulClusterAt(chars, at) {
  if (jamoClass(chars[at]) !== 'L') return null
  let end = at
  while (jamoClass(chars[end]) === 'L') end++
  if (jamoClass(chars[end]) !== 'V') return null
  while (jamoClass(chars[end]) === 'V') end++
  while (jamoClass(chars[end]) === 'T') end++
  return { text: chars.slice(at, end).join(''), end }
}

/** Middle Korean tone marks (bangjeom), written after the syllable they mark and drawn at its left:
 * one dot for the high tone, two for the rising one, neither for the low.
 * https://www.unicode.org/Public/18.0.0/ucd/NamesList.txt (single and double dot Bangjeom)
 * https://encykorea.aks.ac.kr/Article/E0021781 */
export const HANGUL_TONE_MARKS = { high: '\u302E', rising: '\u302F' }

/** Compose an initial, a medial and an optional final. A modern triple becomes one precomposed
 * syllable; any other valid combination becomes its conjoining jamo run. `tone` adds its mark.
 * @param {string} initial @param {string} medial @param {string} [final] @param {string} [tone]
 * @returns {Composed | null} */
export function composeHangul(initial, medial, final = '', tone = '') {
  if ([...initial].length !== 1 || [...medial].length !== 1 || [...final].length > 1) return null
  if (tone && !Object.values(HANGUL_TONE_MARKS).includes(tone)) return null
  const l = toConjoiningJamo(initial, 'L'), v = toConjoiningJamo(medial, 'V')
  const t = final ? toConjoiningJamo(final, 'T') : ''
  if (!l || !v || final && !t) return null
  const lc = l.codePointAt(0) ?? 0, vc = v.codePointAt(0) ?? 0, tc = t ? t.codePointAt(0) ?? 0 : 0
  if (lc >= 0x1100 && lc <= 0x1112 && vc >= 0x1161 && vc <= 0x1175 && (!t || tc >= 0x11a8 && tc <= 0x11c2)) {
    const syllable = 0xac00 + ((lc - 0x1100) * 21 + (vc - 0x1161)) * 28 + (t ? tc - 0x11a7 : 0)
    return { text: String.fromCodePoint(syllable) + tone, precomposed: true }
  }
  return { text: l + v + t + tone, precomposed: false }
}

/** One syllable composed from compatibility or conjoining jamo, or null. Used by filters that accept
 * jamo as they are typed. @param {string} text @returns {string | null} */
export function composeJamo(text) {
  const chars = [...text]
  if (chars.length < 2) return null
  const cluster = hangulClusterAt(chars, 0)
  if (cluster && cluster.end === chars.length) {
    const text = cluster.text.normalize('NFC')
    return [...text].length === 1 ? text : cluster.text
  }
  const initial = toConjoiningJamo(chars[0], 'L'), medial = toConjoiningJamo(chars[1], 'V')
  if (!initial || !medial) return null
  const finals = chars.slice(2).map(char => toConjoiningJamo(char, 'T'))
  if (finals.length > 1 || finals.some(char => char === null)) return null
  return composeHangul(initial, medial, finals.join(''))?.text ?? null
}

// Revised Romanization of Korean (National Institute of Korean Language, 2000) and the normalized
// initial spellings of McCune-Reischauer (1939), as syllable spellings: the tables below, without
// the assimilation rules that apply across syllable boundaries.
// https://www.korean.go.kr/front_eng/roman/roman_01.do
// https://en.wikipedia.org/wiki/McCune%E2%80%93Reischauer
const ROMAN_INITIALS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const ROMAN_MR_INITIALS = ['k', 'kk', 'n', 't', 'tt', 'r', 'm', 'p', 'pp', 's', 'ss', '', 'ch', 'tch', 'ch', 'k', 't', 'p', 'h']
const ROMAN_VOWELS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
const ROMAN_FINALS = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't']

/** The Revised Romanization of one precomposed Hangul syllable, or null for anything else.
 * @param {string} syllable @returns {string | null} */
export function romanizeHangul(syllable) {
  const cp = syllable.codePointAt(0)
  if (cp === undefined || [...syllable].length !== 1 || cp < 0xac00 || cp > 0xd7a3) return null
  const index = cp - 0xac00
  return ROMAN_INITIALS[Math.floor(index / 588)] + ROMAN_VOWELS[Math.floor(index % 588 / 28)] + ROMAN_FINALS[index % 28]
}

/** Fold the forms people type for a romanized syllable: case, separators, McCune's breve vowels. @param {string} text */
export function normalizeRomanization(text) {
  return text.normalize('NFC').toLowerCase().replace(/[’'\-–—\s]/g, '').replace(/ŏ/g, 'eo').replace(/ŭ/g, 'eu')
}

/** @type {Map<string, string[]> | null} */
let romanizationIndex = null
/** @returns {Map<string, string[]>} */
function romanizationSyllables() {
  if (romanizationIndex) return romanizationIndex
  romanizationIndex = new Map()
  for (let cp = 0xac00; cp <= 0xd7a3; cp++) {
    const syllable = String.fromCodePoint(cp), index = cp - 0xac00
    const l = Math.floor(index / 588), v = Math.floor(index % 588 / 28), t = index % 28
    for (const key of new Set([ROMAN_INITIALS[l] + ROMAN_VOWELS[v] + ROMAN_FINALS[t], ROMAN_MR_INITIALS[l] + ROMAN_VOWELS[v] + ROMAN_FINALS[t]])) {
      const found = romanizationIndex.get(key)
      if (found) found.push(syllable)
      else romanizationIndex.set(key, [syllable])
    }
  }
  return romanizationIndex
}

/** The precomposed syllables whose romanization is exactly `query`, or starts with it, in code
 * point order. @param {string} query @returns {string[]} */
export function findSyllablesByRomanization(query) {
  const key = normalizeRomanization(query)
  if (!key || /[^a-z]/.test(key)) return []
  const index = romanizationSyllables()
  const exact = index.get(key)
  if (exact) return exact
  const matches = []
  for (const [roman, syllables] of index) if (roman.startsWith(key)) matches.push(...syllables)
  return [...new Set(matches)].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
}
