/**
 * The tree of a repeated part, from its text. Throws a TypeError naming `field` when the text is not
 * one readable part; an empty text, or ⬚, is the empty slot `null`.
 * @param {string | null | undefined} text
 * @param {string} field
 * @returns {import('./tree.js').Part}
 */
export declare function repeatedPart(text: string | null | undefined, field: string): import('./tree.js').Part;
/**
 * `tree` written as one description that reads back as the same tree. Throws a TypeError when it
 * does not: two parts that join into one component (a pair of regional indicators), or loose marks
 * at the end of a part, cannot stand together as written.
 * @param {import('./tree.js').Part} tree
 * @param {string} field
 * @returns {string}
 */
export declare function repeatedText(tree: import('./tree.js').Part, field: string): string;
