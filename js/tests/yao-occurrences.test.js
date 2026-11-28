import { expect, test } from 'bun:test'
import { yaoCharacters, yaoDecomposition, yaoOccurrences, selectYao } from '../src/yao-occurrences.js'

const returning = '&VR-5E7A-03;'
const folded = '&VR-5E7A-02;'
const detached = '幺󠄀'

test('two 幺 in a single encoded operand can be changed independently and reopened', () => {
  const sites = yaoOccurrences('𦈁')
  expect(sites.map(s => s.path)).toEqual([[0,1,0], [1,1,1]])
  expect(selectYao('𦈁', sites[0].path, null)).toBe('𦈁')
  const one = selectYao('𦈁', sites[1].path, 'detached')
  expect(one).toBe('⿰𦃃⿳亠⿴{11}' + detached + '十')
  const two = selectYao(one, sites[0].path, 'returning')
  expect(two).toBe('⿰⿱𠂹⿱' + returning + '小⿳亠⿴{11}' + detached + '十')
  expect(yaoOccurrences(selectYao(two, sites[1].path, null)).map(s => s.form)).toEqual(['returning',null])
  expect(yaoOccurrences('⿰幽絲')).toHaveLength(4)
})

test('only the selected occurrence changes in saved or incomplete IDS', () => {
  const old = '&GW-u5e7a-g;'
  const draft = '⿳⬚⿻[:1]幼' + old + '𦈁'
  expect(selectYao(draft, [1,0,0], 'folded')).toBe('⿳⬚⿻[:1]⿰' + folded + '力' + old + '𦈁')
  expect(selectYao(draft, [1,1], 'folded')).toBe('⿳⬚⿻[:1]幼' + folded + '𦈁')
  expect(selectYao('⿰幼〮幺', [0,0], 'detached')).toBe('⿰⿰' + detached + '力〮幺')
  expect(selectYao('幺́', [], 'returning')).toBe(returning + '́')
  expect(yaoOccurrences('⿰㇯玄幺幽').map(s => s.path)).toEqual([[1,1,0],[1,1,1]])
  expect(yaoOccurrences('⿰ 幺')).toEqual([])
  expect(yaoOccurrences('幼󠄂')).toEqual([])
  expect(() => selectYao(draft, [0], null)).toThrow(RangeError)
  expect(() => selectYao(draft, [1,1], 'not-a-form')).toThrow(RangeError)
})

test('source-numbered parts, newer reviewed compounds and qualified side strokes remain addressable', () => {
  expect(yaoDecomposition('{29}')).toMatchObject({ids:'⿻弋𢆶'})
  expect(yaoOccurrences('機')).toHaveLength(2)
  expect(yaoOccurrences('𳅀')).toHaveLength(1)
  expect(yaoDecomposition('糸')).toMatchObject({ids:'⿱幺小',regions:'GHT'})
  expect(yaoOccurrences('率󠄁').map(s => s.form)).toEqual(['detached'])
  expect(selectYao('率󠄁',[1,0,1],'folded')).toBe('⿱亠⿱⿲𰀪' + folded + '⺀十')
})

test('every indexed character discovers a site, including those with multiple nested repetitions', () => {
  expect(yaoCharacters.length).toBeGreaterThan(3400)
  expect(new Set(yaoCharacters).size).toBe(yaoCharacters.length)
  for (const ch of yaoCharacters) {
    const sites = yaoOccurrences(ch)
    expect(sites.length).toBeGreaterThan(0)
    expect(new Set(sites.map(s => s.path.join('.'))).size).toBe(sites.length)
  }
})
