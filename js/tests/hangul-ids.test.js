// A Hangul syllable as the description of its letters, and back: the editor's blocks draw from it.
import { describe, expect, it } from 'bun:test'
import { hangulIdsOf, hangulOfIds } from '../src/hangul-ids.js'
import { composeJamo, toConjoiningJamo } from '../src/hangul.js'

describe('Hangul as a description', () => {
  it('writes a syllable as its letters, and reads them back', () => {
    expect(hangulIdsOf('가')).toBe('⿰ㄱㅏ')
    expect(hangulIdsOf('공')).toBe('⿳ㄱㅗㅇ')
    expect(hangulOfIds('⿰ㄱㅏ')).toBe('가')
    expect(hangulOfIds('⿳ㄱㅗㅇ')).toBe('공')
    // A part written as a syllable joins in as its letters.
    expect(hangulOfIds('⿱아ㄶ')).toBe('않')
  })
  it('composes a run of jamo to the syllable it spells', () => {
    expect(composeJamo('라')).toBe('라')
    expect(composeJamo('각')).toBe('각')
    // Old Hangul does not precompose, so the run stays as it is.
    expect(composeJamo('아ᇫ')).toContain('ᇫ')
  })
  it('leaves a description that is no syllable alone', () => {
    expect(hangulOfIds('⿰木口')).toBeNull()
    expect(hangulOfIds('⿰ㄱ')).toBeNull()
  })
})

describe('what does not read as a syllable', () => {
  it('leaves a description with a slot to draw as written', () => {
    expect(hangulOfIds('⿰⬚⿰ㄱㅏ')).toBeNull()
    expect(hangulOfIds('⿰ㄱ')).toBeNull()
  })
  it('takes one letter at a time as a jamo', () => {
    expect(toConjoiningJamo('ㄱx', 'L')).toBeNull()
    expect(toConjoiningJamo('ㄱ', 'L')).toBe('\u1100')
  })
})
