/** The cells in a pyramid of `layers` rows. @param {number} layers */
export declare const pyramidCount: (layers: number) => number;
/**
 * One part per cell of a pyramid of `layers` layers, as an IDS sequence. Rows of two or three use
 * `⿰` and `⿲`; longer rows split in half, and stacks of two or three use `⿱` and `⿳`, so the
 * description stays balanced. The 3-layer sequence is `⿳口⿰口口⿲口口口`. A sideways pyramid turns
 * it: columns of 1, 2, … cells, arranged with `⿰`/`⿲`, and each column stacked with `⿱`/`⿳`.
 *
 * The part is a component, any description or ⬚: `pyramidSequence('⿱众⿰众众', 2)` repeats that
 * description as `⿱⿱众⿰众众⿰⿱众⿰众众⿱众⿰众众`, and an empty part lays out empty slots.
 * @param {string} part A component, a description, or ⬚ for a slot.
 * @param {number} layers
 * @param {{ direction?: 'top' | 'bottom' | 'left' | 'right' }} [options] Where the pyramid points.
 * @returns {string}
 */
export declare function pyramidSequence(part: string, layers: number, { direction }?: {
    direction?: 'top' | 'bottom' | 'left' | 'right';
}): string;
