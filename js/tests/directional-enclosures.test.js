import { expect, it } from 'bun:test'
import { derived, partOf, pathMask, pathRings, placed, pointsBox, svgPath, union } from '../src/geometry.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, shards } from './fixtures/small-export.js'
// Noto Serif CJK JP export b53713c2da0e. Sources and licence in docs/licensing.md.
import records from './fixtures/directional-enclosures.json' with { type: 'json' }

function source(overrides = {}) {
  const data = { ...files, ...shards('g', Object.entries({ ...records, ...overrides })) }
  return createSource(async key => data[key] === undefined ? null : new Uint8Array(Buffer.from(data[key])).buffer)
}

function normalized(path) {
  const rings = pathRings(path, 12)
  const [l, b, r, t] = union(rings.map(pointsBox))
  return rings.map(ring => ring.map((v, i) => i % 2 ? (v - b) / (t - b) : (v - l) / (r - l)))
}

const references = [
  ['⿵', '門', '日', '間'],
  ['⿹', '勹', '田', '甸'],
  ['⿸', '尸', '由', '届'],
  ['⿷', '匚', '甲', '匣'],
  ['⿴', '囗', '古', '固'],
  ['⿴', '囗', '口', '回'],
]
for (const [op, outer, held, host] of references) {
  const otherCandidates = { 甸: { 旬: {} }, 固: { 回: {} }, 回: { 固: {} } }
  const fixture = overrides => source({ ...otherCandidates[host], ...overrides })
  it(`places 自 inside ${outer} at its position in ${host}`, async () => {
    const ids = op + outer + '自', src = fixture(), face = { fontStyle: 'serif' }
    const record = records[host].G, glyph = partOf(record)
    const cut = char => derived(glyph, record.ls[char].map(i => glyph.contours[i]))
    const frameCut = cut(outer), innerBox = cut(held).box
    const frameOutline = normalized(svgPath([placed(frameCut, frameCut.box, frameCut.box, 1, host)]))
    const preview = await sketch(src, ids, face)
    const withoutCut = fixture({ [host]: { ...records[host], G: { ...records[host].G, ls: {} } } })
    for (const layout of ['composed', 'cells']) {
      const options = { ...face, separate: true, layout }
      const { d, parts } = await compose(src, ids, options)
      const original = await compose(withoutCut, ids, options)
      const bounds = path => union(pathRings(path, 32).map(pointsBox))
      const before = bounds(original.d)
      expect(Math.max(...bounds(d).map((edge, i) => Math.abs(edge - before[i])))).toBeLessThan(0.2)
      expect(parts).toHaveLength(2)
      const [frame, inner] = parts
      expect(frame.origin).toBe('host ' + host)
      if (layout === 'cells') expect([frame.leaf, inner.leaf]).toEqual([0, 1])
      else expect(parts.map(p => p.box)).toEqual(preview.map(p => p.box))
      const actual = normalized(frame.d)
      expect(actual.map(c => c.length)).toEqual(frameOutline.map(c => c.length))
      for (let i = 0; i < actual.length; i++) {
        expect(Math.max(...actual[i].map((v, j) => Math.abs(v - frameOutline[i][j])))).toBeLessThan(0.001)
      }
      const [x, y, width, height] = inner.box
      const [left, top, w, h] = frame.box
      const [l, b, r, t] = frameCut.box
      const cx = ((innerBox[0] + innerBox[2]) / 2 - l) / (r - l)
      const cy = (t - (innerBox[1] + innerBox[3]) / 2) / (t - b)
      expect(Math.abs((x + width / 2 - left) / w - cx)).toBeLessThan(0.01)
      expect(Math.abs((y + height / 2 - top) / h - cy)).toBeLessThan(0.01)
      const mask = pathMask(frame.d, 256)
      expect(pathMask(inner.d, 256).some((ink, i) => ink && mask[i])).toBe(false)
    }
  })

  it(`requires an eligible native cut of ${host} and preserves the original spelling`, async () => {
    const opts = { fontStyle: 'serif', separate: true }, ids = op + outer + '自'
    const record = records[host], plain = fixture(), excluded = { ...opts, exclude: [host] }
    const noLabels = fixture({ [host]: { ...record, G: { ...record.G, ls: {} } } })
    const fallback = await compose(noLabels, ids, opts)
    expect((await compose(plain, ids, excluded)).d).toBe(fallback.d)
    expect((await compose(plain, ids, opts)).d).not.toBe(fallback.d)
    const overlaps = { ...record.G.ls, [held]: record.G.ls[outer] }
    for (const glyph of [{ ...record.G, v: 0 }, { ...record.G, ls: overlaps }]) {
      const unverified = fixture({ [host]: { ...record, G: glyph } })
      expect((await compose(unverified, ids, opts)).d).toBe(fallback.d)
    }
    for (const native of [host, op + outer + held]) {
      expect((await compose(plain, native, opts)).d).toBe((await compose(noLabels, native, opts)).d)
    }
  })
}

it('gives an encoded whole glyph priority over the synthetic fit for its description', async () => {
  const ids = '⿵門自', encoded = '\uE001'
  const extra = { [ids]: { e: encoded }, [encoded]: { ...records.自, s: ids } }
  const src = source(extra), options = { fontStyle: 'serif' }
  const native = await compose(src, encoded, options)
  expect((await compose(src, ids, options)).d).toBe(native.d)
  const unlabeled = source({ ...extra, 間: { ...records.間, G: { ...records.間.G, ls: {} } } })
  for (const layout of ['cells', 'composed']) {
    const editable = { ...options, separate: true, layout }
    expect((await compose(src, ids, editable)).d).toBe((await compose(unlabeled, ids, editable)).d)
  }
})

for (const [ids, host, fallback] of [['⿹勹自', '旬', '甸'], ['⿸广自', '庙', null]]) {
  it(`uses the verified contours of unlabelled ${host} only for a matching outline`, async () => {
    const opts = { fontStyle: 'serif', separate: true }
    const { parts } = await compose(source(), ids, opts)
    expect(parts[0].origin).toBe('host ' + host)
    const record = records[host], glyph = partOf(record.G)
    const cut = derived(glyph, [4, 5, 6].map(i => glyph.contours[i]))
    const native = normalized(svgPath([placed(cut, cut.box, cut.box, 1, host)]))
    const actual = normalized(parts[0].d)
    expect(actual.map(c => c.length)).toEqual(native.map(c => c.length))
    for (let i = 0; i < actual.length; i++) {
      expect(Math.max(...actual[i].map((v, j) => Math.abs(v - native[i][j])))).toBeLessThan(0.001)
    }
    const nativeSpelling = await compose(source(), record.s, { fontStyle: 'serif' })
    expect(nativeSpelling.d).toBe((await compose(source(), host, { fontStyle: 'serif' })).d)
    for (const G of [{ ...record.G, p: record.G.p.toReversed() }, { ...record.G, v: 0 }]) {
      const changed = await compose(source({ [host]: { ...record, G } }), ids, opts)
      expect(changed.parts[0].origin).not.toBe('host ' + host)
      if (fallback) expect(changed.parts[0].origin).toBe('host ' + fallback)
    }
  })
}

it('retains the ink bounds of a nested enclosure in its parent region', async () => {
  const ids = '⿰口⿵門自'
  const missing = { 間: { ...records.間, G: { ...records.間.G, ls: {} } } }
  for (const layout of ['composed', 'cells']) {
    const options = { fontStyle: 'serif', separate: true, layout }
    const latest = await compose(source(), ids, options)
    const original = await compose(source(missing), ids, options)
    expect(latest.parts.map(part => part.origin)).toContain('host 間')
    const extent = parts => union(parts.slice(1).flatMap(p => pathRings(p.d, 32).map(pointsBox)))
    const before = extent(original.parts)
    expect(Math.max(...extent(latest.parts).map((v, i) => Math.abs(v - before[i])))).toBeLessThan(0.2)
  }
})
