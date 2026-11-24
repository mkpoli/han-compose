/** Compatibility jamo by class, in the order the syllable block indexes them. */
export declare const COMPAT_INITIALS: string[];
export declare const COMPAT_MEDIALS: string[];
export declare const COMPAT_FINALS: string[];
/** Every consonant a syllable is written with, its double letters and clusters included. */
export declare const HANGUL_CONSONANTS: string[];
/** Every vowel a syllable is written with, the compound ones included. */
export declare const HANGUL_VOWELS: string[];
/** Whether a jamo is a consonant or a vowel, or null for any other character.
 * @param {string} letter @returns {'consonant' | 'vowel' | null} */
export declare function jamoKind(letter: string): 'consonant' | 'vowel' | null;
/** The letters of a precomposed syllable, or null for anything else.
 * @param {string} syllable
 * @returns {{ initial: string, medial: string, final: string } | null} */
export declare function hangulLetters(syllable: string): {
    initial: string;
    medial: string;
    final: string;
} | null;
/** The description of one precomposed Hangul syllable, by its 配置, or null for anything else.
 * @param {string} syllable @returns {string | null} */
export declare function hangulIdsOf(syllable: string): string | null;
/** The precomposed syllable a description composes, or null when it does not read as one.
 *  Reading order carries the roles: a consonant, one or two vowels, then no consonant or two.
 *  A part written as a precomposed syllable joins in as its letters, so ⿱아ㄶ reads 않.
 * @param {string} text @returns {string | null} */
export declare function hangulOfIds(text: string): string | null;
