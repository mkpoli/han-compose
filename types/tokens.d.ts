export type Token = {
    path: number[];
    start: number;
    end: number;
    tokenEnd: number;
    text: string;
    noteStart?: number;
    noteEnd?: number;
};
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
export declare function tokens(text: string): Token[];
