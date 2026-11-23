import { expect, test } from 'bun:test'
import { Composer } from '../src/compose.js'
import { character, constants } from './fixtures/small-export.js'

const SELECTOR = '\u{E0101}'
// 禺's two shapes as boxes: a frame, and with the sequence a bar crossing its left side.
const plain = [[200, 0, 260, 800], [740, 0, 800, 800], [200, 740, 800, 800]]
const crossed = [[200, 0, 260, 800], [740, 0, 800, 800], [200, 740, 800, 800], [0, 300, 260, 400]]
const cut = (h, boxes) => { const { G, ink } = character(h, boxes); return { h, op: '⿰', ok: ['木'], si: ink, d: 0, j: 1, v: 1, b: G.b, p: G.p } }
const hosts = { 'R\t禺': [cut('偶', plain), cut('湡', crossed.map(([a, b, c, d]) => [a + 5, b, c + 5, d]))] }
const records = {
  木: character('木', [[100, -60, 900, 0], [470, -80, 530, 820]]),
  禺: { ...character('禺', plain), f: [1, 2, 3], u: { R: [[0, 0, 1, 1], [1, 1, 1, 1], 9] }, P: ['R'], s: '⿻日禸' },
  ['禺' + SELECTOR]: character('禺', crossed),
  // A sequence the export records a layout of its own for.
  ['木' + SELECTOR]: { ...character('木', plain), f: [9] },
}
const composer = new Composer({ manifest: { constants, spelled: [] }, layout: null,
  rec: key => records[key] ?? null, hosts: (key, place) => hosts[`${place}\t${key}`] ?? [], places: () => [] })

test('a variation sequence is laid out as its base in its own outline, and spells no description', () => {
  const record = composer.rec('禺' + SELECTOR)
  expect(record.f).toEqual([1, 2, 3])
  expect(record.u).toEqual(records.禺.u)
  expect(record.G).toBe(records['禺' + SELECTOR].G)
  expect(record.o).toBe(4)
  expect(record.s).toBeUndefined()
})

test('a sequence with a layout of its own keeps it, and one the export lacks has no record', () => {
  expect(composer.rec('木' + SELECTOR).f).toEqual([9])
  expect(composer.rec('禺\u{E0102}')).toBe(null)
})

test('a variation sequence takes the cuts of its own shape alone', () => {
  const key = '禺' + SELECTOR, entries = composer.hostsOf('禺', 'R')
  expect(entries.map(h => h.h)).toEqual(['偶', '湡'])
  expect(composer.variantEntries(key, '禺', entries).map(h => h.h)).toEqual(['湡'])
  expect(composer.variantCuts(key, '禺', entries.map(h => [false, 0, h])).map(([, , h]) => h.h)).toEqual(['湡'])
  expect(composer.hostsOf(key, 'R')).toEqual([])
})

test('only the first cuts are read, so a part held by hundreds loads few hosts', () => {
  let read = 0
  const entries = Array.from({ length: 50 }, () => [false, 0, hosts['R\t禺'][0]])
  const counting = Object.assign(Object.create(composer), { pieceOf: h => { read++; return composer.pieceOf(h) } })
  expect(counting.variantCuts('禺' + SELECTOR, '禺', entries)).toEqual([])
  expect(read).toBe(12)
})
