import { expect, it } from 'bun:test'
import { componentParts } from '../src/component-forms.js'

it('preserves the 3 leaves of ⿲㇇丨𰛅 and honours donor exclusions', () => {
  for (const style of ["fangsong", "regular", "pen-writing"]) {
    const parts = componentParts('⿲㇇丨𰛅', undefined, style)
    expect(parts).toHaveLength(3)
    for (const donor of ['水', '丨']) {
      expect(componentParts('⿲㇇丨𰛅', undefined, style, true, new Set([donor]))).toBeNull()
    }
    expect(parts.every(p => p.target[1] >= -120 && p.target[3] <= 880)).toBe(true)
  }
  expect(componentParts('⿲㇇丨𰛅', undefined, 'sans')).toBeNull()
})
