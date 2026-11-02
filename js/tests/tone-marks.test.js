// A Middle Korean tone mark names the tone of the syllable it follows and stays on it, inside a
// longer description as well as at its end.
import { describe, expect, it } from 'bun:test'
import { splitToneMarks, toneMarksAt, isToneMark, parseDescription } from '../src/tree.js'

describe('tone marks', () => {
  it('reads the marks that follow a syllable, and the mark itself', () => {
    expect(isToneMark('\u302E')).toBe(true)
    expect(isToneMark('\u302F')).toBe(true)
    expect(isToneMark('\u0301')).toBe(false)
    expect(toneMarksAt(['가', '\u302E', '\u302F', '나'], 1)).toBe(3)
    expect(splitToneMarks('가\u302E\u302F')).toEqual({ rest: '가', tones: '\u302E\u302F' })
    expect(splitToneMarks('가')).toEqual({ rest: '가', tones: '' })
  })
  it('keeps each mark on the syllable it follows in a description', () => {
    const tree = parseDescription('⿰가\u302E나\u302F')
    expect(tree.parts[0]).toBe('가\u302E')
    expect(tree.parts[1]).toBe('나\u302F')
  })
})
