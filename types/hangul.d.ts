export type JamoClass = 'L' | 'V' | 'T';
export type Composed = {
    text: string;
    precomposed: boolean;
};
/** The jamo a combiner offers, modern first. */
export declare const HANGUL_INITIALS: {
    modern: string[];
    historical: string[];
};
export declare const HANGUL_MEDIALS: {
    modern: string[];
    historical: string[];
};
export declare const HANGUL_FINALS: {
    modern: string[];
    historical: string[];
};
/** The class of a conjoining jamo, or null for anything else. @param {string | undefined} char @returns {JamoClass | null} */
export declare function jamoClass(char: string | undefined): JamoClass | null;
/** `char` as a conjoining jamo for `role`, mapping compatibility jamo; null when it cannot take that role.
 * @param {string | undefined} char @param {JamoClass} role @returns {string | null} */
export declare function toConjoiningJamo(char: string | undefined, role: JamoClass): string | null;
/** The conjoining jamo run starting at `at` that forms one syllable, or null. The run is L* V+ T*.
 * @param {string[]} chars @param {number} at @returns {{ text: string, end: number } | null} */
export declare function hangulClusterAt(chars: string[], at: number): {
    text: string;
    end: number;
} | null;
/** Middle Korean tone marks (bangjeom), written after the syllable they mark and drawn at its left:
 * one dot for the high tone, two for the rising one, neither for the low.
 * https://www.unicode.org/Public/18.0.0/ucd/NamesList.txt (single and double dot Bangjeom)
 * https://encykorea.aks.ac.kr/Article/E0021781 */
export declare const HANGUL_TONE_MARKS: {
    high: string;
    rising: string;
};
/** Compose an initial, a medial and an optional final. A modern triple becomes one precomposed
 * syllable; any other valid combination becomes its conjoining jamo run. `tone` adds its mark.
 * @param {string} initial @param {string} medial @param {string} [final] @param {string} [tone]
 * @returns {Composed | null} */
export declare function composeHangul(initial: string, medial: string, final?: string, tone?: string): Composed | null;
/** One syllable composed from compatibility or conjoining jamo, or null. Used by filters that accept
 * jamo as they are typed. @param {string} text @returns {string | null} */
export declare function composeJamo(text: string): string | null;
/** The Revised Romanization of one precomposed Hangul syllable, or null for anything else.
 * @param {string} syllable @returns {string | null} */
export declare function romanizeHangul(syllable: string): string | null;
/** Fold the forms people type for a romanized syllable: case, separators, McCune's breve vowels. @param {string} text */
export declare function normalizeRomanization(text: string): string;
/** The precomposed syllables whose romanization is exactly `query`, or starts with it, in code
 * point order. @param {string} query @returns {string[]} */
export declare function findSyllablesByRomanization(query: string): string[];
