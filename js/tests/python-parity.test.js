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

test('shares keeps a character’s own piece proportions when every operand comes from that character', () => {
  const host = {
    '雨\tT': [{ h: '雲', op: '⿱', ok: ['云'], d: 0, si: 100, v: 1, j: 1, wh: 1, b: [100, 600, 900, 900], fr: [100, 100, 900, 900], k: [0] }],
    '云\tB': [{ h: '雲', op: '⿱', ok: ['雨'], d: 0, si: 900, v: 1, j: 1, wh: 1, b: [100, 100, 900, 560], fr: [100, 100, 900, 900], k: [1] }],
  }
  const recs = {
    雨: { ...character('雨', [[100, 600, 900, 900]]), ink: 900 },
    云: { ...character('云', [[100, 100, 900, 560]]), ink: 100 },
    雲: { ...character('雲', [[100, 600, 900, 900], [100, 100, 900, 560]]), s: '⿱雨云' },
    '⿱雨云': { e: '雲' },
  }
  const c = new Composer({ manifest: { constants, spelled: [] }, layout: null,
    rec: key => recs[key] ?? null, hosts: (w, p) => host[`${w}\t${p}`] ?? [], places: () => [] })
  // Rain has 9x the ink of cloud, yet 雲 draws cloud taller (460 vs 300). Mapping into a 400-tall
  // region keeps cloud taller than rain instead of inverting them by ink share.
  const [rain, cloud] = c.shares('⿱', ['雨', '云'], [100, 0, 900, 400], false)
  expect(cloud.target[3] - cloud.target[1]).toBeGreaterThan(rain.target[3] - rain.target[1])
  // Unrelated sequences that happen to borrow from another host keep ink-share allocation.
  const other = { ...recs, '⿱雨云': { e: '零' } }
  const c2 = new Composer({ manifest: { constants, spelled: [] }, layout: null,
    rec: key => other[key] ?? null, hosts: (w, p) => host[`${w}\t${p}`] ?? [], places: () => [] })
  const [rain2, cloud2] = c2.shares('⿱', ['雨', '云'], [100, 0, 900, 400], false)
  expect(rain2.target[3] - rain2.target[1]).toBeGreaterThan(cloud2.target[3] - cloud2.target[1])
})
