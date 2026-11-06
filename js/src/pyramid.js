// @ts-check
// Pyramids: where their cells go, and the balanced description that writes one. One square per
// component, with the same gap between every row and every column; rows centred, so the silhouette
// is an isosceles triangle even when the IDS tree groups rows and row components in halves.
export { pyramidCount, pyramidSequence } from './pyramid-sequence.js'

/** The gap between cells, as a share of a cell. 0.13 keeps the six-cell pyramid's old spacing. */
export const PYRAMID_GAP = 0.13

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
export function pyramidCells(region, layers, { direction = 'top' } = {}) {
  const [x0, y0, x1, y1] = region
  const span = Math.min(x1 - x0, y1 - y0)
  if (!Number.isInteger(layers) || layers <= 0 || !(span > 0)) return []
  const cell = span / (layers + PYRAMID_GAP * (layers - 1))
  const gap = cell * PYRAMID_GAP
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const across = (layers * cell + (layers - 1) * gap) / 2
  const cells = []
  if (direction === 'left' || direction === 'right') {
    const widestFirst = direction === 'right'
    const left = cx - across
    for (let column = 0; column < layers; column++) {
      const count = widestFirst ? layers - column : column + 1
      const height = count * cell + (count - 1) * gap
      const x = left + column * (cell + gap) + cell / 2
      const top = cy + (height - cell) / 2
      for (let i = 0; i < count; i++) {
        const y = top - i * (cell + gap)
        cells.push([x - cell / 2, y - cell / 2, x + cell / 2, y + cell / 2])
      }
    }
    return cells
  }
  const widestFirst = direction === 'bottom'
  const top = cy + across - cell / 2
  for (let row = 0; row < layers; row++) {
    const count = widestFirst ? layers - row : row + 1
    const width = count * cell + (count - 1) * gap
    const y = top - row * (cell + gap)
    for (let i = 0; i < count; i++) {
      const x = cx - width / 2 + i * (cell + gap)
      cells.push([x, y - cell / 2, x + cell, y + cell / 2])
    }
  }
  return cells
}

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
export function pyramidOnBaseLayout(region, layers) {
  const [x0, y0, x1, y1] = region
  const width = x1 - x0, height = y1 - y0
  if (!Number.isInteger(layers) || layers <= 0 || !(width > 0) || !(height > 0)) return { cells: [], base: [x0, y0, x1, y0] }
  // A cell's height, with a gap after every row and above the base: `layers + 1` rows plus
  // `layers` gaps, the gap a share of the cell.
  const unit = height / (layers + 1 + PYRAMID_GAP * layers)
  const base = [x0, y0, x1, y0 + unit]
  return { cells: pyramidOnBaseCells([x0, y0 + unit * (1 + PYRAMID_GAP), x1, y1], layers), base }
}

/**
 * The cells of the pyramid part of a pyramid standing on a base, inside `region` ([x0, y0, x1, y1],
 * y up), in reading order. The widest row spans the region's width and the rows fill its height, so
 * a cell is wider than it is tall, the way the shape is written by hand. All cells are the same
 * size, every row is centred, and `PYRAMID_GAP` of a cell separates both columns and rows.
 * @param {number[]} region
 * @param {number} layers
 * @returns {number[][]}
 */
export function pyramidOnBaseCells(region, layers) {
  const [x0, y0, x1, y1] = region
  const width = x1 - x0, height = y1 - y0
  if (!Number.isInteger(layers) || layers <= 0 || !(width > 0) || !(height > 0)) return []
  // The widest row holds `layers` cells, and the rows stack `layers` deep, with a gap between each.
  const span = layers + PYRAMID_GAP * (layers - 1)
  const cellWidth = width / span, cellHeight = height / span
  const columnGap = cellWidth * PYRAMID_GAP, rowGap = cellHeight * PYRAMID_GAP
  const cx = (x0 + x1) / 2
  const cells = []
  for (let row = 0; row < layers; row++) {
    const count = row + 1
    const top = y1 - row * (cellHeight + rowGap)
    const left = cx - (count * cellWidth + (count - 1) * columnGap) / 2
    for (let i = 0; i < count; i++) {
      const x = left + i * (cellWidth + columnGap)
      cells.push([x, top - cellHeight, x + cellWidth, top])
    }
  }
  return cells
}
