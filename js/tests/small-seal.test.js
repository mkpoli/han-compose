import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { smallSealSource } from '../src/small-seal.js'
import { onlyBundled } from '../src/local.js'
import { compose } from '../src/loader.js'

const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../../data/sources/small-seal/outlines.json.gz', import.meta.url))))
const chars = Object.keys(outlines.records)
const jade = String.fromCodePoint(0x3D06D)
const sequence = `⿰${jade}${jade}`

it('draws supported seal glyphs locally, including edited descriptions and empty slots', async () => {
  const source = smallSealSource({ load: async () => outlines })
  expect(chars.length).toBeGreaterThan(1000)
  expect(onlyBundled(sequence)).toBe(true)
  expect(onlyBundled(`⿰${jade}木`)).toBe(false)
  const exact = await compose(source, sequence)
  expect(exact.d.length).toBeGreaterThan(100)
  const edited = await compose(source, `⿱${jade}${jade}`)
  expect(edited.d.length).toBeGreaterThan(100)
  expect(edited.d).not.toBe(exact.d)
  const partial = await compose(source, `⿰${jade}⬚`)
  expect(partial.slots).toHaveLength(1)
  for (const char of chars.slice(0, 200)) expect(onlyBundled(char)).toBe(true)
  await expect(compose(source, `⿰${jade}${String.fromCodePoint(0x3FC3F)}`)).rejects.toThrow()
})
