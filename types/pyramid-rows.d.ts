/** The four ways a pyramid can point. */
export declare const PYRAMID_DIRECTIONS: ('top' | 'bottom' | 'left' | 'right')[];
/**
 * A triangular arrangement of one repeated part, read from a tree: groups of 1, 2, 3, … of the same
 * cell, pointing top, bottom, left or right. Null unless it has at least `minLayers` layers. A cell
 * is any subtree, so a pyramid of a description reads back like one of a component; the cell is that
 * subtree. A row may be grouped by any `⿰` or `⿲` tree, and a stack by any `⿱` or `⿳` tree, so
 * equivalent spellings read alike. A single layer points `top`.
 * @param {unknown} tree
 * @param {{ minLayers?: number }} [options]
 * @returns {{ cell: unknown, layers: number, count: number, direction: 'top' | 'bottom' | 'left' | 'right' } | null}
 */
export declare function pyramidRows(tree: unknown, { minLayers }?: {
    minLayers?: number;
}): {
    cell: unknown;
    layers: number;
    count: number;
    direction: 'top' | 'bottom' | 'left' | 'right';
} | null;
/**
 * A pyramid standing on a base: rows of 1, 2, … `layers` cells of one part, and one more part under
 * them, read from a stack however its grouping spells it (⿳口⿰口口木 reads like ⿱⿱口⿰口口木). A base
 * is one part; it may repeat the cell, as `⿳口⿰口口口` is a pyramid of three 口 on a fourth, and it
 * may be a description, as `⿳口⿰口口⿱水火` puts a stacked 水火 under the pyramid. Null unless the
 * stack has at least `minLayers` pyramid rows and every row holds that many cells of the part. A
 * complete pyramid, such as ⿳口⿰口口⿲口口口, has no base row and reads by `pyramidRows`.
 * @param {unknown} tree
 * @param {{ minLayers?: number }} [options] At least two, the rows a pyramid needs.
 * @returns {{ cell: unknown, layers: number, base: unknown } | null}
 */
export declare function pyramidOnBase(tree: unknown, { minLayers }?: {
    minLayers?: number;
}): {
    cell: unknown;
    layers: number;
    base: unknown;
} | null;
