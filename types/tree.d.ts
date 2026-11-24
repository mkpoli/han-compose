export type Component = string;
export type Node = {
    op: string;
    parts: Part[];
    note?: string;
    marks?: string;
};
export type Part = Component | Node | null;
/** A slot still to fill (U+2B1A DOTTED SQUARE), and ＋ as older drafts and links write it. */
export declare const EMPTY = "\u2B1A";
export declare const EMPTY_MARKS: string[];
/** Whether an operator takes a modifier written after it. @param {string} op */
export declare const takesModifier: (op: string) => boolean;
/** The Shuishu characters, at the tentative allocations of the proposed block. */
export declare const SHUISHU: RegExp;
/** Whether `text` holds a Shuishu character. @param {string | null | undefined} text */
export declare const isShuishu: (text: string | null | undefined) => boolean;
/** The Jurchen characters of Unicode 18.0, U+18E00..U+19191, and its 51 radicals, U+191A0..U+191D2. */
export declare const JURCHEN: RegExp;
/** Whether `text` holds a Jurchen character or radical. @param {string | null | undefined} text */
export declare const isJurchen: (text: string | null | undefined) => boolean;
/** A Jurchen character with one of the selectors its variant sequences use. */
export declare const JURCHEN_VARIANT: RegExp;
/** Whether `text` holds one of the New Korean letters. @param {string | null | undefined} text */
export declare const isNewKorean: (text: string | null | undefined) => boolean;
/**
 * The character a zi.tools stroke chain names, by its contents (without `#(` and `)`): the strokes in
 * writing order, joined. Only the chains the grammar gives a character are read as one; any other is
 * a shape the composer cannot draw yet. Source: NightFurySL2001, （白式）IDS 延展语法导论,
 * <https://nightfurySl2001.github.io/bai-ids/>, §5.3.
 * @type {Readonly<Record<string, string>>}
 */
export declare const STROKE_CHAINS: Readonly<Record<string, string>>;
/**
 * The character the stroke chain starting at `chars[at]` names and where it ends, or null where none
 * starts there or it names none.
 * @param {string[]} chars @param {number} at @returns {{ char: string, end: number } | null}
 */
export declare function strokeChain(chars: string[], at: number): {
    char: string;
    end: number;
} | null;
/**
 * The component no code point names that starts at `chars[at]`, in its source's spelling, and where
 * it ends: a numbered component of BabelStone IDS (`{53}`, IDS.TXT note 6), an entity reference of
 * CHISE IDS (`&CDP-8BD0;`) or a zi.tools stroke chain (`#(-𠃌㇉)`, 白式 IDS §5). Null where none
 * starts there. Each is one component of a description; a chain the grammar gives a character is
 * read as that character first (`strokeChain`).
 * @param {string[]} chars @param {number} [at]
 * @returns {{ text: string, kind: 'numbered' | 'entity' | 'chain', end: number } | null}
 */
export declare function customAt(chars: string[], at?: number): {
    text: string;
    kind: 'numbered' | 'entity' | 'chain';
    end: number;
} | null;
/** Whether a component is one no code point names. @param {string | null | undefined} component */
export declare const isCustom: (component: string | null | undefined) => boolean;
/** The Emoji sequence a text starts with, or ''. @param {string} text */
export declare function emojiPrefix(text: string): string;
/** A jamo run that composes to a syllable, as the one component a field shows: initials, medials, finals.
 *  @param {string[]} chars @param {number} at @returns {{ text: string, end: number } | null} */
export declare function hangulClusterAt(chars: string[], at: number): {
    text: string;
    end: number;
} | null;
/** How many operands an operator takes; 0 for anything else. @param {string | undefined} char */
export declare const arity: (char: string | undefined) => number;
/** Whether `char` is a variation selector. @param {string | undefined} char */
export declare const isSelector: (char: string | undefined) => boolean;
/** Whether `part` is a node. @param {Part | undefined} part @returns {part is Node} */
export declare const isNode: (part: Part | undefined) => part is Node;
/** Whether `node` is an empty slot, `⬚` or numbered (`⬚0`). @param {unknown} node */
export declare const isEmpty: (node: unknown) => boolean;
/** Whether `char` may stand as a component: a graphic character (or one at a bundled allocation the
 *  engine draws: Small Seal, the New Korean letters, Shuishu) that is no operator and no slot.
 *  @param {string | undefined | null} char */
export declare function isComponent(char: string | undefined | null): boolean;
/** Whether `char` is an alphabetic or syllabic letter, or a decimal digit. @param {string | undefined | null} char */
export declare function isLetter(char: string | undefined | null): boolean;
/** Whether `char` may trail a description as a loose mark: a combining mark, a modifier letter, an
 *  accent or tone-letter symbol, a superscript or subscript digit. @param {string | undefined} char */
export declare const isMark: (char: string | undefined) => boolean;
/** A Middle Korean tone mark, U+302E or U+302F. Unlike the other loose marks it names the tone of the
 *  syllable it follows, and stays on it inside a longer description. @param {string | undefined} char */
export declare const isToneMark: (char: string | undefined) => char is "〮" | "〯";
/** Where the tone marks running from `at` end. @param {string[]} chars @param {number} at @returns {number} */
export declare function toneMarksAt(chars: string[], at: number): number;
/** The tone marks ending `marks`, apart from what comes before them.
 *  @param {string} marks @returns {{ rest: string, tones: string }} */
export declare function splitToneMarks(marks: string): {
    rest: string;
    tones: string;
};
/** The tone marks a part's components hold, in reading order. @param {Part} part @returns {string} */
export declare const tonesOf: (part: Part) => string;
/** Whether `text` is one or more loose marks and nothing else. @param {string | null | undefined} text */
export declare const isMarks: (text: string | null | undefined) => boolean;
/** The modifier after an operator at `chars[at]`, or '' where none starts there. @param {string[]} chars @param {number} at */
export declare function modifierAt(chars: string[], at: number): string;
/**
 * A description as a tree. An operator missing an operand, and a slot written `⬚` or `＋`, read as
 * null, so a draft is read like a whole description. Loose marks after the last part go on the
 * root: a node's `marks`, or a component's text. Throws a `SyntaxError` naming what is
 * wrong: a part that is no component, or text that does not hold exactly one description.
 * @param {string} sequence
 * @returns {Part}
 */
export declare function parseDescription(sequence: string): Part;
/** A tree written back as a description, an empty slot as ⬚. @param {Part} tree @returns {string} */
export declare const writeDescription: (tree: Part) => string;
/**
 * Where the description starting at `chars[at]` ends: the index just past it, or -1 where none starts
 * there. Text may run on past it (⿰亻哥 in `⿰亻哥と`, the marked text of an input method). A component
 * takes its variation selector; a stroke chain takes its own and the selector after it.
 * @param {string[]} chars
 * @param {number} [at]
 * @returns {number}
 */
export declare function descriptionEnd(chars: string[], at?: number): number;
/**
 * The description a text holds, and the loose marks that trail it: `{ base, marks }`. `base` is the
 * text when no description is found. A mark is kept only on the last part of the description; text
 * after that part is not a description's.
 * @param {string} text
 * @returns {{ base: string, marks: string }}
 */
export declare function splitDescription(text: string): {
    base: string;
    marks: string;
};
/**
 * `tree` with `marks` trailing it: a component keeps them in its text, a node in `marks`.
 * @param {Part} tree @param {string} marks @returns {Part}
 */
export declare function withMarks(tree: Part, marks: string): Part;
/** A part or a component split at its first character: the base and the loose marks after it.
 *  @param {Part} part @returns {{ base: Part, marks: string }} */
export declare function splitMarks(part: Part): {
    base: Part;
    marks: string;
};
/** The loose marks a component or a tree carries (`木ˊ`, or a node's `marks`). @param {Part | string} part */
export declare const marksOf: (part: Part | string) => string;
/** `part` without its loose marks. @param {Part | string} part */
export declare const withoutMarks: (part: Part | string) => Part;
/**
 * `tree` with every loose mark hoisted to its root, in reading order, and none left inside: the text
 * of a description carries marks only at its end. A tone mark stays on its syllable.
 * @param {Part} tree @returns {Part}
 */
export declare function normalizeMarks(tree: Part): Part;
/**
 * `tree` with the part at `path` (a list of operand indices) replaced by `part`.
 * @param {Part} tree @param {number[]} path @param {Part} part @returns {Part}
 */
export declare function replaceAt(tree: Part, path: number[], part: Part): Part;
/**
 * The leaves of a tree in reading order, with their paths: a node's operands, every level down.
 * @param {Part} tree
 * @param {number[]} [path]
 * @returns {{ path: number[], leaf: Part }[]}
 */
export declare function leaves(tree: Part, path?: number[]): {
    path: number[];
    leaf: Part;
}[];
