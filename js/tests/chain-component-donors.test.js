import { expect, test } from 'bun:test'
import { fitNestedHostChains, hostChainParts, hostContextParts } from '../src/host-chain.js'
import { centre, derived, fill, partOf, pathMask, pathRings, placed, pointsBox, rings, svgPath, union } from '../src/geometry.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { documentSource } from '../src/document-source.js'
import { constants, files, shards } from './fixtures/small-export.js'
// Format-7 outlines from the five published faces.
import records from './fixtures/chain-component-donors.json' with { type: 'json' }

test('both isolated spellings of the flat turn keep the native size and weight of 乐 in every face', async () => {
  const key = '#(丿𠃊)', face = constants.face
  const commits = { sans: 'a83fc941166b', serif: '8156f838798c', regular: 'c14ee5e08798',
    fangsong: '9f797e2322d2', 'pen-writing': 'ce3eaafda8f9' }
  for (const [fontStyle, commit] of Object.entries(commits)) {
    const G = records[fontStyle].乐
    const composer = { fontStyle, excluded: () => false, glyphRecord: () => G }
    const [{ part }] = hostChainParts(composer, key, face, false)
    const from = centre(part.box), to = centre(face)
    const centered = part.box.map((edge, i) => edge + to[i % 2] - from[i % 2])
    const reference = svgPath([placed(part, part.box, centered, 1, 'native 乐')])
    const input = { ...files, ...shards('g', [['乐', { G }]]) }
    input['manifest.json'] = JSON.stringify({ ...JSON.parse(input['manifest.json']), composer: { commit } })
    const source = createSource(async name => input[name] ? Uint8Array.from(Buffer.from(input[name])).buffer : null)
    for (const written of [key, '#(丿𠃊>)']) for (const layout of ['auto', 'cells']) for (const separate of [false, true]) {
      const drawing = await compose(source, written, { fontStyle, layout, separate })
      expect(drawing.d).toBe(reference)
    }
    const aspect = path => {
      const [left, bottom, right, top] = union(pathRings(path, 64).map(pointsBox))
      return (right - left) / (top - bottom)
    }
    for (const layout of ['auto', 'cells']) {
      const narrow = await compose(source, key, { fontStyle, layout, face: [0, 0, 500, 900] })
      expect(aspect(narrow.d)).toBeCloseTo(aspect(reference), 2)
    }
  }
})

test('draws both spellings of three missing FangSong components as editable native outlines', async () => {
  const input = { ...files, ...shards('g', Object.entries(records.fangsong).map(([ch, G]) => [ch, { G }])) }
  const source = createSource(async key => input[key] ? Uint8Array.from(Buffer.from(input[key])).buffer : null)
  for (const [component, host, current, historical, count] of [
    ['㠯', '官', '#(一-𠃍丨b一-𠃍)', '#(丨𠃍一𠃍一^v,0>4,3v4)', 3],
    ['㔾', '氾', '#(-𠃌乚)', '#(𠃌乚^)', 1],
    ['⺆', '周', '#(-丿𠃌)', '#(丿𠃌^)', 1],
  ]) {
    for (const key of [current, historical]) {
      const normal = await compose(source, key, { fontStyle: 'fangsong' })
      const editable = await compose(source, key, { fontStyle: 'fangsong', separate: true })
      expect(normal.origins).toEqual([`chain ${current}, cut from ${host}`])
      expect(editable.d).toBe(normal.d)
      expect(editable.parts).toHaveLength(1)
      expect(normal.d.match(/M/g)).toHaveLength(count)
    }
    const mock = { fontStyle: 'fangsong', glyphRecord: () => records.fangsong[host] }
    for (const blocked of [component, host]) {
      expect(hostChainParts({ ...mock, excluded: ch => ch === blocked }, current, [0, 0, 1000, 1000], false)).toBeNull()
    }
  }
})

test('keeps the FangSong stems at native weight when standalone components fill their recorded boxes', () => {
  const face = [0, -120, 1000, 880]
  const composer = { fontStyle: 'fangsong', C: { face }, data: { manifest: { composer: { commit: '9f797e2322d2' } } },
    glyphRecord: ch => records.fangsong[ch], excluded: ch => ch === '木', exclude: new Set(['木']) }
  for (const key of ['#(一-𠃍丨b一-𠃍)', '#(-𠃌乚)']) {
    const parts = hostChainParts(composer, key, face, true)
    const mask = pathMask(svgPath(parts), 500)
    // The row through the upper opening crosses the left stem and the right fold.
    const bands = Array.from(mask.slice(140 * 500, 141 * 500)).join('').match(/1+/g)
    expect(bands).toHaveLength(2)
    for (const band of bands) {
      expect(band.length).toBeGreaterThanOrEqual(27)
      expect(band.length).toBeLessThanOrEqual(31)
    }
  }
})

test('preserves the foot and stem proportions of 乐 in nested slots', async () => {
  const key = '#(丿𠃊)', input = { ...files, ...shards('g', [['乐', { G: records.sans.乐 }]]) }
  // Compare placement at the same master in the donor and both layouts.
  input['manifest.json'] = JSON.stringify({ ...JSON.parse(input['manifest.json']), heavy: 400 })
  const source = createSource(async name => input[name] ? Uint8Array.from(Buffer.from(input[name])).buffer : null)
  const ratio = contours => {
    const box = union(contours.map(pointsBox)), size = 300
    const mask = fill(contours, size, box)
    const start = size * (size / 2)
    const stem = mask.subarray(start, start + size).reduce((n, ink) => n + ink, 0) * (box[2] - box[0]) / size
    const foot = pointsBox(contours.at(-1))
    return (foot[3] - foot[1]) / stem
  }
  const host = partOf(records.sans.乐), native = [1, 4, 5].map(i => host.contours[i])
  const expected = ratio(rings(native, native.map(c => c.light)))
  for (const layout of ['auto', 'cells']) for (const ids of ['⿰' + key + '木', '⿲木' + key + '木']) {
    const { parts } = await compose(source, ids, { layout })
    const frame = parts.find(p => p.origin.includes('cut from 乐'))
    expect(frame).toBeDefined()
    expect(Math.abs(ratio(pathRings(frame.d)) / expected - 1)).toBeLessThan(0.08)
  }
})

test('keeps the FangSong 㔾 bowl centered under its inner hook as it changes width', () => {
  const key = '#(-𠃌乚)', face = [0, -120, 1000, 880]
  const composer = { fontStyle: 'fangsong', C: { face }, data: { manifest: { composer: { commit: '9f797e2322d2' } } },
    excluded: () => false, glyphRecord: () => records.fangsong.氾 }
  const glyph = partOf(records.fangsong.氾), bowl = derived(glyph, [glyph.contours[0]])
  const reference = placed(bowl, bowl.box, bowl.box, 1, 'native')
  const bottom = (part, weight) => {
    const [ring] = pathRings(svgPath([{ ...part, weight: [weight, weight] }]), 40)
    const [left, low, right] = pointsBox(ring)
    const i = ring.findIndex((v, i) => i % 2 === 1 && v === low)
    return (ring[i - 1] - left) / (right - left)
  }
  for (const [box, root] of [[face, true], [[0, -120, 190, 880], false], [[0, -120, 940, 480], false]]) {
    const parts = hostChainParts(composer, key, box, root)
    fitNestedHostChains(parts)
    for (const weight of [0, 0.5, 1]) expect(Math.abs(bottom(parts[0], weight) - bottom(reference, weight))).toBeLessThan(0.015)
    // Anisotropic fitting of the horizontal strokes must preserve the length of the return on the inner hook.
    for (const master of ['light', 'heavy']) {
      const outline = parts[0].part.contours[0][master], native = bowl.contours[0][master]
      expect(outline[2 * 31] - outline[2 * 39]).toBeCloseTo(native[2 * 31] - native[2 * 39], 6)
    }
  }
})

test('keeps the three FangSong water strokes and the 㔾 bowl in their native positions in 氾', async () => {
  const current = '#(-𠃌乚)', historical = '#(𠃌乚^)'
  const options = { fontStyle: 'fangsong' }, face = [0, -120, 1000, 880]
  const input = { ...files, ...shards('g', [['氾', { G: records.fangsong.氾, ink: 6687.1, nl: 4, o: 4 }]]) }
  const source = createSource(async name => input[name] === undefined ? null : Uint8Array.from(Buffer.from(input[name])).buffer)
  const native = await compose(source, '氾', options)
  for (const body of [current, historical, '㔾']) {
    const compound = '⿰氵' + body
    expect((await compose(source, compound, options)).d).toBe(native.d)
    const editable = await compose(source, compound, { ...options, separate: true })
    expect(editable.parts.map(p => [p.leaf, p.origin, p.d.match(/M/g).length])).toEqual([
      [0, '氵 from 氾', 3], [1, body + ' from 氾', 1],
    ])
    expect(pathMask(editable.d, 256)).toEqual(pathMask(native.d, 256))
    const root = { id: 'fan', kind: 'operator', op: '⿰', children: [
      { id: 'water', kind: 'component', char: '氵' }, { id: 'body', kind: 'component', char: body },
    ] }
    expect(documentSource({ root }, editable, await sketch(source, compound, options)).complete).toBe(true)
    const strokeInputs = [current, '⿰氵' + current, '𠃌', '乚']
    const blockedInputs = body === '㔾' ? [] : strokeInputs
    for (const blocked of [compound, body, '氾', '氵', '㔾', ...blockedInputs]) {
      const mock = { fontStyle: 'fangsong', excluded: char => char === blocked, glyphRecord: () => records.fangsong.氾 }
      expect(hostContextParts(mock, compound, face)).toBeNull()
    }
  }
  const direct = await compose(source, '⿰氵㔾', { ...options, separate: true, exclude: [current, '⿰氵' + current, '𠃌', '乚'] })
  expect(direct.origins).toEqual(['氵 from 氾', '㔾 from 氾'])
  const repeated = '⿰⿰氵' + current + '⿰氵' + historical
  const normal = await compose(source, repeated, options)
  const editable = await compose(source, repeated, { ...options, separate: true })
  expect(editable.parts.map(p => p.leaf)).toEqual([0, 1, 2, 3])
  expect(pathMask(editable.d, 256)).toEqual(pathMask(normal.d, 256))
  const unverified = { fontStyle: 'fangsong', excluded: () => false, glyphRecord: () => records.fangsong.官 }
  expect(hostContextParts(unverified, '⿰氵' + current, face)).toBeNull()
})
