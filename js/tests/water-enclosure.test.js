import { expect, it } from 'bun:test'
import { componentParts } from '../src/component-forms.js'

it('preserves the 2 leaves of ⿺水巜 and honours donor exclusions', () => {
  for (const style of ["fangsong", "regular", "pen-writing", "serif"]) {
    const parts = componentParts('⿺水巜', undefined, style)
    expect(parts).toHaveLength(2)
    for (const donor of ['水', style === 'fangsong' ? '巛' : '巜']) {
      expect(componentParts('⿺水巜', undefined, style, true, new Set([donor]))).toBeNull()
    }
    expect(parts.every(p => p.target[1] >= -120 && p.target[3] <= 880)).toBe(true)
  }
  expect(componentParts('⿺水巜', undefined, 'sans')).toBeNull()
})
