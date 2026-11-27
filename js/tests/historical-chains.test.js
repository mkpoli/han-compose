import { expect, it } from 'bun:test'
import { canonicalHistoricalChain, historicalChainGraph, historicalChainReference, historicalNativeChar } from '../src/historical-chains.js'

it('normalizes attested historical joins, crossings, arcs and closure', () => {
  expect(canonicalHistoricalChain('#(𠃌㇉^)')).toBe('#(-𠃌㇉)')
  expect(canonicalHistoricalChain('#(丨一丨>v)')).toBe('#(丨b一-丨)')
  expect(canonicalHistoricalChain('#(𠃌𠃊^,0x1)')).toBe('#(-𠃌𠃊x0)')
  expect(canonicalHistoricalChain('#(丨𠃍一^v,0>2)')).toBe('#(-丨𠃍-一z)')
  expect(canonicalHistoricalChain('#(HPQaQbQcQd0205)')).toBe('#(㇇◝x4◞◟◜)')
  expect(canonicalHistoricalChain('#(SQbQcQdQaQbQaQbQa0004)')).toBe('#(丨x4◞◟◜◝◞◝◞◝)')
})

it('preserves unmatched and still-current spellings', () => {
  for (const spelling of ['#(-𠃌㇉)', '#(丨𠃍一>v)', '#(𠃌㇉>,0v9)', 'constructor']) {
    expect(canonicalHistoricalChain(spelling)).toBe(spelling)
  }
})

it('keeps historically distinct stroke graphs and explicit variant references', () => {
  expect(historicalChainGraph('#(丨𠃍一>v)')).toMatchObject({
    strokes: ['丨', '𠃍', '一'],
    joins: [[[0, 1], [1, 0]], [[1, 1], [2, 1]]],
    crossings: [],
    evidence: { host: '㠯' },
  })
  expect(historicalChainGraph('#(PHPHwg)')).toBeNull()
  expect(historicalChainReference('#(丿𠃍^)')?.key).toBe('⺆z')
  expect(historicalChainReference('#(丿乁^)')?.key).toBe('几n')
  expect(historicalChainReference('#(丨㇅𠃍丨一^v^>,0v4)')).toBeNull()
})

it('identifies unqualified standalone chains by their historical host', () => {
  expect(historicalNativeChar('#(PHPHwg)')).toBe('𠃉')
  expect(historicalNativeChar('#(丨𠃍一>v)')).toBeNull()
})
