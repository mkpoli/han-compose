export type YaoGroup = {
    indices: number[];
    box: number[];
    score: number;
    rawScore: number;
};
export type CollapsedYaoHost = {
    host: string;
    paths: number[][];
    edits: {
        index: number;
        path: number[];
        formId: string;
    }[];
};
/** Fast check before parsing whether a sequence contains any explicit 幺 variant token.
 * @param {string} text */
export declare function containsYaoVariant(text: string): boolean;
/** Collect every documented host character (including `幺`) that any subtree of `text` collapses to,
 * so the loader can prefetch their native glyph shards in the initial pass.
 * @param {string} text @returns {string[]} */
export declare function collectYaoHosts(text: string): string[];
/** If `text` is an edited spelling of an encoded host character `H`, recover `H` and each edited 幺
 * site's occurrence index, path, and canonical form ID.
 * @param {string} text @param {((seq: string) => string | null) | null} [lookupEncoded]
 * @returns {CollapsedYaoHost | null} */
export declare function collapseYaoHost(text: string, lookupEncoded?: ((seq: string) => string | null) | null): CollapsedYaoHost | null;
/** Detect up to `expectedCount` 幺 contour groups in `part` (handles both stroke-separated and merged fonts).
 * @param {{ contours: any[], box: number[] }} part @param {number} expectedCount
 * @returns {YaoGroup[]} */
export declare function findYaoGroups(part: {
    contours: any[];
    box: number[];
}, expectedCount: number): YaoGroup[];
/** Fit `yaoPart(formId)` to `targetBox` and adjust its stroke weight isotropically in target
 * coordinates to match the ink density of `originalPart`.
 * @param {string} formId @param {{ contours: any[], box: number[] }} originalPart @param {number[]} targetBox */
export declare function matchedYaoForTarget(formId: string, originalPart: {
    contours: any[];
    box: number[];
}, targetBox: number[]): any;
/** Cached site-aligned 幺 groups for `glyph` (or null if fewer than `siteCount` clean matches exist,
 * or if a candidate swallows a lower stacked sibling such as 小/{86} in a fused fallback glyph).
 * @param {{ contours: any[], box: number[] }} glyph @param {string} host @param {number} siteCount
 * @returns {YaoGroup[] | null} */
export declare function alignedYaoGroups(glyph: {
    contours: any[];
    box: number[];
}, host: string, siteCount: number): YaoGroup[] | null;
/** Replace only the edited 幺 occurrence(s) inside `glyph`, keeping every other stroke and layout
 * proportion native to `host`. Returns null when `glyph` has no clean match for the host's sites.
 * @param {{ contours: any[], box: number[] }} glyph @param {string} host
 * @param {number[][]} paths @param {{ index: number, path: number[], formId: string }[]} edits
 * @param {number[]} region @param {boolean} atRoot */
export declare function replaceYaoInPart(glyph: {
    contours: any[];
    box: number[];
}, host: string, paths: number[][], edits: {
    index: number;
    path: number[];
    formId: string;
}[], region: number[], atRoot: boolean): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
}[] | null;
