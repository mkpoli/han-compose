import { expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { clearHookContacts } from '../src/directional-enclosures.js'
import { fill, groupRings, partOf, placed, pathMask, pathRings, pointsBox, union } from '../src/geometry.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { character, files, shards } from './fixtures/small-export.js'
// Noto Serif CJK JP export b53713c2da0e. Sources and licence in docs/licensing.md.
import records from './fixtures/directional-enclosures.json' with { type: 'json' }
// Zhuque Fangsong b53713c2da0e (OFL), 勹・百・訇.
import fangsong from './fixtures/fangsong-hook-bai.json' with { type: 'json' }

function source(box = [0.15, -0.03, 0.70, 0.55], extra = {}) {
  // A fixed layout prediction makes the learned opening reproducible. The PUA
  // glyph has the identical 百 outline and follows the ordinary placement.
  const model = JSON.parse(files['layout.json'])
  model.seeds[0][1] = Buffer.from(Float32Array.from([0.05, -0.06, 0.94, 0.84, ...box]).buffer).toString('base64')
  const data = { ...files, 'layout.json': JSON.stringify(model), ...shards('g',
    Object.entries({ ...records, '\uE000': records.百, '\uE001': records.自,
      'ˊ': character('ˊ', [[740, 640, 790, 760]]), ...extra })) }
  return createSource(async name => data[name] === undefined ? null : Uint8Array.from(Buffer.from(data[name])).buffer)
}

const options = { fontStyle: 'serif', separate: true }
const bounds = d => union(pathRings(d, 32).map(pointsBox))
function overlap(parts) {
  const [outer, inner] = parts.map(p => pathMask(p.d, 256))
  return inner.reduce((total, pixel, i) => total + (pixel & outer[i]), 0) /
    inner.reduce((total, pixel) => total + pixel, 0)
}

it('clears overlapping 百 while retaining its frame, stroke contours and nearly all its size', async () => {
  const src = source()
  const baseline = await compose(src, '⿹勹\uE000', options)
  const after = await compose(src, '⿹勹百', options)
  expect(overlap(baseline.parts)).toBeGreaterThan(0.01)
  expect(overlap(after.parts)).toBe(0)
  expect(after.parts[0].d).toBe(baseline.parts[0].d)
  expect(bounds(after.d)).toEqual(bounds(baseline.d))
  const before = bounds(baseline.parts[1].d), revised = bounds(after.parts[1].d)
  const sx = (revised[2] - revised[0]) / (before[2] - before[0])
  const sy = (revised[3] - revised[1]) / (before[3] - before[1])
  expect(sx).toBeGreaterThan(0.949)
  expect(sx).toBeLessThan(1.001)
  expect(Math.abs(sx - sy)).toBeLessThan(0.001)
  const oldRings = pathRings(baseline.parts[1].d, 8), newRings = pathRings(after.parts[1].d, 8)
  expect(newRings.map(r => r.length)).toEqual(oldRings.map(r => r.length))
  for (const [i, ring] of newRings.entries()) {
    expect(Math.max(...ring.map((v, j) =>
      Math.abs(v - revised[j % 2] - (oldRings[i][j] - before[j % 2]) * sx)))).toBeLessThan(0.3)
  }
  expect((await sketch(source(), '⿹勹百', options))[1].box).toEqual(after.parts[1].box)
})

it('keeps ordinary positioning for clear ink and other directions', async () => {
  const src = source([0.29, 0.2, 0.67, 0.49])
  for (const [seq, control] of [['⿹勹百', '⿹勹\uE000'], ['⿵門自', '⿵門\uE001']]) {
    for (const layout of ['cells', 'composed']) {
      const opts = { ...options, layout }
      expect((await compose(src, seq, opts)).d).toBe((await compose(src, control, opts)).d)
    }
  }
})

it('sketches the moved leaf beside a loose mark and leaves missing outlines editable', async () => {
  const marked = await compose(source(), '⿹勹百ˊ', options)
  expect(marked.origins).toContain('mark ˊ')
  const before = await compose(source(), '⿹勹\uE000ˊ', options)
  expect(marked.parts[0].d).toBe(before.parts[0].d)
  expect(marked.parts.at(-1).d).toBe(before.parts.at(-1).d)
  expect((await sketch(source(), '⿹勹百ˊ', options))[1].box).toEqual(marked.parts[1].box)
  expect(await sketch(source(undefined, { 百: {} }), '⿹勹百', options)).toHaveLength(2)
})

it('retains an encoded whole glyph and its editable decomposition', async () => {
  const src = source(undefined, { '⿹勹百': { e: '\uE002' }, '\uE002': { ...records.口, s: '⿹勹百' } })
  const plain = { fontStyle: 'serif' }
  expect((await compose(src, '⿹勹百', plain)).d).toBe((await compose(src, '\uE002', plain)).d)
  const other = source(undefined, { '⿹勹\uE000': { e: '\uE002' }, '\uE002': { ...records.口, s: '⿹勹\uE000' } })
  expect((await compose(src, '⿹勹百', options)).d).toBe((await compose(other, '⿹勹\uE000', options)).d)
})

const hookBox = [0.12, -0.07, 0.70, 0.49]
const fangsongOptions = { fontStyle: 'fangsong', separate: true }

it('retains the full 百 inside the native 勹 of 訇 when the ordinary hook cannot clear it', async () => {
  const src = source(hookBox, fangsong)
  const original = await compose(src, '⿹勹百', { ...fangsongOptions, exclude: ['訇'] })
  const after = await compose(src, '⿹勹百', fangsongOptions)
  expect(overlap(original.parts)).toBeGreaterThan(0.01)
  expect(after.origins).toEqual(['host 訇', 'glyph 百'])
  expect(overlap(after.parts)).toBe(0)
  expect(Math.max(...bounds(after.parts[0].d).map((v, i) => Math.abs(v - bounds(original.parts[0].d)[i])))).toBeLessThan(0.2)
  const before = pathRings(original.parts[1].d), revised = pathRings(after.parts[1].d)
  const dx = revised[0][0] - before[0][0], dy = revised[0][1] - before[0][1]
  expect(revised.map(r => r.length)).toEqual(before.map(r => r.length))
  for (const [i, ring] of revised.entries()) {
    expect(Math.max(...ring.map((v, j) => Math.abs(v - before[i][j] - (j % 2 ? dy : dx))))).toBeLessThan(0.21)
  }
  const preview = await sketch(source(hookBox, fangsong), '⿹勹百', fangsongOptions)
  expect(preview.map(p => p.box)).toEqual(after.parts.map(p => p.box))
  const donor = fangsong.訇
  for (const G of [{ ...donor.G, v: 0 }, { ...donor.G, p: donor.G.p.toReversed() }]) {
    const other = source(hookBox, { ...fangsong, 訇: { ...donor, G } })
    expect((await compose(other, '⿹勹百', fangsongOptions)).d).toBe(original.d)
  }
  for (const opts of [{ ...options }, { ...fangsongOptions, layout: 'cells' }]) {
    expect((await compose(src, '⿹勹百', opts)).d).toBe((await compose(src, '⿹勹百', { ...opts, exclude: ['訇'] })).d)
  }
})

it('declines a wider hook stroke when it would meet a neighbouring mark', async () => {
  const src = source(hookBox, fangsong)
  await compose(src, '⿹勹百', fangsongOptions)
  const draw = new Composer(src.store(), fangsongOptions)
  const original = new Composer(src.store(), { ...fangsongOptions, exclude: ['訇'] }).compose('⿹勹百')
  const revised = draw.compose('⿹勹百')
  const [l, b, r, t] = bounds((await compose(src, '⿹勹百', fangsongOptions)).d)
  // The public path coordinates run down from the ascent.
  const frame = [l, 880 - t, r, 880 - b], size = 128
  const mask = parts => fill(groupRings(parts), size, frame)
  const previous = mask(original), hook = mask([revised[0]])
  const index = hook.findIndex((ink, i) => ink && !previous[i])
  expect(index).toBeGreaterThanOrEqual(0)
  const x = l + (index % size + 0.5) * (r - l) / size
  const y = frame[3] - (Math.floor(index / size) + 0.5) * (t - b) / size
  const dot = partOf(character('點', [[x - 2, y - 2, x + 2, y + 2]]).G)
  const parts = [...original, placed(dot, dot.box, dot.box, 1, 'mark 點')]
  clearHookContacts(draw, parts)
  expect(parts[0].origin).toBe(original[0].origin)
  expect(parts[0].origin).not.toBe('host 訇')
})
