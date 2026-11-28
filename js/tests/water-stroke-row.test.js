import { expect, it } from 'bun:test'
import { componentParts } from '../src/component-forms.js'
import { fill, groupRings } from '../src/geometry.js'

it('preserves the 3 leaves of ⿲㇇丨𰛅, centres 丨 cleanly, and honours donor exclusions', () => {
  for (const style of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing', 'woodblock']) {
    const parts = componentParts('⿲㇇丨𰛅', undefined, style)
    expect(parts).toHaveLength(3)
    for (const donor of ['水', '丨']) {
      expect(componentParts('⿲㇇丨𰛅', undefined, style, true, new Set([donor]))).toBeNull()
    }
    expect(parts.every(p => p.target[1] >= -120 && p.target[3] <= 880)).toBe(true)
    const size = 250, box = [0, -120, 1000, 880]
    const masks = parts.map(p => fill(groupRings([p], 16), size, box))
    // No overlap between 丨 and either neighbouring part.
    expect(masks[1].some((v, i) => v && (masks[0][i] || masks[2][i]))).toBe(false)
    if (style === 'fangsong' || style === 'regular' || style === 'pen-writing' || style === 'woodblock') {
      const mb = parts[1].target, ulg = [], urg = []
      let minL = Infinity, minR = Infinity
      for (let row = 0; row < size; row++) {
        const y = 880 - row * 1000 / size
        let lR = -1, mL = -1, mR = -1, rL = -1
        for (let col = 0; col < size; col++) {
          const idx = row * size + col
          if (masks[0][idx]) lR = col
          if (masks[1][idx]) { if (mL < 0) mL = col; mR = col }
          if (masks[2][idx] && rL < 0) rL = col
        }
        if (mL >= 0) {
          if (lR >= 0) {
            const g = (mL - lR) * 1000 / size
            if (g < minL) minL = g
            if (y >= mb[1] + 0.55 * (mb[3] - mb[1])) ulg.push(g)
          }
          if (rL >= 0) {
            const g = (rL - mR) * 1000 / size
            if (g < minR) minR = g
            if (y >= mb[1] + 0.55 * (mb[3] - mb[1])) urg.push(g)
          }
        }
      }
      ulg.sort((a, b) => a - b)
      urg.sort((a, b) => a - b)
      expect(minL).toBeGreaterThanOrEqual(36)
      expect(minR).toBeGreaterThanOrEqual(40)
      expect(Math.abs(ulg[ulg.length >> 1] - urg[urg.length >> 1])).toBeLessThanOrEqual(8)
    }
  }
})
