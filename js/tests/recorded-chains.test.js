import { expect, test } from 'bun:test'
import { recordedChainEvidence, recordedChainNative } from '../src/recorded-chains.js'
import { keyOf, parseTree } from '../src/compose.js'
import { arity } from '../src/tree.js'
import inventory from '../src/recorded-chains.json' with { type: 'json' }

test('retains the encoded glyph of an unambiguous exact complete description', () => {
  expect(recordedChainNative('#(H)')?.char).toBe('一')
  const simplified = '⿱丿⿹⿴#(-𠃌㇉)丶山'
  const tree = parseTree(simplified, arity)
  expect(recordedChainNative(keyOf(tree))?.char).toBe('岛')
  expect(recordedChainNative('⿱丿⿹⿷⿴#(一-𠃍丨b𠃌)一一山')?.char).toBe('島')
  expect(recordedChainNative(simplified)?.source.url).toEndWith('/ids_lv0.txt#L3740')
})

test('requires an exact default description with a single possible encoded host', () => {
  expect(recordedChainNative('#(-丨𠃍-一z)')).toBeNull()
  expect(recordedChainNative('#(T)')).toBeNull()
  expect(recordedChainNative('#(-𠃌㇉)')).toBeNull()
  expect(recordedChainNative('⿰又⿱丿⿹⿴#(-𠃌㇉)丶灬')).toBeNull()
  expect(recordedChainNative('⿱丿⿹⿴#(-𠃌㇉)丶.山')).toBeNull()
})

test('keeps historical-only spellings and exact guide glyph citations', () => {
  expect(Object.keys(inventory.chains)).toHaveLength(436)
  expect(Object.values(inventory.chains).filter(chain => chain[2].length)).toHaveLength(219)
  const historical = recordedChainEvidence('#(DP)')
  expect(historical?.levels).toEqual([])
  expect(historical?.firstCommit).toStartWith('b0bd3edb')
  expect(historical?.lastCommit).toStartWith('052b09b3')
  expect(recordedChainEvidence('#(-𠃌㇉)')?.guide.codePoints).toEqual(['U+E00A'])
})
