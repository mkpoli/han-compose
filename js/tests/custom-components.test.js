import { describe, expect, it } from 'bun:test'
import { customAt, descriptionEnd, isCustom, parseDescription, writeDescription } from '../src/tree.js'
import { tokens } from '../src/tokens.js'
import { parseTree } from '../src/compose.js'

const arity = op => ({ '⿰': 2, '⿱': 2, '⿹': 2, '⿲': 3, '⿳': 3 })[op] ?? 0

describe('components no code point names', () => {
  it('reads each as one part, in its source spelling', () => {
    expect(parseDescription('⿹{53}一')).toEqual({ op: '⿹', parts: ['{53}', '一'] })
    expect(parseDescription('⿱&CDP-8BD0;心')).toEqual({ op: '⿱', parts: ['&CDP-8BD0;', '心'] })
    expect(parseDescription('⿱丿⿹#(-𠃌㇉)一')).toEqual({ op: '⿱', parts: ['丿', { op: '⿹', parts: ['#(-𠃌㇉)', '一'] }] })
    for (const text of ['⿹{53}一', '⿱&CDP-8BD0;心', '⿱丿⿹#(-𠃌㇉)一']) expect(writeDescription(parseDescription(text))).toBe(text)
  })
  it('still reads a chain the grammar names as its character', () => {
    expect(parseDescription('⿰#(H)木')).toEqual({ op: '⿰', parts: ['一', '木'] })
  })
  it('reads braces, & and # as characters where no custom component fits', () => {
    expect(parseDescription('⿳{1}')).toEqual({ op: '⿳', parts: ['{', '1', '}'] })
    expect(parseDescription('⿰{木')).toEqual({ op: '⿰', parts: ['{', '木'] })
    expect(() => parseDescription('⿰{5木')).toThrow(SyntaxError)
  })
  it('finds where a description with one ends', () => {
    expect(descriptionEnd([...'⿰{5}木と'])).toBe(5)
    expect(descriptionEnd([...'⿱&CDP-8BD0;心'])).toBe(12)
    expect(customAt([...'⿹{53}一'], 1)).toEqual({ text: '{53}', kind: 'numbered', end: 5 })
    expect(isCustom('#(-𠃌㇉)')).toBe(true)
    expect(isCustom('{53}一')).toBe(false)
  })
  it('hands the composer one component', () => {
    expect(parseTree('⿹{53}一', arity)).toEqual(['⿹', '{53}', '一'])
    expect(parseTree('⿱丿⿹#(-𠃌㇉)一', arity)).toEqual(['⿱', '丿', ['⿹', '#(-𠃌㇉)', '一']])
  })
})

describe('the tokens of a field holding one', () => {
  const texts = text => tokens(text).map(token => token.text)
  it('are one token for each custom component', () => {
    expect(texts('⿹{53}一')).toEqual(['⿹', '{53}', '一'])
    expect(texts('⿱丿⿹#(-𠃌㇉)一')).toEqual(['⿱', '丿', '⿹', '#(-𠃌㇉)', '一'])
    expect(texts('&CDP-8964;')).toEqual(['&CDP-8964;'])
    const [, entity] = tokens('⿱&CDP-8BD0;心')
    expect(entity).toMatchObject({ path: [0], start: 1, end: 11, tokenEnd: 11 })
  })
  it('follow the reading the description took', () => {
    expect(texts('⿳{1}')).toEqual(['⿳', '{', '1', '}'])
    expect(texts('⿰{5')).toEqual(['⿰', '{', '5'])
  })
})
