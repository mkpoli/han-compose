/** Encoded characters with a documented path to 幺, in code point order. */
export declare const yaoCharacters: readonly string[];
/** The sourced decomposition used when an edit opens this operand.
 * @param {string} host */
export declare function yaoDecomposition(host: string): {
    ids: string;
    regions: string;
    source: {
        author: string;
        title: string;
        date: string;
        url: string;
        sha256: string;
        file?: undefined;
    } | {
        sha256?: undefined;
        author: string;
        title: string;
        date: string;
        url: string;
        file?: undefined;
    } | {
        sha256?: undefined;
        author?: undefined;
        date?: undefined;
        url?: undefined;
        title: string;
        file: string;
    };
} | null;
export type YaoOccurrence = {
    path: number[];
    text: string;
    form: string | null;
};
export type Span = {
    text: string;
    start: number;
    end: number;
};
/** Each separately addressable 幺 in the written IDS and reachable encoded operands.
 * Paths descend through the source IDS of encoded characters. Unrelated and
 * unsupported operands remain opaque. An invalid draft has no editable sites.
 * @param {string} ids @returns {YaoOccurrence[]} */
export declare function yaoOccurrences(ids: string): YaoOccurrence[];
/** Write a form (by canonical ID or spelling) at exactly one source operand path.
 * Passing null writes bare 幺. Expand only ancestors of the requested occurrence,
 * leaving existing entity spellings, selectors, modifiers, slots and marks intact.
 * @param {string} ids @param {readonly number[]} path @param {string|null} form */
export declare function selectYao(ids: string, path: readonly number[], form: string | null): string;
