import { expect, test } from 'bun:test'
import { Composer } from '../src/compose.js'
import { fullFormFamilies, fullFormOf, fullFormText } from '../src/full-forms.js'
import { createVariationRegistry } from '../src/variation-registry.js'
import { character, constants } from './fixtures/small-export.js'

const FULL = '&HC-u91d1-full;'
const whole = [[100, 0, 900, 60], [100, 700, 900, 760], [470, 0, 530, 760]]
const narrow = [[100, 0, 400, 60], [220, 0, 280, 760]]
const cut = (h, boxes) => { const { G, ink } = character(h, boxes); return { h, op: '⿰', ok: ['木'], si: ink, d: 0, j: 1, v: 1, b: G.b, p: G.p } }
const hosts = { 'L\t金': [cut('鈢', narrow), cut('鉢', narrow)] }
const records = {
  木: character('木', [[100, -60, 900, 0], [470, -80, 530, 820]]),
  金: { ...character('金', whole), P: ['L'], s: '⿱人王' },
}
const composer = new Composer({ manifest: { constants, spelled: [] }, layout: null,
  rec: key => records[key] ?? null, hosts: (key, place) => hosts[`${place}\t${key}`] ?? [], places: () => [] })

test('an entity names the character it writes in full, and no other entity does', () => {
  expect(fullFormText('金')).toBe(FULL)
  expect(fullFormOf(FULL)).toBe('金')
  expect(fullFormOf(fullFormText('𥫗'))).toBe('𥫗')
  expect(fullFormOf('&CDP-8BD0;')).toBe(null)
  expect(fullFormOf('金')).toBe(null)
})

test('a component written in full has its character\'s outline and none of its hosts', () => {
  const record = composer.rec(FULL)
  expect(record.G).toBe(records.金.G)
  expect(record.s).toBeUndefined()
  expect(record.P).toBeUndefined()
  expect(composer.hostsOf(FULL, 'L')).toEqual([])
  expect(composer.hostsOf('金', 'L').map(h => h.h)).toEqual(['鈢', '鉢'])
  expect(composer.rec('&HC-u6c34-full;')).toBe(null)
})

test('on the left the plain component is cut from a host and the full one is its own glyph', () => {
  const origins = sequence => composer.compose(sequence).map(part => part.origin)
  expect(origins('⿰金木')[0]).toMatch(/^host /)
  expect(origins(`⿰${FULL}木`)[0]).toBe(`glyph ${FULL}`)
})

test('each positional form is a family with the forms and the full component, in its place', () => {
  const registry = createVariationRegistry(fullFormFamilies)
  const family = registry.familiesFor('金').find(f => f.id === 'full/L/金')
  expect(family.place).toBe('L')
  expect(family.forms.map(form => [form.text, form.traits.form])).toEqual([['釒', 'positional'], [FULL, 'full']])
  // The plain component leaves the form to the composer.
  expect(registry.at('⿰金皮', [0]).find(hit => hit.family === family).forms).toEqual([])
  const saved = registry.select('⿰金皮', [0], 'full/L/金', 'full')
  expect(saved).toBe(`⿰${FULL}皮`)
  expect(registry.at(saved, [0]).find(hit => hit.family === family).forms.map(form => form.id)).toEqual(['full'])
  expect(registry.select(saved, [0], 'full/L/金', '釒')).toBe('⿰釒皮')
  // 艸 on top has three forms in the table, 食 on the left two.
  expect(registry.familiesFor('艸').find(f => f.id === 'full/T/艸').forms.length).toBe(4)
})
