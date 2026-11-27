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
