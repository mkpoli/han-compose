import { expect, test } from 'bun:test'
import { pathMask } from '../src/geometry.js'
import { compose, createSource } from '../src/loader.js'
import { SI_CHAIN } from '../src/si-chain.js'
import faces from './fixtures/si-chain.json'
import { character, files, records, shards } from './fixtures/small-export.js'

// Native 巳 and terminal outlines, from the versioned exports at
// https://ids-input-composer.mkpoli.workers.dev/ (Sans 0bd3ee83a5e2, Regular c14ee5e08798,
// Serif, Fangsong and Pen-writing b53713c2da0e). The printed straight-foot form is in
// https://rare.glyphatlas.org/en/entry/3156
function sourceFor(glyphs) {
  const native = Object.fromEntries(Object.entries(glyphs).map(([char, G]) => [char, { G, o: G.p.length, ink: 7000 }]))
  const inputs = { ...records, 一: character('一', [[100, 350, 900, 420]]),
    𠃍: character('𠃍', [[100, 740, 900, 800], [840, 0, 900, 800]]), ...native }
  const data = { ...files, ...shards('g', Object.entries(inputs)) }
  return createSource(async name => data[name] === undefined ? null : Uint8Array.from(Buffer.from(data[name])).buffer)
}

for (const [fontStyle, glyphs] of Object.entries(faces)) {
  test(`${fontStyle} joins the counter of 巳 and removes its hook`, async () => {
    const source = sourceFor(glyphs)
    const draw = (text, options) => compose(source, text, { fontStyle, ...options })
    const size = 128
    const host = await draw('巳'), chain = await draw(SI_CHAIN)
    expect(chain.parts[0].box).toEqual(host.parts[0].box)
    const native = pathMask(host.d, size), revised = pathMask(chain.d, size)
    // The cap is the only change to the silhouette. The entire upper half,
    // including the counter and both ends of the middle bar, stays identical.
    expect(revised.slice(0, size * 64)).toEqual(native.slice(0, size * 64))
    const hasHook = mask => mask.some((ink, i) => {
      const x = (i % size) / size, y = Math.floor(i / size) / size
      return ink && x > 0.84 && y > 0.60 && y < 0.80
    })
    expect(hasHook(native)).toBe(true)
    expect(hasHook(revised)).toBe(false)
    for (const ids of [`⿰口${SI_CHAIN}`, `⿱口${SI_CHAIN}`, `⿰${SI_CHAIN}口`]) {
      expect((await draw(ids)).origins).toContain(`glyph ${SI_CHAIN}`)
    }
    expect((await draw(`⿰口${SI_CHAIN}`, { layout: 'cells' })).origins).toContain(`cells ${SI_CHAIN}`)
    for (const char of ['一', '𠃍', '㇄']) await expect(draw(SI_CHAIN, { exclude: [char] })).rejects.toThrow(SI_CHAIN)
    const fallback = draw(SI_CHAIN, { exclude: ['巳'] })
    if (fontStyle === 'fangsong') {
      await expect(fallback).rejects.toThrow(SI_CHAIN)
      await expect(draw(SI_CHAIN, { exclude: ['匚'] })).rejects.toThrow(SI_CHAIN)
    } else expect((await fallback).origins).toEqual(Array(3).fill(`chain ${SI_CHAIN}`))
  })
}

test('falls back to the constituent strokes when either cut has a different contour revision', async () => {
  for (const char of ['巳', '㇄']) {
    const original = faces.sans[char]
    const changed = { ...original, p: [...original.p, original.p[0]] }
    const source = sourceFor({ ...faces.sans, [char]: changed })
    expect((await compose(source, SI_CHAIN)).origins).toEqual(Array(3).fill(`chain ${SI_CHAIN}`))
  }
})
