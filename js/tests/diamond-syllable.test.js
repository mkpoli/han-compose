import { expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { constants } from './fixtures/small-export.js'

const store = { manifest: { constants, spelled: [] }, rec: () => null, hosts: () => [], places: () => [] }
const syllable = ['⿱', ['⿰', '◇', 'ㅏ'], 'ㄴ']

it('keeps three editable parts in the diamond syllable and honors the Hangul donor exclusion', () => {
  const options = { fontStyle: 'fangsong' }
  const parts = new Composer(store, options).diamondSyllable(syllable, constants.face)
  expect(parts.map(p => p.origin)).toEqual(['Zhuque ◇', 'Gowun Batang ㅏ', 'Gowun Batang ㄴ'])
  for (const donor of ['안', '◇', 'ㅏ', 'ㄴ']) {
    expect(new Composer(store, { ...options, exclude: [donor] }).diamondSyllable(syllable, constants.face)).toBeNull()
  }
})
