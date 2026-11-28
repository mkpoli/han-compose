import { expect, it } from 'bun:test'
import { componentParts } from '../src/component-forms.js'
import { Composer } from '../src/compose.js'
import { character, constants } from './fixtures/small-export.js'

const composer = (style, record, exclude = []) => new Composer({
  manifest: { constants, spelled: [] }, rec: () => record, hosts: () => [], places: () => [],
}, { fontStyle: style, exclude })

it('uses brush components when a FangSong export has only a fallback glyph', () => {
  const record = { ...character('⺀', [[0, 0, 300, 300]]), P: ['B'] }
  record.G.v = 0
  expect(composer('fangsong', record).glyphRecord('⺀').p).toHaveLength(2)
  expect(composer('fangsong', record, ['冬']).glyphRecord('⺀')).toBeNull()
  expect(composer('fangsong', record).glyphRecord('歺').p).toHaveLength(1)
  expect(composer('fangsong', record, ['粲']).glyphRecord('歺')).toBeNull()
  expect(composer('fangsong', record).glyphRecord('厃').p).toHaveLength(2)
  expect(composer('fangsong', record, ['詹']).glyphRecord('厃')).toBeNull()
  expect(composer('fangsong', record).glyphRecord('山')).toBeNull()
  expect(composer('regular', record).glyphRecord('⺀')).toBe(record.G)
  record.G.v = 1
  expect(composer('fangsong', record).glyphRecord('⺀')).toBe(record.G)
})

it('expands 𢀛 to ⿱工口 when an export lacks a record for it', () => {
  const pen = composer('pen-writing', null)
  expect(pen.sequenceOf('𢀛')).toBe('⿱工口')
  expect(pen.writtenOut('𢀛')).toEqual(['⿱', '工', '口'])
})

it('draws ⿴𰀪⺀ as two native stroke groups in FangSong and Regular and honours donor exclusion', () => {
  for (const style of ['fangsong', 'regular']) {
    const parts = componentParts('⿴𰀪⺀', undefined, style)
    expect(parts).toHaveLength(2)
    expect(parts[0].part.contours).toHaveLength(2)
    expect(parts[1].part.contours).toHaveLength(2)
    expect(componentParts('⿴𰀪⺀', undefined, style, true, new Set(['彡']))).toBeNull()
    expect(componentParts('⿴𰀪⺀', undefined, style, true, new Set(['冬']))).toBeNull()
  }
})

it('does not split a bare CJK stroke via sweptUnder', () => {
  const stroke = { ...character('㇉', [[100, 0, 200, 800], [100, 0, 800, 300]]) }
  const serif = new Composer({
    manifest: { constants, spelled: [] },
    layout: { ops: ['⿺'] },
    rec: key => key === '㇉' ? stroke : null,
    hosts: () => [],
    places: () => [],
  }, { fontStyle: 'serif' })
  const outer = [{ origin: 'glyph ㇉', part: serif.glyph('㇉'), source: [100, 0, 800, 800], target: [100, 0, 800, 800], native: 1000 }]
  expect(serif.sweptUnder(['㇉', '一'], outer, [0, 0, 1000, 1000])).toBeNull()
})

it('keeps 足 connected between 矢 and 隹 in ⿻足⿰矢隹 and under 五 in ⿱五⿻足⿰矢隹', () => {
  const records = {
    五: character('五', [[100, 100, 900, 800]]),
    足: character('足', [[100, 0, 900, 800]]),
    矢: character('矢', [[100, 100, 800, 800]]),
    隹: character('隹', [[100, 100, 800, 800]]),
  }
  const c = new Composer({
    manifest: { constants, spelled: [] }, rec: key => records[key] ?? null, hosts: () => [], places: () => [],
  }, { fontStyle: 'sans' })
  const parts = c.compose('⿱五⿻足⿰矢隹')
  expect(parts).toHaveLength(4)
  const [five, foot, arrow, bird] = parts
  expect(five.target[1]).toBeGreaterThan(foot.target[3] - 10)
  expect(arrow.target[2]).toBeLessThan(bird.target[0])
  expect(foot.target[0]).toBeLessThan(arrow.target[2])
  expect(foot.target[2]).toBeGreaterThan(bird.target[0])
  expect(foot.target[1]).toBeLessThan(arrow.target[1])
})
