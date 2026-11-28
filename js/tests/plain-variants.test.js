import { describe, expect, it } from 'bun:test'
import { hasVariationSelector, plainBase, plainVariantSource } from '../src/plain-variants.js'
import { traitKey, traitsOf } from '../src/source.js'

const PLAIN = '丑\u{E0100}'
const OWN = '者\u{E0101}'

/** A source holding records for `keys` alone, each marked with its key. @param {string[]} keys */
const holding = keys => ({
  manifest: { constants: {} }, layout: null,
  ready: async () => {}, load: async () => {}, modelFiles: () => [], filesOf: names => new Set(names),
  store: () => ({
    manifest: {}, layout: null, missing: new Set(),
    rec: key => keys.includes(key) ? { k: key } : null,
    identity: () => undefined, hosts: () => [], places: () => [],
  }),
})

describe('sequences a face draws with its plain glyph', () => {
  it('are the ones Noto registers that way, in Sans and Serif alone', () => {
    expect(plainBase(PLAIN, 'sans')).toBe('丑')
    expect(plainBase(PLAIN, 'serif')).toBe('丑')
    expect(plainBase(OWN, 'sans')).toBeNull()
    for (const style of ['fangsong', 'regular', 'pen-writing']) expect(plainBase(PLAIN, style)).toBeNull()
    expect(hasVariationSelector(`⿰${PLAIN}口`)).toBe(true)
    expect(hasVariationSelector('⿰丑口')).toBe(false)
  })

  it('draw from the base record where the export has none of their own', async () => {
    const source = plainVariantSource({ fallback: holding(['丑', OWN, '者']), style: 'sans' })
    await source.ready()
    const store = source.store()
    expect(store.rec(PLAIN)).toEqual({ k: '丑' })
    expect(store.rec(OWN)).toEqual({ k: OWN })
    expect([...source.filesOf([PLAIN, '口'])]).toEqual([PLAIN, '口', '丑'])
  })

  it('keep a record of their own when the export holds one', () => {
    const store = plainVariantSource({ fallback: holding([PLAIN, '丑']), style: 'sans' }).store()
    expect(store.rec(PLAIN)).toEqual({ k: PLAIN })
  })

  it('stay missing in a face that registers none', () => {
    const store = plainVariantSource({ fallback: holding(['丑']), style: 'fangsong' }).store()
    expect(store.rec(PLAIN)).toBeNull()
  })

  it('read the export through their own source, whatever was drawn before', () => {
    // The worker keeps one source per trait set: a sequence without a selector must not hand a
    // plain sequence the source that lacks its base records.
    expect(traitKey(traitsOf('⿱⺌月'))).not.toBe(traitKey(traitsOf('⿱⺌月\u{E0100}')))
  })
})
