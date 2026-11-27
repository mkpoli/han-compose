import { expect, test } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { pathMask, pathRings, pointsBox, union } from '../src/geometry.js'
import { files, shards } from './fixtures/small-export.js'
// TW-Kai, format-7 export c14ee5e08798. The top counter closes in 官 and opens in standalone 㠯.
import glyphs from './fixtures/kai-guan.json' with { type: 'json' }

const current = '#(一-𠃍丨b一-𠃍)'
const historical = '#(丨𠃍一𠃍一^v,0>4,3v4)'
const source = (host = glyphs.官, commit, body = glyphs.㠯) => {
  const entries = body ? [['㠯', { G: body, ink: 4670.3, nl: 2, o: 2 }]] : []
  if (host) entries.push(['官', { G: host, ink: 6082.9, nl: 4, o: 4 }])
  const data = { ...files, ...shards('g', entries) }
  if (commit) data['manifest.json'] = JSON.stringify({ ...JSON.parse(data['manifest.json']), composer: { commit } })
  return createSource(async key => data[key] === undefined ? null : Uint8Array.from(Buffer.from(data[key])).buffer)
}

test('uses the two closed counters of Kai 官 for either spelling of its five-stroke body', async () => {
  for (const written of [current, historical]) {
    const options = { fontStyle: 'regular' }
    for (const separate of [false, true]) {
      const drawing = await compose(source(), written, { ...options, separate })
      expect(drawing.origins).toEqual([`chain ${current}, cut from 官`])
      expect(drawing.d.match(/M/g)).toHaveLength(3)
      const nested = await compose(source(), '⿰木' + written, { ...options, separate })
      expect(nested.origins).toContain(`chain ${current}, cut from 官`)
    }
  }
})

test('the widened Kai body retains its brush weight and rising upper bar', async () => {
  const drawing = await compose(source(glyphs.官, 'c14ee5e08798'), current, { fontStyle: 'regular' })
  const frame = union(pathRings(drawing.d, 48).map(pointsBox))
  expect(frame.map(edge => Math.round(edge * 10) / 10)).toEqual([75.7, -56, 930.6, 802.4])
  const mask = pathMask(drawing.d, 500)
  const column = x => Array.from({ length: 500 }, (_, y) => mask[y * 500 + x])
  const left = column(150), right = column(325)
  // Native 官 rises about 0.16 units per unit across its upper bar.
  const rise = (left.indexOf(1) - right.indexOf(1)) / 175
  expect(rise).toBeGreaterThan(0.14)
  expect(rise).toBeLessThan(0.18)
  const top = right.indexOf(1)
  expect(right.indexOf(0, top) - top).toBeGreaterThanOrEqual(19)
})

test('preserves the native encoded Kai 㠯 and uses it when the 官 cut cannot be verified', async () => {
  const options = { fontStyle: 'regular' }
  const encoded = await compose(source(), '㠯', options)
  expect(encoded.d.match(/M/g)).toHaveLength(2)
  for (const data of [source(null), source(glyphs.㠯)]) {
    const drawing = await compose(data, current, options)
    expect(drawing.origins).toEqual([`chain ${current}, glyph 㠯`])
  }
  const excluded = await compose(source(), historical, { ...options, exclude: ['官'] })
  expect(excluded.origins).toEqual([`chain ${historical}, glyph 㠯`])
})

test('an unregistered export uses its own freestanding Kai 㠯 frame for the closed cut', async () => {
  const data = source(), options = { fontStyle: 'regular' }
  const bounds = drawing => union(pathRings(drawing.d, 48).map(pointsBox))
  const native = await compose(data, current, { ...options, exclude: ['官'] })
  const originalInk = bounds(native)
  for (const key of [current, historical]) {
    const cut = await compose(data, key, options)
    expect(cut.d.match(/M/g)).toHaveLength(3)
    expect(cut.parts[0].box).toEqual(native.parts[0].box)
    expect(bounds(cut).every((edge, i) => Math.abs(edge - originalInk[i]) < 10)).toBe(true)
  }
  const cutOnly = await compose(source(glyphs.官, undefined, null), current, options)
  expect(cutOnly.origins).toEqual([`chain ${current}, cut from 官`])
  const [x, y, width, height] = cutOnly.parts[0].box
  expect(width).toBeGreaterThan(800)
  expect(height).toBeGreaterThan(850)
  expect(Math.abs(x + width / 2 - 500)).toBeLessThan(15)
  expect(Math.abs(y + height / 2 - 500)).toBeLessThan(15)
})

test('places both leaves of the written Kai 官 at the native size and weight', async () => {
  const data = source(), options = { fontStyle: 'regular' }
  for (const body of [current, historical, '㠯']) {
    const guan = '⿱宀' + body
    expect((await compose(data, guan, options)).d).toBe((await compose(data, '官', options)).d)
    for (const [key, owners] of [[guan, [0, 1]], ['⿰木' + guan, [0, 1, 2]]]) {
      const ordinary = await compose(data, key, options)
      const editable = await compose(data, key, { ...options, separate: true })
      expect(editable.parts.map(p => p.leaf)).toEqual(owners)
      expect(editable.origins.slice(-2)).toEqual(['宀 from 官', body + ' from 官'])
      expect(pathMask(editable.d, 256)).toEqual(pathMask(ordinary.d, 256))
      const boxes = await sketch(data, key, options)
      expect(boxes).toHaveLength(owners.length)
    }
  }
})
