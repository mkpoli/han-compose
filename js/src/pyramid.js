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
