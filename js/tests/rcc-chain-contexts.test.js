import { expect, it } from 'bun:test'
import { rccChainContextParts, rccChainDonors } from '../src/rcc-chain-contexts.js'

const tiger = '⿱⺊⿸#(-乛丿)노'
const horse = '⿱⿷#(-一丨b𠃌)𰀁乙'
const em = [0, -120, 1000, 880]

it('derives donors only for the two RCC spellings in the faces that need them', () => {
  expect(rccChainDonors(tiger, 'fangsong')).toEqual(['虍', '丨', '一', '丄'])
  expect(rccChainDonors(horse, 'fangsong')).toEqual(['馬', '乙'])
  expect(rccChainDonors(horse, 'regular')).toEqual(['馬', '乙'])
  expect(rccChainDonors(tiger, 'regular')).toEqual([])
  expect(rccChainDonors(horse, 'serif')).toEqual([])
  expect(rccChainDonors('⿷#(-一丨b𠃌)𰀁', 'fangsong')).toEqual([])
})

it('rejects an excluded donor or operand before fetching contextual outlines', () => {
  for (const [key, excluded] of [[tiger, '虍'], [tiger, '노'], [horse, '𠃌'], [horse, '𰀁']]) {
    const composer = {
      fontStyle: 'fangsong',
      excluded: char => char === excluded,
      glyphRecord: () => { throw new Error('unexpected donor lookup') },
    }
    expect(rccChainContextParts(composer, key, em)).toBeNull()
  }
})

it('requires the recorded donor outline and its own face', () => {
  for (const v of [0, 1]) {
    const composer = { fontStyle: 'fangsong', excluded: () => false, glyphRecord: () => ({ v, p: [] }) }
    expect(rccChainContextParts(composer, horse, em)).toBeNull()
  }
})
