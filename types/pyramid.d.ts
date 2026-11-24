export { pyramidCount, pyramidSequence } from './pyramid-sequence.js';
/** The gap between cells, as a share of a cell. 0.13 keeps the six-cell pyramid's old spacing. */
export declare const PYRAMID_GAP = 0.13;
/**
 * The cells of a `layers`-layer pyramid inside `region` ([x0, y0, x1, y1], y up), in reading order.
 * Each cell is square and all cells are the same size. The pyramid fills the shorter side of the
 * region and is centred in it. `direction` is the way it points: rows of 1…`layers` cells for
 * `top`, the widest row first for `bottom`, and columns of 1…`layers` cells left or right for
 * `left`/`right`.
 * @param {number[]} region
 * @param {number} layers
 * @param {{ direction?: 'top' | 'bottom' | 'left' | 'right' }} [options]
 * @returns {number[][]}
 */
export declare function pyramidCells(region: number[], layers: number, { direction }?: {
    direction?: 'top' | 'bottom' | 'left' | 'right';
}): number[][];
/**
 * Where a pyramid standing on a base draws inside `region` ([x0, y0, x1, y1], y up): its cells in
 * reading order, and the base's box. The widest row spans the region's width and the rows fill
 * their part of its height, so a cell is wider than it is tall, the way the shape is written by
 * hand. All cells are the same size, every row is centred, and `PYRAMID_GAP` of a cell separates
 * both columns and rows, including the last row from the base.
 * @param {number[]} region
 * @param {number} layers
 * @returns {{ cells: number[][], base: number[] }}
 */
export declare function pyramidOnBaseLayout(region: number[], layers: number): {
    cells: number[][];
    base: number[];
};
/**
 * The cells of the pyramid part of a pyramid standing on a base, inside `region` ([x0, y0, x1, y1],
 * y up), in reading order. The widest row spans the region's width and the rows fill its height, so
 * a cell is wider than it is tall, the way the shape is written by hand. All cells are the same
 * size, every row is centred, and `PYRAMID_GAP` of a cell separates both columns and rows.
 * @param {number[]} region
 * @param {number} layers
 * @returns {number[][]}
 */
export declare function pyramidOnBaseCells(region: number[], layers: number): number[][];
