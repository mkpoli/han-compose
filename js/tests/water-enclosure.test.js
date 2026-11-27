import { expect, it } from 'bun:test'
import { componentParts } from '../src/component-forms.js'
import { fill, groupRings } from '../src/geometry.js'

it('preserves the 2 leaves of ⿺水巜, balances 巜 height and stroke weight, and honours donor exclusions', () => {
  const medRun = (part) => {
    const size = 250, mask = fill(groupRings([part], 16), size, [0, -120, 1000, 880]), runs = []
    for (let row = 0; row < size; row++) {
      let run = 0
      for (let col = 0; col < size; col++) {
        if (mask[row * size + col]) run++
        else if (run) { runs.push(run * 1000 / size); run = 0 }
      }
      if (run) runs.push(run * 1000 / size)
    }
    runs.sort((a, b) => a - b)
    return runs[runs.length >> 1]
  }
  for (const style of ['sans', 'fangsong', 'regular', 'pen-writing', 'serif']) {
    const parts = componentParts('⿺水巜', undefined, style)
    expect(parts).toHaveLength(2)
    for (const donor of ['水', style === 'fangsong' ? '巛' : '巜']) {
      expect(componentParts('⿺水巜', undefined, style, true, new Set([donor]))).toBeNull()
    }
    const [water, bends] = parts
    expect(parts.every(p => p.target[1] >= -120 && p.target[3] <= 880)).toBe(true)
    const waterH = water.target[3] - water.target[1], bendsH = bends.target[3] - bends.target[1]
    expect(bendsH / waterH).toBeGreaterThan(0.54)
    expect(water.target[3] - bends.target[3]).toBeLessThan(105)
    expect(water.target[2] - bends.target[2]).toBeGreaterThan(20)
    // Both parts remain non-overlapping and share comparable stroke weight.
    const mw = fill(groupRings([water], 16), 250, [0, -120, 1000, 880])
    const mb = fill(groupRings([bends], 16), 250, [0, -120, 1000, 880])
    expect(mw.some((v, i) => v && mb[i])).toBe(false)
    const ratio = medRun(bends) / medRun(water)
    expect(ratio).toBeGreaterThan(0.85)
    expect(ratio).toBeLessThan(1.2)
  }
})
