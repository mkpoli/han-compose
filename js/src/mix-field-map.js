// @ts-check

/** Bilinear interpolation in a square grid with samples at integer coordinates.
 * @param {Float32Array} grid @param {number} n @param {number} x @param {number} y */
export function sampleGrid(grid, n, x, y) {
  x = Math.min(n - 1, Math.max(0, x))
  y = Math.min(n - 1, Math.max(0, y))
  const a = Math.floor(x),
    b = Math.floor(y),
    i = b * n + a
  const right = Math.min(a + 1, n - 1) - a,
    down = (Math.min(b + 1, n - 1) - b) * n
  const top = grid[i] + (x - a) * (grid[i + right] - grid[i])
  const bottom = grid[i + down] + (x - a) * (grid[i + down + right] - grid[i + down])
  return top + (y - b) * (bottom - top)
}

/** Register the edges of two distance fields on a shared lattice. A displacement
 * at a node maps its neighbourhood into the two faces in opposite directions.
 * @param {Float32Array} a @param {Float32Array} b @param {number} side */
export function registerFields(a, b, side) {
  let n = 1,
    dx = new Float32Array(1),
    dy = new Float32Array(1)
  for (const step of [16, 8, 4]) {
    const previous = n,
      px = dx,
      py = dy
    n = side / step + 1
    dx = new Float32Array(n * n)
    dy = new Float32Array(n * n)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        dx[j * n + i] = sampleGrid(px, previous, i / 2, j / 2)
        dy[j * n + i] = sampleGrid(py, previous, i / 2, j / 2)
      }
    const delta = step / 4
    for (let pass = 0; pass < 6; pass++)
      for (let jj = 1; jj < n - 1; jj++)
        for (let ii = 1; ii < n - 1; ii++) {
          const i = pass % 2 ? n - 1 - ii : ii,
            j = pass % 2 ? n - 1 - jj : jj
          const k = j * n + i,
            x = i * step,
            y = j * step
          const mx = (dx[k - 1] + dx[k + 1] + dx[k - n] + dx[k + n]) / 4
          const my = (dy[k - 1] + dy[k + 1] + dy[k - n] + dy[k + n]) / 4
          let best = Infinity,
            u = dx[k],
            v = dy[k]
          for (const [tx, ty] of [
            [dx[k], dy[k]],
            [mx, my],
            [mx + delta, my],
            [mx - delta, my],
            [mx, my + delta],
            [mx, my - delta],
            [dx[k] + delta, dy[k]],
            [dx[k] - delta, dy[k]],
            [dx[k], dy[k] + delta],
            [dx[k], dy[k] - delta]
          ]) {
            let cost = 0.7 * ((tx - mx) ** 2 + (ty - my) ** 2)
            for (let sy = -1; sy <= 1; sy++)
              for (let sx = -1; sx <= 1; sx++) {
                const cx = x + sx * step * 0.65,
                  cy = y + sy * step * 0.65
                const av = sampleGrid(a, side, cx - tx, cy - ty),
                  bv = sampleGrid(b, side, cx + tx, cy + ty)
                const band = step + 4
                cost += (Math.max(-band, Math.min(band, av)) - Math.max(-band, Math.min(band, bv))) ** 2 / 9
              }
            if (cost < best) {
              best = cost
              u = tx
              v = ty
            }
          }
          dx[k] = u
          dy[k] = v
        }
  }
  return (/** @type {number} */ x, /** @type {number} */ y) => [
    sampleGrid(dx, n, x / 4, y / 4),
    sampleGrid(dy, n, x / 4, y / 4)
  ]
}
