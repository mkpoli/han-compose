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
/** Look up `han-decompose`-verified contour indices for `host` on primary Source Han Serif glyphs,
 * returning site-aligned groups without running geometric search, or null when uncatalogued.
 * @param {{ contours: any[], box: number[] }} glyph @param {string} host @param {number} siteCount
 * @param {string} [fontStyle] @param {boolean} [isPrimary] @returns {YaoGroup[] | null} */
export declare function decomposedYaoGroups(glyph: {
    contours: any[];
    box: number[];
}, host: string, siteCount: number, fontStyle?: string, isPrimary?: boolean): YaoGroup[] | null;
/** Cached site-aligned 幺 groups for `glyph`: prefers `han-decompose`'s verified contour cuts on
 * primary Source Han Serif glyphs, falling back to geometric detection on uncatalogued hosts or
 * other faces (rejecting fused glyphs that swallow a lower stacked sibling).
 * @param {{ contours: any[], box: number[] }} glyph @param {string} host @param {number} siteCount
 * @param {string} [fontStyle] @param {boolean} [isPrimary]
 * @returns {YaoGroup[] | null} */
export declare function alignedYaoGroups(glyph: {
    contours: any[];
    box: number[];
}, host: string, siteCount: number, fontStyle?: string, isPrimary?: boolean): YaoGroup[] | null;
/**
 * Identify the 5 separate Noto Serif strokes of a native detached 幺 (`bar`, `dot`, `midDiag`,
 * `topDiag`, `shortDot`). Returns null for merged/non-5-contour or non-detached faces so callers
 * fall back cleanly to whole-幺 replacement.
 * @param {{ contours: any[] }} glyph @param {number[]} indices @param {number[]} box
 */
export declare function classifyDetachedYao5(glyph: {
    contours: any[];
}, indices: number[], box: number[]): {
    bar: {
        ci: number;
        c: any;
        b: number[];
        nx0: number;
        ny0: number;
        nx1: number;
        ny1: number;
        nw: number;
        nh: number;
    };
    dot: {
        ci: number;
        c: any;
        b: number[];
        nx0: number;
        ny0: number;
        nx1: number;
        ny1: number;
        nw: number;
        nh: number;
    };
    midDiag: {
        ci: number;
        c: any;
        b: number[];
        nx0: number;
        ny0: number;
        nx1: number;
        ny1: number;
        nw: number;
        nh: number;
    };
    topDiag: {
        ci: number;
        c: any;
        b: number[];
        nx0: number;
        ny0: number;
        nx1: number;
        ny1: number;
        nw: number;
        nh: number;
    };
    shortDot: {
        ci: number;
        c: any;
        b: number[];
        nx0: number;
        ny0: number;
        nx1: number;
        ny1: number;
        nw: number;
        nh: number;
    };
    box: number[];
} | null;
/** Replace only the edited 幺 occurrence(s) inside `glyph`, keeping every other stroke and layout
 * proportion native to `host`. On 5-contour native detached 幺 glyphs (Noto Serif CJK JP), keeps
 * native strokes untouched for `detached` and edits only the upper turn for `folded`/`returning`;
 * falls back to weight-matched whole-幺 replacement on merged/other glyphs.
 * @param {{ contours: any[], box: number[] }} glyph @param {string} host
 * @param {number[][]} paths @param {{ index: number, path: number[], formId: string }[]} edits
 * @param {number[]} region @param {boolean} atRoot
 * @param {{ fontStyle?: string, isPrimary?: boolean, nativeInk?: number | null }} [opts] */
export declare function replaceYaoInPart(glyph: {
    contours: any[];
    box: number[];
}, host: string, paths: number[][], edits: {
    index: number;
    path: number[];
    formId: string;
}[], region: number[], atRoot: boolean, opts?: {
    fontStyle?: string;
    isPrimary?: boolean;
    nativeInk?: number | null;
}): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[] | {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
}[] | null;
