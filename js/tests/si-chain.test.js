import { expect, test } from 'bun:test'
import { fill, pathMask, pathRings, pointsBox, union } from '../src/geometry.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { SI_CHAIN, siBendDonor } from '../src/si-chain.js'
import faces from './fixtures/si-chain.json'
import metrics from '../src/chain-ink-metrics.json'
import { character, files, records, shards } from './fixtures/small-export.js'

// Native 巳 and bend donors from the published font exports. The figure in
// parentheses at 統外字登記 row 579 is the reference for the upper counter.
// https://rare.glyphatlas.org/en/entry/3156#sighting-3322
function sourceFor(glyphs, commit) {
  const native = Object.fromEntries(Object.entries(glyphs).map(([char, G]) => [char, { G, o: G.p.length, ink: 7000 }]))
  const inputs = { ...records, 一: character('一', [[100, 350, 900, 420]]),
    𠃍: character('𠃍', [[100, 740, 900, 800], [840, 0, 900, 800]]), ...native }
  const data = { ...files, ...shards('g', Object.entries(inputs)) }
  if (commit) data['manifest.json'] = JSON.stringify({ ...JSON.parse(files['manifest.json']), composer: { commit } })
  return createSource(async name => data[name] === undefined ? null : Uint8Array.from(Buffer.from(data[name])).buffer)
}

// Centers of uninterrupted ink spans along a cross-section, as fractions of ink extent.
function inkCenters(size, filled) {
  const centers = []
  let start
  for (let i = 0; i <= size; i++) {
    if (i < size && filled(i)) start ??= i
    else if (start !== undefined) {
      centers.push((start + i) / (2 * size))
      start = undefined
    }
  }
  return centers
}

for (const [fontStyle, glyphs] of Object.entries(faces)) {
  test(`${fontStyle} joins the counter of 巳 and removes its hook`, async () => {
    const source = sourceFor(glyphs)
    const draw = (text, options) => compose(source, text, { fontStyle, ...options })
    const size = 128
    const host = await draw('巳'), chain = await draw(SI_CHAIN)
    expect(chain.parts[0].box).toEqual(host.parts[0].box)
    const native = pathMask(host.d, size), revised = pathMask(chain.d, size)
    const rings = pathRings(chain.d, 48)
    const normalized = fill(rings, size, union(rings.map(pointsBox)))
    const bars = inkCenters(size, y => normalized[y * size + Math.round(0.45 * size)])
    const walls = inkCenters(size, x => normalized[Math.round(0.23 * size) * size + x])
    expect(bars).toHaveLength(3)
    expect(walls).toHaveLength(2)
    expect(bars[1]).toBeGreaterThan(0.35)
    expect(bars[1]).toBeLessThan(0.405)
    expect(walls[1]).toBeGreaterThan(0.735)
    expect(walls[1]).toBeLessThan(0.805)
    expect(revised.some((pixel, i) => i % size < size / 2 && i >= 0.78 * size * size && pixel !== native[i])).toBe(true)
    const hasHook = mask => mask.some((ink, i) => {
      const x = (i % size) / size, y = Math.floor(i / size) / size
      return ink && x > 0.84 && y > 0.60 && y < 0.80
    })
    expect(hasHook(native)).toBe(true)
    expect(hasHook(revised)).toBe(false)
    for (const ids of [`⿰口${SI_CHAIN}`, `⿱口${SI_CHAIN}`, `⿰${SI_CHAIN}口`]) {
      expect((await draw(ids)).origins).toContain(`glyph ${SI_CHAIN}`)
    }
    expect((await draw(`⿰口${SI_CHAIN}`, { layout: 'cells' })).origins).toContain(`cells ${SI_CHAIN} (glyph ${SI_CHAIN})`)
    for (const char of ['一', '𠃍', '㇄']) await expect(draw(SI_CHAIN, { exclude: [char] })).rejects.toThrow(SI_CHAIN)
    for (const donor of ['巳', siBendDonor(fontStyle)]) {
      const fallback = draw(SI_CHAIN, { exclude: [donor] })
      if (fontStyle === 'fangsong') await expect(fallback).rejects.toThrow(SI_CHAIN)
      else expect((await fallback).origins).toEqual(Array(3).fill(`chain ${SI_CHAIN}`))
    }
  })
}

test('falls back to the constituent strokes when either cut has a different contour revision', async () => {
  for (const char of ['巳', '匸']) {
    const original = faces.sans[char]
    const changed = { ...original, p: [...original.p, original.p[0]] }
    const source = sourceFor({ ...faces.sans, [char]: changed })
    expect((await compose(source, SI_CHAIN)).origins).toEqual(Array(3).fill(`chain ${SI_CHAIN}`))
  }
})

test('keeps the recorded standalone ink frame and single editable chain in all five exports', async () => {
  const versions = { sans: 'a83fc941166b', serif: '8156f838798c', fangsong: '9f797e2322d2',
    regular: 'c14ee5e08798', 'pen-writing': 'ce3eaafda8f9' }
  for (const [fontStyle, commit] of Object.entries(versions)) {
    const source = sourceFor(faces[fontStyle], commit)
    const normal = await compose(source, SI_CHAIN, { fontStyle })
    const edited = await compose(source, SI_CHAIN, { fontStyle, separate: true })
    const box = union(pathRings(normal.d, 64).map(pointsBox))
    expect(edited.d).toEqual(normal.d)
    expect(edited.parts).toHaveLength(1)
    expect(await sketch(source, SI_CHAIN, { fontStyle })).toHaveLength(1)
    for (const [i, edge] of box.entries()) expect(Math.abs(edge - metrics[commit][SI_CHAIN][i])).toBeLessThan(0.16)
  }
})
