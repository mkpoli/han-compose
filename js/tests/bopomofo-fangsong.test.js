import { expect, it } from 'bun:test'
import { bopomofoSource } from '../src/bopomofo.js'
import { onlyBundled } from '../src/local.js'

it('uses native Zhuyin before the paired brush face', async () => {
  const native = { G: { v: 1 } }, paired = { G: { v: 1, fixed: true } }
  const fallback = { ready: async () => {}, store: () => ({ rec: () => native }) }
  const source = bopomofoSource({ style: 'fangsong', fallback, load: async () => ({ fangsong: { 'ㄙ': paired } }) })
  await source.ready()
  expect(source.store().rec('ㄙ')).toBe(native)
  native.G.v = 0
  expect(source.store().rec('ㄙ')).toBe(paired)
  expect(onlyBundled('ㆸ', false, false, 'fangsong')).toBeFalse()
  expect(onlyBundled('ㄙ', false, false, 'fangsong')).toBeTrue()
})
