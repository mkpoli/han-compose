import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { hasBundledGlyph } from '../src/bundled-coverage.js'
import { bundledSource } from '../src/bundled.js'
import { onlyBundled } from '../src/local.js'
import coverage from '../data/palette/bundled-coverage.json' with { type: 'json' }
import { hasTangut } from '../src/tangut.js'
import { hasBopomofo } from '../src/bopomofo.js'
import { hasSmallSeal } from '../src/small-seal.js'
import { hasShuishu } from '../src/shuishu.js'
import { hasJurchen } from '../src/jurchen.js'

it('indexes the exact scalar outlines in each dedicated bundle', () => {
  for (const name of ['tangut', 'bopomofo', 'small-seal', 'shuishu', 'jurchen']) {
    const { records } = JSON.parse(gunzipSync(readFileSync(new URL(`../data/sources/${name}/outlines.json.gz`, import.meta.url))))
    const points = Object.entries(records).filter(([key, rec]) => [...key].length === 1 && rec.G?.p?.length).map(([key]) => key.codePointAt(0)).sort((a, b) => a - b)
    const ranges = []
    for (const cp of points) {
      const last = ranges.at(-1)
      if (last && cp === last[1] + 1) last[1] = cp
      else ranges.push([cp, cp])
    }
    expect(coverage[name]).toEqual(ranges)
    for (const [first, last] of ranges) {
      expect(hasBundledGlyph(name, String.fromCodePoint(first))).toBe(true)
      expect(hasBundledGlyph(name, String.fromCodePoint(last))).toBe(true)
    }
    expect(points.flatMap(cp => [cp - 1, cp + 1]).filter(cp => cp >= 0 && cp <= 0x10FFFF && !ranges.some(([a, b]) => cp >= a && cp <= b)).every(cp => !hasBundledGlyph(name, String.fromCodePoint(cp)))).toBe(true)
    expect(hasBundledGlyph(name, '⿰')).toBe(false)
  }
})

it('does not claim missing Tangut, Small Seal or variation sequences work offline', () => {
  for (const sequence of [String.fromCodePoint(0x18D09), String.fromCodePoint(0x18D80), String.fromCodePoint(0x3FC3F), String.fromCodePoint(0x1B4E6), '𗀀\u{E0100}']) {
    expect(onlyBundled(sequence)).toBe(false)
  }
  expect(onlyBundled('⿰𗀀𗀁')).toBe(true)
})

it('lets absent bundled keys reach the fallback with their host metadata', async () => {
  const native = { G: { p: [[1]] } }, fallbackRecord = { G: { p: [[2]] } }
  const calls = []
  const fallback = { ready: async () => {}, filesOf: keys => { calls.push(keys); return new Set(keys) },
    load: async () => {}, store: () => ({ rec: () => fallbackRecord, hosts: () => ['host'], places: () => ['L'], missing: new Set() }) }
  const source = bundledSource({ load: async () => ({ records: { '𗀀': native } }), matches: () => true, fallback })
  await source.ready()
  source.filesOf(['𗀀', '𘶀'])
  expect(calls).toEqual([['𘶀']])
  const store = source.store()
  expect(store.rec('𗀀')).toBe(native)
  expect(store.rec('𘶀')).toBe(fallbackRecord)
  expect(store.hosts('𘶀', 'L')).toEqual(['host'])
  expect(store.places('𘶀')).toEqual(['L'])
})

it('keeps every indexed bundle glyph inside its bundle matcher', () => {
  const matchers = { tangut: hasTangut, bopomofo: hasBopomofo, 'small-seal': hasSmallSeal, shuishu: hasShuishu, jurchen: hasJurchen }
  for (const [name, ranges] of Object.entries(coverage)) {
    for (const [first, last] of ranges) for (let cp = first; cp <= last; cp++) {
      expect(matchers[name](String.fromCodePoint(cp))).toBe(true)
    }
  }
})
