import { expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { character, constants } from './fixtures/small-export.js'

const composer = (style, record, exclude = []) => new Composer({
  manifest: { constants, spelled: [] }, rec: () => record, hosts: () => [], places: () => [],
}, { fontStyle: style, exclude })

it('uses brush components when a FangSong export has only a fallback glyph', () => {
  const record = character('⺀', [[0, 0, 300, 300]])
  record.G.v = 0
  expect(composer('fangsong', record).glyphRecord('⺀').p).toHaveLength(2)
  expect(composer('fangsong', record, ['冬']).glyphRecord('⺀')).toBeNull()
  expect(composer('fangsong', record).glyphRecord('山')).toBeNull()
  expect(composer('regular', record).glyphRecord('⺀')).toBe(record.G)
  record.G.v = 1
  expect(composer('fangsong', record).glyphRecord('⺀')).toBe(record.G)
})
