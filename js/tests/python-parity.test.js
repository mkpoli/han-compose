import { expect, test } from 'bun:test'
import { Composer } from '../src/compose.js'
import { character, constants } from './fixtures/small-export.js'

const box = [[100, 0, 900, 800]]
const records = {
  口: character('口', box), 南: character('南', box), 艹: character('艹', box), 勹: character('勹', box),
  喃: { ...character('喃', box), s: '⿰口南' },
  '⿰口南': { e: '喃' },
  𬞑: { ...character('𬞑', box), s: '⿱艹喃' },
  '⿱艹喃': { e: '𬞑' },
}
const composer = new Composer({ manifest: { constants, spelled: [], rooms: { '⿹\t勹': [0.2, 0.1, 0.8, 0.7] } }, layout: null,
  rec: key => records[key] ?? null, hosts: () => [], places: () => [] })

test('an operand that spells a drawn character is read as that character', () => {
  expect(composer.joined(['⿱', '艹', ['⿰', '口', '南']])).toEqual(['⿱', '艹', '喃'])
  expect(composer.joined(['⿱', '艹', ['⿰', '南', '口']])).toEqual(['⿱', '艹', ['⿰', '南', '口']])
  expect(composer.joined('喃')).toBe('喃')
})

test('a character written with an operand spelled out is drawn as its glyph', () => {
  expect(composer.compose('⿱艹⿰口南').map(part => part.origin)).toEqual(['glyph 𬞑'])
})

test('an enclosed part stays in the room of an enclosing part cut from a host', () => {
  const cut = [{ origin: 'learned 匐', target: [0, 0, 1000, 1000] }]
  // A box hanging out of the foot is moved up into the room, at its own size.
  expect(composer.keptRoom('⿹', '勹', cut, [300, -100, 700, 300])).toEqual([300, 100, 700, 500])
  // One larger than the room shrinks about its centre first.
  const shrunk = composer.keptRoom('⿹', '勹', cut, [0, 0, 1000, 1000])
  expect(shrunk[2] - shrunk[0]).toBeCloseTo(600)
  expect(shrunk[3] - shrunk[1]).toBeCloseTo(600)
  // No room where the enclosing part is its own glyph, or the export lists none for it.
  expect(composer.keptRoom('⿹', '勹', [{ origin: 'glyph 勹', target: [0, 0, 1000, 1000] }], [300, -100, 700, 300])).toBe(null)
  expect(composer.keptRoom('⿴', '囗', cut, [300, -100, 700, 300])).toBe(null)
})

test('layout prediction falls back to a positional form with table entries in that place', () => {
  const zero = Array.from({ length: 71 }, () => 0)
  const rows = 1 + 2 * 81, data = new Float32Array(rows * 8)
  data[1 * 8 + 0] = 1
  data[(1 + 81) * 8 + 4] = 1
  const layout = {
    ops: ['⿰'],
    shape: 71,
    defaults: { L: [0, 0, 500, 800], R: [500, 0, 1000, 800] },
    // Single linear seed whose first output reads operand 0's mean x0, and fifth reads operand 1's mean x0.
    seeds: [[{ w: { rows, cols: 8, data }, b: new Float32Array(8) }]],
  }
  const recs = {
    金: { ...character('金', box), a: { L: ['釒'] }, o: 8, f: zero },
    釒: { ...character('釒', box), u: { L: [[40, 0, 420, 800], [10, 5, 15, 5], 324] }, o: 8, f: zero },
    言: { ...character('言', box), e: '訁', u: { R: [[460, 0, 960, 800], [10, 5, 15, 5], 10] }, o: 7, f: zero },
    訁: { ...character('訁', box), u: { L: [[45, 0, 445, 800], [12, 9, 27, 4], 222] }, o: 5, f: zero },
  }
  const c = new Composer({ manifest: { constants, spelled: [] }, layout,
    rec: key => recs[key] ?? null, hosts: () => [], places: () => [] })
  // 金 on the left falls back to 釒's usual L box; 言 on the right keeps 言's usual R box despite e: 訁.
  const [left, right] = c.predict('⿰', ['金', '言'])
  expect(left[0]).toBeCloseTo(40, 3)
  expect(right[0]).toBeCloseTo(460, 3)
})
