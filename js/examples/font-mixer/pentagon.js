import { FONT_STYLES } from '../../src/font-mix.js'

// The pad's geometry: one pole per face on a circle, the equal mix at the centre.
export const sides = FONT_STYLES.length
export const radius = 84
export const vertices = Array.from({ length: sides }, (_, i) => {
  const angle = ((i * 2) / sides - 0.5) * Math.PI
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
})
const cross = (a, b) => a[0] * b[1] - a[1] * b[0]

export const pointAt = (weights) =>
  [0, 1].map((axis) => vertices.reduce((v, p, i) => v + weights[i] * p[axis], 0))

// Each triangle blends its two poles with the centre. A point outside the pad
// takes the nearest mix on the edge it left through.
export function weightsAt(p) {
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides,
      a = vertices[i],
      b = vertices[j],
      area = cross(a, b)
    let u = cross(p, b) / area,
      v = cross(a, p) / area
    if (u < -1e-7 || v < -1e-7) continue
    u = Math.max(u, 0)
    v = Math.max(v, 0)
    if (u + v > 1) {
      v = Math.max(0, Math.min(1, v + (1 - u - v) / 2))
      u = 1 - v
    }
    // Leave a narrow target along each edge. Moving onto it continuously
    // removes the interior shares, keeping a two-face drag on its axis.
    const sum = u + v
    const radial = Math.min(1, sum / 0.965)
    const across = Math.max(0, Math.min(1, ((sum ? v / sum : 0) - 0.025) / 0.95))
    const weights = Array(sides).fill((1 - radial) / sides)
    weights[i] += radial * (1 - across)
    weights[j] += radial * across
    return weights
  }
  return Array(sides).fill(1 / sides)
}
